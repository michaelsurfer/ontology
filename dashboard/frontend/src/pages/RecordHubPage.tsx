import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import EditIcon from '@mui/icons-material/Edit';
import { PageHeader } from '../components/PageHeader';
import { RecordFieldsCard } from '../components/recordHub/RecordFieldsCard';
import { RecordIdentityStrip } from '../components/recordHub/RecordIdentityStrip';
import { RecordHubGraphSection } from '../components/recordHub/RecordHubGraphSection';
import {
  RelatedRecordsPanel,
  type RelatedRecordRow,
} from '../components/recordHub/RelatedRecordsPanel';
import { ontologyApi, readApiErrorMessage } from '../api/client';
import type { EntityDefinition, EntityRowRecord, EntitySummary } from '../types';
import {
  buildRecordHubGraphSearchParams,
  buildRelatedRecordEdges,
  buildRecordHubTitle,
  buildRowDisplayLabel,
  collectRelatedEntityIds,
  filterRelationshipLinksForRow,
  relatedRowCacheKey,
} from '../utils/recordHubNeighborhood';

type RecordHubLoadState = {
  entity: EntityDefinition;
  row: EntityRowRecord;
  relatedRows: RelatedRecordRow[];
};

// Load label cache for related rows by fetching each related entity's rows once.
async function loadRelatedRowLabels(
  edges: ReturnType<typeof buildRelatedRecordEdges>,
): Promise<Map<string, { label: string; displayName: string }>> {
  const labelCache = new Map<string, { label: string; displayName: string }>();
  const relatedEntityIds = collectRelatedEntityIds(edges);

  await Promise.all(
    relatedEntityIds.map(async (relatedEntityId) => {
      const [entityResponse, rowsResponse] = await Promise.all([
        ontologyApi.getEntity(relatedEntityId),
        ontologyApi.listEntityRows(relatedEntityId),
      ]);
      const relatedEntity = entityResponse.data;

      for (const relatedRow of rowsResponse.data) {
        const cacheKey = relatedRowCacheKey(relatedEntityId, relatedRow.id);
        labelCache.set(cacheKey, {
          label: buildRowDisplayLabel(relatedEntity.name, relatedEntity.fields, relatedRow),
          displayName: relatedEntity.display_name,
        });
      }
    }),
  );

  return labelCache;
}

// Build related table rows with resolved labels from the cache.
function buildRelatedRecordRows(
  edges: ReturnType<typeof buildRelatedRecordEdges>,
  entityNameById: Map<number, EntitySummary>,
  labelCache: Map<string, { label: string; displayName: string }>,
): RelatedRecordRow[] {
  return edges.map((edge) => {
    const cacheKey = relatedRowCacheKey(edge.relatedEntityId, edge.relatedRowId);
    const cached = labelCache.get(cacheKey);
    const entitySummary = entityNameById.get(edge.relatedEntityId);

    return {
      linkId: edge.linkId,
      relationshipName: edge.relationshipName,
      direction: edge.direction,
      relatedEntityId: edge.relatedEntityId,
      relatedEntityName: entitySummary?.name || String(edge.relatedEntityId),
      relatedEntityDisplayName: cached?.displayName || entitySummary?.name || String(edge.relatedEntityId),
      relatedRowId: edge.relatedRowId,
      relatedRowLabel: cached?.label || `${entitySummary?.name || 'record'} #${edge.relatedRowId}`,
    };
  });
}

export function RecordHubPage() {
  const navigate = useNavigate();
  const { entityId: entityIdRaw, rowId: rowIdRaw } = useParams();
  const entityId = Number(entityIdRaw);
  const rowId = Number(rowIdRaw);

  const [loadState, setLoadState] = useState<RecordHubLoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(entityId) || !Number.isFinite(rowId)) {
      setErrorMessage('Invalid entity or row id in URL.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRecordHub() {
      setLoading(true);
      setErrorMessage('');
      setNotFound(false);
      setLoadState(null);

      try {
        const [entityResponse, rowsResponse, relationshipsResponse, entitiesResponse] =
          await Promise.all([
            ontologyApi.getEntity(entityId),
            ontologyApi.listEntityRows(entityId),
            ontologyApi.listRelationships(),
            ontologyApi.listEntities(),
          ]);

        const entity = entityResponse.data;
        const row = rowsResponse.data.find((candidate) => candidate.id === rowId);

        if (!row) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const entityNameById = new Map<number, EntitySummary>();
        for (const entitySummary of entitiesResponse.data) {
          entityNameById.set(entitySummary.id, entitySummary);
        }

        const matchingLinks = filterRelationshipLinksForRow(
          relationshipsResponse.data,
          entityId,
          rowId,
        );
        const edges = buildRelatedRecordEdges(matchingLinks, entityId, rowId);
        const labelCache = await loadRelatedRowLabels(edges);
        const relatedRows = buildRelatedRecordRows(edges, entityNameById, labelCache);

        if (!cancelled) {
          setLoadState({ entity, row, relatedRows });
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(readApiErrorMessage(error));
          setLoading(false);
        }
      }
    }

    void loadRecordHub();

    return () => {
      cancelled = true;
    };
  }, [entityId, rowId]);

  const fieldGroups = useMemo(() => {
    if (!loadState) {
      return { identifierFields: [], detailFields: [] };
    }

    const activeFields = loadState.entity.fields.filter((field) => field.is_active !== false);
    const identifierFields = activeFields.filter((field) => field.is_identifier);
    const identifierNames = new Set(identifierFields.map((field) => field.field_name));
    const detailFields = activeFields.filter((field) => !identifierNames.has(field.field_name));

    return { identifierFields, detailFields };
  }, [loadState]);

  const scopedGraphEntityIds = useMemo(() => {
    if (!loadState) {
      return [];
    }
    const entityIdSet = new Set<number>([loadState.entity.id]);
    for (const relatedRow of loadState.relatedRows) {
      entityIdSet.add(relatedRow.relatedEntityId);
    }
    return Array.from(entityIdSet);
  }, [loadState]);

  if (!Number.isFinite(entityId) || !Number.isFinite(rowId)) {
    return <Alert severity="error">Invalid record URL.</Alert>;
  }

  if (loading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress size={32} />
        <Typography color="text.secondary">Loading record…</Typography>
      </Stack>
    );
  }

  if (notFound) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">Row {rowId} was not found on this record type.</Alert>
        <Button
          component={RouterLink}
          to={`/entities/${entityId}`}
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to entity
        </Button>
      </Stack>
    );
  }

  if (errorMessage || !loadState) {
    return (
      <Stack spacing={2}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <Button
          component={RouterLink}
          to={`/entities/${entityId}`}
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to entity
        </Button>
      </Stack>
    );
  }

  const { entity, row, relatedRows } = loadState;
  const recordTitle = buildRecordHubTitle(entity, row);

  return (
    <Stack spacing={2}>
      <PageHeader
        title={recordTitle}
        subtitle={`${entity.display_name} · ${entity.name} · Row ${row.id}`}
        actions={
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              component={RouterLink}
              to={`/entities/${entityId}`}
              variant="outlined"
              startIcon={<ArrowBackIcon />}
            >
              Back
            </Button>
            <Button
              component={RouterLink}
              to={`/rdf-graph${buildRecordHubGraphSearchParams(scopedGraphEntityIds)}`}
              variant="outlined"
              startIcon={<AccountTreeOutlinedIcon />}
            >
              Graph View
            </Button>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/entities/${entityId}`)}
            >
              Edit on entity page
            </Button>
          </Stack>
        }
      />

      <RecordIdentityStrip
        identifierFields={fieldGroups.identifierFields}
        rowValues={row.values}
      />

      <RecordFieldsCard fields={fieldGroups.detailFields} rowValues={row.values} />

      <RelatedRecordsPanel relatedRows={relatedRows} />

      <RecordHubGraphSection
        anchorEntityDisplayName={entity.display_name}
        scopedEntityIds={scopedGraphEntityIds}
      />

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Metadata
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={3} sx={{ rowGap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Row id
              </Typography>
              <Typography variant="body2">{row.id}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Entity id
              </Typography>
              <Typography variant="body2">{entity.id}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2">
                {row.created_at_ms ? new Date(row.created_at_ms).toLocaleString() : '—'}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
