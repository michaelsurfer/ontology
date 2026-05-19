import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
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
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { ontologyApi } from '../api/client';
import type { EntitySummary, RelationshipRecord } from '../types';

export function RowRelationshipsPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [relationshipName, setRelationshipName] = useState('works_at');
  const [subjectEntityId, setSubjectEntityId] = useState(0);
  const [objectEntityId, setObjectEntityId] = useState(0);
  const [subjectRowId, setSubjectRowId] = useState(1);
  const [objectRowId, setObjectRowId] = useState(1);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      const [entitiesResponse, relationshipsResponse] = await Promise.all([
        ontologyApi.listEntities(),
        ontologyApi.listRelationships(),
      ]);
      setEntities(entitiesResponse.data);
      setRelationships(relationshipsResponse.data);
      if (entitiesResponse.data.length > 0) {
        setSubjectEntityId(entitiesResponse.data[0].id);
        setObjectEntityId(entitiesResponse.data[0].id);
      }
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load');
    }
  }

  function entityLabel(entityId: number): string {
    const match = entities.find((entity) => entity.id === entityId);
    return match ? match.name : String(entityId);
  }

  async function handleCreate() {
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
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Row links
          </Typography>
          <Typography color="text.secondary">Instance-level relationships between specific rows</Typography>
        </Box>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New row link
        </Button>
      </Stack>

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
            <TextField
              label="Relationship name"
              value={relationshipName}
              onChange={(event) => setRelationshipName(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Subject entity"
              value={subjectEntityId}
              onChange={(event) => setSubjectEntityId(Number(event.target.value))}
              fullWidth
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Subject row id"
              type="number"
              value={subjectRowId}
              onChange={(event) => setSubjectRowId(Number(event.target.value))}
              fullWidth
            />
            <TextField
              select
              label="Object entity"
              value={objectEntityId}
              onChange={(event) => setObjectEntityId(Number(event.target.value))}
              fullWidth
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </TextField>
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
          <Button variant="contained" onClick={() => void handleCreate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
