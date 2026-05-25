import type {
  EntityDefinition,
  EntityFieldDefinition,
  EntityRowRecord,
  RelationshipRecord,
} from '../types';

export type RelatedRecordEdge = {
  linkId: number;
  relationshipName: string;
  direction: 'outgoing' | 'incoming';
  relatedEntityId: number;
  relatedRowId: number;
};

// Filter row-level relationship links that touch a specific row.
export function filterRelationshipLinksForRow(
  allLinks: RelationshipRecord[],
  entityId: number,
  rowId: number,
): RelationshipRecord[] {
  return allLinks.filter((link) => {
    const touchesAsSubject = link.subject_entity_id === entityId && link.subject_row_id === rowId;
    const touchesAsObject = link.object_entity_id === entityId && link.object_row_id === rowId;
    return touchesAsSubject || touchesAsObject;
  });
}

// Build a view of the other end of each link from the current row's perspective.
export function buildRelatedRecordEdges(
  links: RelationshipRecord[],
  currentEntityId: number,
  currentRowId: number,
): RelatedRecordEdge[] {
  return links.map((link) => {
    const isSubject =
      link.subject_entity_id === currentEntityId && link.subject_row_id === currentRowId;

    return {
      linkId: link.id,
      relationshipName: link.relationship_name,
      direction: isSubject ? 'outgoing' : 'incoming',
      relatedEntityId: isSubject ? link.object_entity_id : link.subject_entity_id,
      relatedRowId: isSubject ? link.object_row_id : link.subject_row_id,
    };
  });
}

// Human-readable label for a row using identifier field, then first text field, then fallback.
export function buildRowDisplayLabel(
  entityName: string,
  fields: EntityFieldDefinition[],
  row: EntityRowRecord | undefined,
): string {
  if (!row) {
    return `${entityName} #?`;
  }

  const activeFields = fields.filter((field) => field.is_active !== false);
  const identifierField = activeFields.find((field) => field.is_identifier);
  if (identifierField) {
    const identifierValue = row.values[identifierField.field_name];
    if (identifierValue !== null && identifierValue !== undefined && String(identifierValue).trim()) {
      return String(identifierValue).trim();
    }
  }

  const firstTextField = activeFields.find((field) => field.field_type === 'TEXT');
  if (firstTextField) {
    const textValue = row.values[firstTextField.field_name];
    if (textValue !== null && textValue !== undefined && String(textValue).trim()) {
      return String(textValue).trim();
    }
  }

  return `${entityName} #${row.id}`;
}

// Title for the record hub header from the anchor entity and row.
export function buildRecordHubTitle(entity: EntityDefinition, row: EntityRowRecord): string {
  return buildRowDisplayLabel(entity.name, entity.fields, row);
}

// Collect distinct related entity ids from neighborhood edges.
export function collectRelatedEntityIds(edges: RelatedRecordEdge[]): number[] {
  const entityIdSet = new Set<number>();
  for (const edge of edges) {
    entityIdSet.add(edge.relatedEntityId);
  }
  return Array.from(entityIdSet);
}

// Key for caching row labels across entity types.
export function relatedRowCacheKey(entityId: number, rowId: number): string {
  return `${entityId}:${rowId}`;
}

// Entity ids to include in a scoped Graph View (anchor + related record types).
export function collectEntityIdsForRecordHubGraph(
  anchorEntityId: number,
  relatedEdges: RelatedRecordEdge[],
): number[] {
  const entityIdSet = new Set<number>([anchorEntityId]);
  for (const edge of relatedEdges) {
    entityIdSet.add(edge.relatedEntityId);
  }
  return Array.from(entityIdSet);
}

// Query string for Graph View navigation from record hub.
export function buildRecordHubGraphSearchParams(entityIds: number[]): string {
  if (entityIds.length === 0) {
    return '';
  }
  return `?entity_ids=${entityIds.join(',')}`;
}
