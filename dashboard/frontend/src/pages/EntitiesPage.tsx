import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import type { EntitySummary, FieldType } from '../types';

const emptyField = { field_name: '', field_type: 'TEXT' as FieldType, is_required: false };

export function EntitiesPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entityName, setEntityName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fields, setFields] = useState([{ ...emptyField }]);

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

  async function handleCreateEntity() {
    try {
      await ontologyApi.createEntity({
        name: entityName.trim(),
        display_name: displayName.trim() || entityName.trim(),
        fields,
      });
      setDialogOpen(false);
      setEntityName('');
      setDisplayName('');
      setFields([{ ...emptyField }]);
      await reloadEntities();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create entity');
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
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Entities
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New entity
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create entity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name (snake_case)"
              value={entityName}
              onChange={(event) => setEntityName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              fullWidth
            />
            {fields.map((field, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Field name"
                  value={field.field_name}
                  onChange={(event) => {
                    const next = [...fields];
                    next[index] = { ...next[index], field_name: event.target.value };
                    setFields(next);
                  }}
                  fullWidth
                />
                <TextField
                  select
                  label="Type"
                  value={field.field_type}
                  onChange={(event) => {
                    const next = [...fields];
                    next[index] = {
                      ...next[index],
                      field_type: event.target.value as FieldType,
                    };
                    setFields(next);
                  }}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="TEXT">TEXT</MenuItem>
                  <MenuItem value="INTEGER">INTEGER</MenuItem>
                  <MenuItem value="REAL">REAL</MenuItem>
                </TextField>
              </Box>
            ))}
            <Button
              variant="outlined"
              onClick={() => setFields([...fields, { ...emptyField }])}
            >
              Add field
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateEntity()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
