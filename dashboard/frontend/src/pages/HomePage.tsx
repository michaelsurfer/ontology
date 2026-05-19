import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { ontologyApi } from '../api/client';

export function HomePage() {
  const [healthMessage, setHealthMessage] = useState('Checking services…');
  const [healthOk, setHealthOk] = useState(false);

  useEffect(() => {
    void loadHealth();
  }, []);

  async function loadHealth() {
    try {
      const response = await ontologyApi.health();
      const dataLayerUrl = response.data.dataLayerUrl || 'data-layer-service';
      setHealthOk(Boolean(response.data.ok));
      setHealthMessage(`Dashboard API is up. Connected to ${dataLayerUrl}.`);
    } catch (error) {
      setHealthOk(false);
      setHealthMessage(
        error instanceof Error
          ? error.message
          : 'Dashboard API or data-layer-service is not reachable.',
      );
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Ontology dashboard
      </Typography>
      <Typography color="text.secondary">
        Manage entities, row data, and relationships through the data-layer-service API. Export RDF
        Turtle and explore it as a graph.
      </Typography>

      <Alert severity={healthOk ? 'success' : 'warning'}>{healthMessage}</Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Workflow
          </Typography>
          <Box component="ol" sx={{ pl: 2, m: 0 }}>
            <li>Create entity schemas (tables)</li>
            <li>Define entity-level relationships (schema)</li>
            <li>Add row data and row-level links</li>
            <li>View RDF / TTL in the graph explorer</li>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
            <Button component={RouterLink} to="/entities" variant="contained">
              Entities
            </Button>
            <Button component={RouterLink} to="/rdf-graph" variant="outlined">
              RDF graph
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
