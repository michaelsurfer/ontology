import { executeSparqlQuery } from './sparqlQuery.js'

/* Generate a SPARQL query from a natural-language question. */
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
        'Rules: use SELECT (no INSERT/DELETE/LOAD). Always include a LIMIT 50 unless the user explicitly asks for more. ' +
        'Prefer using the provided IRIs (class_iri, property_iri, predicate_iri) over guessing. ' +
        'If you use prefixes (ex:, rdf:, rdfs:, owl:, xsd:, res:), you MUST include PREFIX declarations in the SPARQL. ' +
        'Use the prefix ex: for the base IRI when appropriate.',
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

  const responseJson = await tryChatJson({ openAiClient, model, messages })
  const sparqlText = String(responseJson?.sparql || '').trim()
  if (!sparqlText) {
    throw new Error('Failed to generate SPARQL')
  }

  return {
    model,
    sparqlText,
    notes: responseJson?.notes ? String(responseJson.notes) : '',
  }
}

/* Answer a question by generating SPARQL, executing it, and summarizing results. */
export async function answerQuestionWithSparql({
  openAiClient,
  questionText,
  baseIri,
  schemaContext,
  exportOptions,
  rulesContext,
  rulesValidation,
}) {
  const sparqlPlan = await generateSparqlFromQuestion({
    openAiClient,
    questionText,
    baseIri,
    schemaContext,
  })

  const queryTextWithPrefixes = ensureSparqlHasCommonPrefixes({
    queryText: sparqlPlan.sparqlText,
    baseIri,
  })

  const startedAtMs = Date.now()
  const queryResult = await executeSparqlQuery({
    queryText: queryTextWithPrefixes,
    exportOptions: exportOptions || {
      includeOntology: true,
      includeData: true,
      maxRowsPerEntity: 200,
    },
  })
  const finishedAtMs = Date.now()

  const answerText = await summarizeSparqlResult({
    openAiClient,
    questionText,
    sparqlText: queryTextWithPrefixes,
    variables: queryResult.variables,
    rows: queryResult.rows,
    rulesContext,
    rulesValidation,
  })

  return {
    model: sparqlPlan.model,
    sparqlText: queryTextWithPrefixes,
    sparqlNotes: sparqlPlan.notes,
    variables: queryResult.variables,
    rows: queryResult.rows,
    executionTimeMs: finishedAtMs - startedAtMs,
    answerText,
  }
}

/* Ensure SPARQL has PREFIX declarations for common prefixes used by this app. */
function ensureSparqlHasCommonPrefixes({ queryText, baseIri }) {
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
    return `Query returned ${fallbackCount} row(s).`
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
    return content ? String(content).trim() : 'No answer.'
  } catch (error) {
    const fallbackCount = Array.isArray(rows) ? rows.length : 0
    return `Query returned ${fallbackCount} row(s).`
  }
}

/* Attempt to get structured JSON back from chat completions. */
async function tryChatJson({ openAiClient, model, messages }) {
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

  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    return null
  }

  try {
    return JSON.parse(content)
  } catch (error) {
    return null
  }
}

