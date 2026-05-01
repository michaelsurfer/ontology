import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { initializeDatabase } from './database.js'
import { createRdfTurtleExport } from './rdfExport.js'
import {
  deleteById,
  getAllRows,
  getRowById,
  insertRow,
  updateRowById,
} from './simpleCrud.js'
import {
  createRelationshipDefinition,
  deleteRelationshipDefinition,
  deleteAllRelationshipDefinitions,
  getRelationshipDefinitions,
  updateRelationshipDefinition,
} from './relationshipsStore.js'
import {
  getEntityMappings,
  upsertEntityMapping,
  deleteEntityMapping,
  deleteAllEntityMappings,
  getPropertyMappings,
  upsertPropertyMapping,
  deletePropertyMapping,
  deleteAllPropertyMappings,
  getOntologySettings,
  updateOntologySettings,
} from './mappingsStore.js'
import { getSchemaGraph } from './schemaGraph.js'
import { executeSparqlQuery } from './sparqlQuery.js'
import { createOpenAiClient } from './openaiClient.js'
import { answerQuestionWithSparql } from './aiChat.js'
import { runPlanningAgent } from './aiPlanning.js'
import {
  getPlannerSystemPrompt,
  setPlannerSystemPrompt,
  getPlannerSystemPromptRow,
} from './aiPlanningSettings.js'
import { DEFAULT_PLANNER_SYSTEM_PROMPT, PLANNER_FINALIZE_PROMPT_APPEND } from './aiPlanningDefaults.js'
import {
  addCustomEntityField,
  createCustomEntity,
  deleteCustomEntity,
  getCustomEntityByName,
  listCustomEntities,
  updateCustomEntityField,
} from './customEntities.js'
import {
  createCustomEntityRow,
  deleteCustomEntityRow,
  listCustomEntityRows,
  updateCustomEntityRow,
} from './customEntityCrud.js'
import { listAllEntitiesWithColumns } from './entitiesApi.js'
import {
  createOntologyRule,
  deleteOntologyRule,
  getOntologyRules,
  updateOntologyRule,
} from './rulesStore.js'
import { createShaclTurtleExport } from './shaclExport.js'
import { validateCurrentGraphAgainstRules } from './shaclValidate.js'
import {
  createIngestEvents,
  listIngestEvents,
} from './ingestStore.js'
import {
  approveSuggestion,
  deleteSuggestion,
  deleteSuggestionsByStatus,
  listSuggestions,
  publishApprovedSuggestions,
  rejectSuggestion,
} from './suggestionsStore.js'

/* Start the Express server that powers the ontology platform API. */
function startServer() {
  initializeDatabase()

  const openAiClient = createOpenAiClient()

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(morgan('dev'))

  app.get('/api/health', (request, response) => {
    response.json({ ok: true })
  })

  // Ingest events (webhook / SDK "front door")
  app.get('/api/ingest/events', (request, response) => {
    const limit = Number.isFinite(Number(request.query.limit)) ? Number(request.query.limit) : 100
    response.json(listIngestEvents({ limit }))
  })

  app.post('/api/ingest/events', async (request, response) => {
    const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
    const entityName = String(safeBody.entity_name || safeBody.entityName || '').trim()
    if (!entityName) {
      response.status(400).json({ error: 'entity_name is required' })
      return
    }

    const aiModeValue = safeBody.ai_mode !== undefined ? safeBody.ai_mode : safeBody.aiMode
    const aiMode = normalizeBoolean(aiModeValue)
    if (aiMode === null) {
      response.status(400).json({ error: 'ai_mode is required (boolean)' })
      return
    }

    try {
      const created = await createIngestEvents({ payload: request.body })
      response.status(202).json(created)
    } catch (error) {
      response.status(400).json({ error: error?.message ? String(error.message) : 'Ingest failed' })
    }
  })

  // Ontology suggestions (draft -> approved -> published)
  app.get('/api/suggestions', (request, response) => {
    const status = request.query.status ? String(request.query.status) : null
    response.json(listSuggestions({ status }))
  })

  app.post('/api/suggestions/:id/approve', (request, response) => {
    response.json(approveSuggestion({ id: request.params.id }))
  })

  app.post('/api/suggestions/:id/reject', (request, response) => {
    response.json(rejectSuggestion({ id: request.params.id }))
  })

  app.post('/api/suggestions/publish', (request, response) => {
    response.json(publishApprovedSuggestions())
  })

  app.delete('/api/suggestions/:id', (request, response) => {
    const result = deleteSuggestion({ id: request.params.id })
    if (!result.deleted) {
      response.status(400).json({ error: result.reason || 'Delete failed' })
      return
    }
    response.status(204).end()
  })

  app.delete('/api/suggestions', (request, response) => {
    const status = request.query.status ? String(request.query.status) : null
    if (!status) {
      response.status(400).json({ error: 'status query parameter is required' })
      return
    }
    response.json(deleteSuggestionsByStatus({ status }))
  })

  // Note: builtin CRM tables/routes were removed. Use custom entities + ingestion to create data tables.

  // Relationship definition routes
  app.get('/api/relationships', (request, response) => {
    response.json(getRelationshipDefinitions())
  })

  app.post('/api/relationships', (request, response) => {
    const createdRelationshipDefinition = createRelationshipDefinition(request.body)
    response.status(201).json(createdRelationshipDefinition)
  })

  app.put('/api/relationships/:id', (request, response) => {
    const updatedRelationshipDefinition = updateRelationshipDefinition(
      request.params.id,
      request.body,
    )
    response.json(updatedRelationshipDefinition)
  })

  app.delete('/api/relationships/:id', (request, response) => {
    deleteRelationshipDefinition(request.params.id)
    response.status(204).end()
  })

  app.delete('/api/relationships', (request, response) => {
    const confirm = String(request.query.confirm || '').trim()
    if (confirm !== 'yes') {
      response.status(400).json({ error: 'Add ?confirm=yes to delete all relationships' })
      return
    }
    response.json(deleteAllRelationshipDefinitions())
  })

  // Ontology + mapping routes
  app.get('/api/ontology/settings', (request, response) => {
    response.json(getOntologySettings())
  })

  app.put('/api/ontology/settings', (request, response) => {
    response.json(updateOntologySettings(request.body))
  })

  app.get('/api/mappings/entities', (request, response) => {
    response.json(getEntityMappings())
  })

  app.put('/api/mappings/entities/:entityName', (request, response) => {
    response.json(upsertEntityMapping(request.params.entityName, request.body))
  })

  app.delete('/api/mappings/entities/:entityName', (request, response) => {
    const result = deleteEntityMapping(request.params.entityName)
    if (!result.deleted) {
      response.status(404).json({ error: 'Not found' })
      return
    }
    response.status(204).end()
  })

  app.delete('/api/mappings/entities', (request, response) => {
    const confirm = String(request.query.confirm || '').trim()
    if (confirm !== 'yes') {
      response.status(400).json({ error: 'Add ?confirm=yes to delete all entity mappings' })
      return
    }
    response.json(deleteAllEntityMappings())
  })

  app.get('/api/mappings/properties', (request, response) => {
    response.json(getPropertyMappings())
  })

  app.put('/api/mappings/properties/:entityName/:columnName', (request, response) => {
    response.json(
      upsertPropertyMapping(request.params.entityName, request.params.columnName, request.body),
    )
  })

  app.delete('/api/mappings/properties/:entityName/:columnName', (request, response) => {
    deletePropertyMapping(request.params.entityName, request.params.columnName)
    response.status(204).end()
  })

  app.delete('/api/mappings/properties', (request, response) => {
    const confirm = String(request.query.confirm || '').trim()
    if (confirm !== 'yes') {
      response.status(400).json({ error: 'Add ?confirm=yes to delete all property mappings' })
      return
    }
    response.json(deleteAllPropertyMappings())
  })

  // RDF export
  app.post('/api/rdf/export', async (request, response) => {
    const exportOptions = request.body || {}
    const turtleText = await createRdfTurtleExport(exportOptions)

    response.setHeader('Content-Type', 'text/turtle; charset=utf-8')
    response.send(turtleText)
  })

  // Custom entities (Option B: real tables)
  app.get('/api/custom-entities', (request, response) => {
    response.json(listCustomEntities())
  })

  app.get('/api/custom-entities/:entityName', (request, response) => {
    const entity = getCustomEntityByName(request.params.entityName)
    if (!entity) {
      response.status(404).json({ error: 'Not found' })
      return
    }
    response.json(entity)
  })

  app.post('/api/custom-entities', (request, response) => {
    const settings = getOntologySettings()
    const createdEntity = createCustomEntity({
      ...request.body,
      base_iri: settings?.base_iri,
    })
    response.status(201).json(createdEntity)
  })

  app.delete('/api/custom-entities/:entityName', (request, response) => {
    deleteCustomEntity({ entity_name: request.params.entityName })
    response.status(204).end()
  })

  app.post('/api/custom-entities/:entityName/fields', (request, response) => {
    const settings = getOntologySettings()
    const createdEntity = addCustomEntityField({
      entity_name: request.params.entityName,
      ...request.body,
      base_iri: settings?.base_iri,
    })
    response.status(201).json(createdEntity)
  })

  app.put('/api/custom-entities/:entityName/fields/:fieldId', (request, response) => {
    const updatedEntity = updateCustomEntityField({
      entity_name: request.params.entityName,
      field_id: request.params.fieldId,
      ...request.body,
    })
    response.json(updatedEntity)
  })

  app.get('/api/custom/:entityName', (request, response) => {
    response.json(listCustomEntityRows(request.params.entityName))
  })

  app.post('/api/custom/:entityName', (request, response) => {
    response.status(201).json(createCustomEntityRow(request.params.entityName, request.body))
  })

  app.put('/api/custom/:entityName/:id', (request, response) => {
    response.json(updateCustomEntityRow(request.params.entityName, request.params.id, request.body))
  })

  app.delete('/api/custom/:entityName/:id', (request, response) => {
    deleteCustomEntityRow(request.params.entityName, request.params.id)
    response.status(204).end()
  })

  // Entities list (for UI dropdowns / graph join suggestions)
  app.get('/api/entities', (request, response) => {
    response.json(listAllEntitiesWithColumns())
  })

  // SPARQL query endpoint (runs against the exported RDF graph)
  app.post('/api/sparql', async (request, response) => {
    const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
    const queryText = safeBody.query || safeBody.queryText || ''

    const exportOptions = {
      includeOntology: safeBody.includeOntology !== false,
      includeData: safeBody.includeData !== false,
      maxRowsPerEntity: Number.isFinite(safeBody.maxRowsPerEntity) ? Number(safeBody.maxRowsPerEntity) : 200,
    }

    const startedAtMs = Date.now()
    const result = await executeSparqlQuery({ queryText, exportOptions })
    const finishedAtMs = Date.now()

    response.json({
      variables: result.variables,
      rows: result.rows,
      executionTimeMs: finishedAtMs - startedAtMs,
    })
  })

  // AI chat endpoint (natural language -> SPARQL -> results -> answer)
  app.post('/api/ai/chat', async (request, response) => {
    const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
    const messageText = String(safeBody.message || safeBody.text || '').trim()
    if (!messageText) {
      response.status(400).json({ error: 'message is required' })
      return
    }

    if (!openAiClient) {
      response.status(400).json({ error: 'OpenAI is not configured (missing OPENAI_API_KEY)' })
      return
    }

    try {
      const ontologySettings = getOntologySettings()
      const baseIri = ontologySettings?.base_iri || 'http://example.com/context#'

      const enabledRules = getOntologyRules().filter((rule) => rule && rule.is_enabled)
      const rulesContext = {
        enabledRulesCount: enabledRules.length,
        enabledRules: enabledRules.map((rule) => ({
          id: rule.id,
          rule_name: rule.rule_name,
          target_entity: rule.target_entity,
          rule_kind: rule.rule_kind,
          property_iri: rule.property_iri,
        })),
      }

      const rulesCheckingEnabledRaw =
        safeBody.rules_checking_enabled !== undefined
          ? safeBody.rules_checking_enabled
          : safeBody.rulesCheckingEnabled
      const rulesCheckingEnabled =
        rulesCheckingEnabledRaw === undefined ? null : normalizeBoolean(rulesCheckingEnabledRaw)

      const shouldValidateRules =
        rulesCheckingEnabled === true ? true : rulesCheckingEnabled === false ? false : shouldRunRulesValidation(messageText)
      const rulesValidation = shouldValidateRules
        ? await validateCurrentGraphAgainstRules({ includeOntology: true, includeData: true, maxRowsPerEntity: 200 })
        : null
      const rulesValidationPayload = rulesValidation
        ? {
            conforms: Boolean(rulesValidation.conforms),
            executionTimeMs: Number.isFinite(rulesValidation.executionTimeMs) ? Number(rulesValidation.executionTimeMs) : null,
            resultsCount: Array.isArray(rulesValidation.results) ? rulesValidation.results.length : 0,
            results: Array.isArray(rulesValidation.results) ? rulesValidation.results.slice(0, 20) : [],
          }
        : null

      const schemaContext = {
        ontologySettings,
        entityMappings: getEntityMappings(),
        propertyMappings: getPropertyMappings(),
        relationships: getRelationshipDefinitions(),
        rules: rulesContext,
      }

      const exportOptions = {
        includeOntology: true,
        includeData: true,
        maxRowsPerEntity: 200,
      }

      const result = await answerQuestionWithSparql({
        openAiClient,
        questionText: messageText,
        baseIri,
        schemaContext,
        exportOptions,
        rulesContext,
        rulesValidation: rulesValidationPayload
          ? {
              conforms: rulesValidationPayload.conforms,
              executionTimeMs: rulesValidationPayload.executionTimeMs,
              results: rulesValidationPayload.results,
            }
          : null,
      })

      response.json({
        answerText: result.answerText,
        sparqlText: result.sparqlText,
        sparqlNotes: result.sparqlNotes,
        variables: result.variables,
        rows: result.rows,
        executionTimeMs: result.executionTimeMs,
        model: result.model,
        enabledRulesCount: rulesContext.enabledRulesCount,
        rulesValidation: rulesValidationPayload,
      })
    } catch (error) {
      response.status(500).json({ error: error?.message ? String(error.message) : 'AI request failed' })
    }
  })

  // AI planning prompts (stored in ai_planning_settings)
  app.get('/api/ai/plan/prompt', (request, response) => {
    try {
      const effective = getPlannerSystemPrompt()
      const row = getPlannerSystemPromptRow()
      response.json({
        plannerSystemPrompt: effective,
        defaultPlannerSystemPrompt: DEFAULT_PLANNER_SYSTEM_PROMPT,
        storedPlannerSystemPrompt: row?.planner_system_prompt ?? null,
        updatedAt: row?.updated_at ?? null,
        finalizePromptAppend: PLANNER_FINALIZE_PROMPT_APPEND,
        finalizeSystemPromptCombined: `${effective} ${PLANNER_FINALIZE_PROMPT_APPEND}`,
        userIterationPayloadShape:
          'JSON with iteration, max_iterations, user_goal, prior_query_results (summarized trace rows).',
        userFinalizePayloadShape:
          'JSON with user_goal, prior_query_results (full trace), instruction: finish with action complete.',
      })
    } catch (error) {
      response.status(500).json({ error: error?.message ? String(error.message) : 'Failed to read prompt' })
    }
  })

  app.put('/api/ai/plan/prompt', (request, response) => {
    try {
      const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
      const promptText = safeBody.plannerSystemPrompt ?? safeBody.planner_system_prompt ?? ''
      const row = setPlannerSystemPrompt(promptText)
      const effective = getPlannerSystemPrompt()
      response.json({
        plannerSystemPrompt: effective,
        row,
        defaultPlannerSystemPrompt: DEFAULT_PLANNER_SYSTEM_PROMPT,
        finalizePromptAppend: PLANNER_FINALIZE_PROMPT_APPEND,
        finalizeSystemPromptCombined: `${effective} ${PLANNER_FINALIZE_PROMPT_APPEND}`,
      })
    } catch (error) {
      response.status(400).json({ error: error?.message ? String(error.message) : 'Failed to save prompt' })
    }
  })

  // AI planning agent (loop: planner ↔ SPARQL skill)
  app.post('/api/ai/plan', async (request, response) => {
    const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
    const goalText = String(safeBody.goal || safeBody.message || '').trim()
    if (!goalText) {
      response.status(400).json({ error: 'goal (or message) is required' })
      return
    }

    if (!openAiClient) {
      response.status(400).json({ error: 'OpenAI is not configured (missing OPENAI_API_KEY)' })
      return
    }

    try {
      const ontologySettings = getOntologySettings()
      const baseIri = ontologySettings?.base_iri || 'http://example.com/context#'

      const enabledRules = getOntologyRules().filter((rule) => rule && rule.is_enabled)
      const rulesContext = {
        enabledRulesCount: enabledRules.length,
        enabledRules: enabledRules.map((rule) => ({
          id: rule.id,
          rule_name: rule.rule_name,
          target_entity: rule.target_entity,
          rule_kind: rule.rule_kind,
          property_iri: rule.property_iri,
        })),
      }

      const schemaContext = {
        ontologySettings,
        entityMappings: getEntityMappings(),
        propertyMappings: getPropertyMappings(),
        relationships: getRelationshipDefinitions(),
        rules: rulesContext,
      }

      const maxRowsPerEntity = Number.isFinite(safeBody.maxRowsPerEntity)
        ? Number(safeBody.maxRowsPerEntity)
        : 200
      const exportOptions = {
        includeOntology: safeBody.includeOntology !== false,
        includeData: safeBody.includeData !== false,
        maxRowsPerEntity,
      }

      const maxIterationsRaw = safeBody.max_iterations ?? safeBody.maxIterations
      const maxIterations = Number.isFinite(Number(maxIterationsRaw)) ? Number(maxIterationsRaw) : 5

      const result = await runPlanningAgent({
        openAiClient,
        userGoal: goalText,
        baseIri,
        schemaContext,
        exportOptions,
        maxIterations,
      })

      response.json(result)
    } catch (error) {
      response.status(500).json({ error: error?.message ? String(error.message) : 'Planning request failed' })
    }
  })

  // Ontology rules (SHACL)
  app.get('/api/rules', (request, response) => {
    response.json(getOntologyRules())
  })

  app.post('/api/rules', (request, response) => {
    const createdRule = createOntologyRule(request.body)
    response.status(201).json(createdRule)
  })

  app.put('/api/rules/:id', (request, response) => {
    const updatedRule = updateOntologyRule(request.params.id, request.body)
    response.json(updatedRule)
  })

  app.delete('/api/rules/:id', (request, response) => {
    deleteOntologyRule(request.params.id)
    response.status(204).end()
  })

  app.get('/api/shacl/export', async (request, response) => {
    const turtleText = await createShaclTurtleExport()
    response.setHeader('Content-Type', 'text/turtle; charset=utf-8')
    response.send(turtleText)
  })

  app.post('/api/shacl/validate', async (request, response) => {
    const safeBody = request.body && typeof request.body === 'object' ? request.body : {}
    const includeOntology = safeBody.includeOntology !== false
    const includeData = safeBody.includeData !== false
    const maxRowsPerEntity = Number.isFinite(safeBody.maxRowsPerEntity) ? Number(safeBody.maxRowsPerEntity) : 200

    const startedAtMs = Date.now()
    const report = await validateCurrentGraphAgainstRules({ includeOntology, includeData, maxRowsPerEntity })
    const finishedAtMs = Date.now()

    response.json({
      ...report,
      executionTimeMs: finishedAtMs - startedAtMs,
    })
  })

  // Simple schema-graph endpoint for visualization
  app.get('/api/graph/schema', (request, response) => {
    response.json(getSchemaGraph())
  })

  // Basic error handler
  app.use((error, request, response, next) => {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  })

  const port = Number(process.env.PORT || 5174)
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
}

/* Normalize a boolean-like input; returns null when missing/invalid. */
function normalizeBoolean(value) {
  if (value === true) return true
  if (value === false) return false
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

/* Decide whether to run SHACL validation for an AI question. */
function shouldRunRulesValidation(messageText) {
  const text = String(messageText || '').toLowerCase()
  return (
    text.includes('rule') ||
    text.includes('shacl') ||
    text.includes('validate') ||
    text.includes('validation') ||
    text.includes('conform') ||
    text.includes('violation')
  )
}

/* Create simple CRUD routes for a single table/entity. */
function createCrudRoutes(app, tableName) {
  app.get(`/api/${tableName}`, (request, response) => {
    response.json(getAllRows(tableName))
  })

  app.get(`/api/${tableName}/:id`, (request, response) => {
    const row = getRowById(tableName, request.params.id)
    if (!row) {
      response.status(404).json({ error: 'Not found' })
      return
    }
    response.json(row)
  })

  app.post(`/api/${tableName}`, (request, response) => {
    const createdRow = insertRow(tableName, request.body)
    response.status(201).json(createdRow)
  })

  app.put(`/api/${tableName}/:id`, (request, response) => {
    const updatedRow = updateRowById(tableName, request.params.id, request.body)
    response.json(updatedRow)
  })

  app.delete(`/api/${tableName}/:id`, (request, response) => {
    deleteById(tableName, request.params.id)
    response.status(204).end()
  })
}

startServer()

