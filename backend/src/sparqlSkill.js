import { executeSparqlQuery } from './sparqlQuery.js'
import { enrichSchemaContextForSparql } from './sparqlSchemaContext.js'

/* Generate a SPARQL query from a natural-language question (shared by chat and planning agents). */
export async function generateSparqlFromQuestion({
  openAiClient,
  questionText,
  baseIri,
  schemaContext,
}) {
  if (!openAiClient) {
    throw new Error('OpenAI is not configured')
  }

  const normalizedQuestionText = String(questionText || '').trim()
  if (!normalizedQuestionText) {
    throw new Error('questionText is required')
  }

  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  const safeBaseIri = String(baseIri || '').trim() || 'http://example.com/context#'

  const messages = [
    {
      role: 'system',
      content:
        'You are a helpful data assistant. You translate user questions into SPARQL SELECT queries to run against an RDF graph. ' +
        'Return JSON only with keys: sparql, notes. ' +
        'Rules: use SELECT only. The query engine rejects ASK, CONSTRUCT, and DESCRIBE — never emit them. No INSERT/DELETE/LOAD. Always include a LIMIT 50 unless the user explicitly asks for more. ' +
        'Copy IRIs exactly from the payload: use predicate_iri, domain_class_iri, and range_class_iri from sparqlRelationshipHints — never invent property or class IRIs. ' +
        'Subclass / class hierarchy is separate: use sparqlSubclassHints (child_class_iri, parent_class_iri, sparql_fragments). It is NOT in sparqlRelationshipHints. ' +
        'If the user asks to show or list subclass relationships, hierarchy, or rdfs:subClassOf edges, use the exact query in sparql_list_all_subclass_edges (or SELECT ?c ?p WHERE { ?c rdfs:subClassOf ?p . } with PREFIX rdfs:). ' +
        'Important: individuals are rdf:type the child (leaf) class only. A filter like ?x rdf:type <parent_class_iri> will miss instances of subclasses. ' +
        'To include all instances under a parent class, use ?x rdf:type ?c . ?c rdfs:subClassOf* <parent_class_iri> . (or adapt sparql_fragments.select_instances_under_parent_including_subclasses). ' +
        'For questions about whether X is a subclass of Y, match sparqlSubclassHints and use sparql_fragments.select_confirm_child_subclass_of_parent or a SELECT with FILTER EXISTS — never ASK. ' +
        'If the user asks how two tables/entities are linked, match sparqlRelationshipHints by subject_entity and object_entity, then start from copy_ready_sparql_fragment (adapt variable names and add FILTER/BIND only as needed). ' +
        'If the user asks to show/list members/items (not just counts), include at least one human-readable literal column in SELECT using OPTIONAL with domain_readable_property_iris or range_readable_property_iris (for example ?personName), so output is not only IRIs. ' +
        'If you use prefixes (ex:, rdf:, rdfs:, owl:, xsd:, res:), you MUST include PREFIX declarations in the SPARQL. ' +
        'Use the prefix ex: for the base IRI when appropriate. ' +
        'Relationships may be stored in SQL link tables (uses_sql_link_table / sql_link_table). The exported RDF graph has only direct triples: ' +
        '?domainIndividual <predicate_iri> ?rangeIndividual. Do not use rdf:type on the junction table name and do not model link rows as resources.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          question: normalizedQuestionText,
          baseIri: safeBaseIri,
          schemaContext,
          output: {
            sparql: 'string',
            notes: 'string (short)',
          },
        },
        null,
        2,
      ),
    },
  ]

  const { parsed: responseJson, usage: generationUsage } = await tryChatJson({ openAiClient, model, messages })
  const sparqlText = String(responseJson?.sparql || '').trim()
  if (!sparqlText) {
    throw new Error('Failed to generate SPARQL')
  }

  return {
    model,
    sparqlText,
    notes: responseJson?.notes ? String(responseJson.notes) : '',
    usage: generationUsage,
  }
}

/**
 * SPARQL skill: generate SPARQL from natural language and/or execute SPARQL against the RDF export.
 * Either pass questionText (NL → SPARQL) or sparqlText (direct execute). NL generation requires openAiClient.
 */
export async function runSparqlSkill({
  openAiClient,
  questionText,
  sparqlText,
  baseIri,
  schemaContext,
  exportOptions,
}) {
  const safeExport = exportOptions || {
    includeOntology: true,
    includeData: true,
    maxRowsPerEntity: 200,
  }

  const trimmedSparql = String(sparqlText || '').trim()
  let model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  let sparqlNotes = ''
  let finalSparql = ''
  let openAiUsageFromGeneration = null

  if (trimmedSparql) {
    finalSparql = ensureSparqlHasCommonPrefixes({ queryText: trimmedSparql, baseIri })
  } else {
    const generation = await generateSparqlFromQuestion({
      openAiClient,
      questionText,
      baseIri,
      schemaContext: enrichSchemaContextForSparql(schemaContext),
    })
    model = generation.model
    sparqlNotes = generation.notes || ''
    openAiUsageFromGeneration = generation.usage || null
    finalSparql = ensureSparqlHasCommonPrefixes({
      queryText: generation.sparqlText,
      baseIri,
    })
  }

  const startedAtMs = Date.now()
  try {
    const queryResult = await executeSparqlQuery({
      queryText: finalSparql,
      exportOptions: safeExport,
    })
    const finishedAtMs = Date.now()
    return {
      ok: true,
      model,
      sparqlText: finalSparql,
      sparqlNotes,
      variables: queryResult.variables,
      rows: queryResult.rows,
      executionTimeMs: finishedAtMs - startedAtMs,
      openAiUsage: openAiUsageFromGeneration,
    }
  } catch (error) {
    const finishedAtMs = Date.now()
    return {
      ok: false,
      error: error?.message ? String(error.message) : String(error),
      model,
      sparqlText: finalSparql,
      sparqlNotes,
      variables: [],
      rows: [],
      executionTimeMs: finishedAtMs - startedAtMs,
      openAiUsage: openAiUsageFromGeneration,
    }
  }
}

/* Ensure SPARQL has PREFIX declarations for common prefixes used by this app. */
export function ensureSparqlHasCommonPrefixes({ queryText, baseIri }) {
  const normalizedQueryText = String(queryText || '').trim()
  if (!normalizedQueryText) {
    return normalizedQueryText
  }

  const safeBaseIri = String(baseIri || '').trim() || 'http://example.com/context#'
  const requiredPrefixes = [
    { prefix: 'rdf', iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
    { prefix: 'rdfs', iri: 'http://www.w3.org/2000/01/rdf-schema#' },
    { prefix: 'owl', iri: 'http://www.w3.org/2002/07/owl#' },
    { prefix: 'xsd', iri: 'http://www.w3.org/2001/XMLSchema#' },
    { prefix: 'ex', iri: safeBaseIri },
    { prefix: 'res', iri: 'http://example.com/resource/' },
  ]

  const declaredPrefixes = new Set()
  const prefixRegex = /^\s*PREFIX\s+([A-Za-z_][A-Za-z0-9_-]*):\s*<[^>]+>\s*$/gim
  for (const match of normalizedQueryText.matchAll(prefixRegex)) {
    if (match && match[1]) {
      declaredPrefixes.add(String(match[1]).toLowerCase())
    }
  }

  const prefixesToAdd = requiredPrefixes.filter((item) => !declaredPrefixes.has(item.prefix))
  if (prefixesToAdd.length === 0) {
    return normalizedQueryText
  }

  const prefixLines = prefixesToAdd.map((item) => `PREFIX ${item.prefix}: <${item.iri}>`).join('\n')
  return `${prefixLines}\n\n${normalizedQueryText}`
}

/* Normalize OpenAI completion.usage into stable numeric fields (camelCase). */
export function normalizeOpenAiUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null
  }
  const promptRaw = usage.prompt_tokens ?? usage.input_tokens
  const completionRaw = usage.completion_tokens ?? usage.output_tokens
  const totalRaw = usage.total_tokens
  if (promptRaw == null && completionRaw == null && totalRaw == null) {
    return null
  }
  const safePrompt = Number.isFinite(Number(promptRaw)) ? Math.max(0, Number(promptRaw)) : 0
  const safeCompletion = Number.isFinite(Number(completionRaw)) ? Math.max(0, Number(completionRaw)) : 0
  let safeTotal = Number.isFinite(Number(totalRaw)) ? Math.max(0, Number(totalRaw)) : 0
  if (safeTotal === 0 && (safePrompt > 0 || safeCompletion > 0)) {
    safeTotal = safePrompt + safeCompletion
  }
  return {
    promptTokens: safePrompt,
    completionTokens: safeCompletion,
    totalTokens: safeTotal,
  }
}

/* Attempt to get structured JSON back from chat completions. */
export async function tryChatJson({ openAiClient, model, messages }) {
  let result = null
  try {
    result = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
      response_format: { type: 'json_object' },
    })
  } catch (error) {
    result = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    })
  }

  const usage = normalizeOpenAiUsage(result?.usage)
  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    return { parsed: null, usage }
  }

  try {
    return { parsed: JSON.parse(content), usage }
  } catch (error) {
    return { parsed: null, usage }
  }
}
