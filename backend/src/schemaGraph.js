import { getDatabase } from './database.js'

/* Build a schema-level graph (classes + object properties) for visualization. */
export function getSchemaGraph() {
  const database = getDatabase()

  const entityMappings = database
    .prepare('SELECT entity_name, class_iri FROM entity_mappings ORDER BY entity_name ASC')
    .all()

  const relationshipDefinitions = database
    .prepare(
      'SELECT id, relationship_name, subject_entity, subject_column, predicate_iri, object_entity, object_column FROM relationship_definitions ORDER BY id ASC',
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

  const edges = relationshipDefinitions.map((relationshipDefinition) => ({
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
    },
    animated: false,
  }))

  return { nodes, edges }
}

