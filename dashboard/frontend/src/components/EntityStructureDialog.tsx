import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ontologyApi } from '../api/client';
import type { EntityDefinition, EntityFieldInput, FieldType } from '../types';

export type EntityFieldFormRow = {
  field_name: string;
  field_type: FieldType;
  is_required: boolean;
  description: string;
  example: string;
  extraction_hint: string;
  is_identifier: boolean;
};

const emptyFieldRow: EntityFieldFormRow = {
  field_name: '',
  field_type: 'TEXT',
  is_required: false,
  description: '',
  example: '',
  extraction_hint: '',
  is_identifier: false,
};

type EntityStructureDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  entityId?: number;
  initialEntity?: EntityDefinition | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

// Whether a field row has any AI metadata filled in.
function fieldRowHasMetadata(fieldRow: EntityFieldFormRow): boolean {
  return (
    fieldRow.description.trim().length > 0 ||
    fieldRow.example.trim().length > 0 ||
    fieldRow.extraction_hint.trim().length > 0
  );
}

// Indices of fields whose metadata section should start expanded.
function buildInitialExpandedMetadataIndices(fieldRows: EntityFieldFormRow[]): Set<number> {
  const expandedIndices = new Set<number>();
  fieldRows.forEach((fieldRow, index) => {
    if (fieldRowHasMetadata(fieldRow)) {
      expandedIndices.add(index);
    }
  });
  return expandedIndices;
}

// Map a form row to the API field input shape.
function fieldRowToApiInput(row: EntityFieldFormRow): EntityFieldInput {
  return {
    field_name: row.field_name.trim(),
    field_type: row.field_type,
    is_required: row.is_required,
    description: row.description.trim() || undefined,
    example: row.example.trim() || undefined,
    extraction_hint: row.extraction_hint.trim() || undefined,
    is_identifier: row.is_identifier,
  };
}

// Dialog to create or update an entity schema (name, display name, fields + AI metadata).
export function EntityStructureDialog({
  open,
  mode,
  entityId,
  initialEntity,
  onClose,
  onSaved,
  onDeleted,
}: EntityStructureDialogProps) {
  const [entityName, setEntityName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldRows, setFieldRows] = useState<EntityFieldFormRow[]>([{ ...emptyFieldRow }]);
  const [expandedMetadataIndices, setExpandedMetadataIndices] = useState<Set<number>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'edit' && initialEntity) {
      setEntityName(initialEntity.name);
      setDisplayName(initialEntity.display_name || initialEntity.name);
      const loadedFieldRows =
        initialEntity.fields.length > 0
          ? initialEntity.fields.map((field) => ({
              field_name: field.field_name,
              field_type: field.field_type,
              is_required: Boolean(field.is_required),
              description: field.description || '',
              example: field.example || '',
              extraction_hint: field.extraction_hint || '',
              is_identifier: Boolean(field.is_identifier),
            }))
          : [{ ...emptyFieldRow }];
      setFieldRows(loadedFieldRows);
      setExpandedMetadataIndices(buildInitialExpandedMetadataIndices(loadedFieldRows));
    } else if (mode === 'create') {
      setEntityName('');
      setDisplayName('');
      setFieldRows([{ ...emptyFieldRow }]);
      setExpandedMetadataIndices(new Set());
    }
    setErrorMessage('');
    setDeleting(false);
  }, [open, mode, initialEntity]);

  // Persist entity structure to data-layer via dashboard API.
  async function handleSaveEntityStructure() {
    const trimmedName = entityName.trim();
    if (!trimmedName) {
      setErrorMessage('Entity name is required.');
      return;
    }

    const normalizedFields = fieldRows
      .map(fieldRowToApiInput)
      .filter((row) => row.field_name.length > 0);

    if (normalizedFields.length === 0) {
      setErrorMessage('Add at least one field.');
      return;
    }

    const identifierCount = normalizedFields.filter((field) => field.is_identifier).length;
    if (identifierCount > 1) {
      setErrorMessage('Only one field can be marked as the identifier.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      if (mode === 'create') {
        await ontologyApi.createEntity({
          name: trimmedName,
          display_name: displayName.trim() || trimmedName,
          fields: normalizedFields,
        });
      } else if (entityId !== undefined) {
        await ontologyApi.updateEntity(entityId, {
          name: trimmedName,
          display_name: displayName.trim() || trimmedName,
          fields: normalizedFields,
        });
      }
      onSaved();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save entity');
    } finally {
      setSaving(false);
    }
  }

  // Permanently delete this entity schema and all related rows and links.
  async function handleDeleteEntity() {
    if (mode !== 'edit' || entityId === undefined) {
      return;
    }

    const entityLabel = displayName.trim() || entityName.trim() || `entity ${entityId}`;
    if (
      !window.confirm(
        `Delete "${entityLabel}" and all its rows and relationships? This cannot be undone.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setDeleting(true);
    setErrorMessage('');
    try {
      await ontologyApi.deleteEntity(entityId);
      onDeleted?.();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete entity');
    } finally {
      setSaving(false);
      setDeleting(false);
    }
  }

  function updateFieldRow(index: number, patch: Partial<EntityFieldFormRow>) {
    const nextRows = [...fieldRows];
    const mergedRow = { ...nextRows[index], ...patch };

    if (patch.is_identifier === true) {
      for (let rowIndex = 0; rowIndex < nextRows.length; rowIndex += 1) {
        if (rowIndex !== index) {
          nextRows[rowIndex] = { ...nextRows[rowIndex], is_identifier: false };
        }
      }
    }

    nextRows[index] = mergedRow;
    setFieldRows(nextRows);
  }

  function removeFieldRow(index: number) {
    if (fieldRows.length <= 1) {
      setFieldRows([{ ...emptyFieldRow }]);
      setExpandedMetadataIndices(new Set());
      return;
    }
    setFieldRows(fieldRows.filter((_, rowIndex) => rowIndex !== index));
    setExpandedMetadataIndices((previousIndices) => {
      const nextIndices = new Set<number>();
      previousIndices.forEach((expandedIndex) => {
        if (expandedIndex < index) {
          nextIndices.add(expandedIndex);
        } else if (expandedIndex > index) {
          nextIndices.add(expandedIndex - 1);
        }
      });
      return nextIndices;
    });
  }

  // Show or hide description, example, and extraction hint for one field.
  function toggleMetadataExpanded(index: number) {
    setExpandedMetadataIndices((previousIndices) => {
      const nextIndices = new Set(previousIndices);
      if (nextIndices.has(index)) {
        nextIndices.delete(index);
      } else {
        nextIndices.add(index);
      }
      return nextIndices;
    });
  }

  function addFieldRow() {
    setFieldRows([...fieldRows, { ...emptyFieldRow }]);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'create' ? 'Create entity' : 'Edit entity structure'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          {mode === 'edit' ? (
            <Alert severity="info">
              Saving fields replaces the full field list. Existing rows keep values by field name
              where names still match. Metadata helps AI agents extract and map data accurately.
            </Alert>
          ) : (
            <Alert severity="info">
              Expand &quot;AI metadata&quot; on each field to add descriptions, examples, and
              extraction hints. Mark one field as the identifier (e.g. name or code).
            </Alert>
          )}

          <TextField
            label="Name (snake_case)"
            value={entityName}
            onChange={(event) => setEntityName(event.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            fullWidth
            disabled={saving}
          />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Fields
          </Typography>

          {fieldRows.map((fieldRow, index) => {
            const isMetadataExpanded = expandedMetadataIndices.has(index);
            const metadataFilled = fieldRowHasMetadata(fieldRow);

            return (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      <TextField
                        label="Field name"
                        value={fieldRow.field_name}
                        onChange={(event) =>
                          updateFieldRow(index, { field_name: event.target.value })
                        }
                        sx={{ flex: '1 1 160px' }}
                        disabled={saving}
                      />
                      <TextField
                        select
                        label="Type"
                        value={fieldRow.field_type}
                        onChange={(event) =>
                          updateFieldRow(index, { field_type: event.target.value as FieldType })
                        }
                        sx={{ minWidth: 110, flex: '0 0 110px' }}
                        disabled={saving}
                      >
                        <MenuItem value="TEXT">TEXT</MenuItem>
                        <MenuItem value="INTEGER">INTEGER</MenuItem>
                        <MenuItem value="REAL">REAL</MenuItem>
                      </TextField>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={fieldRow.is_required}
                            onChange={(event) =>
                              updateFieldRow(index, { is_required: event.target.checked })
                            }
                            disabled={saving}
                          />
                        }
                        label="Required"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={fieldRow.is_identifier}
                            onChange={(event) =>
                              updateFieldRow(index, { is_identifier: event.target.checked })
                            }
                            disabled={saving}
                          />
                        }
                        label="Identifier"
                      />
                      <IconButton
                        aria-label="Remove field"
                        color="error"
                        onClick={() => removeFieldRow(index)}
                        disabled={saving}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>

                    <Button
                      size="small"
                      variant="text"
                      onClick={() => toggleMetadataExpanded(index)}
                      disabled={saving}
                      endIcon={isMetadataExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{
                        alignSelf: 'flex-start',
                        px: 0,
                        color: metadataFilled ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      AI metadata{metadataFilled ? ' (filled)' : ''}
                    </Button>

                    <Collapse in={isMetadataExpanded}>
                      <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                        <TextField
                          label="Description"
                          value={fieldRow.description}
                          onChange={(event) =>
                            updateFieldRow(index, { description: event.target.value })
                          }
                          fullWidth
                          multiline
                          minRows={2}
                          disabled={saving}
                          placeholder="What this field represents in plain language"
                        />
                        <TextField
                          label="Example"
                          value={fieldRow.example}
                          onChange={(event) =>
                            updateFieldRow(index, { example: event.target.value })
                          }
                          fullWidth
                          disabled={saving}
                          placeholder="e.g. Alice Smith or ACME-001"
                        />
                        <TextField
                          label="Extraction hint"
                          value={fieldRow.extraction_hint}
                          onChange={(event) =>
                            updateFieldRow(index, { extraction_hint: event.target.value })
                          }
                          fullWidth
                          multiline
                          minRows={2}
                          disabled={saving}
                          placeholder="Where to find this in source documents or APIs"
                        />
                      </Stack>
                    </Collapse>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          <Button variant="outlined" onClick={addFieldRow} disabled={saving}>
            Add field
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        {mode === 'edit' && entityId !== undefined ? (
          <Button color="error" onClick={() => void handleDeleteEntity()} disabled={saving}>
            {deleting ? 'Deleting…' : 'Delete entity'}
          </Button>
        ) : (
          <Box />
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSaveEntityStructure()} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
