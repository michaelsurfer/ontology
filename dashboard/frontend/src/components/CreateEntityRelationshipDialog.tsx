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
import { ontologyApi, readApiErrorMessage } from '../api/client';

export type PendingGraphRelationshipConnection = {
  subjectEntityId: number;
  objectEntityId: number;
  subjectLabel: string;
  objectLabel: string;
};

type CreateEntityRelationshipDialogProps = {
  open: boolean;
  connection: PendingGraphRelationshipConnection | null;
  onClose: () => void;
  onCreated: () => void;
};

// Dialog to name and create a schema relationship from a Graph View class-to-class link.
export function CreateEntityRelationshipDialog({
  open,
  connection,
  onClose,
  onCreated,
}: CreateEntityRelationshipDialogProps) {
  const [relationshipName, setRelationshipName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && connection) {
      setRelationshipName('');
      setErrorMessage('');
    }
  }, [open, connection]);

  async function handleCreate() {
    if (!connection) {
      return;
    }

    const trimmedName = relationshipName.trim();
    if (!trimmedName) {
      setErrorMessage('Relationship name is required.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const existingResponse = await ontologyApi.listEntityRelationships();
      const duplicate = existingResponse.data.find(
        (row) =>
          row.relationship_name === trimmedName &&
          row.subject_entity_id === connection.subjectEntityId &&
          row.object_entity_id === connection.objectEntityId,
      );
      if (duplicate) {
        setErrorMessage('This relationship already exists between these record types.');
        setSaving(false);
        return;
      }

      await ontologyApi.createEntityRelationship({
        relationship_name: trimmedName,
        subject_entity_id: connection.subjectEntityId,
        object_entity_id: connection.objectEntityId,
      });
      onCreated();
      onClose();
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!connection) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create entity relationship</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Define how records link at the schema level. Row links can be created later via
            workflows or the Relationships page.
          </Typography>

          <TextField
            label="Subject record type"
            value={connection.subjectLabel}
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Object record type"
            value={connection.objectLabel}
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Relationship name"
            value={relationshipName}
            onChange={(event) => setRelationshipName(event.target.value)}
            placeholder="e.g. employed_by, belongs_to_account"
            helperText="Use a short snake_case name. This becomes an OWL object property in the graph."
            fullWidth
            autoFocus
          />

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={saving}>
          {saving ? 'Creating…' : 'Create relationship'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
