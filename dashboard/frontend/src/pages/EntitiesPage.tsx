import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { PageHeader } from '../components/PageHeader';
import { EntityStructureDialog } from '../components/EntityStructureDialog';
import { ontologyApi } from '../api/client';
import type { EntityDefinition, EntitySummary } from '../types';

export function EntitiesPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entityBeingEdited, setEntityBeingEdited] = useState<EntityDefinition | null>(null);
  const [loadingEditEntityId, setLoadingEditEntityId] = useState<number | null>(null);

  useEffect(() => {
    void reloadEntities();
  }, []);

  async function reloadEntities() {
    try {
      const response = await ontologyApi.listEntities();
      setEntities(response.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entities');
    }
  }

  async function openEditEntityDialog(entityId: number) {
    setLoadingEditEntityId(entityId);
    try {
      const response = await ontologyApi.getEntity(entityId);
      setEntityBeingEdited(response.data);
      setEditDialogOpen(true);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entity for edit');
    } finally {
      setLoadingEditEntityId(null);
    }
  }

  async function handleDeleteEntity(entityId: number) {
    if (!window.confirm('Delete this entity and all its rows?')) {
      return;
    }
    try {
      await ontologyApi.deleteEntity(entityId);
      await reloadEntities();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete entity');
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Entities"
        subtitle="Define entity schemas and manage row data in the data layer."
        actions={
          <Button variant="contained" onClick={() => setCreateDialogOpen(true)}>
            New entity
          </Button>
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell>{entity.id}</TableCell>
                  <TableCell>
                    <Button component={RouterLink} to={`/entities/${entity.id}`}>
                      {entity.name}
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label="Edit entity structure"
                      onClick={() => void openEditEntityDialog(entity.id)}
                      disabled={loadingEditEntityId === entity.id}
                    >
                      {loadingEditEntityId === entity.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <EditIcon />
                      )}
                    </IconButton>
                    <IconButton color="error" onClick={() => void handleDeleteEntity(entity.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntityStructureDialog
        open={createDialogOpen}
        mode="create"
        onClose={() => setCreateDialogOpen(false)}
        onSaved={() => void reloadEntities()}
      />

      <EntityStructureDialog
        open={editDialogOpen}
        mode="edit"
        entityId={entityBeingEdited?.id}
        initialEntity={entityBeingEdited}
        onClose={() => {
          setEditDialogOpen(false);
          setEntityBeingEdited(null);
        }}
        onSaved={() => void reloadEntities()}
      />
    </Stack>
  );
}
