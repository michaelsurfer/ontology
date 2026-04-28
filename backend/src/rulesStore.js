import { getDatabase } from './database.js'

/* Fetch all ontology rules (SHACL constraints). */
export function getOntologyRules() {
  const database = getDatabase()
  return database.prepare('SELECT * FROM ontology_rules ORDER BY id DESC').all()
}

/* Create a new ontology rule (SHACL constraint). */
export function createOntologyRule(inputData) {
  const database = getDatabase()
  const rule = normalizeOntologyRuleInput(inputData)

  const result = database
    .prepare(
      `
      INSERT INTO ontology_rules (
        rule_name,
        target_entity,
        rule_kind,
        property_iri,
        datatype_iri,
        pattern,
        allowed_values_json,
        min_count,
        max_count,
        message,
        severity_iri,
        is_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      rule.rule_name,
      rule.target_entity,
      rule.rule_kind,
      rule.property_iri,
      rule.datatype_iri,
      rule.pattern,
      rule.allowed_values_json,
      rule.min_count,
      rule.max_count,
      rule.message,
      rule.severity_iri,
      rule.is_enabled,
    )

  return database.prepare('SELECT * FROM ontology_rules WHERE id = ?').get(result.lastInsertRowid)
}

/* Update an existing ontology rule. */
export function updateOntologyRule(id, inputData) {
  const database = getDatabase()
  const rule = normalizeOntologyRuleInput(inputData)

  database
    .prepare(
      `
      UPDATE ontology_rules
      SET
        rule_name = ?,
        target_entity = ?,
        rule_kind = ?,
        property_iri = ?,
        datatype_iri = ?,
        pattern = ?,
        allowed_values_json = ?,
        min_count = ?,
        max_count = ?,
        message = ?,
        severity_iri = ?,
        is_enabled = ?
      WHERE id = ?
    `,
    )
    .run(
      rule.rule_name,
      rule.target_entity,
      rule.rule_kind,
      rule.property_iri,
      rule.datatype_iri,
      rule.pattern,
      rule.allowed_values_json,
      rule.min_count,
      rule.max_count,
      rule.message,
      rule.severity_iri,
      rule.is_enabled,
      Number(id),
    )

  return database.prepare('SELECT * FROM ontology_rules WHERE id = ?').get(Number(id))
}

/* Delete an ontology rule by id. */
export function deleteOntologyRule(id) {
  const database = getDatabase()
  database.prepare('DELETE FROM ontology_rules WHERE id = ?').run(Number(id))
}

/* Normalize and validate ontology rule input fields. */
function normalizeOntologyRuleInput(inputData) {
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const minCount = safeInputData.min_count === null || safeInputData.min_count === undefined ? null : Number(safeInputData.min_count)
  const maxCount = safeInputData.max_count === null || safeInputData.max_count === undefined ? null : Number(safeInputData.max_count)

  const allowedValues = Array.isArray(safeInputData.allowed_values)
    ? safeInputData.allowed_values.map((value) => String(value))
    : null

  const rule = {
    rule_name: String(safeInputData.rule_name || '').trim(),
    target_entity: String(safeInputData.target_entity || '').trim(),
    rule_kind: String(safeInputData.rule_kind || '').trim(),
    property_iri: String(safeInputData.property_iri || '').trim(),
    datatype_iri: safeInputData.datatype_iri ? String(safeInputData.datatype_iri).trim() : null,
    pattern: safeInputData.pattern ? String(safeInputData.pattern).trim() : null,
    allowed_values_json: allowedValues ? JSON.stringify(allowedValues) : null,
    min_count: Number.isFinite(minCount) ? minCount : null,
    max_count: Number.isFinite(maxCount) ? maxCount : null,
    message: safeInputData.message ? String(safeInputData.message).trim() : null,
    severity_iri: safeInputData.severity_iri ? String(safeInputData.severity_iri).trim() : null,
    is_enabled: safeInputData.is_enabled === 0 || safeInputData.is_enabled === false ? 0 : 1,
  }

  const missingFields = ['rule_name', 'target_entity', 'rule_kind', 'property_iri'].filter((fieldName) => !rule[fieldName])
  if (missingFields.length > 0) {
    throw new Error(`Missing fields: ${missingFields.join(', ')}`)
  }

  return rule
}

