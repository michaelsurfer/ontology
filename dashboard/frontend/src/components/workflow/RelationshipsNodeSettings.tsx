import { useEffect, useState } from 'react';
import {
  Alert,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ontologyApi } from '../../api/client';
import type { EntityDefinition, EntityRelationshipDefinition, EntitySummary } from '../../types';

type RelationshipsNodeSettingsProps = {
  entityRelationshipId: number | null;
  payloadLinkField: string;
  objectEntityField: string;
  entityRelationshipOptions: EntityRelationshipDefinition[];
  entityOptions: EntitySummary[];
  onUpdate: (patch: Record<string, unknown>) => void;
};

// Build a readable label for an entity relationship dropdown option.
function formatEntityRelationshipLabel(
  definition: EntityRelationshipDefinition,
  entityNameById: Map<number, string>,
): string {
  const subjectName = entityNameById.get(definition.subject_entity_id) || `entity ${definition.subject_entity_id}`;
  const objectName = entityNameById.get(definition.object_entity_id) || `entity ${definition.object_entity_id}`;
  return `${definition.relationship_name} (${subjectName} → ${objectName})`;
}

// Relationships node — pick schema relationship and explicit field mapping for the object entity.
export function RelationshipsNodeSettings({
  entityRelationshipId,
  payloadLinkField,
  objectEntityField,
  entityRelationshipOptions,
  entityOptions,
  onUpdate,
}: RelationshipsNodeSettingsProps) {
  const [objectEntityDefinition, setObjectEntityDefinition] = useState<EntityDefinition | null>(null);
  const [loadingObjectEntity, setLoadingObjectEntity] = useState(false);

  const selectedRelationship =
    entityRelationshipId !== null
      ? entityRelationshipOptions.find((definition) => definition.id === entityRelationshipId) || null
      : null;

  const entityNameById = new Map(entityOptions.map((entity) => [entity.id, entity.name]));

  useEffect(() => {
    if (!selectedRelationship) {
      setObjectEntityDefinition(null);
      return;
    }

    let cancelled = false;
    setLoadingObjectEntity(true);

    void (async () => {
      try {
        const response = await ontologyApi.getEntity(selectedRelationship.object_entity_id);
        if (!cancelled) {
          setObjectEntityDefinition(response.data);
        }
      } catch {
        if (!cancelled) {
          setObjectEntityDefinition(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingObjectEntity(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRelationship?.object_entity_id, selectedRelationship?.id]);

  const objectFieldNames =
    objectEntityDefinition?.fields
      .filter((field) => field.is_active !== false)
      .map((field) => field.field_name) || [];

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Choose an entity relationship defined under Entity relationships, then map an incoming JSON
        field to a field on the target (object) entity to find the row to link. Records that cannot
        be linked are sent to the <strong>failure</strong> output (connect to Fallback).
      </Typography>

      {entityRelationshipOptions.length === 0 ? (
        <Alert severity="warning">
          No entity relationships exist. Create one under Entity relationships in the menu first.
        </Alert>
      ) : null}

      <TextField
        select
        label="Entity relationship"
        size="small"
        required
        value={entityRelationshipId ?? ''}
        onChange={(event) => {
          const rawValue = event.target.value;
          if (rawValue === '') {
            onUpdate({ entityRelationshipId: null, objectEntityField: '' });
            return;
          }
          const parsedId = Number(rawValue);
          onUpdate({
            entityRelationshipId: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null,
            objectEntityField: '',
          });
        }}
        fullWidth
        helperText="Required — subject and object entity types come from this definition"
      >
        <MenuItem value="">
          <em>Select a relationship</em>
        </MenuItem>
        {entityRelationshipOptions.map((definition) => (
          <MenuItem key={definition.id} value={definition.id}>
            {formatEntityRelationshipLabel(definition, entityNameById)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Incoming JSON field"
        size="small"
        required
        value={payloadLinkField}
        onChange={(event) => onUpdate({ payloadLinkField: event.target.value })}
        fullWidth
        placeholder="company_name"
        helperText="Key from each input record used to find the object row"
        disabled={entityRelationshipId === null}
      />

      <TextField
        select
        label="Object entity field"
        size="small"
        required
        value={objectEntityField}
        onChange={(event) => onUpdate({ objectEntityField: event.target.value })}
        fullWidth
        helperText={
          loadingObjectEntity
            ? 'Loading target entity fields…'
            : 'Field on the object entity compared to the incoming JSON value'
        }
        disabled={entityRelationshipId === null || objectFieldNames.length === 0}
      >
        <MenuItem value="">
          <em>Select object field</em>
        </MenuItem>
        {objectFieldNames.map((fieldName) => (
          <MenuItem key={fieldName} value={fieldName}>
            {fieldName}
          </MenuItem>
        ))}
      </TextField>

      {entityRelationshipId !== null &&
      !loadingObjectEntity &&
      objectFieldNames.length === 0 ? (
        <Alert severity="info">Target entity has no active fields to match on.</Alert>
      ) : null}
    </Stack>
  );
}
