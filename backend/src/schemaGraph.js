import { getDatabase } from './database.js'

/* Build a schema-level graph (classes + object properties) for visualization. */
export function getSchemaGraph() {
  const database = getDatabase()

  const entityMappings = database
    .prepare('SELECT entity_name, class_iri, parent_entity_name FROM entity_mappings ORDER BY entity_name ASC')
    .all()

  const relationshipDefinitions = database
    .prepare(
      'SELECT id, relationship_name, subject_entity, subject_column, predicate_iri, object_entity, object_column, junction_entity, junction_subject_column, junction_object_column, junction_auto_created FROM relationship_definitions ORDER BY id ASC',
    )
    .all()

  const nodes = entityMappings.map((entityMapping, index) => ({
    id: entityMapping.entity_name,
    type: 'default',
    data: {
      label: entityMapping.entity_name,
      class_iri: entityMapping.class_iri,
    },
    position: {
      x: 80 + (index % 4) * 260,
      y: 80 + Math.floor(index / 4) * 160,
    },
  }))

  const relationshipEdges = relationshipDefinitions.map((relationshipDefinition) => {
    const usesJunction = Boolean(
      String(relationshipDefinition.junction_entity || '').trim() &&
        String(relationshipDefinition.junction_subject_column || '').trim() &&
        String(relationshipDefinition.junction_object_column || '').trim(),
    )
    return {
      id: `rel-${relationshipDefinition.id}`,
      source: relationshipDefinition.subject_entity,
      target: relationshipDefinition.object_entity,
      label: relationshipDefinition.relationship_name,
      data: {
        relationship_id: relationshipDefinition.id,
        relationship_name: relationshipDefinition.relationship_name,
        subject_entity: relationshipDefinition.subject_entity,
        subject_column: relationshipDefinition.subject_column,
        predicate_iri: relationshipDefinition.predicate_iri,
        object_entity: relationshipDefinition.object_entity,
        object_column: relationshipDefinition.object_column,
        junction_entity: relationshipDefinition.junction_entity || '',
        junction_subject_column: relationshipDefinition.junction_subject_column || '',
        junction_object_column: relationshipDefinition.junction_object_column || '',
        junction_auto_created: Boolean(Number(relationshipDefinition.junction_auto_created || 0)),
        uses_junction: usesJunction,
      },
      animated: false,
    }
  })

  const subclassEdges = entityMappings
    .map((entityMapping) => {
      const parentName = entityMapping.parent_entity_name
        ? String(entityMapping.parent_entity_name || '').trim()
        : ''
      if (!parentName) {
        return null
      }
      return {
        id: `subclass-${entityMapping.entity_name}`,
        source: entityMapping.entity_name,
        target: parentName,
        label: 'rdfs:subClassOf',
        data: {
          edge_kind: 'subclass',
        },
        animated: false,
        style: { strokeDasharray: '6 4' },
      }
    })
    .filter(Boolean)

  const edges = [...subclassEdges, ...relationshipEdges]

  return { nodes, edges }
}

