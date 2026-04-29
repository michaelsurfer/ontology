import { DataFactory, Writer } from 'n3'
import { getDatabase } from './database.js'

const { namedNode, literal, quad, blankNode } = DataFactory

/* Generate SHACL shapes (Turtle) from stored ontology rules. */
export async function createShaclTurtleExport() {
  const database = getDatabase()

  const ontologySettings = database
    .prepare('SELECT id, base_iri FROM ontology_settings WHERE id = 1')
    .get()

  const baseIri = ontologySettings?.base_iri || 'http://example.com/context#'

  const entityMappings = database
    .prepare('SELECT entity_name, class_iri FROM entity_mappings ORDER BY entity_name ASC')
    .all()

  const classIriByEntityName = new Map(entityMappings.map((mapping) => [mapping.entity_name, mapping.class_iri]))

  const rules = database
    .prepare('SELECT * FROM ontology_rules WHERE is_enabled = 1 ORDER BY id ASC')
    .all()

  const writer = new Writer({
    prefixes: {
      sh: 'http://www.w3.org/ns/shacl#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      ex: baseIri,
    },
  })

  const shNodeShape = namedNode('http://www.w3.org/ns/shacl#NodeShape')
  const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
  const shTargetClass = namedNode('http://www.w3.org/ns/shacl#targetClass')
  const shProperty = namedNode('http://www.w3.org/ns/shacl#property')
  const shPath = namedNode('http://www.w3.org/ns/shacl#path')
  const shMinCount = namedNode('http://www.w3.org/ns/shacl#minCount')
  const shMaxCount = namedNode('http://www.w3.org/ns/shacl#maxCount')
  const shDatatype = namedNode('http://www.w3.org/ns/shacl#datatype')
  const shPattern = namedNode('http://www.w3.org/ns/shacl#pattern')
  const shIn = namedNode('http://www.w3.org/ns/shacl#in')
  const shMessage = namedNode('http://www.w3.org/ns/shacl#message')
  const shSeverity = namedNode('http://www.w3.org/ns/shacl#severity')

  for (const rule of rules) {
    const classIri = classIriByEntityName.get(rule.target_entity)
    if (!classIri) {
      continue
    }

    const shapeNode = namedNode(`${baseIri}RuleShape${rule.id}`)
    writer.addQuad(quad(shapeNode, rdfType, shNodeShape))
    writer.addQuad(quad(shapeNode, shTargetClass, namedNode(classIri)))

    const propertyShapeNode = blankNode()
    writer.addQuad(quad(shapeNode, shProperty, propertyShapeNode))
    writer.addQuad(quad(propertyShapeNode, shPath, namedNode(rule.property_iri)))

    if (rule.min_count !== null && rule.min_count !== undefined) {
      writer.addQuad(quad(propertyShapeNode, shMinCount, literal(String(rule.min_count), namedNode('http://www.w3.org/2001/XMLSchema#integer'))))
    }
    if (rule.max_count !== null && rule.max_count !== undefined) {
      writer.addQuad(quad(propertyShapeNode, shMaxCount, literal(String(rule.max_count), namedNode('http://www.w3.org/2001/XMLSchema#integer'))))
    }

    if (rule.datatype_iri) {
      writer.addQuad(quad(propertyShapeNode, shDatatype, namedNode(rule.datatype_iri)))
    }

    if (rule.pattern) {
      writer.addQuad(quad(propertyShapeNode, shPattern, literal(rule.pattern)))
    }

    if (rule.allowed_values_json) {
      const allowedValues = safeJsonArrayParse(rule.allowed_values_json)
      if (allowedValues.length > 0) {
        const listHead = createRdfList(writer, allowedValues.map((value) => literal(String(value))))
        writer.addQuad(quad(propertyShapeNode, shIn, listHead))
      }
    }

    if (rule.message) {
      writer.addQuad(quad(propertyShapeNode, shMessage, literal(rule.message)))
    }

    if (rule.severity_iri) {
      writer.addQuad(quad(propertyShapeNode, shSeverity, namedNode(rule.severity_iri)))
    }
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

/* Parse JSON array; return [] if invalid. */
function safeJsonArrayParse(value) {
  try {
    const parsed = JSON.parse(String(value || ''))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

/* Create an RDF list and return its head node. */
function createRdfList(writer, items) {
  const rdfFirst = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first')
  const rdfRest = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest')
  const rdfNil = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')

  if (!items || items.length === 0) {
    return rdfNil
  }

  const head = blankNode()
  let current = head

  for (let index = 0; index < items.length; index += 1) {
    writer.addQuad(quad(current, rdfFirst, items[index]))

    const isLast = index === items.length - 1
    if (isLast) {
      writer.addQuad(quad(current, rdfRest, rdfNil))
    } else {
      const next = blankNode()
      writer.addQuad(quad(current, rdfRest, next))
      current = next
    }
  }

  return head
}

