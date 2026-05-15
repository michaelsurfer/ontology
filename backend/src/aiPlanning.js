import { runSparqlSkill, tryChatJson } from './sparqlSkill.js'
import { getPlannerSystemPrompt } from './aiPlanningSettings.js'
import {
  PLANNER_FINALIZE_PROMPT_APPEND,
  PLANNER_SYNTHESIS_RUNTIME_APPEND,
} from './aiPlanningDefaults.js'

const QUERY_GRAPH_ACTION_ALIASES = new Set([
  'query_graph',
  'request_ontology_facts',
  'ontology_facts',
  'request_facts',
  'query_ontology',
  'graph_query',
  'retrieve_facts',
  'sparql_query',
  'fetch_graph',
])

const COMPLETE_ACTION_ALIASES = new Set(['complete', 'finish', 'done', 'final_answer'])

/* Map mistaken action strings from the model to canonical query_graph or complete. */
function normalizePlannerDecisionAction(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return parsed
  }
  const raw = String(parsed.action || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  let canonical = parsed.action
  if (QUERY_GRAPH_ACTION_ALIASES.has(raw)) {
    canonical = 'query_graph'
  } else if (COMPLETE_ACTION_ALIASES.has(raw)) {
    canonical = 'complete'
  }
  if (canonical === parsed.action) {
    return parsed
  }
  return { ...parsed, action: canonical }
}

/**
 * Planning agent loop: repeatedly chooses NL graph queries (via SPARQL skill) until it emits a plan.
 * Uses planner_system_prompt from ai_planning_settings (getPlannerSystemPrompt).
 */
export async function runPlanningAgent({
  openAiClient,
  userGoal,
  baseIri,
  schemaContext,
  exportOptions,
  maxIterations,
  model: modelOverride,
}) {
  if (!openAiClient) {
    throw new Error('OpenAI is not configured')
  }

  const normalizedGoal = String(userGoal || '').trim()
  if (!normalizedGoal) {
    throw new Error('userGoal is required')
  }

  const model = String(modelOverride || process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  const maxIter = Math.min(Math.max(Number(maxIterations) || 5, 1), 10)
  const trace = []

  for (let iteration = 1; iteration <= maxIter; iteration += 1) {
    const plannerPayload = {
      iteration,
      max_iterations: maxIter,
      user_goal: normalizedGoal,
      prior_query_results: trace.map((step) => ({
        step: step.step,
        question: step.question,
        reason: step.reason,
        ok: step.ok,
        error: step.error,
        row_count: step.rowCount,
        rows_sample: step.rowsSample,
        sparql_notes: step.sparqlNotes,
      })),
    }

    const parsed = normalizePlannerDecisionAction(
      await requestPlannerDecision({
        openAiClient,
        model,
        plannerPayload,
      }),
    )

    if (!parsed) {
      return buildFailure({
        model,
        trace,
        error: 'Planner returned invalid or empty JSON.',
      })
    }

    if (parsed.action === 'complete') {
      return {
        ok: true,
        model,
        planText: String(parsed.plan || '').trim() || '(empty plan)',
        caveats: parsed.caveats ? String(parsed.caveats).trim() : '',
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map((item) => String(item)) : [],
        trace,
        iterations: iteration,
        stoppedReason: 'complete',
      }
    }

    if (parsed.action === 'query_graph') {
      const question = String(parsed.question || '').trim()
      if (!question) {
        trace.push({
          step: iteration,
          question: '',
          reason: parsed.reason || '',
          ok: false,
          error: 'empty_question',
          rowCount: 0,
          rowsSample: [],
          sparqlText: '',
          sparqlNotes: '',
          executionTimeMs: 0,
        })
        continue
      }

      const skillResult = await runSparqlSkill({
        openAiClient,
        questionText: question,
        sparqlText: null,
        baseIri,
        schemaContext,
        exportOptions,
      })

      const rowsSample = Array.isArray(skillResult.rows) ? skillResult.rows.slice(0, 40) : []

      trace.push({
        step: iteration,
        question,
        reason: parsed.reason ? String(parsed.reason) : '',
        ok: skillResult.ok,
        error: skillResult.ok ? null : skillResult.error,
        rowCount: Array.isArray(skillResult.rows) ? skillResult.rows.length : 0,
        rowsSample,
        sparqlText: skillResult.sparqlText,
        sparqlNotes: skillResult.sparqlNotes || '',
        executionTimeMs: skillResult.executionTimeMs,
      })
      continue
    }

    return buildFailure({
      model,
      trace,
      error: `Unknown action: ${String(parsed.action)}`,
    })
  }

  const finalized = await forceCompletePlan({
    openAiClient,
    model,
    userGoal: normalizedGoal,
    trace,
  })

  if (finalized) {
    return {
      ok: true,
      model,
      planText: finalized.planText,
      caveats: finalized.caveats,
      assumptions: finalized.assumptions,
      trace,
      iterations: maxIter,
      stoppedReason: 'max_iterations_force_complete',
    }
  }

  return buildFailure({
    model,
    trace,
    error: 'max_iterations_reached',
    partialPlanHint: 'Increase max_iterations or narrow the goal.',
  })
}

/* Combine DB/default planner prompt with a fixed synthesis reminder (see aiPlanningDefaults). */
function buildPlannerSystemPromptForModel() {
  const base = getPlannerSystemPrompt()
  const suffix = String(PLANNER_SYNTHESIS_RUNTIME_APPEND || '').trim()
  if (!suffix) {
    return base
  }
  return `${base} ${suffix}`.trim()
}

/* Ask the planner model for the next JSON decision. */
async function requestPlannerDecision({ openAiClient, model, plannerPayload }) {
  const systemPrompt = buildPlannerSystemPromptForModel()
  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: JSON.stringify(plannerPayload),
    },
  ]

  const { parsed } = await tryChatJson({ openAiClient, model, messages })
  return parsed
}

/* After hitting the iteration cap, ask once more for a complete plan using gathered rows. */
async function forceCompletePlan({ openAiClient, model, userGoal, trace }) {
  const systemPrompt = buildPlannerSystemPromptForModel()
  const messages = [
    { role: 'system', content: `${systemPrompt} ${PLANNER_FINALIZE_PROMPT_APPEND}` },
    {
      role: 'user',
      content: JSON.stringify({
        user_goal: userGoal,
        prior_query_results: trace,
        instruction: 'Finish now with action complete.',
      }),
    },
  ]

  const { parsed: rawParsed } = await tryChatJson({ openAiClient, model, messages })
  const parsed = normalizePlannerDecisionAction(rawParsed)
  if (parsed && parsed.action === 'complete') {
    return {
      planText: String(parsed.plan || '').trim() || '(empty plan)',
      caveats: parsed.caveats ? String(parsed.caveats).trim() : '',
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map((item) => String(item)) : [],
    }
  }

  return null
}

/* Build a consistent error-shaped response. */
function buildFailure({ model, trace, error, partialPlanHint }) {
  return {
    ok: false,
    model,
    trace,
    error,
    partialPlanHint: partialPlanHint || null,
    planText: null,
    caveats: '',
    assumptions: [],
    iterations: trace.length,
    stoppedReason: 'error',
  }
}
