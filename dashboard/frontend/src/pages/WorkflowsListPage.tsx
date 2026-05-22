import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { ontologyApi } from '../api/client';
import type { WorkflowSummary } from '../types/workflow';

export function WorkflowsListPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void reloadWorkflows();
  }, []);

  async function reloadWorkflows() {
    try {
      const response = await ontologyApi.listWorkflows();
      setWorkflows(response.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load workflows');
    }
  }

  async function handleDeleteWorkflow(workflowId: number) {
    if (!window.confirm('Delete this workflow and its run history?')) {
      return;
    }
    try {
      await ontologyApi.deleteWorkflow(workflowId);
      await reloadWorkflows();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete workflow');
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Workflows
        </Typography>
        <Button variant="contained" component={RouterLink} to="/workflows/new">
          New workflow
        </Button>
      </Stack>

      <Typography color="text.secondary">
        Build ingest pipelines with Trigger → Entities → Relationships → Fallback nodes on a canvas.
      </Typography>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <Button component={RouterLink} to={`/workflows/${workflow.id}`}>
                      {workflow.name}
                    </Button>
                  </TableCell>
                  <TableCell>{new Date(workflow.updated_at_ms).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => void handleDeleteWorkflow(workflow.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No workflows yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
