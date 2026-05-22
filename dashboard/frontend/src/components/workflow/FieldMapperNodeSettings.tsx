import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { ontologyApi } from '../../api/client';
import type { EntityDefinition, EntitySummary } from '../../types';
import type { FieldMappingRule } from '../../types/workflow';

type FieldMapperNodeSettingsProps = {
  mappings: FieldMappingRule[];
  entityId: number | null;
  entityOptions: EntitySummary[];
  onUpdate: (patch: Record<string, unknown>) => void;
};

// Build a new empty field mapping row for the editor.
function createEmptyMappingRule(): FieldMappingRule {
  return {
    sourceField: '',
    targetField: '',
    targetMode: 'custom',
  };
}

// Field Mapper node configuration — rename incoming JSON keys before entity mapping.
export function FieldMapperNodeSettings({
  mappings,
  entityId,
  entityOptions,
  onUpdate,
}: FieldMapperNodeSettingsProps) {
  const [entityDefinition, setEntityDefinition] = useState<EntityDefinition | null>(null);
  const [loadingEntityFields, setLoadingEntityFields] = useState(false);

  useEffect(() => {
    if (entityId === null) {
      setEntityDefinition(null);
      return;
    }

    let cancelled = false;
    setLoadingEntityFields(true);

    void (async () => {
      try {
        const response = await ontologyApi.getEntity(entityId);
        if (!cancelled) {
          setEntityDefinition(response.data);
        }
      } catch {
        if (!cancelled) {
          setEntityDefinition(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingEntityFields(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  function updateMappingAtIndex(index: number, patch: Partial<FieldMappingRule>) {
    const nextMappings = mappings.map((mapping, mappingIndex) =>
      mappingIndex === index ? { ...mapping, ...patch } : mapping,
    );
    onUpdate({ mappings: nextMappings });
  }

  function addMappingRule() {
    onUpdate({ mappings: [...mappings, createEmptyMappingRule()] });
  }

  function removeMappingAtIndex(index: number) {
    onUpdate({ mappings: mappings.filter((_mapping, mappingIndex) => mappingIndex !== index) });
  }

  const entityFieldNames = entityDefinition?.fields.map((field) => field.field_name) || [];

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Map incoming JSON keys to new names before the Entities node runs. Use a custom target name
        or pick a field from an entity schema.
      </Typography>

      <TextField
        select
        label="Reference entity (for target fields)"
        size="small"
        value={entityId ?? ''}
        onChange={(event) => {
          const rawValue = event.target.value;
          const nextEntityId = rawValue === '' ? null : Number(rawValue);
          onUpdate({
            entityId: Number.isFinite(nextEntityId) ? nextEntityId : null,
          });
        }}
        fullWidth
      >
        <MenuItem value="">
          <em>None — custom target names only</em>
        </MenuItem>
        {entityOptions.map((entity) => (
          <MenuItem key={entity.id} value={entity.id}>
            {entity.name} (id {entity.id})
          </MenuItem>
        ))}
      </TextField>

      {entityId !== null && loadingEntityFields ? (
        <Typography variant="caption" color="text.secondary">
          Loading entity fields…
        </Typography>
      ) : null}

      {mappings.length === 0 ? (
        <Alert severity="info">No mappings yet. Add a rule to rename incoming fields.</Alert>
      ) : null}

      {mappings.map((mapping, index) => (
        <Box
          key={`mapping-${index}`}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Mapping {index + 1}
              </Typography>
              <IconButton
                size="small"
                color="error"
                aria-label="Remove mapping"
                onClick={() => removeMappingAtIndex(index)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>

            <TextField
              label="Incoming JSON field"
              size="small"
              value={mapping.sourceField}
              onChange={(event) => updateMappingAtIndex(index, { sourceField: event.target.value })}
              fullWidth
              placeholder="company_name"
            />

            <TextField
              select
              label="Target type"
              size="small"
              value={mapping.targetMode}
              onChange={(event) =>
                updateMappingAtIndex(index, {
                  targetMode: event.target.value === 'entity' ? 'entity' : 'custom',
                  targetField: '',
                })
              }
              fullWidth
            >
              <MenuItem value="custom">Custom field name</MenuItem>
              <MenuItem value="entity" disabled={entityId === null || entityFieldNames.length === 0}>
                Entity field
              </MenuItem>
            </TextField>

            {mapping.targetMode === 'entity' ? (
              <TextField
                select
                label="Target entity field"
                size="small"
                value={mapping.targetField}
                onChange={(event) => updateMappingAtIndex(index, { targetField: event.target.value })}
                fullWidth
              >
                <MenuItem value="">
                  <em>Select field</em>
                </MenuItem>
                {entityFieldNames.map((fieldName) => (
                  <MenuItem key={fieldName} value={fieldName}>
                    {fieldName}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Target field name"
                size="small"
                value={mapping.targetField}
                onChange={(event) => updateMappingAtIndex(index, { targetField: event.target.value })}
                fullWidth
                placeholder="name"
              />
            )}
          </Stack>
        </Box>
      ))}

      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addMappingRule}>
        Add mapping
      </Button>
    </Stack>
  );
}
