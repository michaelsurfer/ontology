import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ontologyApi } from '../api/client';
import { RdfGraphView } from '../components/RdfGraphView';
import { TurtlePreviewPanel } from '../components/TurtlePreviewPanel';
import type { GraphViewModel } from '../types';

export function RdfGraphPage() {
  const [entityNamesText, setEntityNamesText] = useState('');
  const [entityIdsText, setEntityIdsText] = useState('*');
  const [graph, setGraph] = useState<GraphViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadGraph({ entity_ids: '*' });
  }, []);

  async function loadGraph(body: { entity_ids?: '*' | number[]; entity_names?: string[] }) {
    setLoading(true);
    try {
      const response = await ontologyApi.fetchRdfGraph(body);
      setGraph(response.data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load RDF graph');
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    const trimmedNames = entityNamesText
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (trimmedNames.length > 0) {
      void loadGraph({ entity_names: trimmedNames });
      return;
    }

    const trimmedIds = entityIdsText.trim();
    if (trimmedIds === '*') {
      void loadGraph({ entity_ids: '*' });
      return;
    }

    const idList = trimmedIds
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));

    if (idList.length > 0) {
      void loadGraph({ entity_ids: idList });
      return;
    }

    void loadGraph({ entity_ids: '*' });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        RDF graph
      </Typography>
      <Typography color="text.secondary">
        Exports Turtle from data-layer-service and renders classes and properties (schema graph).
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap>
            <TextField
              label="Entity ids (comma-separated or *)"
              value={entityIdsText}
              onChange={(event) => setEntityIdsText(event.target.value)}
              fullWidth
            />
            <TextField
              label="Entity names (comma-separated, optional)"
              value={entityNamesText}
              onChange={(event) => setEntityNamesText(event.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={handleRefresh} disabled={loading} sx={{ minWidth: 140 }}>
              {loading ? 'Loading…' : 'Refresh graph'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {graph ? <RdfGraphView graph={graph} /> : null}

      {graph ? <TurtlePreviewPanel turtleText={graph.turtlePreview} /> : null}
    </Stack>
  );
}
