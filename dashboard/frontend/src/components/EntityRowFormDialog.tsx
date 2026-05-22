import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { EntityDefinition } from '../types';
import {
  buildEmptyFormValues,
  convertFormValuesToRow,
  inputPropsForFieldType,
} from './entityRowFormUtils';

type EntityRowFormDialogProps = {
  open: boolean;
  entity: EntityDefinition;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
};

// Dialog to add a new entity row using one input per schema field.
export function EntityRowFormDialog({ open, entity, onClose, onSave }: EntityRowFormDialogProps) {
  const activeFields = entity.fields.filter((field) => field.is_active !== false);
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    buildEmptyFormValues(activeFields),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFormValues(buildEmptyFormValues(activeFields));
    setErrorMessage('');
    setSaving(false);
  }, [open, entity.id, activeFields.length]);

  function updateFieldValue(fieldName: string, nextValue: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: nextValue,
    }));
  }

  async function handleSaveClick() {
    const conversion = convertFormValuesToRow(activeFields, formValues);
    if (!conversion.ok) {
      setErrorMessage(conversion.errorMessage);
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await onSave(conversion.values);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save row');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add row — {entity.display_name || entity.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          {activeFields.length === 0 ? (
            <Alert severity="info">
              This entity has no active fields. Use Edit structure to add fields first.
            </Alert>
          ) : (
            activeFields.map((field) => {
              const inputProps = inputPropsForFieldType(field.field_type);
              const label = field.is_required
                ? `${field.field_name} (required)`
                : field.field_name;

              return (
                <TextField
                  key={field.id}
                  label={label}
                  size="small"
                  fullWidth
                  value={formValues[field.field_name] ?? ''}
                  onChange={(event) => updateFieldValue(field.field_name, event.target.value)}
                  type={inputProps.type}
                  inputProps={{
                    inputMode: inputProps.inputMode,
                    step: inputProps.step,
                  }}
                  helperText={`Type: ${field.field_type}`}
                />
              );
            })
          )}

          <Typography variant="caption" color="text.secondary">
            Only active fields are shown. Optional fields can be left empty.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSaveClick()}
          disabled={saving || activeFields.length === 0}
        >
          {saving ? 'Saving…' : 'Save row'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
