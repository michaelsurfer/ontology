import { listCustomEntities } from './customEntities.js'
import { getEntityMappings, getPropertyMappings } from './mappingsStore.js'
import { getRelationshipDefinitions } from './relationshipsStore.js'
import { getOntologyRules } from './rulesStore.js'

/* Convert camelCase keys to snake_case for matching Object columns and IRIs. */
function camelToSnakeIdentifier(value) {
  return String(value || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* Local name segment of an RDF IRI (fragment or last path segment). */
function iriLocalName(iriText) {
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

/* Parse MCP-style JSON: { tool, arguments } or a plain object treated as arguments. */
function normalizeMcpPayload(rawBody) {
  const safeBody = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
  const toolName = String(safeBody.tool || safeBody.toolName || safeBody.tool_name || '').trim() || null

  const nestedArguments = safeBody.arguments
  if (nestedArguments !== undefined && nestedArguments !== null && typeof nestedArguments === 'object' && !Array.isArray(nestedArguments)) {
    return { toolName, arguments: { ...nestedArguments } }
  }

  const shallowCopy = { ...safeBody }
  delete shallowCopy.tool
  delete shallowCopy.toolName
  delete shallowCopy.tool_name
  delete shallowCopy.arguments
  return { toolName, arguments: shallowCopy }
}

/* Score Objects whose active fields overlap payload keys (best-effort entity inference). */
function inferEntityNamesFromArguments(argumentsObj, entities) {
  const keySet = new Set()
  for (const rawKey of Object.keys(argumentsObj || {})) {
    const trimmed = String(rawKey || '').trim()
    if (!trimmed) {
      continue
    }
    const snake = camelToSnakeIdentifier(trimmed)
    keySet.add(trimmed.toLowerCase())
    if (snake) {
      keySet.add(snake)
    }
  }

  const scored = []
  for (const entity of entities || []) {
    const entityName = String(entity?.entity_name || '').trim()
    if (!entityName) {
      continue
    }
    let score = 0
    for (const field of entity.fields || []) {
      if (!field || !field.is_active) {
        continue
      }
      const fieldName = String(field.field_name || '').trim()
      if (!fieldName) {
        continue
      }
      if (keySet.has(fieldName.toLowerCase())) {
        score += 1
      }
    }
    if (score > 0) {
      scored.push({ entity_name: entityName, display_name: String(entity.display_name || entityName).trim(), score })
    }
  }

  scored.sort((first, second) => second.score - first.score)
  return scored.map((item) => item.entity_name)
}

/* Build maps from (entity + property IRI) and local property name to resolve argument values. */
function buildPropertyLookup(propertyMappings) {
  const byEntityAndIri = new Map()
  const byEntityAndColumn = new Map()
  for (const row of propertyMappings || []) {
    const entityName = String(row?.entity_name || '').trim()
    const columnName = String(row?.column_name || '').trim()
    const propertyIri = String(row?.property_iri || '').trim()
    if (entityName && propertyIri) {
      byEntityAndIri.set(`${entityName}::${propertyIri}`, columnName)
    }
    if (entityName && columnName) {
      byEntityAndColumn.set(`${entityName}::${columnName.toLowerCase()}`, propertyIri)
    }
  }
  return { byEntityAndIri, byEntityAndColumn }
}

/* Resolve the argument value that corresponds to a guardrail rule property. */
function resolveArgumentValueForRule({ argumentsObj, rule, targetEntityName, lookup }) {
  const propertyIri = String(rule.property_iri || '').trim()
  const localName = iriLocalName(propertyIri)
  const snakeLocal = camelToSnakeIdentifier(localName)

  const columnFromMapping = lookup.byEntityAndIri.get(`${targetEntityName}::${propertyIri}`)
  if (columnFromMapping && Object.prototype.hasOwnProperty.call(argumentsObj, columnFromMapping)) {
    return argumentsObj[columnFromMapping]
  }

  for (const [rawKey, rawValue] of Object.entries(argumentsObj)) {
    const keySnake = camelToSnakeIdentifier(rawKey)
    const keyLower = String(rawKey || '').trim().toLowerCase()
    if (keySnake && keySnake === snakeLocal) {
      return rawValue
    }
    if (localName && keyLower === String(localName).toLowerCase()) {
      return rawValue
    }
    if (columnFromMapping && keySnake === camelToSnakeIdentifier(columnFromMapping)) {
      return rawValue
    }
  }

  return undefined
}

/* Evaluate one stored ontology rule against a single value. */
function evaluateRuleValue(rule, value) {
  const kind = String(rule.rule_kind || '').trim()

  if (kind === 'minCount') {
    const minCount = Number.isFinite(Number(rule.min_count)) ? Number(rule.min_count) : 1
    const hasValue = value !== undefined && value !== null && value !== ''
    if (!hasValue && minCount >= 1) {
      return {
        passed: false,
        detail: `Required property missing or empty (min count ${minCount}).`,
      }
    }
    return { passed: true, detail: 'Value present.' }
  }

  if (value === undefined || value === null) {
    return { passed: true, detail: 'No value supplied; rule not applied.' }
  }

  if (kind === 'pattern') {
    const patternText = String(rule.pattern || '').trim()
    if (!patternText) {
      return { passed: true, detail: 'Rule has no pattern; skipped.' }
    }
    try {
      const regularExpression = new RegExp(patternText)
      const passed = regularExpression.test(String(value))
      return {
        passed,
        detail: passed ? 'Pattern matched.' : `Value does not match pattern: ${patternText}`,
      }
    } catch (error) {
      return { passed: false, detail: `Invalid regex in rule: ${error?.message || 'error'}` }
    }
  }

  if (kind === 'in') {
    let allowedList = []
    try {
      allowedList = rule.allowed_values_json ? JSON.parse(String(rule.allowed_values_json)) : []
    } catch (error) {
      return { passed: false, detail: 'Rule allowed_values_json is invalid JSON.' }
    }
    if (!Array.isArray(allowedList)) {
      return { passed: false, detail: 'Rule allowed values are not a JSON array.' }
    }
    const stringValues = allowedList.map((item) => String(item))
    const passed = stringValues.includes(String(value))
    return {
      passed,
      detail: passed ? 'Value is in the allowed list.' : `Value must be one of: ${stringValues.join(', ')}`,
    }
  }

  if (kind === 'datatype') {
    const datatypeIri = String(rule.datatype_iri || '').trim().toLowerCase()
    if (!datatypeIri) {
      return { passed: true, detail: 'No datatype IRI; skipped.' }
    }
    if (datatypeIri.includes('integer')) {
      const parsed = typeof value === 'number' ? value : Number(value)
      const passed = Number.isFinite(parsed) && Number.isInteger(parsed)
      return { passed, detail: passed ? 'Integer datatype satisfied.' : 'Value must be an integer.' }
    }
    if (datatypeIri.includes('decimal') || datatypeIri.includes('float') || datatypeIri.includes('double')) {
      const parsed = typeof value === 'number' ? value : Number(value)
      const passed = Number.isFinite(parsed)
      return { passed, detail: passed ? 'Numeric datatype satisfied.' : 'Value must be a number.' }
    }
    if (datatypeIri.includes('boolean')) {
      const passed = typeof value === 'boolean' || value === 'true' || value === 'false' || value === 0 || value === 1
      return { passed, detail: passed ? 'Boolean datatype satisfied.' : 'Value must be a boolean.' }
    }
    const passed = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    return { passed, detail: passed ? 'Value is a literal.' : 'Value must be a string, number, or boolean.' }
  }

  return { passed: true, detail: `Unknown rule kind "${kind}"; not evaluated.` }
}

/* Pick relationship definitions that involve inferred Objects. */
function relevantRelationships(relationshipRows, entityNameSet) {
  const result = []
  for (const relationship of relationshipRows || []) {
    const subjectEntity = String(relationship?.subject_entity || '').trim()
    const objectEntity = String(relationship?.object_entity || '').trim()
    if (entityNameSet.has(subjectEntity) || entityNameSet.has(objectEntity)) {
      result.push({
        id: relationship.id,
        relationship_name: relationship.relationship_name,
        subject_entity: subjectEntity,
        object_entity: objectEntity,
        subject_column: relationship.subject_column,
        object_column: relationship.object_column,
        predicate_iri: relationship.predicate_iri,
      })
    }
  }
  return result
}

/*
 * MCP-style policy gate: evaluate guardrail rules + summarize relationships for a proposed tool payload.
 * Does not execute tools or call external MCP — HTTP API only.
 */
export function runMcpInject({ rawBody }) {
  const { toolName, arguments: argumentsObject } = normalizeMcpPayload(rawBody)

  if (!argumentsObject || typeof argumentsObject !== 'object' || Array.isArray(argumentsObject)) {
    throw new Error('mcp-inject expects an object with an "arguments" object (or a plain object of fields)')
  }

  const entities = listCustomEntities()
  const relationshipDefinitions = getRelationshipDefinitions()
  const enabledRules = getOntologyRules().filter((rule) => Number(rule?.is_enabled || 0) === 1)
  const propertyMappings = getPropertyMappings()
  const entityMappings = getEntityMappings()
  const lookup = buildPropertyLookup(propertyMappings)

  const explicitEntityHint = String(argumentsObject.entity_name || argumentsObject.entityName || '').trim()
  let inferredNames = inferEntityNamesFromArguments(argumentsObject, entities)
  if (explicitEntityHint && entities.some((entity) => String(entity.entity_name).trim() === explicitEntityHint)) {
    inferredNames = [explicitEntityHint, ...inferredNames.filter((name) => name !== explicitEntityHint)]
  }

  const primaryEntityName = inferredNames[0] || explicitEntityHint || null

  const applicableEntitySet = new Set()
  for (const name of inferredNames) {
    const trimmed = String(name || '').trim()
    if (trimmed) {
      applicableEntitySet.add(trimmed)
    }
  }
  if (applicableEntitySet.size === 0 && explicitEntityHint) {
    const exists = entities.some((entity) => String(entity.entity_name || '').trim() === explicitEntityHint)
    if (exists) {
      applicableEntitySet.add(explicitEntityHint)
    }
  }

  const scopeNote =
    applicableEntitySet.size > 0
      ? null
      : 'No Object could be inferred from argument keys and no valid entity_name was provided — guardrail rules were not evaluated (nothing to scope policies to).'

  const ruleResults = []
  const violations = []

  for (const rule of enabledRules) {
    const targetEntity = String(rule.target_entity || '').trim()
    if (!targetEntity) {
      continue
    }
    if (applicableEntitySet.size > 0 && !applicableEntitySet.has(targetEntity)) {
      continue
    }
    if (applicableEntitySet.size === 0) {
      continue
    }

    const resolvedValue = resolveArgumentValueForRule({
      argumentsObj: argumentsObject,
      rule,
      targetEntityName: targetEntity,
      lookup,
    })

    const outcome = evaluateRuleValue(rule, resolvedValue)
    const humanMessage =
      String(rule.message || '').trim() ||
      `${rule.rule_name}: ${outcome.detail}`

    ruleResults.push({
      rule_id: rule.id,
      rule_name: rule.rule_name,
      target_entity: targetEntity,
      rule_kind: rule.rule_kind,
      property_iri: rule.property_iri,
      passed: outcome.passed,
      detail: outcome.detail,
      message: humanMessage,
      value_seen: resolvedValue === undefined ? null : resolvedValue,
    })

    if (!outcome.passed) {
      violations.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        target_entity: targetEntity,
        reason: humanMessage,
      })
    }
  }

  const allowed = violations.length === 0
  const relationshipSummary = relevantRelationships(relationshipDefinitions, applicableEntitySet)

  const reasoningParts = []
  if (toolName) {
    reasoningParts.push(`Tool "${toolName}" was reviewed against stored ontology guardrails.`)
  } else {
    reasoningParts.push('Payload was reviewed against stored ontology guardrails.')
  }
  if (primaryEntityName) {
    reasoningParts.push(`Primary Object for this review: "${primaryEntityName}".`)
  } else if (scopeNote) {
    reasoningParts.push(scopeNote)
  } else {
    reasoningParts.push('No primary Object name was resolved from the payload.')
  }
  reasoningParts.push(
    `Evaluated ${ruleResults.length} applicable enabled rule(s); ${violations.length} violation(s).`,
  )
  if (allowed) {
    reasoningParts.push('Result: allowed — no failing guardrail checks for this payload.')
  } else {
    reasoningParts.push(`Result: blocked — ${violations[0]?.reason || 'guardrail failure'}`)
  }

  const nextAction = allowed
    ? {
        type: 'execute',
        detail: 'Ontology guardrails passed; safe to proceed with tool execution in an integrated MCP host.',
      }
    : {
        type: 'reject',
        reason: violations[0]?.reason || 'Ontology guardrail violation',
        rule_id: violations[0]?.rule_id ?? null,
        rule_name: violations[0]?.rule_name ?? null,
      }

  return {
    ok: true,
    mode: 'mcp_inject',
    allowed,
    tool: toolName,
    inferred_entities: inferredNames,
    primary_entity: primaryEntityName,
    reasoning: reasoningParts.join(' '),
    violations,
    relationships: relationshipSummary,
    entity_mappings: entityMappings.filter((row) => applicableEntitySet.has(String(row.entity_name || '').trim())),
    business_rules: {
      evaluated: ruleResults.length,
      results: ruleResults,
    },
    nextAction,
  }
}
