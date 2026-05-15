import { getDatabase } from './database.js'
import { listCustomEntities } from './customEntities.js'
import { getEntityMappings, getPropertyMappings } from './mappingsStore.js'
import { getRelationshipDefinitions } from './relationshipsStore.js'
import { getOntologyRules } from './rulesStore.js'

/* Cap rows returned per side so smart-inject payloads stay readable in the UI. */
const MAX_RELATIONSHIP_ROWS = 20

/* Quote a SQLite table/column identifier (matches rdfExport rules). */
function quoteSqlIdent(rawName) {
  const name = String(rawName ?? '').trim()
  if (!name) {
    return '""'
  }
  return `"${name.replace(/"/g, '""')}"`
}

/* True when links are stored in a junction table (many-to-many). */
function relationshipDefinitionUsesJunction(relDef) {
  return Boolean(
    String(relDef?.junction_entity || '').trim() &&
      String(relDef?.junction_subject_column || '').trim() &&
      String(relDef?.junction_object_column || '').trim(),
  )
}

/* Convert camelCase / mixed keys to snake_case for matching ontology columns. */
function camelToSnakeIdentifier(value) {
  return String(value || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Convert a snake_case field into human readable title case text. */
function humanizeFieldName(fieldName) {
  return String(fieldName || '')
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

/* Build a short display label from an ontology IRI. */
function iriLabel(iriText) {
  const text = String(iriText || '').trim()
  if (!text) {
    return ''
  }
  const hashIndex = text.lastIndexOf('#')
  const slashIndex = text.lastIndexOf('/')
  const markerIndex = Math.max(hashIndex, slashIndex)
  if (markerIndex < 0 || markerIndex === text.length - 1) {
    return text
  }
  return text.slice(markerIndex + 1)
}

/* Remove envelope-only keys so scoring focuses on business payload fields. */
function stripEnvelopeKeys(recordObj) {
  const safeRecord = recordObj && typeof recordObj === 'object' && !Array.isArray(recordObj) ? { ...recordObj } : {}
  delete safeRecord.source
  delete safeRecord.sourceId
  delete safeRecord.meta
  return safeRecord
}

/* Normalize a request body into a list of plain records for field enrichment. */
function normalizeBodyToRecords(body) {
  if (body === undefined || body === null) {
    return []
  }
  if (Array.isArray(body)) {
    return body
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item))
  }
  if (typeof body !== 'object') {
    return []
  }
  if (Array.isArray(body.records)) {
    return body.records
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => stripEnvelopeKeys(item))
  }

  const nestedPayload =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload
        : body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)
          ? body.attributes
          : null
  if (nestedPayload) {
    return [stripEnvelopeKeys(nestedPayload)]
  }
  return [stripEnvelopeKeys(body)]
}

/* Build a lookup index for quick ontology meaning resolution while injecting. */
function buildOntologyIndex() {
  const entities = listCustomEntities()
  const entityMappings = getEntityMappings()
  const propertyMappings = getPropertyMappings()
  const relationships = getRelationshipDefinitions()
  const rules = getOntologyRules().filter((rule) => Number(rule?.is_enabled || 0) === 1)

  const entityByName = {}
  for (const entity of entities) {
    const entityName = String(entity?.entity_name || '').trim()
    if (!entityName) {
      continue
    }
    const fieldSet = new Set(
      (entity.fields || [])
        .filter((field) => field && field.is_active)
        .map((field) => String(field.field_name || '').trim())
        .filter(Boolean),
    )
    entityByName[entityName] = {
      entity_name: entityName,
      display_name: String(entity?.display_name || entityName).trim() || entityName,
      field_set: fieldSet,
    }
  }

  const entityMappingByName = {}
  for (const mapping of entityMappings) {
    const entityName = String(mapping?.entity_name || '').trim()
    if (!entityName) {
      continue
    }
    entityMappingByName[entityName] = mapping
  }

  const propertyMappingsByEntityColumn = {}
  const propertyMappingsByColumn = {}
  for (const mapping of propertyMappings) {
    const entityName = String(mapping?.entity_name || '').trim()
    const columnName = String(mapping?.column_name || '').trim()
    if (!entityName || !columnName) {
      continue
    }
    const pairKey = `${entityName}::${columnName}`
    propertyMappingsByEntityColumn[pairKey] = mapping
    if (!propertyMappingsByColumn[columnName]) {
      propertyMappingsByColumn[columnName] = []
    }
    propertyMappingsByColumn[columnName].push(mapping)
  }

  return {
    entities,
    relationships,
    rules,
    entityByName,
    entityMappingByName,
    propertyMappingsByEntityColumn,
    propertyMappingsByColumn,
  }
}

/* Find all entities that could own this field based on active schema columns. */
function getCandidateEntityNamesForField(fieldName, ontologyIndex) {
  const candidates = []
  for (const entity of ontologyIndex.entities) {
    const entityName = String(entity?.entity_name || '').trim()
    if (!entityName) {
      continue
    }
    const fieldExists = (entity.fields || []).some(
      (field) => field && field.is_active && String(field.field_name || '').trim() === fieldName,
    )
    if (fieldExists) {
      candidates.push(entityName)
    }
  }
  return candidates
}

/* Human-readable sentence for a relationship definition hint (for demo JSON). */
function summarizeRelationshipHint(hint, entityDisplayName) {
  if (!hint || typeof hint !== 'object') {
    return ''
  }
  const relName = String(hint.relationship_name || '').trim() || 'relationship'
  const predicateLabel = iriLabel(hint.predicate_iri || '')
  const predicatePart = predicateLabel ? ` via ${predicateLabel}` : ''
  const direction = hint.direction === 'object' ? 'object side' : 'subject side'
  const related = String(hint.related_entity || '').trim() || 'another object'
  const objectLabel = String(entityDisplayName || '').trim() || 'this object'
  const anchorNote =
    hint.payload_matches_join_column === false
      ? ' When the payload uses a non-join field (e.g. email), rows are resolved by anchoring on that field then following the relationship join column.'
      : ''
  return `${direction} of "${relName}" on ${objectLabel}: connects to ${related}${predicatePart}.${anchorNote}`
}

/*
 * List relationship definitions that touch this Object (employee↔company etc.).
 * Includes relationships even when the payload field is NOT the join column — then we
 * anchor on the payload field (e.g. email) and follow join_column_on_host like SPARQL.
 */
function buildRelationshipHints(fieldName, candidateEntityName, ontologyIndex) {
  const hints = []
  for (const relationship of ontologyIndex.relationships) {
    if (!relationship) {
      continue
    }
    const subjectEntityName = String(relationship.subject_entity || '').trim()
    const objectEntityName = String(relationship.object_entity || '').trim()
    const subjectCol = String(relationship.subject_column || '').trim()
    const objectCol = String(relationship.object_column || '').trim()

    if (subjectEntityName === candidateEntityName) {
      hints.push({
        id: relationship.id,
        relationship_name: relationship.relationship_name,
        predicate_iri: relationship.predicate_iri,
        direction: 'subject',
        related_entity: objectEntityName,
        subject_entity: subjectEntityName,
        object_entity: objectEntityName,
        subject_column: subjectCol,
        object_column: objectCol,
        junction_entity: relationship.junction_entity || null,
        junction_subject_column: relationship.junction_subject_column || null,
        junction_object_column: relationship.junction_object_column || null,
        host_side: 'subject',
        join_column_on_host: subjectCol,
        payload_matches_join_column: fieldName === subjectCol,
      })
    }

    if (objectEntityName === candidateEntityName && objectEntityName !== subjectEntityName) {
      hints.push({
        id: relationship.id,
        relationship_name: relationship.relationship_name,
        predicate_iri: relationship.predicate_iri,
        direction: 'object',
        related_entity: subjectEntityName,
        subject_entity: subjectEntityName,
        object_entity: objectEntityName,
        subject_column: subjectCol,
        object_column: objectCol,
        junction_entity: relationship.junction_entity || null,
        junction_subject_column: relationship.junction_subject_column || null,
        junction_object_column: relationship.junction_object_column || null,
        host_side: 'object',
        join_column_on_host: objectCol,
        payload_matches_join_column: fieldName === objectCol,
      })
    }
  }
  return hints
}

/* Merge rows into a list with dedupe by row id or JSON fallback. */
function mergeDedupeRows(targetList, newRows, seenIds) {
  for (const row of newRows || []) {
    const rowId = row && row.id !== undefined && row.id !== null ? row.id : null
    const dedupeKey = rowId !== null ? `id:${rowId}` : JSON.stringify(row)
    if (seenIds.has(dedupeKey)) {
      continue
    }
    seenIds.add(dedupeKey)
    targetList.push(row)
    if (targetList.length >= MAX_RELATIONSHIP_ROWS) {
      break
    }
  }
}

/*
 * From a join key, load only rows on the opposite entity (e.g. Company when host is Employee).
 * Used in anchor_field_then_join so we do not return every Employee sharing the same FK.
 */
function resolveFarSideRowsFromPivot(relHint, pivotValue, database) {
  const subjectEntity = String(relHint.subject_entity || '').trim()
  const objectEntity = String(relHint.object_entity || '').trim()
  const subjectColumn = String(relHint.subject_column || '').trim()
  const objectColumn = String(relHint.object_column || '').trim()
  const isSubjectHost = relHint.host_side === 'subject'

  const subTable = quoteSqlIdent(subjectEntity)
  const objTable = quoteSqlIdent(objectEntity)
  const subCol = quoteSqlIdent(subjectColumn)
  const objCol = quoteSqlIdent(objectColumn)

  if (relationshipDefinitionUsesJunction(relHint)) {
    const junctionTable = quoteSqlIdent(relHint.junction_entity)
    const junctionSubjectCol = quoteSqlIdent(relHint.junction_subject_column)
    const junctionObjectCol = quoteSqlIdent(relHint.junction_object_column)
    const junctionSubjectKey = String(relHint.junction_subject_column || '').trim()
    const junctionObjectKey = String(relHint.junction_object_column || '').trim()

    if (isSubjectHost) {
      const linkRows = database
        .prepare(`SELECT * FROM ${junctionTable} WHERE ${junctionSubjectCol} = ? LIMIT ?`)
        .all(pivotValue, MAX_RELATIONSHIP_ROWS)

      const objectRows = []
      const seenObjectIds = new Set()
      for (const linkRow of linkRows) {
        const objectJoinVal =
          junctionObjectKey && Object.prototype.hasOwnProperty.call(linkRow, junctionObjectKey)
            ? linkRow[junctionObjectKey]
            : null
        if (objectJoinVal === null || objectJoinVal === undefined) {
          continue
        }
        const matchedObjectRows = database
          .prepare(`SELECT * FROM ${objTable} WHERE ${objCol} = ? LIMIT ?`)
          .all(objectJoinVal, MAX_RELATIONSHIP_ROWS)
        mergeDedupeRows(objectRows, matchedObjectRows, seenObjectIds)
        if (objectRows.length >= MAX_RELATIONSHIP_ROWS) {
          break
        }
      }
      return {
        join_kind: 'junction_table',
        far_entity: objectEntity,
        far_rows: objectRows,
        link_rows: linkRows,
      }
    }

    const linkRows = database
      .prepare(`SELECT * FROM ${junctionTable} WHERE ${junctionObjectCol} = ? LIMIT ?`)
      .all(pivotValue, MAX_RELATIONSHIP_ROWS)

    const subjectRows = []
    const seenSubjectIds = new Set()
    for (const linkRow of linkRows) {
      const subjectJoinVal =
        junctionSubjectKey && Object.prototype.hasOwnProperty.call(linkRow, junctionSubjectKey)
          ? linkRow[junctionSubjectKey]
          : null
      if (subjectJoinVal === null || subjectJoinVal === undefined) {
        continue
      }
      const matchedSubjectRows = database
        .prepare(`SELECT * FROM ${subTable} WHERE ${subCol} = ? LIMIT ?`)
        .all(subjectJoinVal, MAX_RELATIONSHIP_ROWS)
      mergeDedupeRows(subjectRows, matchedSubjectRows, seenSubjectIds)
      if (subjectRows.length >= MAX_RELATIONSHIP_ROWS) {
        break
      }
    }
    return {
      join_kind: 'junction_table',
      far_entity: subjectEntity,
      far_rows: subjectRows,
      link_rows: linkRows,
    }
  }

  if (isSubjectHost) {
    const objectRows = database
      .prepare(`SELECT * FROM ${objTable} WHERE ${objCol} = ? LIMIT ?`)
      .all(pivotValue, MAX_RELATIONSHIP_ROWS)
    return {
      join_kind: 'direct_column_match',
      far_entity: objectEntity,
      far_rows: objectRows,
      link_rows: [],
    }
  }

  const subjectRows = database
    .prepare(`SELECT * FROM ${subTable} WHERE ${subCol} = ? LIMIT ?`)
    .all(pivotValue, MAX_RELATIONSHIP_ROWS)
  return {
    join_kind: 'direct_column_match',
    far_entity: subjectEntity,
    far_rows: subjectRows,
    link_rows: [],
  }
}

/*
 * Resolve both sides of a relationship given a join key (payload equals join column on host).
 */
function resolveRelatedRowsAtPivot(relHint, pivotValue, database) {
  const subjectEntity = String(relHint.subject_entity || '').trim()
  const objectEntity = String(relHint.object_entity || '').trim()
  const subjectColumn = String(relHint.subject_column || '').trim()
  const objectColumn = String(relHint.object_column || '').trim()
  const isSubjectHost = relHint.host_side === 'subject'

  const subTable = quoteSqlIdent(subjectEntity)
  const objTable = quoteSqlIdent(objectEntity)
  const subCol = quoteSqlIdent(subjectColumn)
  const objCol = quoteSqlIdent(objectColumn)

  if (relationshipDefinitionUsesJunction(relHint)) {
    const junctionTable = quoteSqlIdent(relHint.junction_entity)
    const junctionSubjectCol = quoteSqlIdent(relHint.junction_subject_column)
    const junctionObjectCol = quoteSqlIdent(relHint.junction_object_column)
    const junctionSubjectKey = String(relHint.junction_subject_column || '').trim()
    const junctionObjectKey = String(relHint.junction_object_column || '').trim()

    if (isSubjectHost) {
      const linkRows = database
        .prepare(`SELECT * FROM ${junctionTable} WHERE ${junctionSubjectCol} = ? LIMIT ?`)
        .all(pivotValue, MAX_RELATIONSHIP_ROWS)

      const subjectRows = database
        .prepare(`SELECT * FROM ${subTable} WHERE ${subCol} = ? LIMIT ?`)
        .all(pivotValue, MAX_RELATIONSHIP_ROWS)

      const objectRows = []
      const seenObjectIds = new Set()
      for (const linkRow of linkRows) {
        const objectJoinVal =
          junctionObjectKey && Object.prototype.hasOwnProperty.call(linkRow, junctionObjectKey)
            ? linkRow[junctionObjectKey]
            : null
        if (objectJoinVal === null || objectJoinVal === undefined) {
          continue
        }
        const matchedObjectRows = database
          .prepare(`SELECT * FROM ${objTable} WHERE ${objCol} = ? LIMIT ?`)
          .all(objectJoinVal, MAX_RELATIONSHIP_ROWS)
        mergeDedupeRows(objectRows, matchedObjectRows, seenObjectIds)
        if (objectRows.length >= MAX_RELATIONSHIP_ROWS) {
          break
        }
      }

      return {
        join_kind: 'junction_table',
        join_role: 'subject',
        subject_rows: subjectRows,
        object_rows: objectRows,
        link_rows: linkRows,
      }
    }

    const linkRows = database
      .prepare(`SELECT * FROM ${junctionTable} WHERE ${junctionObjectCol} = ? LIMIT ?`)
      .all(pivotValue, MAX_RELATIONSHIP_ROWS)
    const objectRows = database
      .prepare(`SELECT * FROM ${objTable} WHERE ${objCol} = ? LIMIT ?`)
      .all(pivotValue, MAX_RELATIONSHIP_ROWS)

    const subjectRows = []
    const seenSubjectIds = new Set()
    for (const linkRow of linkRows) {
      const subjectJoinVal =
        junctionSubjectKey && Object.prototype.hasOwnProperty.call(linkRow, junctionSubjectKey)
          ? linkRow[junctionSubjectKey]
          : null
      if (subjectJoinVal === null || subjectJoinVal === undefined) {
        continue
      }
      const matchedSubjectRows = database
        .prepare(`SELECT * FROM ${subTable} WHERE ${subCol} = ? LIMIT ?`)
        .all(subjectJoinVal, MAX_RELATIONSHIP_ROWS)
      mergeDedupeRows(subjectRows, matchedSubjectRows, seenSubjectIds)
      if (subjectRows.length >= MAX_RELATIONSHIP_ROWS) {
        break
      }
    }

    return {
      join_kind: 'junction_table',
      join_role: 'object',
      subject_rows: subjectRows,
      object_rows: objectRows,
      link_rows: linkRows,
    }
  }

  const subjectRows = database
    .prepare(`SELECT * FROM ${subTable} WHERE ${subCol} = ? LIMIT ?`)
    .all(pivotValue, MAX_RELATIONSHIP_ROWS)
  const objectRows = database
    .prepare(`SELECT * FROM ${objTable} WHERE ${objCol} = ? LIMIT ?`)
    .all(pivotValue, MAX_RELATIONSHIP_ROWS)

  return {
    join_kind: 'direct_column_match',
    join_role: isSubjectHost ? 'subject' : 'object',
    subject_rows: subjectRows,
    object_rows: objectRows,
    link_rows: [],
  }
}

/*
 * Anchor on any column (e.g. email), read join_column_on_host from those rows, then load related entity rows.
 * Mirrors SPARQL: filter Employee by email, then traverse worksAt / FK to Company.
 */
function resolveMappedRecordsAnchorThenJoin(relHint, hostEntityName, fieldName, anchorValue, database, ontologyIndex) {
  const meta = ontologyIndex.entityByName[hostEntityName]
  if (!meta || !meta.field_set.has(fieldName)) {
    return {
      resolved: false,
      resolution_mode: 'anchor_field_then_join',
      join_kind: null,
      join_role: relHint.host_side || null,
      join_value: anchorValue,
      pivot_values_used: [],
      anchor_field: fieldName,
      join_column_used: String(relHint.join_column_on_host || '').trim(),
      explanation: null,
      reason: `Cannot anchor on "${fieldName}" — it is not an active column on "${hostEntityName}".`,
      subject_rows: [],
      object_rows: [],
      link_rows: [],
      anchor_rows: [],
    }
  }

  const hostTable = quoteSqlIdent(hostEntityName)
  const anchorCol = quoteSqlIdent(fieldName)
  const joinColName = String(relHint.join_column_on_host || '').trim()

  let anchorRows = []
  try {
    anchorRows = database.prepare(`SELECT * FROM ${hostTable} WHERE ${anchorCol} = ? LIMIT ?`).all(anchorValue, MAX_RELATIONSHIP_ROWS)
  } catch (error) {
    return {
      resolved: false,
      resolution_mode: 'anchor_field_then_join',
      join_kind: null,
      join_role: relHint.host_side || null,
      join_value: anchorValue,
      pivot_values_used: [],
      anchor_field: fieldName,
      join_column_used: joinColName,
      explanation: null,
      reason: error?.message ? String(error.message) : 'anchor_query_failed',
      subject_rows: [],
      object_rows: [],
      link_rows: [],
      anchor_rows: [],
    }
  }

  if (anchorRows.length === 0) {
    return {
      resolved: true,
      resolution_mode: 'anchor_field_then_join',
      join_kind: null,
      join_role: relHint.host_side || null,
      join_value: anchorValue,
      pivot_values_used: [],
      anchor_field: fieldName,
      join_column_used: joinColName,
      explanation: `No row in "${hostEntityName}" where ${fieldName} equals the payload value.`,
      reason: null,
      subject_rows: [],
      object_rows: [],
      link_rows: [],
      anchor_rows: [],
    }
  }

  const pivotValues = []
  for (const row of anchorRows) {
    if (!joinColName || !Object.prototype.hasOwnProperty.call(row, joinColName)) {
      continue
    }
    const pivot = row[joinColName]
    if (pivot !== null && pivot !== undefined && pivot !== '') {
      pivotValues.push(pivot)
    }
  }

  if (pivotValues.length === 0) {
    return {
      resolved: true,
      resolution_mode: 'anchor_field_then_join',
      join_kind: null,
      join_role: relHint.host_side || null,
      join_value: anchorValue,
      pivot_values_used: [],
      anchor_field: fieldName,
      join_column_used: joinColName,
      explanation: `Anchor rows found, but "${joinColName}" is null — cannot traverse the relationship.`,
      reason: null,
      subject_rows: relHint.host_side === 'subject' ? anchorRows : [],
      object_rows: relHint.host_side === 'object' ? anchorRows : [],
      link_rows: [],
      anchor_rows: anchorRows,
    }
  }

  const subjectEntity = String(relHint.subject_entity || '').trim()
  const objectEntity = String(relHint.object_entity || '').trim()

  const collectedFarRows = []
  const collectedLinkRows = []
  const seenFar = new Set()
  const seenL = new Set()
  let lastJoinKind = null

  for (const pivotValue of pivotValues) {
    const farPack = resolveFarSideRowsFromPivot(relHint, pivotValue, database)
    lastJoinKind = farPack.join_kind
    mergeDedupeRows(collectedFarRows, farPack.far_rows, seenFar)
    mergeDedupeRows(collectedLinkRows, farPack.link_rows, seenL)
    if (collectedFarRows.length >= MAX_RELATIONSHIP_ROWS) {
      break
    }
  }

  let subjectOut = []
  let objectOut = []
  if (relHint.host_side === 'subject') {
    subjectOut = anchorRows.slice(0, MAX_RELATIONSHIP_ROWS)
    objectOut = collectedFarRows.slice(0, MAX_RELATIONSHIP_ROWS)
  } else {
    objectOut = anchorRows.slice(0, MAX_RELATIONSHIP_ROWS)
    subjectOut = collectedFarRows.slice(0, MAX_RELATIONSHIP_ROWS)
  }

  const pivotLabel = pivotValues.map((value) => String(value)).join(', ')
  const farName = relHint.host_side === 'subject' ? objectEntity : subjectEntity

  return {
    resolved: true,
    resolution_mode: 'anchor_field_then_join',
    join_kind: lastJoinKind,
    join_role: relHint.host_side || null,
    join_value: anchorValue,
    pivot_values_used: pivotValues,
    anchor_field: fieldName,
    join_column_used: joinColName,
    explanation: `Anchored on ${hostEntityName}.${fieldName}, read ${hostEntityName}.${joinColName} (= ${pivotLabel}), then loaded "${farName}" rows linked by relationship "${relHint.relationship_name}" (same path SPARQL uses: filter host → traverse join → related entity).`,
    reason: null,
    subject_entity: subjectEntity,
    object_entity: objectEntity,
    subject_rows: subjectOut,
    object_rows: objectOut,
    link_rows: collectedLinkRows.slice(0, MAX_RELATIONSHIP_ROWS),
    anchor_rows: anchorRows,
  }
}

/* Load subject/object (and optional link) rows: direct join on payload, or anchor field then join (SPARQL-style). */
function resolveMappedRecordsForRelationshipHint(relHint, hostEntityName, fieldName, joinValue, ontologyIndex) {
  const emptyRows = {
    resolved: false,
    resolution_mode: null,
    join_kind: null,
    join_role: null,
    join_value: joinValue,
    pivot_values_used: [],
    anchor_field: null,
    join_column_used: null,
    explanation: null,
    reason: null,
    subject_entity: String(relHint.subject_entity || '').trim(),
    object_entity: String(relHint.object_entity || '').trim(),
    subject_rows: [],
    object_rows: [],
    link_rows: [],
    anchor_rows: [],
  }

  if (joinValue === null || joinValue === undefined || joinValue === '') {
    return {
      ...emptyRows,
      reason: 'No value in payload to match stored rows (join key empty).',
    }
  }

  const subjectEntity = String(relHint.subject_entity || '').trim()
  const objectEntity = String(relHint.object_entity || '').trim()
  const hostOk =
    hostEntityName === subjectEntity || hostEntityName === objectEntity

  if (!hostOk) {
    return {
      ...emptyRows,
      reason: 'Host entity is not part of this relationship.',
    }
  }

  const database = getDatabase()

  try {
    if (relHint.payload_matches_join_column) {
      const pack = resolveRelatedRowsAtPivot(relHint, joinValue, database)
      const pivotLabel = String(relHint.join_column_on_host || '').trim()
      return {
        resolved: true,
        resolution_mode: 'join_column_equals_payload',
        join_kind: pack.join_kind,
        join_role: pack.join_role,
        join_value: joinValue,
        pivot_values_used: [joinValue],
        anchor_field: null,
        join_column_used: pivotLabel,
        explanation: `Payload field is the relationship join column (${pivotLabel}). Matched ${subjectEntity} and ${objectEntity} rows sharing that value.`,
        reason: null,
        subject_entity: subjectEntity,
        object_entity: objectEntity,
        subject_rows: pack.subject_rows,
        object_rows: pack.object_rows,
        link_rows: pack.link_rows,
        anchor_rows: [],
      }
    }

    return resolveMappedRecordsAnchorThenJoin(relHint, hostEntityName, fieldName, joinValue, database, ontologyIndex)
  } catch (error) {
    return {
      ...emptyRows,
      reason: error?.message ? String(error.message) : 'query_failed',
    }
  }
}

/* Build rule hints where the field mapping aligns with enabled ontology rules. */
function buildRuleHints(propertyIri, candidateEntityName, ontologyIndex) {
  if (!propertyIri) {
    return []
  }
  return ontologyIndex.rules
    .filter(
      (rule) =>
        String(rule?.target_entity || '').trim() === candidateEntityName &&
        String(rule?.property_iri || '').trim() === propertyIri,
    )
    .map((rule) => ({
      id: rule.id,
      rule_name: rule.rule_name,
      rule_kind: rule.rule_kind,
      message: rule.message,
      severity_iri: rule.severity_iri,
    }))
}

/* Build a per-field business meaning object from ontology metadata and matching evidence. */
function enrichFieldMeaning({ rawKey, rawValue, explicitEntityName, ontologyIndex }) {
  const originalFieldName = String(rawKey || '').trim()
  const normalizedFieldName = camelToSnakeIdentifier(originalFieldName)
  const fieldName = normalizedFieldName || originalFieldName.toLowerCase()
  const evidence = []

  if (normalizedFieldName && normalizedFieldName !== originalFieldName) {
    evidence.push(`normalized "${originalFieldName}" to "${normalizedFieldName}"`)
  }

  const candidateEntityNames = explicitEntityName
    ? [explicitEntityName]
    : getCandidateEntityNamesForField(fieldName, ontologyIndex)
  if (candidateEntityNames.length > 0) {
    evidence.push(`field exists on ${candidateEntityNames.length} object schema(s)`)
  } else {
    evidence.push('no direct object schema match found; fallback meaning used')
  }

  const candidateEntities = candidateEntityNames.map((entityName) => {
    const entityMeta = ontologyIndex.entityByName[entityName] || null
    const entityMapping = ontologyIndex.entityMappingByName[entityName] || null
    const propertyMapping =
      ontologyIndex.propertyMappingsByEntityColumn[`${entityName}::${fieldName}`] ||
      (ontologyIndex.propertyMappingsByColumn[fieldName] || []).find(
        (mapping) => String(mapping?.entity_name || '').trim() === entityName,
      ) ||
      null
    const relationships = buildRelationshipHints(fieldName, entityName, ontologyIndex)
    const rules = buildRuleHints(propertyMapping?.property_iri || '', entityName, ontologyIndex)

    return {
      entity_name: entityName,
      display_name: entityMeta?.display_name || entityName,
      class_iri: entityMapping?.class_iri || null,
      class_label: iriLabel(entityMapping?.class_iri || ''),
      property_iri: propertyMapping?.property_iri || null,
      property_label: iriLabel(propertyMapping?.property_iri || ''),
      datatype_iri: propertyMapping?.datatype_iri || null,
      potential_relationships: relationships,
      potential_rules: rules,
    }
  })

  const primaryCandidate = candidateEntities[0] || null
  const businessMeaning = primaryCandidate
    ? `${humanizeFieldName(fieldName)} for ${primaryCandidate.display_name}`
    : humanizeFieldName(fieldName)

  if (primaryCandidate?.property_iri) {
    evidence.push(`matched ontology property ${primaryCandidate.property_iri}`)
  }
  if (primaryCandidate?.potential_relationships?.length) {
    evidence.push(
      `field participates in ${primaryCandidate.potential_relationships.length} relationship definition(s)`,
    )
  }
  if (primaryCandidate?.potential_rules?.length) {
    evidence.push(`field participates in ${primaryCandidate.potential_rules.length} enabled rule(s)`)
  }

  const primaryRelationships = primaryCandidate?.potential_relationships || []
  const primaryRules = primaryCandidate?.potential_rules || []

  const relationshipsForJson = primaryRelationships.map((hint) => ({
    ...hint,
    business_summary: summarizeRelationshipHint(hint, primaryCandidate?.display_name || primaryCandidate?.entity_name),
    mapped_records: primaryCandidate
      ? resolveMappedRecordsForRelationshipHint(hint, primaryCandidate.entity_name, fieldName, rawValue, ontologyIndex)
      : {
          resolved: false,
          resolution_mode: null,
          join_kind: null,
          join_role: null,
          join_value: rawValue,
          pivot_values_used: [],
          anchor_field: null,
          join_column_used: null,
          explanation: null,
          reason: 'No matching Object context for this field.',
          subject_entity: String(hint.subject_entity || ''),
          object_entity: String(hint.object_entity || ''),
          subject_rows: [],
          object_rows: [],
          link_rows: [],
          anchor_rows: [],
        },
  }))

  const ontologySignals = []
  if (candidateEntityNames.length > 0) {
    ontologySignals.push('object_schema_field')
  }
  if (primaryCandidate?.property_iri) {
    ontologySignals.push('property_mapping')
  }
  if (primaryCandidate?.class_iri) {
    ontologySignals.push('class_mapping')
  }
  if (primaryRelationships.length > 0) {
    ontologySignals.push('relationship_definition')
  }
  if (primaryRules.length > 0) {
    ontologySignals.push('guardrail_rule')
  }

  const matchedOntology = ontologySignals.length > 0

  const relationshipSummaries = relationshipsForJson
    .map((item) => item.business_summary)
    .filter(Boolean)

  return {
    field_name: fieldName,
    original_key: originalFieldName,
    value: rawValue,
    business_meaning: businessMeaning,
    reason: evidence.join('; '),
    ontology_match: {
      matched: matchedOntology,
      signals: ontologySignals,
    },
    business_semantics: primaryCandidate
      ? {
          interprets_as: businessMeaning,
          on_business_object: `${primaryCandidate.display_name} (${primaryCandidate.entity_name})`,
          ontology_class: primaryCandidate.class_label || null,
          ontology_class_iri: primaryCandidate.class_iri || null,
          ontology_property: primaryCandidate.property_label || null,
          ontology_property_iri: primaryCandidate.property_iri || null,
          datatype: primaryCandidate.datatype_iri || null,
          relationship_summaries: relationshipSummaries,
          guardrail_rule_names: primaryRules.map((rule) => String(rule.rule_name || '').trim()).filter(Boolean),
        }
      : {
          interprets_as: businessMeaning,
          on_business_object: null,
          ontology_class: null,
          ontology_class_iri: null,
          ontology_property: null,
          ontology_property_iri: null,
          datatype: null,
          relationship_summaries: [],
          guardrail_rule_names: [],
        },
    relationships: relationshipsForJson,
    guardrail_rules: primaryRules,
    primary_entity: primaryCandidate
      ? {
          entity_name: primaryCandidate.entity_name,
          display_name: primaryCandidate.display_name,
          class_iri: primaryCandidate.class_iri,
          property_iri: primaryCandidate.property_iri,
          relationships: relationshipsForJson,
          rules: primaryRules,
        }
      : null,
    candidate_entities: candidateEntities,
  }
}

/* Collect per-record relationship rows resolved from the database for this payload. */
function summarizeRelationshipInstancesFromFields(enrichedFields) {
  const relationshipInstances = []
  let fieldsWithResolvedDbRows = 0

  for (const field of Object.values(enrichedFields)) {
    let sawResolvedForField = false
    for (const rel of field.relationships || []) {
      const mapped = rel.mapped_records
      if (!mapped || !mapped.resolved) {
        continue
      }
      sawResolvedForField = true
      relationshipInstances.push({
        source_field: field.field_name,
        payload_value: field.value,
        relationship_id: rel.id,
        relationship_name: rel.relationship_name,
        predicate_iri: rel.predicate_iri,
        subject_entity: rel.subject_entity,
        object_entity: rel.object_entity,
        join_kind: mapped.join_kind,
        join_role: mapped.join_role,
        subject_row_count: Array.isArray(mapped.subject_rows) ? mapped.subject_rows.length : 0,
        object_row_count: Array.isArray(mapped.object_rows) ? mapped.object_rows.length : 0,
        link_row_count: Array.isArray(mapped.link_rows) ? mapped.link_rows.length : 0,
        explanation: mapped.explanation,
      })
    }
    if (sawResolvedForField) {
      fieldsWithResolvedDbRows += 1
    }
  }

  return { relationshipInstances, fieldsWithResolvedDbRows }
}

/* Resolve an explicit target entity from request envelope when provided. */
function resolveExplicitEntityName(rawBody, ontologyIndex) {
  const safeBody = rawBody && typeof rawBody === 'object' ? rawBody : {}
  const rawName = String(safeBody.entity_name || safeBody.entityName || '').trim()
  if (!rawName) {
    return null
  }
  return ontologyIndex.entityByName[rawName] ? rawName : null
}

/* Smart-inject API: enrich payload fields with business meaning from ontology metadata. */
export function runSmartInject({ rawBody }) {
  const records = normalizeBodyToRecords(rawBody)
  if (records.length === 0) {
    throw new Error('smart-inject expects a JSON object, records array, or nested data/payload object')
  }

  const ontologyIndex = buildOntologyIndex()
  const explicitEntityName = resolveExplicitEntityName(rawBody, ontologyIndex)

  const enrichedRecords = records.map((record, recordIndex) => {
    const safeRecord = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
    const fieldEntries = Object.entries(safeRecord)
    const enrichedFields = {}
    let fieldsWithOntologySignals = 0
    let fieldsWithRelationships = 0
    for (const [rawKey, rawValue] of fieldEntries) {
      const meaning = enrichFieldMeaning({
        rawKey,
        rawValue,
        explicitEntityName,
        ontologyIndex,
      })
      enrichedFields[meaning.field_name] = meaning
      if (meaning.ontology_match && meaning.ontology_match.matched) {
        fieldsWithOntologySignals += 1
      }
      if (Array.isArray(meaning.relationships) && meaning.relationships.length > 0) {
        fieldsWithRelationships += 1
      }
    }

    const fieldOverview = Object.values(enrichedFields).map((field) => {
      const meaningSnippet = String(field.business_meaning || '').trim()
      const relPart =
        field.business_semantics &&
        Array.isArray(field.business_semantics.relationship_summaries) &&
        field.business_semantics.relationship_summaries.length > 0
          ? ` — ${field.business_semantics.relationship_summaries.join(' ')}`
          : ''
      return `${field.field_name}: ${meaningSnippet}${relPart}`
    })

    const { relationshipInstances, fieldsWithResolvedDbRows } = summarizeRelationshipInstancesFromFields(enrichedFields)

    return {
      index: recordIndex,
      input_record: safeRecord,
      field_count: Object.keys(enrichedFields).length,
      enrichment_summary: {
        fields_with_ontology_signals: fieldsWithOntologySignals,
        fields_with_relationships: fieldsWithRelationships,
        fields_with_relationship_rows_loaded: fieldsWithResolvedDbRows,
        relationship_instance_count: relationshipInstances.length,
        relationship_instances: relationshipInstances,
        field_overview: fieldOverview,
      },
      fields: enrichedFields,
    }
  })

  return {
    ok: true,
    mode: 'smart_inject',
    accepted: enrichedRecords.length,
    ontology_context: {
      entities: ontologyIndex.entities.length,
      relationships: ontologyIndex.relationships.length,
      enabled_rules: ontologyIndex.rules.length,
      property_mappings: Object.keys(ontologyIndex.propertyMappingsByEntityColumn).length,
    },
    entity_hint: explicitEntityName,
    results: enrichedRecords,
  }
}
