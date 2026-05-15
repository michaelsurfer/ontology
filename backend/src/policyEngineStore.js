import { PDFParse } from 'pdf-parse'

const MAX_CHARS_FOR_EXTRACTION = 80000
const MAX_CHARS_FOR_GRAPH_CONTEXT = 120000

/* Truncate very long text so OpenAI requests stay within practical limits. */
function truncateForModel(plainText, maxChars) {
  const text = String(plainText || '')
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n\n[…truncated for model context…]`
}

/* Decode an uploaded file buffer into plain text (UTF-8 text types or PDF text extraction). */
export async function decodePolicyUploadBufferToPlainText({ buffer, mimeType, fileName }) {
  const safeMime = String(mimeType || '').toLowerCase()
  const lowerName = String(fileName || '').toLowerCase()

  const isPdf = safeMime.includes('pdf') || lowerName.endsWith('.pdf')
  if (isPdf) {
    const parser = new PDFParse({ data: buffer })
    try {
      const textResult = await parser.getText()
      await parser.destroy()
      const extracted = String(textResult?.text || '').trim()
      if (!extracted) {
        throw new Error('No extractable text found in PDF (may be scanned images only).')
      }
      return extracted
    } catch (error) {
      try {
        await parser.destroy()
      } catch (destroyError) {
        // ignore
      }
      throw new Error(error?.message ? String(error.message) : 'Failed to read PDF')
    }
  }

  const decoded = buffer.toString('utf8')
  if (!decoded.trim()) {
    throw new Error('File appears empty or is not valid UTF-8 text. Try .txt / .md or PDF.')
  }
  return decoded
}

/* Call OpenAI chat completions and parse JSON from the assistant message. */
async function completeJsonFromOpenAi({ openAiClient, systemPrompt, userPrompt }) {
  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let completion = null
  try {
    completion = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
      response_format: { type: 'json_object' },
    })
  } catch {
    completion = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    })
  }

  const rawContent = completion?.choices?.[0]?.message?.content
  if (!rawContent) {
    throw new Error('OpenAI returned an empty response')
  }

  try {
    return JSON.parse(rawContent)
  } catch (parseError) {
    throw new Error('OpenAI response was not valid JSON')
  }
}

/* Normalize entity rows from the model into a stable client shape. */
function normalizeExtractedEntities(rawList) {
  const list = Array.isArray(rawList) ? rawList : []
  const result = []
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const localId = String(item.local_id || item.localId || item.id || '').trim()
    const name = String(item.name || item.label || '').trim()
    if (!localId || !name) {
      continue
    }
    result.push({
      local_id: localId,
      name,
      description: String(item.description || item.summary || '').trim(),
    })
  }
  return result
}

/* Normalize relationship rows and ensure they reference known local entity ids. */
function normalizeExtractedRelationships(rawList, entityLocalIds) {
  const idSet = new Set(entityLocalIds)
  const list = Array.isArray(rawList) ? rawList : []
  const result = []
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const localId = String(item.local_id || item.localId || item.id || '').trim()
    const fromId = String(item.from_local_id || item.fromLocalId || item.from_entity_id || item.source || '').trim()
    const toId = String(item.to_local_id || item.toLocalId || item.to_entity_id || item.target || '').trim()
    const label = String(item.label || item.relation || item.predicate || 'related').trim()
    if (!localId || !fromId || !toId || !label) {
      continue
    }
    if (!idSet.has(fromId) || !idSet.has(toId)) {
      continue
    }
    result.push({
      local_id: localId,
      from_local_id: fromId,
      to_local_id: toId,
      label,
      notes: String(item.notes || '').trim(),
    })
  }
  return result
}

/*
 * Run extraction for one document: entities + relationships + short summary.
 * Nothing is persisted to the application database.
 */
export async function runPolicyDocumentExtract({ openAiClient, fileName, plainText }) {
  if (!openAiClient) {
    throw new Error('OpenAI is not configured')
  }
  const trimmedName = String(fileName || 'document').trim() || 'document'
  const body = truncateForModel(plainText, MAX_CHARS_FOR_EXTRACTION)

  const systemPrompt =
    'You extract a structured policy-oriented graph from business documents. Reply with JSON only, no markdown. ' +
    'Use stable local_id strings (e.g. e1, e2, r1) unique within this document. Entities are things like actors, obligations, controls, data types, or processes.'

  const userPrompt = `Document file name: ${trimmedName}\n\n` +
    'Return JSON with this exact shape:\n' +
    '{"summary":"2-4 sentences","entities":[{"local_id":"e1","name":"short title","description":"what it means"}],"relationships":[{"local_id":"r1","from_local_id":"e1","to_local_id":"e2","label":"verb phrase","notes":"optional"}]}\n\n' +
    'Document text:\n---\n' +
    body +
    '\n---'

  const parsed = await completeJsonFromOpenAi({ openAiClient, systemPrompt, userPrompt })
  const entities = normalizeExtractedEntities(parsed.entities)
  const entityIds = entities.map((row) => row.local_id)
  const relationships = normalizeExtractedRelationships(parsed.relationships, entityIds)

  return {
    ok: true,
    file_name: trimmedName,
    summary: String(parsed.summary || '').trim(),
    entities,
    relationships,
  }
}

/* Assign simple grid positions for React Flow nodes. */
function assignGridPositions(nodes) {
  return nodes.map((node, index) => ({
    ...node,
    position: node.position && typeof node.position.x === 'number'
      ? node.position
      : {
          x: 40 + (index % 4) * 260,
          y: 40 + Math.floor(index / 4) * 140,
        },
  }))
}

/* Normalize graph nodes from the second LLM pass. */
function normalizeGraphNodes(rawList) {
  const list = Array.isArray(rawList) ? rawList : []
  const result = []
  let fallbackIndex = 0
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    let id = String(item.id || '').trim()
    if (!id) {
      fallbackIndex += 1
      id = `policy-node-${fallbackIndex}`
    }
    const label = String(item.label || item.name || id).trim()
    /* Normalize arrays that the model might return as strings or omit entirely. */
    function toStringArray(value) {
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
      const text = String(value || '').trim()
      return text ? [text] : []
    }

    function toSourceClauses(value) {
      const list = Array.isArray(value) ? value : []
      return list
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          document: String(entry.document || entry.doc || entry.file || '').trim(),
          section: String(entry.section || entry.clause || entry.ref || '').trim(),
        }))
        .filter((entry) => entry.document || entry.section)
    }

    result.push({
      id,
      type: 'policyGraphNode',
      data: {
        label,
        kind: String(item.kind || item.type || '').trim(),
        description: String(item.description || '').trim(),
        owner: String(item.owner || '').trim(),
        teams: toStringArray(item.teams),
        key_rules: toStringArray(item.key_rules || item.rules || item.keyRules),
        risks_if_ignored: toStringArray(item.risks_if_ignored || item.risks || item.risksIfIgnored),
        source_clauses: toSourceClauses(item.source_clauses || item.sourceClauses || item.sources),
      },
    })
  }
  return assignGridPositions(result)
}

/* Normalize graph edges; drop edges that reference unknown node ids. */
function normalizeGraphEdges(rawList, nodeIdSet) {
  const list = Array.isArray(rawList) ? rawList : []
  const result = []
  let fallbackIndex = 0
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    let id = String(item.id || '').trim()
    if (!id) {
      fallbackIndex += 1
      id = `policy-edge-${fallbackIndex}`
    }
    const source = String(item.source || item.from || '').trim()
    const target = String(item.target || item.to || '').trim()
    const label = String(item.label || item.relation || '').trim() || 'related'
    if (!source || !target || !nodeIdSet.has(source) || !nodeIdSet.has(target)) {
      continue
    }
    result.push({
      id,
      source,
      target,
      label,
      data: { label },
    })
  }
  return result
}

/*
 * Build a merged policy graph (React Flow style) from all extractions + the user policy prompt.
 * Nothing is persisted to the application database.
 */
export async function runPolicyGraphFromPrompt({ openAiClient, extractions, policyPrompt }) {
  if (!openAiClient) {
    throw new Error('OpenAI is not configured')
  }
  const normalizedPrompt = String(policyPrompt || '').trim()
  if (!normalizedPrompt) {
    throw new Error('policyPrompt is required')
  }
  const list = Array.isArray(extractions) ? extractions : []
  if (list.length === 0) {
    throw new Error('extractions must be a non-empty array')
  }

  const sanitized = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    sanitized.push({
      file_name: String(entry.file_name || '').trim() || 'document',
      summary: String(entry.summary || '').trim(),
      entities: Array.isArray(entry.entities) ? entry.entities : [],
      relationships: Array.isArray(entry.relationships) ? entry.relationships : [],
    })
  }
  if (sanitized.length === 0) {
    throw new Error('extractions contained no usable items')
  }

  const bundleText = JSON.stringify(sanitized)

  const clippedBundle = truncateForModel(bundleText, MAX_CHARS_FOR_GRAPH_CONTEXT)

  const systemPrompt =
    'You are a policy modeling assistant. Given extracted entities/relationships from documents and a user instruction, ' +
    'produce ONE consolidated policy graph for business users — not technical users. ' +
    'Reply with JSON only, no markdown. ' +
    'Nodes must have unique id strings suitable as graph ids. Edges use source and target matching those node ids. ' +
    'For each node fill ALL business detail fields even if you must make a reasonable inference from the document text.'

  const nodeSchema =
    '{"id":"n1",' +
    '"label":"short visible title",' +
    '"kind":"obligation|control|risk|actor|data|process (pick one)",' +
    '"description":"1-2 sentences plain English: what this policy concept is",' +
    '"owner":"name or role of the person/team responsible",' +
    '"teams":["team1","team2"],' +
    '"key_rules":["plain English rule 1","plain English rule 2"],' +
    '"risks_if_ignored":["risk 1","risk 2"],' +
    '"source_clauses":[{"document":"file name","section":"section or clause reference"}]}'

  const userPrompt =
    'User instruction for the policy graph to create:\n---\n' +
    normalizedPrompt +
    '\n---\n\n' +
    'Extracted data from all documents (JSON):\n' +
    clippedBundle +
    '\n\n' +
    'Return JSON with this exact shape (do not omit any node fields):\n' +
    '{"reasoning":"short explanation of how you merged the sources",' +
    '"nodes":[' + nodeSchema + '],' +
    '"edges":[{"id":"e1","source":"n1","target":"n2","label":"plain English relationship phrase"}]}'

  const parsed = await completeJsonFromOpenAi({ openAiClient, systemPrompt, userPrompt })
  const rawNodes = normalizeGraphNodes(parsed.nodes)
  const nodeIdSet = new Set(rawNodes.map((node) => node.id))
  const edgesRaw = normalizeGraphEdges(parsed.edges, nodeIdSet)

  const edgesForReactFlow = edgesRaw.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: edge.data,
    animated: false,
  }))

  return {
    ok: true,
    reasoning: String(parsed.reasoning || '').trim(),
    nodes: rawNodes,
    edges: edgesForReactFlow,
  }
}
