import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import type { EntityDefinition, EntityRowRecord } from '../types';

export function EntityDetailPage() {
  const { entityId: entityIdRaw } = useParams();
  const entityId = Number(entityIdRaw);

  const [entity, setEntity] = useState<EntityDefinition | null>(null);
  const [rows, setRows] = useState<EntityRowRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rowValuesText, setRowValuesText] = useState('{\n  \n}');

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

  async function handleCreateRow() {
    try {
      const parsedValues = JSON.parse(rowValuesText) as Record<string, unknown>;
      await ontologyApi.createEntityRow(entityId, parsedValues);
      setDialogOpen(false);
      await reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create row');
    }
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

  const fieldNames = entity.fields.map((field) => field.field_name);

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
          <Typography variant="h6" sx={{ mb: 1 }}>
            Fields
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entity.fields.map((field) => `${field.field_name} (${field.field_type})`).join(', ')}
          </Typography>
        </CardContent>
      </Card>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Row data</Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          Add row
        </Button>
      </Stack>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                {fieldNames.map((fieldName) => (
                  <TableCell key={fieldName}>{fieldName}</TableCell>
                ))}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  {fieldNames.map((fieldName) => (
                    <TableCell key={`${row.id}-${fieldName}`}>
                      {formatCell(row.values[fieldName])}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => void handleDeleteRow(row.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Add row (JSON values)</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={8}
            fullWidth
            value={rowValuesText}
            onChange={(event) => setRowValuesText(event.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateRow()}>
            Save row
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
