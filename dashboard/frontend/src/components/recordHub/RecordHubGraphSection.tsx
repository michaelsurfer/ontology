import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import { ontologyApi, readApiErrorMessage } from '../../api/client';
import { RdfGraphView } from '../RdfGraphView';
import type { GraphViewModel } from '../../types';
type RecordHubGraphSectionProps = {
  anchorEntityDisplayName: string;
  scopedEntityIds: number[];
};

// Load and render schema graph limited to record types linked to this hub record.
export function RecordHubGraphSection({
  anchorEntityDisplayName,
  scopedEntityIds,
}: RecordHubGraphSectionProps) {

  const [graph, setGraph] = useState<GraphViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadScopedGraph() {
    setLoading(true);
    try {
      const response = await ontologyApi.fetchRdfGraph({ entity_ids: scopedEntityIds });
      setGraph(response.data);
      setErrorMessage('');
    } catch (error) {
      setGraph(null);
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const scopedEntityIdsKey = scopedEntityIds.join(',');

  useEffect(() => {
    void loadScopedGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when scoped id list changes
  }, [scopedEntityIdsKey]);

  const scopeLabel =
    scopedEntityIds.length === 1
      ? 'this record type'
      : `${scopedEntityIds.length} related record types`;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Related schema graph
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {scopeLabel} connected to {anchorEntityDisplayName} (including{' '}
          {anchorEntityDisplayName} and types linked via row relationships).
        </Typography>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {loading && !graph ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {!loading && graph ? (
          <RdfGraphView
            graph={graph}
            graphHeight={400}
            scopedGraph
            onGraphChanged={() => void loadScopedGraph()}
          />
        ) : null}

        {!loading && !graph && !errorMessage ? (
          <Typography variant="body2" color="text.secondary">
            No graph data for this scope. Sync RDF cache under Settings → Caching if needed.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
