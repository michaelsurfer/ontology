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
import LinkIcon from '@mui/icons-material/Link';
import { EntityRelationshipLinksDialog } from '../components/EntityRelationshipLinksDialog';
import { ontologyApi } from '../api/client';
import type { EntityRelationshipDefinition, EntitySummary } from '../types';

export function EntityRelationshipsPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationshipDefinition[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [relationshipName, setRelationshipName] = useState('works_at');
  const [subjectEntityId, setSubjectEntityId] = useState<number>(0);
  const [objectEntityId, setObjectEntityId] = useState<number>(0);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [viewLinksDefinition, setViewLinksDefinition] =
    useState<EntityRelationshipDefinition | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      const [entitiesResponse, relationshipsResponse] = await Promise.all([
        ontologyApi.listEntities(),
        ontologyApi.listEntityRelationships(),
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
    return match ? `${match.name} (${match.id})` : String(entityId);
  }

  // Open dialog showing table, sentences, and graph for row-level links.
  function openViewLinks(definition: EntityRelationshipDefinition) {
    setViewLinksDefinition(definition);
    setLinksDialogOpen(true);
  }

  function closeViewLinks() {
    setLinksDialogOpen(false);
    setViewLinksDefinition(null);
  }

  async function handleCreate() {
    try {
      await ontologyApi.createEntityRelationship({
        relationship_name: relationshipName.trim(),
        subject_entity_id: subjectEntityId,
        object_entity_id: objectEntityId,
      });
      setDialogOpen(false);
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create');
    }
  }

  async function handleDelete(entityRelationshipId: number) {
    if (!window.confirm('Delete this entity relationship?')) {
      return;
    }
    try {
      await ontologyApi.deleteEntityRelationship(entityRelationshipId);
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
            Entity relationships
          </Typography>
          <Typography color="text.secondary">
            Schema-level links between entity types. Use View links to see how rows connect (e.g.
            Employee A works at Company B).
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New relationship
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
                <TableRow key={relationship.id} hover>
                  <TableCell>{relationship.id}</TableCell>
                  <TableCell>{relationship.relationship_name}</TableCell>
                  <TableCell>{entityLabel(relationship.subject_entity_id)}</TableCell>
                  <TableCell>{entityLabel(relationship.object_entity_id)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LinkIcon />}
                        onClick={() => openViewLinks(relationship)}
                      >
                        View links
                      </Button>
                      <IconButton
                        color="error"
                        onClick={() => void handleDelete(relationship.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntityRelationshipLinksDialog
        open={linksDialogOpen}
        onClose={closeViewLinks}
        definition={viewLinksDefinition}
        entities={entities}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create entity relationship</DialogTitle>
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
                  {entity.name} ({entity.id})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Object entity"
              value={objectEntityId}
              onChange={(event) => setObjectEntityId(Number(event.target.value))}
              fullWidth
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name} ({entity.id})
                </MenuItem>
              ))}
            </TextField>
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
