import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { EntityFieldsMetadataTable } from '../components/EntityFieldsMetadataTable';
import { PageHeader } from '../components/PageHeader';
import { EntityRowDataTable } from '../components/EntityRowDataTable';
import { EntityStructureDialog } from '../components/EntityStructureDialog';
import { ontologyApi } from '../api/client';
import type { EntityDefinition, EntityFieldDefinition, EntityRowRecord } from '../types';

// Count fields that have any AI metadata filled in.
function countFieldsWithMetadata(fields: EntityFieldDefinition[]): number {
  return fields.filter(
    (field) =>
      field.is_active !== false &&
      Boolean(
        String(field.description || '').trim() ||
          String(field.example || '').trim() ||
          String(field.extraction_hint || '').trim(),
      ),
  ).length;
}

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

  const activeFieldCount = entity.fields.filter((field) => field.is_active !== false).length;
  const metadataFieldCount = countFieldsWithMetadata(entity.fields);

  return (
    <Stack spacing={2}>
      <PageHeader
        title={entity.display_name}
        subtitle={`Entity ${entity.name} (id ${entity.id})`}
        actions={
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setStructureDialogOpen(true)}
          >
            Edit structure
          </Button>
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack spacing={0.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Field metadata
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {activeFieldCount} field{activeFieldCount === 1 ? '' : 's'}
              {metadataFieldCount > 0
                ? ` · ${metadataFieldCount} with AI metadata`
                : ' · expand to view descriptions and extraction hints'}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, overflowX: 'auto' }}>
          <EntityFieldsMetadataTable fields={entity.fields} />
        </AccordionDetails>
      </Accordion>

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
