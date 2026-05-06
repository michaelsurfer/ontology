/* Enrich ontology schema JSON for NL→SPARQL so models match how the Turtle export works. */

/* Map entity table names to OWL class IRIs from entity_mappings (used to ground relationship hints). */
function buildClassIriByEntityName(schemaContext) {
  const classIriByEntityName = new Map()
  const entityMappings = Array.isArray(schemaContext.entityMappings) ? schemaContext.entityMappings : []
  for (const entityMapping of entityMappings) {
    if (!entityMapping || typeof entityMapping !== 'object') {
      continue
    }
    const entityName = String(entityMapping.entity_name || '').trim()
    const classIri = String(entityMapping.class_iri || '').trim()
    if (entityName && classIri) {
      classIriByEntityName.set(entityName, classIri)
    }
  }
  return classIriByEntityName
}

/* Build a minimal SELECT body the model can copy so predicate and class IRIs are exact. */
function buildCopyReadySparqlFragment({ domainClassIri, rangeClassIri, predicateIri }) {
  const domain = String(domainClassIri || '').trim()
  const range = String(rangeClassIri || '').trim()
  const predicate = String(predicateIri || '').trim()
  if (!domain || !range || !predicate) {
    return null
  }
  return [
    'SELECT ?domainIndividual ?rangeIndividual WHERE {',
    `  ?domainIndividual rdf:type <${domain}> .`,
    `  ?rangeIndividual rdf:type <${range}> .`,
    `  ?domainIndividual <${predicate}> ?rangeIndividual .`,
    '}',
    'LIMIT 50',
  ].join('\n')
}

/* Collect likely human-readable property IRIs per entity (name/title/label first, then text fields). */
function buildReadablePropertyHintsByEntityName(schemaContext) {
  const readableByEntityName = new Map()
  const propertyMappings = Array.isArray(schemaContext.propertyMappings) ? schemaContext.propertyMappings : []

  for (const propertyMapping of propertyMappings) {
    if (!propertyMapping || typeof propertyMapping !== 'object') {
      continue
    }
    const entityName = String(propertyMapping.entity_name || '').trim()
    const columnName = String(propertyMapping.column_name || '').trim().toLowerCase()
    const propertyIri = String(propertyMapping.property_iri || '').trim()
    const datatypeIri = String(propertyMapping.datatype_iri || '').trim().toLowerCase()
    if (!entityName || !propertyIri) {
      continue
    }

    const looksLikeTextDatatype =
      !datatypeIri ||
      datatypeIri.endsWith('#string') ||
      datatypeIri.endsWith('#normalizedstring') ||
      datatypeIri.endsWith('#token')
    const looksLikeReadableColumn =
      columnName.includes('name') ||
      columnName.includes('title') ||
      columnName.includes('label') ||
      columnName.includes('display')

    if (!looksLikeTextDatatype && !looksLikeReadableColumn) {
      continue
    }

    const current = readableByEntityName.get(entityName) || []
    current.push({
      property_iri: propertyIri,
      column_name: String(propertyMapping.column_name || '').trim(),
      preference_score: looksLikeReadableColumn ? 2 : 1,
    })
    readableByEntityName.set(entityName, current)
  }

  for (const [entityName, hints] of readableByEntityName.entries()) {
    hints.sort((left, right) => right.preference_score - left.preference_score)
    readableByEntityName.set(entityName, hints.map((hint) => hint.property_iri))
  }

  return readableByEntityName
}

/* Return true when the relationship uses a SQL link table (junction) for instance links. */
function relationshipHasLinkTable(relationship) {
  if (!relationship || typeof relationship !== 'object') {
    return false
  }
  return Boolean(
    String(relationship.junction_entity || '').trim() &&
      String(relationship.junction_subject_column || '').trim() &&
      String(relationship.junction_object_column || '').trim(),
  )
}

/* Build example SPARQL for subclass hierarchy (RDFS is not inferred — queries must traverse rdfs:subClassOf). */
function buildSubclassSparqlFragments({ childClassIri, parentClassIri }) {
  const child = String(childClassIri || '').trim()
  const parent = String(parentClassIri || '').trim()
  if (!child || !parent) {
    return null
  }
  return {
    select_confirm_child_subclass_of_parent: [
      'SELECT ?childClass ?parentClass WHERE {',
      `  BIND(<${child}> AS ?childClass)`,
      `  BIND(<${parent}> AS ?parentClass)`,
      '  ?childClass rdfs:subClassOf+ ?parentClass .',
      '}',
      'LIMIT 5',
    ].join('\n'),
    select_instances_typed_child_only: [
      'SELECT ?individual WHERE {',
      `  ?individual rdf:type <${child}> .`,
      '}',
      'LIMIT 50',
    ].join('\n'),
    select_instances_under_parent_including_subclasses: [
      'SELECT ?individual ?typeClass WHERE {',
      '  ?individual rdf:type ?typeClass .',
      `  ?typeClass rdfs:subClassOf* <${parent}> .`,
      '}',
      'LIMIT 50',
    ].join('\n'),
  }
}

/* Add SPARQL-oriented hints: link tables are flattened to direct object-property triples in RDF. */
export function enrichSchemaContextForSparql(schemaContext) {
  if (!schemaContext || typeof schemaContext !== 'object') {
    return schemaContext
  }

  const relationships = Array.isArray(schemaContext.relationships) ? schemaContext.relationships : []
  const classIriByEntityName = buildClassIriByEntityName(schemaContext)
  const readablePropertyIrisByEntityName = buildReadablePropertyHintsByEntityName(schemaContext)

  const entityMappingsForSubclass = Array.isArray(schemaContext.entityMappings) ? schemaContext.entityMappings : []
  const sparqlSubclassHints = entityMappingsForSubclass
    .map((entityMapping) => {
      if (!entityMapping || typeof entityMapping !== 'object') {
        return null
      }
      const childEntity = String(entityMapping.entity_name || '').trim()
      const parentEntity = entityMapping.parent_entity_name
        ? String(entityMapping.parent_entity_name || '').trim()
        : ''
      if (!childEntity || !parentEntity) {
        return null
      }
      const childClassIri = classIriByEntityName.get(childEntity) || ''
      const parentClassIri = classIriByEntityName.get(parentEntity) || ''
      if (!childClassIri || !parentClassIri) {
        return null
      }
      const sparqlFragments = buildSubclassSparqlFragments({
        childClassIri,
        parentClassIri,
      })
      return {
        child_entity: childEntity,
        parent_entity: parentEntity,
        child_class_iri: childClassIri,
        parent_class_iri: parentClassIri,
        rdf_pattern: `<${childClassIri}> rdfs:subClassOf <${parentClassIri}> .`,
        query_note:
          'Individuals use rdf:type with the child class IRI only. Filtering ?x rdf:type <parent_class_iri> misses subclass instances; use ?x rdf:type ?c . ?c rdfs:subClassOf* <parent_class_iri> . instead.',
        sparql_fragments: sparqlFragments,
      }
    })
    .filter(Boolean)

  const sparqlRelationshipHints = relationships.map((rel) => {
    const hasLink = relationshipHasLinkTable(rel)
    const subjectEntity = String(rel.subject_entity || '').trim()
    const objectEntity = String(rel.object_entity || '').trim()
    const predicateIri = String(rel.predicate_iri || '').trim()
    const domainClassIri = classIriByEntityName.get(subjectEntity) || ''
    const rangeClassIri = classIriByEntityName.get(objectEntity) || ''
    const domainReadablePropertyIris = readablePropertyIrisByEntityName.get(subjectEntity) || []
    const rangeReadablePropertyIris = readablePropertyIrisByEntityName.get(objectEntity) || []
    const copyReadySparqlFragment = buildCopyReadySparqlFragment({
      domainClassIri,
      rangeClassIri,
      predicateIri,
    })
    return {
      id: rel.id,
      relationship_name: rel.relationship_name,
      subject_entity: rel.subject_entity,
      subject_column: rel.subject_column,
      object_entity: rel.object_entity,
      object_column: rel.object_column,
      predicate_iri: rel.predicate_iri,
      domain_class_iri: domainClassIri || null,
      range_class_iri: rangeClassIri || null,
      domain_readable_property_iris: domainReadablePropertyIris,
      range_readable_property_iris: rangeReadablePropertyIris,
      query_result_note:
        'When returning people/things (not counts), include at least one readable literal from *_readable_property_iris using OPTIONAL so results show names instead of only IRIs.',
      triple_direction_note:
        `Individuals from entity table "${subjectEntity}" are the SUBJECT; ` +
        `individuals from "${objectEntity}" are the OBJECT of <${predicateIri}>. ` +
        'For inverse questions (range → domain), keep the same predicate and swap which variable you bind or filter.',
      uses_sql_link_table: hasLink,
      sql_link_table: hasLink ? rel.junction_entity : null,
      sql_link_columns: hasLink
        ? { subject_fk: rel.junction_subject_column, object_fk: rel.junction_object_column }
        : null,
      copy_ready_sparql_fragment: copyReadySparqlFragment,
      rdf_pattern:
        domainClassIri && rangeClassIri
          ? `?domainIndividual rdf:type <${domainClassIri}> . ?rangeIndividual rdf:type <${rangeClassIri}> . ?domainIndividual <${predicateIri}> ?rangeIndividual .`
          : `?domainIndividual <${predicateIri}> ?rangeIndividual . (add rdf:type using class_iri for "${subjectEntity}" and "${objectEntity}" from entity_mappings)`,
      important:
        'The RDF graph has NO resources for individual link rows. Membership is only visible as this single predicate between entity individuals. Never use rdf:type with sql_link_table.',
    }
  })

  const subclassNotes =
    sparqlSubclassHints.length > 0
      ? [
          'Class hierarchy is in sparqlSubclassHints (rdfs:subClassOf between class IRIs). It is NOT in sparqlRelationshipHints.',
          'Individuals are typed with rdf:type using the child (leaf) class IRI only. The SPARQL engine does not infer types for parents.',
          'To list everyone under a parent class, use sparql_fragments.select_instances_under_parent_including_subclasses or an equivalent ?typeClass rdfs:subClassOf* <parent_class_iri> pattern.',
        ]
      : []

  const listAllSubclassEdgesSparql = [
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'SELECT ?childClass ?parentClass WHERE {',
    '  ?childClass rdfs:subClassOf ?parentClass .',
    '}',
    'LIMIT 50',
  ].join('\n')

  return {
    ...schemaContext,
    sparql_list_all_subclass_edges: listAllSubclassEdgesSparql,
    sparqlGraphModelNotes: [
      ...subclassNotes,
      'The SPARQL endpoint supports SELECT only (no ASK). To list every subclass edge in the graph, use sparql_list_all_subclass_edges.',
      'SQL link tables store pairwise keys; the RDF export materializes them as simple triples: subjectIndividual predicate_iri objectIndividual.',
      'Do not introduce a variable for a "link row" or link table class — those rows are not exported as typed nodes.',
      'For any question about links between two entity tables, locate the matching sparqlRelationshipHints row (subject_entity + object_entity) and reuse predicate_iri, domain_class_iri, and range_class_iri exactly. Start from copy_ready_sparql_fragment when present.',
      'Legacy relationships without junction_entity still use a direct SQL join in the export; the same SPARQL pattern applies.',
    ],
    sparqlSubclassHints,
    sparqlRelationshipHints,
  }
}
