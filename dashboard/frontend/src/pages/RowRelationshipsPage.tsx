import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../components/PageHeader';
import { buildRowLabelMap } from '../components/entityRelationshipLinksUtils';
import { ontologyApi, readApiErrorMessage } from '../api/client';
import type {
  EntityDefinition,
  EntityRelationshipDefinition,
  EntityRowRecord,
  EntitySummary,
  RelationshipRecord,
} from '../types';

type EntityRowPickerContext = {
  entityName: string;
  rows: EntityRowRecord[];
  labelByRowId: Map<number, string>;
};

// Load entity schema and rows so row links can show identifier labels instead of numeric ids.
async function loadRowPickerContextForEntity(entityId: number): Promise<EntityRowPickerContext> {
  const [entityResponse, rowsResponse] = await Promise.all([
    ontologyApi.getEntity(entityId),
    ontologyApi.listEntityRows(entityId),
  ]);
  const entityDefinition: EntityDefinition = entityResponse.data;
  const entityName = entityDefinition.display_name || entityDefinition.name;
  return {
    entityName,
    rows: rowsResponse.data,
    labelByRowId: buildRowLabelMap(rowsResponse.data, entityName, entityDefinition.fields),
  };
}

export function RowRelationshipsPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [entityRelationships, setEntityRelationships] = useState<EntityRelationshipDefinition[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [rowContextByEntityId, setRowContextByEntityId] = useState<Map<number, EntityRowPickerContext>>(
    new Map(),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoadingRows, setDialogLoadingRows] = useState(false);
  const [selectedEntityRelationshipId, setSelectedEntityRelationshipId] = useState(0);
  const [relationshipName, setRelationshipName] = useState('');
  const [subjectEntityId, setSubjectEntityId] = useState(0);
  const [objectEntityId, setObjectEntityId] = useState(0);
  const [subjectRowId, setSubjectRowId] = useState(0);
  const [objectRowId, setObjectRowId] = useState(0);

  useEffect(() => {
    void reload();
  }, []);

  const subjectRowContext = rowContextByEntityId.get(subjectEntityId);
  const objectRowContext = rowContextByEntityId.get(objectEntityId);

  const entityNameById = useMemo(() => {
    const nameMap = new Map<number, string>();
    for (const entity of entities) {
      nameMap.set(entity.id, entity.name);
    }
    for (const [entityId, context] of rowContextByEntityId) {
      nameMap.set(entityId, context.entityName);
    }
    return nameMap;
  }, [entities, rowContextByEntityId]);

  async function ensureRowContextsForEntityIds(
    entityIds: number[],
    validEntityIds?: Set<number>,
  ): Promise<Map<number, EntityRowPickerContext>> {
    const uniqueIds = [...new Set(entityIds.filter((id) => id > 0))].filter((entityId) =>
      validEntityIds ? validEntityIds.has(entityId) : true,
    );
    const missingIds = uniqueIds.filter((entityId) => !rowContextByEntityId.has(entityId));
    if (missingIds.length === 0) {
      return rowContextByEntityId;
    }

    const loadResults = await Promise.allSettled(
      missingIds.map(async (entityId) => {
        const context = await loadRowPickerContextForEntity(entityId);
        return [entityId, context] as const;
      }),
    );

    const nextMap = new Map(rowContextByEntityId);
    for (const result of loadResults) {
      if (result.status === 'fulfilled') {
        const [entityId, context] = result.value;
        nextMap.set(entityId, context);
      }
    }
    setRowContextByEntityId(nextMap);
    return nextMap;
  }

  function collectEntityIdsFromRelationships(records: RelationshipRecord[]): number[] {
    const entityIds: number[] = [];
    for (const record of records) {
      entityIds.push(record.subject_entity_id, record.object_entity_id);
    }
    return entityIds;
  }

  function formatRowLinkEndpoint(entityId: number, rowId: number): string {
    const context = rowContextByEntityId.get(entityId);
    const entityName = context?.entityName || entityNameById.get(entityId) || `Entity ${entityId}`;
    const rowLabel = context?.labelByRowId.get(rowId);
    if (rowLabel) {
      return `${entityName}: ${rowLabel}`;
    }
    return `${entityName} (row ${rowId})`;
  }

  async function reload() {
    try {
      const [entitiesResponse, entityRelationshipsResponse, relationshipsResponse] = await Promise.all([
        ontologyApi.listEntities(),
        ontologyApi.listEntityRelationships(),
        ontologyApi.listRelationships(),
      ]);
      setEntities(entitiesResponse.data);
      setEntityRelationships(entityRelationshipsResponse.data);
      setRelationships(relationshipsResponse.data);

      const validEntityIds = new Set(entitiesResponse.data.map((entity) => entity.id));
      const entityIdsToLoad = collectEntityIdsFromRelationships(relationshipsResponse.data);
      await ensureRowContextsForEntityIds(entityIdsToLoad, validEntityIds);

      if (entityRelationshipsResponse.data.length > 0) {
        applyEntityRelationshipSelection(entityRelationshipsResponse.data[0]);
      } else if (entitiesResponse.data.length > 0) {
        setSubjectEntityId(entitiesResponse.data[0].id);
        setObjectEntityId(entitiesResponse.data[0].id);
      }
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    }
  }

  function applyEntityRelationshipSelection(definition: EntityRelationshipDefinition) {
    setSelectedEntityRelationshipId(definition.id);
    setRelationshipName(definition.relationship_name);
    setSubjectEntityId(definition.subject_entity_id);
    setObjectEntityId(definition.object_entity_id);
  }

  function pickDefaultRowId(context: EntityRowPickerContext | undefined): number {
    if (!context || context.rows.length === 0) {
      return 0;
    }
    return context.rows[0].id;
  }

  async function openCreateDialog() {
    setDialogOpen(true);
    setDialogLoadingRows(true);
    setErrorMessage('');

    try {
      const definition =
        entityRelationships.find((item) => item.id === selectedEntityRelationshipId) ||
        entityRelationships[0];
      if (!definition) {
        return;
      }

      applyEntityRelationshipSelection(definition);
      const validEntityIds = new Set(entities.map((entity) => entity.id));
      const contextMap = await ensureRowContextsForEntityIds(
        [definition.subject_entity_id, definition.object_entity_id],
        validEntityIds,
      );
      const subjectContext = contextMap.get(definition.subject_entity_id);
      const objectContext = contextMap.get(definition.object_entity_id);
      setSubjectRowId(pickDefaultRowId(subjectContext));
      setObjectRowId(pickDefaultRowId(objectContext));
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setDialogLoadingRows(false);
    }
  }

  async function handleEntityRelationshipChange(nextRelationshipId: number) {
    const definition = entityRelationships.find((item) => item.id === nextRelationshipId);
    if (!definition) {
      return;
    }

    applyEntityRelationshipSelection(definition);
    setDialogLoadingRows(true);
    try {
      const validEntityIds = new Set(entities.map((entity) => entity.id));
      const contextMap = await ensureRowContextsForEntityIds(
        [definition.subject_entity_id, definition.object_entity_id],
        validEntityIds,
      );
      const subjectContext = contextMap.get(definition.subject_entity_id);
      const objectContext = contextMap.get(definition.object_entity_id);
      setSubjectRowId(pickDefaultRowId(subjectContext));
      setObjectRowId(pickDefaultRowId(objectContext));
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setDialogLoadingRows(false);
    }
  }

  function entityRelationshipLabel(definition: EntityRelationshipDefinition): string {
    const subjectName =
      rowContextByEntityId.get(definition.subject_entity_id)?.entityName ||
      entityNameById.get(definition.subject_entity_id) ||
      String(definition.subject_entity_id);
    const objectName =
      rowContextByEntityId.get(definition.object_entity_id)?.entityName ||
      entityNameById.get(definition.object_entity_id) ||
      String(definition.object_entity_id);
    return `${definition.relationship_name}: ${subjectName} → ${objectName}`;
  }

  async function handleCreate() {
    if (!selectedEntityRelationshipId) {
      setErrorMessage(
        'Select an entity relationship first (create one under Entity relationships if needed).',
      );
      return;
    }
    if (!subjectRowId || !objectRowId) {
      setErrorMessage('Select a subject and object record for this link.');
      return;
    }
    try {
      await ontologyApi.createRelationship({
        relationship_name: relationshipName.trim(),
        subject_entity_id: subjectEntityId,
        object_entity_id: objectEntityId,
        subject_row_id: subjectRowId,
        object_row_id: objectRowId,
      });
      setDialogOpen(false);
      await reload();
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    }
  }

  async function handleDelete(relationshipId: number) {
    if (!window.confirm('Delete this row link?')) {
      return;
    }
    try {
      await ontologyApi.deleteRelationship(relationshipId);
      await reload();
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    }
  }

  function renderRowSelectField(
    label: string,
    entityId: number,
    selectedRowId: number,
    onRowIdChange: (rowId: number) => void,
    context: EntityRowPickerContext | undefined,
  ) {
    const entityName = context?.entityName || entityNameById.get(entityId) || `Entity ${entityId}`;
    const hasRows = Boolean(context && context.rows.length > 0);

    return (
      <TextField
        select
        label={label}
        value={hasRows ? selectedRowId : ''}
        onChange={(event) => onRowIdChange(Number(event.target.value))}
        fullWidth
        disabled={!hasRows || dialogLoadingRows}
        helperText={
          hasRows
            ? `Showing identifier for each ${entityName} record. Links are stored by row id.`
            : `No rows for ${entityName} yet. Add records on the entity page first.`
        }
      >
        {(context?.rows || []).map((row) => (
          <MenuItem key={row.id} value={row.id}>
            {context?.labelByRowId.get(row.id) || `${entityName} #${row.id}`}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Row links"
        subtitle="Instance-level relationships between specific entity rows."
        actions={
          <Button variant="contained" onClick={() => void openCreateDialog()}>
            New row link
          </Button>
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Object</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationships.map((relationship) => (
                <TableRow key={relationship.id}>
                  <TableCell>{relationship.id}</TableCell>
                  <TableCell>{relationship.relationship_name}</TableCell>
                  <TableCell>
                    {formatRowLinkEndpoint(relationship.subject_entity_id, relationship.subject_row_id)}
                  </TableCell>
                  <TableCell>
                    {formatRowLinkEndpoint(relationship.object_entity_id, relationship.object_row_id)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => void handleDelete(relationship.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create row link</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {entityRelationships.length === 0 ? (
              <Alert severity="warning">
                No entity relationships defined yet. Create a schema relationship first under Entity
                relationships, then return here to link specific rows.
              </Alert>
            ) : null}
            <TextField
              select
              label="Entity relationship (required)"
              value={selectedEntityRelationshipId}
              onChange={(event) => void handleEntityRelationshipChange(Number(event.target.value))}
              fullWidth
              disabled={entityRelationships.length === 0 || dialogLoadingRows}
            >
              {entityRelationships.map((definition) => (
                <MenuItem key={definition.id} value={definition.id}>
                  {entityRelationshipLabel(definition)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Subject entity"
              value={subjectRowContext?.entityName || entityNameById.get(subjectEntityId) || ''}
              fullWidth
              disabled
            />
            {dialogLoadingRows ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20} />
                <FormHelperText sx={{ m: 0 }}>Loading records…</FormHelperText>
              </Stack>
            ) : (
              renderRowSelectField(
                'Subject record',
                subjectEntityId,
                subjectRowId,
                setSubjectRowId,
                subjectRowContext,
              )
            )}
            <TextField
              label="Object entity"
              value={objectRowContext?.entityName || entityNameById.get(objectEntityId) || ''}
              fullWidth
              disabled
            />
            {dialogLoadingRows ? null : (
              renderRowSelectField(
                'Object record',
                objectEntityId,
                objectRowId,
                setObjectRowId,
                objectRowContext,
              )
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={
              entityRelationships.length === 0 ||
              dialogLoadingRows ||
              !subjectRowId ||
              !objectRowId
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
