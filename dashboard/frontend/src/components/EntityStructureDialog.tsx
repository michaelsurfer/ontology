import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { ontologyApi } from '../api/client';
import type { EntityDefinition, FieldType } from '../types';

export type EntityFieldFormRow = {
  field_name: string;
  field_type: FieldType;
  is_required: boolean;
};

const emptyFieldRow: EntityFieldFormRow = {
  field_name: '',
  field_type: 'TEXT',
  is_required: false,
};

type EntityStructureDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  entityId?: number;
  initialEntity?: EntityDefinition | null;
  onClose: () => void;
  onSaved: () => void;
};

// Dialog to create or update an entity schema (name, display name, fields).
export function EntityStructureDialog({
  open,
  mode,
  entityId,
  initialEntity,
  onClose,
  onSaved,
}: EntityStructureDialogProps) {
  const [entityName, setEntityName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldRows, setFieldRows] = useState<EntityFieldFormRow[]>([{ ...emptyFieldRow }]);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'edit' && initialEntity) {
      setEntityName(initialEntity.name);
      setDisplayName(initialEntity.display_name || initialEntity.name);
      setFieldRows(
        initialEntity.fields.length > 0
          ? initialEntity.fields.map((field) => ({
              field_name: field.field_name,
              field_type: field.field_type,
              is_required: Boolean(field.is_required),
            }))
          : [{ ...emptyFieldRow }],
      );
    } else if (mode === 'create') {
      setEntityName('');
      setDisplayName('');
      setFieldRows([{ ...emptyFieldRow }]);
    }
    setErrorMessage('');
  }, [open, mode, initialEntity]);

  // Persist entity structure to data-layer via dashboard API.
  async function handleSaveEntityStructure() {
    const trimmedName = entityName.trim();
    if (!trimmedName) {
      setErrorMessage('Entity name is required.');
      return;
    }

    const normalizedFields = fieldRows
      .map((row) => ({
        field_name: row.field_name.trim(),
        field_type: row.field_type,
        is_required: row.is_required,
      }))
      .filter((row) => row.field_name.length > 0);

    if (normalizedFields.length === 0) {
      setErrorMessage('Add at least one field.');
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

  function updateFieldRow(index: number, patch: Partial<EntityFieldFormRow>) {
    const nextRows = [...fieldRows];
    nextRows[index] = { ...nextRows[index], ...patch };
    setFieldRows(nextRows);
  }

  function removeFieldRow(index: number) {
    if (fieldRows.length <= 1) {
      setFieldRows([{ ...emptyFieldRow }]);
      return;
    }
    setFieldRows(fieldRows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Create entity' : 'Edit entity structure'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          {mode === 'edit' ? (
            <Alert severity="info">
              Saving fields replaces the full field list. Existing rows keep values by field name
              where names still match.
            </Alert>
          ) : null}

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

          <Typography variant="subtitle2">Fields</Typography>

          {fieldRows.map((fieldRow, index) => (
            <Box
              key={index}
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
                onChange={(event) => updateFieldRow(index, { field_name: event.target.value })}
                fullWidth
                sx={{ flex: '1 1 140px' }}
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
              <IconButton
                aria-label="Remove field"
                color="error"
                onClick={() => removeFieldRow(index)}
                disabled={saving}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          <Button
            variant="outlined"
            onClick={() => setFieldRows([...fieldRows, { ...emptyFieldRow }])}
            disabled={saving}
          >
            Add field
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSaveEntityStructure()} disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
