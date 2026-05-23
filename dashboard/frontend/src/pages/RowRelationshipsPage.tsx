import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../components/PageHeader';
import { ontologyApi } from '../api/client';
import type { EntityRelationshipDefinition, EntitySummary, RelationshipRecord } from '../types';

export function RowRelationshipsPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [entityRelationships, setEntityRelationships] = useState<EntityRelationshipDefinition[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntityRelationshipId, setSelectedEntityRelationshipId] = useState(0);
  const [relationshipName, setRelationshipName] = useState('');
  const [subjectEntityId, setSubjectEntityId] = useState(0);
  const [objectEntityId, setObjectEntityId] = useState(0);
  const [subjectRowId, setSubjectRowId] = useState(1);
  const [objectRowId, setObjectRowId] = useState(1);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      const [entitiesResponse, entityRelationshipsResponse, relationshipsResponse] = await Promise.all([
        ontologyApi.listEntities(),
        ontologyApi.listEntityRelationships(),
        ontologyApi.listRelationships(),
      ]);
      setEntities(entitiesResponse.data);
      setEntityRelationships(entityRelationshipsResponse.data);
      setRelationships(relationshipsResponse.data);
      if (entityRelationshipsResponse.data.length > 0) {
        applyEntityRelationshipSelection(entityRelationshipsResponse.data[0]);
      } else if (entitiesResponse.data.length > 0) {
        setSubjectEntityId(entitiesResponse.data[0].id);
        setObjectEntityId(entitiesResponse.data[0].id);
      }
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load');
    }
  }

  function applyEntityRelationshipSelection(definition: EntityRelationshipDefinition) {
    setSelectedEntityRelationshipId(definition.id);
    setRelationshipName(definition.relationship_name);
    setSubjectEntityId(definition.subject_entity_id);
    setObjectEntityId(definition.object_entity_id);
  }

  function entityRelationshipLabel(definition: EntityRelationshipDefinition): string {
    return `${definition.relationship_name}: ${entityLabel(definition.subject_entity_id)} → ${entityLabel(definition.object_entity_id)}`;
  }

  function entityLabel(entityId: number): string {
    const match = entities.find((entity) => entity.id === entityId);
    return match ? match.name : String(entityId);
  }

  async function handleCreate() {
    if (!selectedEntityRelationshipId) {
      setErrorMessage('Select an entity relationship first (create one under Entity relationships if needed).');
      return;
    }
    try {
      await ontologyApi.createRelationship({
        relationship_name: relationshipName.trim(),
        subject_entity_id: subjectEntityId,
        object_entity_id: objectEntityId,
        subject_row_id: subjectRowId,
        object_row_id: objectRowId,
      });
      setDialogOpen(false);
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create');
    }
  }

  async function handleDelete(relationshipId: number) {
    if (!window.confirm('Delete this row link?')) {
      return;
    }
    try {
      await ontologyApi.deleteRelationship(relationshipId);
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete');
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Row links"
        subtitle="Instance-level relationships between specific entity rows."
        actions={
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            New row link
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
                <TableCell>Subject</TableCell>
                <TableCell>Object</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationships.map((relationship) => (
                <TableRow key={relationship.id}>
                  <TableCell>{relationship.id}</TableCell>
                  <TableCell>{relationship.relationship_name}</TableCell>
                  <TableCell>
                    {entityLabel(relationship.subject_entity_id)} row {relationship.subject_row_id}
                  </TableCell>
                  <TableCell>
                    {entityLabel(relationship.object_entity_id)} row {relationship.object_row_id}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => void handleDelete(relationship.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create row link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {entityRelationships.length === 0 ? (
              <Alert severity="warning">
                No entity relationships defined yet. Create a schema relationship first under Entity
                relationships, then return here to link specific rows.
              </Alert>
            ) : null}
            <TextField
              select
              label="Entity relationship (required)"
              value={selectedEntityRelationshipId}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                const definition = entityRelationships.find((item) => item.id === nextId);
                if (definition) {
                  applyEntityRelationshipSelection(definition);
                }
              }}
              fullWidth
              disabled={entityRelationships.length === 0}
            >
              {entityRelationships.map((definition) => (
                <MenuItem key={definition.id} value={definition.id}>
                  {entityRelationshipLabel(definition)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Subject entity"
              value={entityLabel(subjectEntityId)}
              fullWidth
              disabled
            />
            <TextField
              label="Subject row id"
              type="number"
              value={subjectRowId}
              onChange={(event) => setSubjectRowId(Number(event.target.value))}
              fullWidth
            />
            <TextField
              label="Object entity"
              value={entityLabel(objectEntityId)}
              fullWidth
              disabled
            />
            <TextField
              label="Object row id"
              type="number"
              value={objectRowId}
              onChange={(event) => setObjectRowId(Number(event.target.value))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreate()} disabled={entityRelationships.length === 0}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
