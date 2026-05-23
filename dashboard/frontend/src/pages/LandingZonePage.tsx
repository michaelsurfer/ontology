import { Fragment, useEffect, useState } from 'react';
import {
  Alert,
  Box,
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
import { PageHeader } from '../components/PageHeader';
import { ontologyApi } from '../api/client';

type LandingZoneRow = {
  id: number;
  workflow_id: number | null;
  workflow_name: string;
  run_id: number | null;
  record_index: number;
  reason: string;
  payload: Record<string, unknown>;
  created_at_ms: number;
};

export function LandingZonePage() {
  const [records, setRecords] = useState<LandingZoneRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  useEffect(() => {
    void reloadLandingZone();
  }, []);

  async function reloadLandingZone() {
    try {
      const response = await ontologyApi.listLandingZoneRecords();
      setRecords(response.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load landing zone');
    }
  }

  async function handleDeleteRecord(recordId: number) {
    if (!window.confirm('Remove this record from the landing zone?')) {
      return;
    }
    try {
      await ontologyApi.deleteLandingZoneRecord(recordId);
      if (expandedRecordId === recordId) {
        setExpandedRecordId(null);
      }
      await reloadLandingZone();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete record');
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Landing zone"
        subtitle="Records that failed workflow processing and were quarantined from fallback nodes."
        actions={
          <Button variant="outlined" onClick={() => void reloadLandingZone()}>
            Refresh
          </Button>
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Received</TableCell>
                <TableCell>Workflow</TableCell>
                <TableCell>Run</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Payload preview</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => (
                <Fragment key={record.id}>
                  <TableRow hover>
                    <TableCell>{new Date(record.created_at_ms).toLocaleString()}</TableCell>
                    <TableCell>{record.workflow_name || '—'}</TableCell>
                    <TableCell>{record.run_id ?? '—'}</TableCell>
                    <TableCell>{record.reason}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() =>
                          setExpandedRecordId(expandedRecordId === record.id ? null : record.id)
                        }
                      >
                        {expandedRecordId === record.id ? 'Hide' : 'View'} JSON
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton color="error" onClick={() => void handleDeleteRecord(record.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {expandedRecordId === record.id ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            my: 1,
                            p: 2,
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: 12,
                          }}
                        >
                          {JSON.stringify(record.payload, null, 2)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">
                      No records in the landing zone yet. Run a workflow with Fallback → “Send to
                      landing zone” and unmapped rows will appear here.
                    </Typography>
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
