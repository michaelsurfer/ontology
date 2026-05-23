import { useEffect, useState } from 'react';
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

export function RdfGraphPage() {
  const [graph, setGraph] = useState<GraphViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadGraph();
  }, []);

  async function loadGraph() {
    setLoading(true);
    try {
      const response = await ontologyApi.fetchRdfGraph({ entity_ids: '*' });
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
        title="RDF graph"
        subtitle="Explore entity classes and relationship properties as an interactive schema graph."
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Schema graph
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Classes (entity types) and properties (relationships between types). Click a node to
            focus on its direct connections; drag nodes to rearrange the layout.
          </Typography>

          {loading && !graph ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {!loading && graph ? <RdfGraphView graph={graph} /> : null}

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
