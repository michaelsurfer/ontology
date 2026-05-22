import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { WorkflowExecutionResult } from '../../types/workflow';

type EntityMappingResult = {
  recordIndex: number;
  entityId: number;
  entityName: string;
  rowId?: number;
  ok: boolean;
  reason?: string;
  matchScore?: number;
  dryRun?: boolean;
};

type RelationshipMappingResult = {
  recordIndex: number;
  relationshipName: string;
  subjectEntityId: number;
  objectEntityId: number;
  subjectRowId: number;
  objectRowId: number;
  ok: boolean;
  reason?: string;
  relationshipId?: number;
  dryRun?: boolean;
};

type ValidationRecordResult = {
  recordIndex: number;
  ok: boolean;
  failures: Array<{ field: string; message: string }>;
};

type FallbackRecordResult = {
  recordIndex: number;
  reason: string;
  payload: Record<string, unknown>;
};

type WorkflowRunResultViewProps = {
  result: WorkflowExecutionResult;
};

// Render workflow run output as tabs: friendly summary and raw JSON.
export function WorkflowRunResultView({ result }: WorkflowRunResultViewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');

  const entityResults = (result.entityResults || []) as EntityMappingResult[];
  const relationshipResults = (result.relationshipResults || []) as RelationshipMappingResult[];
  const validationResults = (result.validationResults || []) as ValidationRecordResult[];
  const fallbackRecords = (result.fallbackRecords || []) as FallbackRecordResult[];
  const validationFailedCount =
    result.validationFailedCount ?? validationResults.filter((row) => !row.ok).length;

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_event, nextTab) => setActiveTab(nextTab)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Summary" value="summary" />
        <Tab label="JSON" value="json" />
      </Tabs>

      {activeTab === 'summary' ? (
        <WorkflowRunSummaryPanel
          result={result}
          entityResults={entityResults}
          relationshipResults={relationshipResults}
          validationResults={validationResults}
          validationFailedCount={validationFailedCount}
          fallbackRecords={fallbackRecords}
        />
      ) : (
        <TextField
          multiline
          minRows={12}
          fullWidth
          value={JSON.stringify(result, null, 2)}
          InputProps={{ readOnly: true }}
          sx={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      )}
    </Box>
  );
}

type WorkflowRunSummaryPanelProps = {
  result: WorkflowExecutionResult;
  entityResults: EntityMappingResult[];
  relationshipResults: RelationshipMappingResult[];
  validationResults: ValidationRecordResult[];
  validationFailedCount: number;
  fallbackRecords: FallbackRecordResult[];
};

// User-friendly breakdown of a workflow run.
function WorkflowRunSummaryPanel({
  result,
  entityResults,
  relationshipResults,
  validationResults,
  validationFailedCount,
  fallbackRecords,
}: WorkflowRunSummaryPanelProps) {
  return (
    <Stack spacing={2}>
      <Alert severity={result.ok ? 'success' : 'error'}>
        {result.dryRun
          ? 'Dry run completed — no data was written to the data layer.'
          : 'Workflow run completed — changes were applied to the data layer.'}
      </Alert>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Chip label={`${result.recordsProcessed} record(s) in`} size="small" />
        <Chip
          label={`${entityResults.length} entity mapping(s)`}
          size="small"
          color={entityResults.length > 0 ? 'success' : 'default'}
        />
        <Chip
          label={`${result.entitiesInserted} row(s) inserted`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${relationshipResults.length} relationship link(s)`}
          size="small"
          color={relationshipResults.length > 0 ? 'success' : 'default'}
        />
        <Chip
          label={`${validationFailedCount} validation failed`}
          size="small"
          color={validationFailedCount > 0 ? 'warning' : 'default'}
        />
        <Chip
          label={`${result.fallbackCount} fallback`}
          size="small"
          color={result.fallbackCount > 0 ? 'warning' : 'default'}
        />
      </Box>

      {result.nodeLogs.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Pipeline steps
          </Typography>
          <Stack spacing={0.5}>
            {result.nodeLogs.map((log, index) => (
              <Typography key={`${log.nodeId}-${index}`} variant="body2" color="text.secondary">
                <strong>{log.nodeType}</strong> ({log.nodeId}): {log.message}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {validationResults.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Validation
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Record #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {validationResults.map((row, index) => (
                <TableRow key={`validation-${row.recordIndex}-${index}`}>
                  <TableCell>{row.recordIndex}</TableCell>
                  <TableCell>{row.ok ? 'Passed' : 'Failed'}</TableCell>
                  <TableCell>
                    {row.ok
                      ? '—'
                      : row.failures.map((failure) => `${failure.field}: ${failure.message}`).join('; ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Entity mappings
        </Typography>
        {entityResults.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No records matched an entity schema.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Record #</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Row id</TableCell>
                <TableCell>Match score</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entityResults.map((row, index) => (
                <TableRow key={`entity-${row.recordIndex}-${row.entityId}-${index}`}>
                  <TableCell>{row.recordIndex}</TableCell>
                  <TableCell>{row.entityName}</TableCell>
                  <TableCell>{row.rowId ?? (result.dryRun ? '— (dry run)' : '—')}</TableCell>
                  <TableCell>{row.matchScore ?? '—'}</TableCell>
                  <TableCell>{row.ok ? 'Mapped' : row.reason || 'Failed'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Relationships
        </Typography>
        {relationshipResults.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No relationship links were created.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Record #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Subject row</TableCell>
                <TableCell>Object row</TableCell>
                <TableCell>Link id</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationshipResults.map((row, index) => (
                <TableRow key={`rel-${row.recordIndex}-${index}`}>
                  <TableCell>{row.recordIndex}</TableCell>
                  <TableCell>{row.relationshipName}</TableCell>
                  <TableCell>{row.subjectRowId}</TableCell>
                  <TableCell>{row.objectRowId}</TableCell>
                  <TableCell>{row.relationshipId ?? (result.dryRun ? '— (dry run)' : '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Fallback / landing zone
        </Typography>
        {fallbackRecords.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No records sent to fallback.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {fallbackRecords.map((row, index) => (
              <Box
                key={`fallback-${row.recordIndex}-${index}`}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Record #{row.recordIndex} — {row.reason}
                </Typography>
                <Typography
                  component="pre"
                  variant="caption"
                  sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {JSON.stringify(row.payload, null, 2)}
                </Typography>
              </Box>
            ))}
            {!result.dryRun && result.fallbackCount > 0 ? (
              <Typography variant="caption" color="text.secondary">
                If fallback action is “Send to landing zone”, these are also stored under Landing
                zone in the menu.
              </Typography>
            ) : null}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
