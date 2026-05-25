import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { PageHeader } from '../../components/PageHeader';
import { ontologyApi } from '../../api/client';

type CacheMetaState = {
  version: number;
  turtleBytes: number;
  updatedAtMs: number;
  rdfCacheUrl: string;
};

// Format cache last-update time for display, or a fallback when never synced.
function formatLastSyncTime(updatedAtMs: number, turtleBytes: number): string {
  if (updatedAtMs <= 0 || turtleBytes === 0) {
    return 'Never synced (cache is empty)';
  }
  return new Date(updatedAtMs).toLocaleString();
}

export function CachingSettingsPage() {
  const [cacheMeta, setCacheMeta] = useState<CacheMetaState | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [syncingCache, setSyncingCache] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  const reloadCacheMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const response = await ontologyApi.fetchRdfCacheMeta();
      const result = response.data;
      setCacheMeta({
        version: result.version,
        turtleBytes: result.turtle_bytes,
        updatedAtMs: result.updated_at_ms,
        rdfCacheUrl: result.rdfCacheUrl,
      });
    } catch (error) {
      setCacheMeta(null);
      setAlertMessage({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not read cache status. Is rdf-cache-service running on port 8181?',
      });
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void reloadCacheMeta();
  }, [reloadCacheMeta]);

  // Export Turtle from data-layer and load it into rdf-cache-service.
  async function handleSyncCache() {
    setSyncingCache(true);
    setAlertMessage(null);
    try {
      const response = await ontologyApi.syncRdfCache({ entity_ids: '*' });
      const result = response.data;
      setCacheMeta({
        version: result.version,
        turtleBytes: result.turtle_bytes,
        updatedAtMs: result.updated_at_ms,
        rdfCacheUrl: result.rdfCacheUrl,
      });
      setAlertMessage({
        severity: 'success',
        message: `RDF cache synced (version ${result.version}, ${result.turtle_bytes.toLocaleString()} bytes).`,
      });
    } catch (error) {
      setAlertMessage({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sync failed. Is data-layer-service (8182) and rdf-cache-service (8181) running?',
      });
    } finally {
      setSyncingCache(false);
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Caching"
        subtitle="Export Turtle from the data layer and load it into rdf-cache-service for SPARQL and Graph View."
      />

      {alertMessage ? (
        <Alert severity={alertMessage.severity} onClose={() => setAlertMessage(null)}>
          {alertMessage.message}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Last sync
              </Typography>
              <Typography variant="body1">
                {loadingMeta
                  ? 'Loading…'
                  : cacheMeta
                    ? formatLastSyncTime(cacheMeta.updatedAtMs, cacheMeta.turtleBytes)
                    : 'Unknown'}
              </Typography>
              {cacheMeta && cacheMeta.turtleBytes > 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Version {cacheMeta.version} · {cacheMeta.turtleBytes.toLocaleString()} bytes ·{' '}
                  {cacheMeta.rdfCacheUrl}
                </Typography>
              ) : null}
            </Box>

            <Box>
              <Button
                variant="contained"
                startIcon={<SyncIcon />}
                onClick={() => void handleSyncCache()}
                disabled={syncingCache || loadingMeta}
              >
                {syncingCache ? 'Syncing cache…' : 'Sync cache now'}
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Sync exports all entities from data-layer-service and replaces the in-memory RDF cache.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
