import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { ontologyApi } from '../api/client';
import type { EntityRelationshipDefinition, EntitySummary } from '../types';
import {
  buildResolvedRelationshipLinks,
  buildRowLabelMap,
} from './entityRelationshipLinksUtils';
import { EntityRelationshipLinksTable } from './EntityRelationshipLinksTable';
import { EntityRelationshipPairGraphView } from './EntityRelationshipPairGraphView';

type EntityRelationshipLinksDialogProps = {
  open: boolean;
  onClose: () => void;
  definition: EntityRelationshipDefinition | null;
  entities: EntitySummary[];
};

// Dialog with table and graph views of row-level links for one schema relationship.
export function EntityRelationshipLinksDialog({
  open,
  onClose,
  definition,
  entities,
}: EntityRelationshipLinksDialogProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [resolvedLinks, setResolvedLinks] = useState<
    ReturnType<typeof buildResolvedRelationshipLinks>
  >([]);
  const [subjectEntityName, setSubjectEntityName] = useState('');
  const [objectEntityName, setObjectEntityName] = useState('');

  useEffect(() => {
    if (!open || !definition) {
      return;
    }

    setActiveTab(0);
    setLoadError('');
    setLoading(true);

    const subjectEntity = entities.find((entity) => entity.id === definition.subject_entity_id);
    const objectEntity = entities.find((entity) => entity.id === definition.object_entity_id);
    const subjectName = subjectEntity?.name || `Entity ${definition.subject_entity_id}`;
    const objectName = objectEntity?.name || `Entity ${definition.object_entity_id}`;
    setSubjectEntityName(subjectName);
    setObjectEntityName(objectName);

    void (async () => {
      try {
        const [recordsResponse, subjectEntityResponse, objectEntityResponse, subjectRowsResponse, objectRowsResponse] =
          await Promise.all([
            ontologyApi.listRelationships(),
            ontologyApi.getEntity(definition.subject_entity_id),
            ontologyApi.getEntity(definition.object_entity_id),
            ontologyApi.listEntityRows(definition.subject_entity_id),
            ontologyApi.listEntityRows(definition.object_entity_id),
          ]);

        const links = buildResolvedRelationshipLinks(
          definition,
          recordsResponse.data,
          buildRowLabelMap(
            subjectRowsResponse.data,
            subjectName,
            subjectEntityResponse.data.fields,
          ),
          buildRowLabelMap(objectRowsResponse.data, objectName, objectEntityResponse.data.fields),
          subjectName,
          objectName,
        );
        setResolvedLinks(links);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load links');
        setResolvedLinks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, definition, entities]);

  const dialogTitle = useMemo(() => {
    if (!definition) {
      return 'Row links';
    }
    return `${definition.relationship_name}: ${subjectEntityName} → ${objectEntityName}`;
  }, [definition, subjectEntityName, objectEntityName]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How actual rows are connected for this relationship (e.g. Employee A works at Company B).
        </Typography>

        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)} sx={{ mb: 2 }}>
          <Tab label="Table" />
          <Tab label="Graph" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : null}

        {loadError ? <Alert severity="error">{loadError}</Alert> : null}

        {!loading && !loadError ? (
          <Box>
            {activeTab === 0 ? <EntityRelationshipLinksTable links={resolvedLinks} /> : null}
            {activeTab === 1 ? (
              <EntityRelationshipPairGraphView
                links={resolvedLinks}
                subjectEntityName={subjectEntityName}
                objectEntityName={objectEntityName}
              />
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
