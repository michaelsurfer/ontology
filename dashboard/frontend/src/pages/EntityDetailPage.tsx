import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { EntityRowDataTable } from '../components/EntityRowDataTable';
import { EntityStructureDialog } from '../components/EntityStructureDialog';
import { ontologyApi } from '../api/client';
import type { EntityDefinition, EntityRowRecord } from '../types';

export function EntityDetailPage() {
  const { entityId: entityIdRaw } = useParams();
  const entityId = Number(entityIdRaw);

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [rows, setRows] = useState<EntityRowRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(entityId)) {
      return;
    }
    void reload();
  }, [entityId]);

  async function reload() {
    try {
      const [entityResponse, rowsResponse] = await Promise.all([
        ontologyApi.getEntity(entityId),
        ontologyApi.listEntityRows(entityId),
      ]);
      setEntity(entityResponse.data);
      setRows(rowsResponse.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entity');
    }
  }

  async function handleCreateRow(values: Record<string, unknown>) {
    await ontologyApi.createEntityRow(entityId, values);
    setErrorMessage('');
    await reload();
  }

  async function handleUpdateRow(rowId: number, values: Record<string, unknown>) {
    await ontologyApi.updateEntityRow(entityId, rowId, values);
    setErrorMessage('');
    await reload();
  }

  async function handleDeleteRow(rowId: number) {
    if (!window.confirm('Delete this row?')) {
      return;
    }
    try {
      await ontologyApi.deleteEntityRow(entityId, rowId);
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete row');
    }
  }

  if (!entity) {
    return <Typography>Loading entity…</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        {entity.display_name}
      </Typography>
      <Typography color="text.secondary">
        Entity <strong>{entity.name}</strong> (id {entity.id})
      </Typography>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography variant="h6">Fields</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setStructureDialogOpen(true)}
            >
              Edit structure
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {entity.fields
              .map((field) => {
                const requiredLabel = field.is_required ? ', required' : '';
                return `${field.field_name} (${field.field_type}${requiredLabel})`;
              })
              .join(', ')}
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="h6">Row data</Typography>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: 'auto' }}>
          <EntityRowDataTable
            entity={entity}
            rows={rows}
            onCreateRow={handleCreateRow}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
          />
        </CardContent>
      </Card>

      <EntityStructureDialog
        open={structureDialogOpen}
        mode="edit"
        entityId={entity.id}
        initialEntity={entity}
        onClose={() => setStructureDialogOpen(false)}
        onSaved={() => void reload()}
      />
    </Stack>
  );
}
