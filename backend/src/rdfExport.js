import { DataFactory, Writer } from 'n3'
import { getDatabase } from './database.js'

const { namedNode, literal, quad } = DataFactory

/* Quote a SQLite identifier so reserved words (e.g. group, order) are valid. */
function quoteSqlIdent(rawName) {
  const name = String(rawName ?? '').trim()
  if (!name) {
    throw new Error('SQL identifier is empty')
  }
  return `"${name.replace(/"/g, '""')}"`
}

/* Generate a Turtle export that includes OWL schema and/or instance data. */
export function createRdfTurtleExport(exportOptions) {
  const normalizedExportOptions = normalizeExportOptions(exportOptions)

  const database = getDatabase()

  const ontologySettings = database
    .prepare('SELECT id, base_iri FROM ontology_settings WHERE id = 1')
    .get()

  const entityMappings = database
    .prepare('SELECT * FROM entity_mappings ORDER BY entity_name ASC')
    .all()

  const propertyMappings = database
    .prepare('SELECT * FROM property_mappings ORDER BY entity_name ASC, column_name ASC')
    .all()

  const relationshipDefinitions = database
    .prepare('SELECT * FROM relationship_definitions ORDER BY id ASC')
    .all()

  const baseIri = ontologySettings?.base_iri || 'http://example.com/context#'

  const writer = new Writer({
    prefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      ex: baseIri,
      res: 'http://example.com/resource/',
    },
  })

  if (normalizedExportOptions.includeOntology) {
    addOntologyTriples(writer, { baseIri, entityMappings, propertyMappings, relationshipDefinitions })
  }

  if (normalizedExportOptions.includeData) {
    addInstanceDataTriples(writer, {
      entityMappings,
      propertyMappings,
      relationshipDefinitions,
      maxRowsPerEntity: normalizedExportOptions.maxRowsPerEntity,
    })
  }

  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    })
  })
}

/* Normalize export options to safe defaults. */
function normalizeExportOptions(exportOptions) {
  const safeExportOptions = exportOptions && typeof exportOptions === 'object' ? exportOptions : {}

  return {
    includeOntology: safeExportOptions.includeOntology !== false,
    includeData: safeExportOptions.includeData !== false,
    maxRowsPerEntity: Number.isFinite(safeExportOptions.maxRowsPerEntity)
      ? Number(safeExportOptions.maxRowsPerEntity)
      : 200,
  }
}

/* Add OWL class and property definitions for the mapped CRM schema. */
function addOntologyTriples(writer, { baseIri, entityMappings, propertyMappings, relationshipDefinitions }) {
  const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
  const owlOntology = namedNode('http://www.w3.org/2002/07/owl#Ontology')
  const owlClass = namedNode('http://www.w3.org/2002/07/owl#Class')
  const owlObjectProperty = namedNode('http://www.w3.org/2002/07/owl#ObjectProperty')
  const owlDatatypeProperty = namedNode('http://www.w3.org/2002/07/owl#DatatypeProperty')
  const rdfsDomain = namedNode('http://www.w3.org/2000/01/rdf-schema#domain')
  const rdfsRange = namedNode('http://www.w3.org/2000/01/rdf-schema#range')
  const rdfsLabel = namedNode('http://www.w3.org/2000/01/rdf-schema#label')
  const rdfsSubClassOf = namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf')

  writer.addQuad(quad(namedNode(baseIri), rdfType, owlOntology))

  const classIriByEntityName = new Map(
    entityMappings.map((entityMapping) => [entityMapping.entity_name, entityMapping.class_iri]),
  )

  for (const entityMapping of entityMappings) {
    writer.addQuad(quad(namedNode(entityMapping.class_iri), rdfType, owlClass))
    writer.addQuad(
      quad(namedNode(entityMapping.class_iri), rdfsLabel, literal(humanizeName(entityMapping.entity_name))),
    )
    const parentEntityName = entityMapping.parent_entity_name
      ? String(entityMapping.parent_entity_name || '').trim()
      : ''
    if (parentEntityName) {
      const parentClassIri = classIriByEntityName.get(parentEntityName)
      if (parentClassIri) {
        writer.addQuad(quad(namedNode(entityMapping.class_iri), rdfsSubClassOf, namedNode(parentClassIri)))
      }
    }
  }

  for (const propertyMapping of propertyMappings) {
    const domainClassIri = classIriByEntityName.get(propertyMapping.entity_name)
    if (!domainClassIri) {
      continue
    }

    const rangeIri = propertyMapping.datatype_iri || 'http://www.w3.org/2001/XMLSchema#string'

    writer.addQuad(quad(namedNode(propertyMapping.property_iri), rdfType, owlDatatypeProperty))
    writer.addQuad(quad(namedNode(propertyMapping.property_iri), rdfsDomain, namedNode(domainClassIri)))
    writer.addQuad(quad(namedNode(propertyMapping.property_iri), rdfsRange, namedNode(rangeIri)))
    writer.addQuad(
      quad(
        namedNode(propertyMapping.property_iri),
        rdfsLabel,
        literal(humanizeName(`${propertyMapping.entity_name}.${propertyMapping.column_name}`)),
      ),
    )
  }

  for (const relationshipDefinition of relationshipDefinitions) {
    const domainClassIri = classIriByEntityName.get(relationshipDefinition.subject_entity)
    const rangeClassIri = classIriByEntityName.get(relationshipDefinition.object_entity)
    if (!domainClassIri || !rangeClassIri) {
      continue
    }

    writer.addQuad(quad(namedNode(relationshipDefinition.predicate_iri), rdfType, owlObjectProperty))
    writer.addQuad(quad(namedNode(relationshipDefinition.predicate_iri), rdfsDomain, namedNode(domainClassIri)))
    writer.addQuad(quad(namedNode(relationshipDefinition.predicate_iri), rdfsRange, namedNode(rangeClassIri)))
    writer.addQuad(
      quad(
        namedNode(relationshipDefinition.predicate_iri),
        rdfsLabel,
        literal(relationshipDefinition.relationship_name),
      ),
    )
  }
}

/* Add RDF instance data triples (rows become individuals). */
function addInstanceDataTriples(writer, { entityMappings, propertyMappings, relationshipDefinitions, maxRowsPerEntity }) {
  const database = getDatabase()
  const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')

  const entityMappingByEntityName = new Map(
    entityMappings.map((entityMapping) => [entityMapping.entity_name, entityMapping]),
  )

  const propertyMappingsByEntityName = new Map()
  for (const propertyMapping of propertyMappings) {
    const existingMappings = propertyMappingsByEntityName.get(propertyMapping.entity_name) || []
    existingMappings.push(propertyMapping)
    propertyMappingsByEntityName.set(propertyMapping.entity_name, existingMappings)
  }

  const iriByEntityAndId = new Map()

  for (const entityMapping of entityMappings) {
    const rows = database
      .prepare(`SELECT * FROM ${quoteSqlIdent(entityMapping.entity_name)} ORDER BY id ASC LIMIT ?`)
      .all(maxRowsPerEntity)

    const entityPropertyMappings = propertyMappingsByEntityName.get(entityMapping.entity_name) || []

    for (const row of rows) {
      const subjectIri = applySubjectIriTemplate(entityMapping.subject_iri_template, row)
      iriByEntityAndId.set(`${entityMapping.entity_name}:${row.id}`, subjectIri)

      writer.addQuad(quad(namedNode(subjectIri), rdfType, namedNode(entityMapping.class_iri)))

      for (const propertyMapping of entityPropertyMappings) {
        const value = row[propertyMapping.column_name]
        if (value === null || value === undefined || value === '') {
          continue
        }

        writer.addQuad(
          quad(
            namedNode(subjectIri),
            namedNode(propertyMapping.property_iri),
            createLiteralValue(value, propertyMapping.datatype_iri, propertyMapping.language_tag),
          ),
        )
      }
    }
  }

  for (const relationshipDefinition of relationshipDefinitions) {
    const subjectEntityMapping = entityMappingByEntityName.get(relationshipDefinition.subject_entity)
    const objectEntityMapping = entityMappingByEntityName.get(relationshipDefinition.object_entity)
    if (!subjectEntityMapping || !objectEntityMapping) {
      continue
    }

    if (relationshipDefinitionUsesJunction(relationshipDefinition)) {
      emitJunctionManyToManyTriples({
        writer,
        database,
        relationshipDefinition,
        subjectEntityMapping,
        objectEntityMapping,
        iriByEntityAndId,
        maxRowsPerEntity,
      })
    } else {
      emitDirectJoinObjectPropertyTriples({
        writer,
        database,
        relationshipDefinition,
        subjectEntityMapping,
        objectEntityMapping,
        iriByEntityAndId,
        maxRowsPerEntity,
      })
    }
  }
}

/* True when this relationship links subject and object rows through a junction table (many-to-many). */
function relationshipDefinitionUsesJunction(relationshipDefinition) {
  const junctionTable = relationshipDefinition && relationshipDefinition.junction_entity
  const junctionSubjectCol = relationshipDefinition && relationshipDefinition.junction_subject_column
  const junctionObjectCol = relationshipDefinition && relationshipDefinition.junction_object_column
  return Boolean(
    String(junctionTable || '').trim() &&
      String(junctionSubjectCol || '').trim() &&
      String(junctionObjectCol || '').trim(),
  )
}

/* Emit object-property triples where subject and object rows match on one pair of columns (1:1 / 1:N style joins). */
function emitDirectJoinObjectPropertyTriples({
  writer,
  database,
  relationshipDefinition,
  subjectEntityMapping,
  objectEntityMapping,
  iriByEntityAndId,
  maxRowsPerEntity,
}) {
  const subjectTable = quoteSqlIdent(relationshipDefinition.subject_entity)
  const objectTable = quoteSqlIdent(relationshipDefinition.object_entity)
  const subjectCol = quoteSqlIdent(relationshipDefinition.subject_column)
  const objectCol = quoteSqlIdent(relationshipDefinition.object_column)

  const subjectRows = database
    .prepare(`SELECT id, ${subjectCol} AS join_value FROM ${subjectTable} LIMIT ?`)
    .all(maxRowsPerEntity)

  const objectRows = database
    .prepare(`SELECT id, ${objectCol} AS join_value FROM ${objectTable} LIMIT ?`)
    .all(maxRowsPerEntity)

  const objectIdsByJoinValue = new Map()
  for (const objectRow of objectRows) {
    if (objectRow.join_value === null || objectRow.join_value === undefined) {
      continue
    }
    const mapKey = String(objectRow.join_value)
    const list = objectIdsByJoinValue.get(mapKey) || []
    list.push(objectRow.id)
    objectIdsByJoinValue.set(mapKey, list)
  }

  for (const subjectRow of subjectRows) {
    if (subjectRow.join_value === null || subjectRow.join_value === undefined) {
      continue
    }

    const subjectIri =
      iriByEntityAndId.get(`${relationshipDefinition.subject_entity}:${subjectRow.id}`) ||
      applySubjectIriTemplate(subjectEntityMapping.subject_iri_template, { id: subjectRow.id })

    const matchedObjectIds = objectIdsByJoinValue.get(String(subjectRow.join_value)) || []
    for (const objectId of matchedObjectIds) {
      const objectIri =
        iriByEntityAndId.get(`${relationshipDefinition.object_entity}:${objectId}`) ||
        applySubjectIriTemplate(objectEntityMapping.subject_iri_template, { id: objectId })

      writer.addQuad(quad(namedNode(subjectIri), namedNode(relationshipDefinition.predicate_iri), namedNode(objectIri)))
    }
  }
}

/* Emit object-property triples for link-table relationships (two FK columns per link row). */
function emitJunctionManyToManyTriples({
  writer,
  database,
  relationshipDefinition,
  subjectEntityMapping,
  objectEntityMapping,
  iriByEntityAndId,
  maxRowsPerEntity,
}) {
  const junctionTable = String(relationshipDefinition.junction_entity || '').trim()
  const junctionSubjectCol = String(relationshipDefinition.junction_subject_column || '').trim()
  const junctionObjectCol = String(relationshipDefinition.junction_object_column || '').trim()
  const subjectEntity = String(relationshipDefinition.subject_entity || '').trim()
  const objectEntity = String(relationshipDefinition.object_entity || '').trim()
  const subjectColumn = String(relationshipDefinition.subject_column || '').trim()
  const objectColumn = String(relationshipDefinition.object_column || '').trim()

  const junctionRowLimit = Math.min(10000, Math.max(maxRowsPerEntity, maxRowsPerEntity * 10))

  const junctionRows = database
    .prepare(
      `SELECT ${quoteSqlIdent(junctionSubjectCol)} AS subject_join, ${quoteSqlIdent(
        junctionObjectCol,
      )} AS object_join FROM ${quoteSqlIdent(junctionTable)} LIMIT ?`,
    )
    .all(junctionRowLimit)

  const resolveSubjectId = database.prepare(
    `SELECT id FROM ${quoteSqlIdent(subjectEntity)} WHERE ${quoteSqlIdent(subjectColumn)} = ? LIMIT 1`,
  )
  const resolveObjectId = database.prepare(
    `SELECT id FROM ${quoteSqlIdent(objectEntity)} WHERE ${quoteSqlIdent(objectColumn)} = ? LIMIT 1`,
  )

  for (const junctionRow of junctionRows) {
    if (
      junctionRow.subject_join === null ||
      junctionRow.subject_join === undefined ||
      junctionRow.object_join === null ||
      junctionRow.object_join === undefined
    ) {
      continue
    }

    const subjectRow = resolveSubjectId.get(junctionRow.subject_join)
    const objectRow = resolveObjectId.get(junctionRow.object_join)
    if (!subjectRow || !objectRow) {
      continue
    }

    const subjectIri =
      iriByEntityAndId.get(`${subjectEntity}:${subjectRow.id}`) ||
      applySubjectIriTemplate(subjectEntityMapping.subject_iri_template, { id: subjectRow.id })

    const objectIri =
      iriByEntityAndId.get(`${objectEntity}:${objectRow.id}`) ||
      applySubjectIriTemplate(objectEntityMapping.subject_iri_template, { id: objectRow.id })

    writer.addQuad(quad(namedNode(subjectIri), namedNode(relationshipDefinition.predicate_iri), namedNode(objectIri)))
  }
}

/* Apply the IRI template to a row (supports {id}). */
function applySubjectIriTemplate(subjectIriTemplate, row) {
  const safeTemplate = String(subjectIriTemplate || '')
  const safeId = row && row.id !== undefined && row.id !== null ? String(row.id) : ''
  return safeTemplate.replaceAll('{id}', encodeURIComponent(safeId))
}

/* Create an RDF literal value with optional datatype or language tag. */
function createLiteralValue(value, datatypeIri, languageTag) {
  if (languageTag) {
    return literal(String(value), languageTag)
  }
  if (datatypeIri) {
    return literal(String(value), namedNode(datatypeIri))
  }
  return literal(String(value))
}

/* Convert a snake_case or dot-separated name into a human-readable label. */
function humanizeName(value) {
  return String(value || '')
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

