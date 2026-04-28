import crypto from 'node:crypto'

import { askOpenAiForSuggestionText } from './openaiClient.js'

/* Generate draft ontology suggestions from ingested events. */
export async function generateDraftSuggestionsFromEvents({
  events,
  baseIri,
  existingEntityNames,
  existingIngestMappings,
  customEntityFieldNamesByEntityName,
  openAiClient,
}) {
  const safeEvents = Array.isArray(events) ? events : []
  const suggestions = []
  const safeCustomFieldNamesByEntityName =
    customEntityFieldNamesByEntityName instanceof Map ? customEntityFieldNamesByEntityName : new Map()

  for (const event of safeEvents) {
    const entityType = normalizeEntityType(event.entity_type)
    const attributes = event.attributes && typeof event.attributes === 'object' ? event.attributes : {}
    const links = Array.isArray(event.links) ? event.links : []

    const existingTargetEntityName = existingIngestMappings.get(entityType) || null
    const suggestedEntityName = existingTargetEntityName || proposeTargetEntityName(entityType)

    if (!existingTargetEntityName) {
      const aiText = await maybeEnhanceEntityCreateWithAi({
        openAiClient,
        entityType,
        entityName: suggestedEntityName,
        fields: [],
      })

      suggestions.push(
        createSuggestion({
          suggestion_type: 'ingest_mapping',
          title: `Map incoming "${entityType}" to entity "${suggestedEntityName}"`,
          confidence: 0.85,
          proposal: {
            entity_type: entityType,
            target_entity_name: suggestedEntityName,
          },
          ai_summary: aiText?.mapping_summary || null,
        }),
      )
    }

    if (!existingEntityNames.has(suggestedEntityName)) {
      const inferredFields = inferFieldsFromAttributes(attributes)
      const proposal = {
        entity_name: suggestedEntityName,
        display_name: titleCase(suggestedEntityName),
        fields: inferredFields,
        base_iri: baseIri,
      }

      const aiText = await maybeEnhanceEntityCreateWithAi({
        openAiClient,
        entityType,
        entityName: suggestedEntityName,
        fields: inferredFields,
      })

      suggestions.push(
        createSuggestion({
          suggestion_type: 'entity_create',
          title: `Create entity "${suggestedEntityName}" from ingested "${entityType}"`,
          confidence: 0.75,
          proposal,
          ai_summary: aiText?.entity_summary || null,
        }),
      )

      const emailFieldNames = inferredFields
        .map((field) => field.field_name)
        .filter((fieldName) => fieldName.includes('email'))

      for (const emailFieldName of emailFieldNames) {
        suggestions.push(
          createSuggestion({
            suggestion_type: 'rule_create',
            title: `Add email pattern rule for ${suggestedEntityName}.${emailFieldName}`,
            confidence: 0.65,
            proposal: {
              rule_name: `${titleCase(suggestedEntityName)} ${titleCase(emailFieldName)} must look like an email`,
              target_entity: suggestedEntityName,
              rule_kind: 'pattern',
              property_iri: `${baseIri}${toCamelCase(emailFieldName)}`,
              pattern: '^\\S+@\\S+\\.\\S+$',
              message: 'Value must look like an email address',
              severity_iri: 'http://www.w3.org/ns/shacl#Violation',
              is_enabled: 1,
            },
          }),
        )
      }
    }

    // If entity already exists and is a custom entity, propose field additions for new attributes.
    if (existingEntityNames.has(suggestedEntityName)) {
      const existingCustomFields = new Set(safeCustomFieldNamesByEntityName.get(suggestedEntityName) || [])
      if (existingCustomFields.size > 0) {
        const inferredFields = inferFieldsFromAttributes(attributes)
        for (const field of inferredFields) {
          if (!field?.field_name) {
            continue
          }
          if (field.field_name === 'external_id') {
            continue
          }
          if (existingCustomFields.has(field.field_name)) {
            continue
          }

          suggestions.push(
            createSuggestion({
              suggestion_type: 'field_add',
              title: `Add field ${suggestedEntityName}.${field.field_name} from ingested data`,
              confidence: 0.6,
              proposal: {
                entity_name: suggestedEntityName,
                field_name: field.field_name,
                field_type: field.field_type,
                is_required: 0,
                base_iri: baseIri,
              },
            }),
          )

          if (String(field.field_name).includes('email')) {
            suggestions.push(
              createSuggestion({
                suggestion_type: 'rule_create',
                title: `Add email pattern rule for ${suggestedEntityName}.${field.field_name}`,
                confidence: 0.55,
                proposal: {
                  rule_name: `${titleCase(suggestedEntityName)} ${titleCase(field.field_name)} must look like an email`,
                  target_entity: suggestedEntityName,
                  rule_kind: 'pattern',
                  property_iri: `${baseIri}${toCamelCase(field.field_name)}`,
                  pattern: '^\\S+@\\S+\\.\\S+$',
                  message: 'Value must look like an email address',
                  severity_iri: 'http://www.w3.org/ns/shacl#Violation',
                  is_enabled: 1,
                },
              }),
            )
          }
        }
      }
    }

    // Relationship suggestions based on explicit links (external_id join pattern)
    for (const link of links) {
      const predicate = normalizePredicateName(link.predicate || '')
      const targetEntityType = normalizeEntityType(link.targetEntityType || link.target_entity_type || '')
      if (!predicate || !targetEntityType) {
        continue
      }

      const objectEntityName =
        existingIngestMappings.get(targetEntityType) || proposeTargetEntityName(targetEntityType)

      // We assume both sides have "external_id". Subject stores the referenced object external id.
      // Prefer a caller-provided subject column name, or infer it from attributes if possible.
      const subjectForeignKeyColumn =
        normalizeIdentifier(link.subjectColumn || link.subject_column || link.sourceField || '') ||
        inferForeignKeyColumnFromAttributes({
          attributes,
          targetExternalId: link.targetExternalId || link.target_external_id || null,
        }) ||
        normalizeIdentifier(`${objectEntityName}_external_id`)

      suggestions.push(
        createSuggestion({
          suggestion_type: 'relationship_create',
          title: `Create relationship ${suggestedEntityName} ${predicate} ${objectEntityName}`,
          confidence: 0.7,
          proposal: {
            relationship_name: `${titleCase(suggestedEntityName)} ${predicate} ${titleCase(objectEntityName)}`,
            subject_entity: suggestedEntityName,
            subject_column: subjectForeignKeyColumn,
            predicate_iri: `${baseIri}${toCamelCase(predicate)}`,
            object_entity: objectEntityName,
            object_column: 'external_id',
          },
          evidence: {
            from: entityType,
            to: targetEntityType,
            target_external_id: link.targetExternalId || link.target_external_id || null,
            inferred_subject_column: subjectForeignKeyColumn,
          },
        }),
      )

      // Ensure the subject has the foreign key column
      if (existingEntityNames.has(suggestedEntityName)) {
        suggestions.push(
          createSuggestion({
            suggestion_type: 'field_add',
            title: `Add field ${suggestedEntityName}.${subjectForeignKeyColumn} for relationship`,
            confidence: 0.7,
            proposal: {
              entity_name: suggestedEntityName,
              field_name: subjectForeignKeyColumn,
              field_type: 'TEXT',
              is_required: 0,
              base_iri: baseIri,
            },
          }),
        )
      }
    }
  }

  return dedupeSuggestions(suggestions)
}

/* Infer the subject foreign key column from attributes when possible. */
function inferForeignKeyColumnFromAttributes({ attributes, targetExternalId }) {
  const safeAttributes = attributes && typeof attributes === 'object' ? attributes : {}
  const safeTargetExternalId = targetExternalId === null || targetExternalId === undefined ? null : String(targetExternalId)
  if (!safeTargetExternalId) {
    return null
  }

  for (const [key, value] of Object.entries(safeAttributes)) {
    if (value === null || value === undefined) {
      continue
    }
    if (String(value) === safeTargetExternalId) {
      const candidate = normalizeIdentifier(key)
      if (candidate) {
        return candidate
      }
    }
  }

  return null
}

/* Create a normalized suggestion object with a fingerprint for dedupe. */
function createSuggestion({ suggestion_type, title, confidence, proposal, evidence, ai_summary }) {
  const proposalJsonText = JSON.stringify(proposal || {})
  const evidenceJsonText = evidence ? JSON.stringify(evidence) : null

  return {
    suggestion_type,
    status: 'draft',
    title: String(title || '').trim() || 'Suggestion',
    confidence: Number.isFinite(confidence) ? confidence : null,
    fingerprint: createFingerprint({
      suggestion_type,
      title,
      proposalJsonText,
    }),
    proposal_json: proposalJsonText,
    evidence_json: evidenceJsonText,
    ai_summary: ai_summary ? String(ai_summary).trim() : null,
  }
}

/* Create a stable fingerprint for a suggestion. */
function createFingerprint({ suggestion_type, title, proposalJsonText }) {
  const input = `${String(suggestion_type || '')}::${String(title || '')}::${String(proposalJsonText || '')}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

/* Dedupe suggestions by fingerprint and drop empty titles. */
function dedupeSuggestions(suggestions) {
  const unique = []
  const seen = new Set()

  for (const suggestion of suggestions) {
    if (!suggestion || !suggestion.fingerprint) {
      continue
    }
    if (seen.has(suggestion.fingerprint)) {
      continue
    }
    seen.add(suggestion.fingerprint)
    unique.push(suggestion)
  }

  return unique
}

/* Enhance entity suggestion text using OpenAI (optional). */
async function maybeEnhanceEntityCreateWithAi({ openAiClient, entityType, entityName, fields }) {
  if (!openAiClient) {
    return null
  }

  const fieldNames = Array.isArray(fields) ? fields.map((field) => field.field_name) : []

  const promptText = JSON.stringify(
    {
      task: 'Name ontology entity from ingested schema',
      entityType,
      suggestedEntityName: entityName,
      fields: fieldNames,
      returnShape: {
        mapping_summary: 'short string',
        entity_summary: 'short string',
      },
    },
    null,
    2,
  )

  return await askOpenAiForSuggestionText({ openAiClient, promptText })
}

/* Normalize an entity type into a safe internal identifier. */
function normalizeEntityType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  return normalized.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

/* Propose a target entity (table) name for an entity type. */
function proposeTargetEntityName(entityType) {
  const safe = normalizeIdentifier(entityType)
  return pluralize(safe)
}

/* Infer custom entity fields from attribute keys and values. */
function inferFieldsFromAttributes(attributes) {
  const normalizedAttributes = attributes && typeof attributes === 'object' ? attributes : {}

  const fields = []

  // Always include external_id to support relationship joins across sources.
  fields.push({ field_name: 'external_id', field_type: 'TEXT', is_required: 0 })

  for (const [key, value] of Object.entries(normalizedAttributes)) {
    const fieldName = normalizeIdentifier(key)
    if (!fieldName || fieldName === 'id' || fieldName === 'created_at' || fieldName === 'external_id') {
      continue
    }

    fields.push({
      field_name: fieldName,
      field_type: inferSqliteTypeFromValue(value),
      is_required: 0,
    })
  }

  return dedupeFields(fields)
}

/* Dedupe fields by field_name. */
function dedupeFields(fields) {
  const unique = []
  const seen = new Set()
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!field?.field_name) {
      continue
    }
    if (seen.has(field.field_name)) {
      continue
    }
    seen.add(field.field_name)
    unique.push(field)
  }
  return unique
}

/* Infer SQLite type from a sample value. */
function inferSqliteTypeFromValue(value) {
  if (value === null || value === undefined) {
    return 'TEXT'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'REAL'
  }

  if (typeof value === 'boolean') {
    return 'INTEGER'
  }

  return 'TEXT'
}

/* Normalize user-provided identifiers into SQLite-safe names. */
function normalizeIdentifier(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  const safeValue = normalizedValue.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  if (!safeValue) {
    return ''
  }
  if (!/^[a-z][a-z0-9_]*$/.test(safeValue)) {
    return `field_${safeValue.replace(/^[^a-z]+/, '') || 'value'}`
  }
  return safeValue
}

/* Normalize a predicate name for readability. */
function normalizePredicateName(value) {
  const safe = String(value || '').trim()
  if (!safe) {
    return ''
  }
  return safe.replace(/[^a-zA-Z0-9_]+/g, ' ').trim().replace(/\s+/g, ' ')
}

/* Convert snake_case to camelCase for predicate local names. */
function toCamelCase(value) {
  const parts = String(value || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .split('_')
    .filter(Boolean)

  if (parts.length === 0) {
    return 'property'
  }

  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((item) => item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase())
      .join('')
  )
}

/* Convert snake_case into Title Case. */
function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

/* Pluralize a simple English noun (lightweight heuristic). */
function pluralize(value) {
  const safe = String(value || '').trim()
  if (!safe) {
    return 'entities'
  }
  if (safe.endsWith('s')) {
    return safe
  }
  if (safe.endsWith('y') && safe.length > 1) {
    return `${safe.slice(0, -1)}ies`
  }
  return `${safe}s`
}

