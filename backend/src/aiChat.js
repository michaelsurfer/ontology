import { normalizeOpenAiUsage, runSparqlSkill } from './sparqlSkill.js'

/* Re-export NL→SPARQL generation for callers that need only the query step. */
export { generateSparqlFromQuestion } from './sparqlSkill.js'

/* Sum token usage from two OpenAI completion payloads (e.g. NL→SPARQL + summary). */
function mergeOpenAiTokenUsage(first, second) {
  if (!first && !second) {
    return null
  }
  return {
    promptTokens: (first?.promptTokens || 0) + (second?.promptTokens || 0),
    completionTokens: (first?.completionTokens || 0) + (second?.completionTokens || 0),
    totalTokens: (first?.totalTokens || 0) + (second?.totalTokens || 0),
  }
}

/* Answer a question using the SPARQL skill (retrieve) plus a natural-language summary. */
export async function answerQuestionWithSparql({
  openAiClient,
  questionText,
  baseIri,
  schemaContext,
  exportOptions,
  rulesContext,
  rulesValidation,
}) {
  const skillResult = await runSparqlSkill({
    openAiClient,
    questionText,
    sparqlText: null,
    baseIri,
    schemaContext,
    exportOptions,
  })

  const usageFromSparqlGeneration = skillResult.openAiUsage || null

  if (!skillResult.ok) {
    return {
      model: skillResult.model,
      sparqlText: skillResult.sparqlText,
      sparqlNotes: skillResult.sparqlNotes,
      variables: [],
      rows: [],
      executionTimeMs: skillResult.executionTimeMs,
      answerText: `Query failed: ${skillResult.error}`,
      tokenUsage: usageFromSparqlGeneration,
    }
  }

  const summaryResult = await summarizeSparqlResult({
    openAiClient,
    questionText,
    sparqlText: skillResult.sparqlText,
    variables: skillResult.variables,
    rows: skillResult.rows,
    rulesContext,
    rulesValidation,
  })

  return {
    model: skillResult.model,
    sparqlText: skillResult.sparqlText,
    sparqlNotes: skillResult.sparqlNotes,
    variables: skillResult.variables,
    rows: skillResult.rows,
    executionTimeMs: skillResult.executionTimeMs,
    answerText: summaryResult.answerText,
    tokenUsage: mergeOpenAiTokenUsage(usageFromSparqlGeneration, summaryResult.usage),
  }
}

/* Summarize SPARQL results into a short, user-friendly answer. */
async function summarizeSparqlResult({
  openAiClient,
  questionText,
  sparqlText,
  variables,
  rows,
  rulesContext,
  rulesValidation,
}) {
  if (!openAiClient) {
    const fallbackCount = Array.isArray(rows) ? rows.length : 0
    return { answerText: `Query returned ${fallbackCount} row(s).`, usage: null }
  }

  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  const safeQuestionText = String(questionText || '').trim()

  const safeRows = Array.isArray(rows) ? rows.slice(0, 50) : []
  const safeVariables = Array.isArray(variables) ? variables : []
  const safeRulesContext = rulesContext && typeof rulesContext === 'object' ? rulesContext : null
  const safeRulesValidation = rulesValidation && typeof rulesValidation === 'object' ? rulesValidation : null

  const messages = [
    {
      role: 'system',
      content:
        'You are a helpful assistant. Answer the user question using the SPARQL results provided. ' +
        'Be concise and factual. If there are zero rows, say that no matching data was found. ' +
        'If SHACL rules context or a validation report is provided, incorporate it when the user question relates to rules/quality/conformance.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          question: safeQuestionText,
          sparql: sparqlText,
          variables: safeVariables,
          rows: safeRows,
          rulesContext: safeRulesContext,
          rulesValidation: safeRulesValidation,
        },
        null,
        2,
      ),
    },
  ]

  try {
    const completion = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    })
    const content = completion?.choices?.[0]?.message?.content
    const summaryUsage = normalizeOpenAiUsage(completion?.usage)
    return {
      answerText: content ? String(content).trim() : 'No answer.',
      usage: summaryUsage,
    }
  } catch (error) {
    const fallbackCount = Array.isArray(rows) ? rows.length : 0
    return { answerText: `Query returned ${fallbackCount} row(s).`, usage: null }
  }
}
