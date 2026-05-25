import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { ontologyApi } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { RdfGraphView } from '../components/RdfGraphView';
import type { GraphViewModel } from '../types';

// Parse entity_ids=1,2,3 from the query string for scoped graph loads.
function parseEntityIdsFromSearchParams(searchParams: URLSearchParams): number[] | '*' {
  const rawValue = searchParams.get('entity_ids')?.trim() || '';
  if (!rawValue || rawValue === '*') {
    return '*';
  }

  const parsedIds = rawValue
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return parsedIds.length > 0 ? parsedIds : '*';
}

export function RdfGraphPage() {
  const [searchParams] = useSearchParams();
  const entityScope = useMemo(
    () => parseEntityIdsFromSearchParams(searchParams),
    [searchParams],
  );
  const isScopedGraph = entityScope !== '*';

  const [graph, setGraph] = useState<GraphViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const entityScopeKey = entityScope === '*' ? '*' : entityScope.join(',');

  useEffect(() => {
    void loadGraph();
  }, [entityScopeKey]);

  async function loadGraph() {
    setLoading(true);
    try {
      const requestBody =
        entityScope === '*' ? { entity_ids: '*' as const } : { entity_ids: entityScope };
      const response = await ontologyApi.fetchRdfGraph(requestBody);
      setGraph(response.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load schema graph');
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Graph View"
        subtitle={
          isScopedGraph
            ? `Showing ${entityScope.length} related record type(s) from record hub (entity ids: ${entityScope.join(', ')}).`
            : 'Explore record types and relationships. Connect class nodes to create new entity relationships.'
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Schema graph
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Class nodes are record types; property nodes are schema relationships. Drag from one
            class to another to add a new relationship, or click a node to focus its connections.
          </Typography>

          {loading && !graph ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {!loading && graph ? (
            <RdfGraphView
              graph={graph}
              scopedGraph={isScopedGraph}
              onGraphChanged={() => void loadGraph()}
            />
          ) : null}

          {!loading && !graph && !errorMessage ? (
            <Typography variant="body2" color="text.secondary">
              No schema graph data yet.
            </Typography>
          ) : null}
        </CardContent>
      </Card>
    </Stack>
  );
}
