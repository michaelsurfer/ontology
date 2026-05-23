import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { FieldMapperNodeSettings } from '../components/workflow/FieldMapperNodeSettings';
import { RelationshipsNodeSettings } from '../components/workflow/RelationshipsNodeSettings';
import { ValidateNodeSettings } from '../components/workflow/ValidateNodeSettings';
import { WorkflowEditorCanvas } from '../components/workflow/WorkflowEditorCanvas';
import { WorkflowPaletteItem } from '../components/workflow/WorkflowPaletteItem';
import { WorkflowRunResultView } from '../components/workflow/WorkflowRunResultView';
import { ontologyApi } from '../api/client';
import type { EntityDefinition, EntityRelationshipDefinition, EntitySummary } from '../types';
import type {
  FieldMappingRule,
  FieldValidationRule,
  WorkflowExecutionResult,
  WorkflowGraph,
  WorkflowNodeType,
} from '../types/workflow';

const defaultGraph: WorkflowGraph = {
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 80, y: 200 },
      data: { label: 'Trigger', triggerType: 'manual' },
    },
    {
      id: 'field-mapper-1',
      type: 'field_mapper',
      position: { x: 280, y: 200 },
      data: {
        label: 'Field Mapper',
        entityId: null,
        mappings: [{ sourceField: 'company_name', targetField: 'name', targetMode: 'custom' }],
      },
    },
    {
      id: 'validate-1',
      type: 'validate',
      position: { x: 400, y: 200 },
      data: {
        label: 'Validate',
        rules: [
          { jsonField: 'email', format: 'email' },
          { jsonField: 'name', format: 'required' },
        ],
      },
    },
    {
      id: 'entities-1',
      type: 'entities',
      position: { x: 560, y: 160 },
      data: { label: 'Entities', entityId: null, minMatchScore: 1 },
    },
    {
      id: 'relationships-1',
      type: 'relationships',
      position: { x: 840, y: 160 },
      data: {
        label: 'Relationships',
        entityRelationshipId: null,
        payloadLinkField: 'company_name',
        objectEntityField: '',
      },
    },
    {
      id: 'fallback-1',
      type: 'fallback',
      position: { x: 340, y: 360 },
      data: { label: 'Fallback', action: 'landing_zone' },
    },
  ],
  edges: [
    {
      id: 'edge-trigger-field-mapper',
      type: 'deletable',
      source: 'trigger-1',
      target: 'field-mapper-1',
    },
    {
      id: 'edge-field-mapper-validate',
      type: 'deletable',
      source: 'field-mapper-1',
      target: 'validate-1',
    },
    {
      id: 'edge-validate-entities',
      type: 'deletable',
      source: 'validate-1',
      target: 'entities-1',
      sourceHandle: 'success',
    },
    {
      id: 'edge-validate-fallback',
      type: 'deletable',
      source: 'validate-1',
      target: 'fallback-1',
      sourceHandle: 'failure',
    },
    {
      id: 'edge-entities-relationships',
      type: 'deletable',
      source: 'entities-1',
      target: 'relationships-1',
      sourceHandle: 'success',
    },
    {
      id: 'edge-entities-fallback',
      type: 'deletable',
      source: 'entities-1',
      target: 'fallback-1',
      sourceHandle: 'failure',
    },
    {
      id: 'edge-relationships-fallback',
      type: 'deletable',
      source: 'relationships-1',
      target: 'fallback-1',
      sourceHandle: 'failure',
    },
  ],
};

// Normalize legacy fallback action "landing" to landing_zone.
function normalizeFallbackNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const action = String(data.action || 'landing_zone');
  if (action === 'landing' || action === 'landing_zone') {
    return { ...data, action: 'landing_zone' };
  }
  if (action === 'stop') {
    return { ...data, action: 'stop' };
  }
  return { ...data, action: 'landing_zone' };
}

// Normalize Field Mapper node mappings from persisted graph JSON.
function normalizeFieldMapperNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const rawMappings = Array.isArray(data.mappings) ? data.mappings : [];
  const mappings: FieldMappingRule[] = rawMappings.map((entry) => {
    const mappingObject =
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    return {
      sourceField: String(mappingObject.sourceField || ''),
      targetField: String(mappingObject.targetField || ''),
      targetMode: mappingObject.targetMode === 'entity' ? 'entity' : 'custom',
    };
  });

  let resolvedEntityId: number | null = null;
  const entityIdRaw = data.entityId;
  if (entityIdRaw !== undefined && entityIdRaw !== null && entityIdRaw !== '') {
    const parsedEntityId = Number(entityIdRaw);
    if (Number.isFinite(parsedEntityId) && parsedEntityId > 0) {
      resolvedEntityId = parsedEntityId;
    }
  }

  return {
    ...data,
    label: data.label || 'Field Mapper',
    entityId: resolvedEntityId,
    mappings,
  };
}

// Normalize Validate node rules from persisted graph JSON.
function normalizeValidateNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const rawRules = Array.isArray(data.rules) ? data.rules : [];
  const allowedFormats = new Set([
    'required',
    'text',
    'number',
    'integer',
    'email',
    'date',
  ]);

  const rules: FieldValidationRule[] = rawRules.map((entry) => {
    const ruleObject = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const formatRaw = String(ruleObject.format || 'text').toLowerCase();
    const minRaw = ruleObject.minValue;
    const maxRaw = ruleObject.maxValue;
    const parsedMin = minRaw !== undefined && minRaw !== null && minRaw !== '' ? Number(minRaw) : null;
    const parsedMax = maxRaw !== undefined && maxRaw !== null && maxRaw !== '' ? Number(maxRaw) : null;

    return {
      jsonField: String(ruleObject.jsonField || ''),
      format: allowedFormats.has(formatRaw) ? (formatRaw as FieldValidationRule['format']) : 'text',
      minValue: parsedMin !== null && Number.isFinite(parsedMin) ? parsedMin : null,
      maxValue: parsedMax !== null && Number.isFinite(parsedMax) ? parsedMax : null,
    };
  });

  return {
    ...data,
    label: data.label || 'Validate',
    rules,
  };
}

// Normalize Relationships node data; migrate legacy relationshipName when possible.
function normalizeRelationshipsNodeData(
  data: Record<string, unknown>,
  entityRelationshipOptions: EntityRelationshipDefinition[],
): Record<string, unknown> {
  let resolvedRelationshipId: number | null = null;
  const rawRelationshipId = data.entityRelationshipId;
  if (rawRelationshipId !== undefined && rawRelationshipId !== null && rawRelationshipId !== '') {
    const parsedId = Number(rawRelationshipId);
    if (Number.isFinite(parsedId) && parsedId > 0) {
      resolvedRelationshipId = parsedId;
    }
  }

  if (resolvedRelationshipId === null) {
    const legacyName = String(data.relationshipName || '').trim();
    if (legacyName) {
      const matched = entityRelationshipOptions.find(
        (definition) => definition.relationship_name === legacyName,
      );
      if (matched) {
        resolvedRelationshipId = matched.id;
      }
    }
  }

  return {
    ...data,
    label: data.label || 'Relationships',
    entityRelationshipId: resolvedRelationshipId,
    payloadLinkField: String(data.payloadLinkField || data.payloadField || 'company_name').trim(),
    objectEntityField: String(data.objectEntityField || '').trim(),
  };
}

// Normalize Entities node data to a single entityId when loading older workflows.
function normalizeEntitiesNodeData(data: Record<string, unknown>): Record<string, unknown> {
  if (data.entityId !== undefined && data.entityId !== null && data.entityId !== '') {
    return { ...data };
  }
  if (Array.isArray(data.entityIds) && data.entityIds.length > 0) {
    return { ...data, entityId: data.entityIds[0] };
  }
  return { ...data, entityId: data.entityId ?? null };
}

// Convert stored workflow graph into React Flow nodes and edges.
function graphToFlowState(
  graph: WorkflowGraph,
  entityRelationshipOptions: EntityRelationshipDefinition[],
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data:
        node.type === 'field_mapper'
          ? normalizeFieldMapperNodeData(node.data)
          : node.type === 'validate'
            ? normalizeValidateNodeData(node.data)
            : node.type === 'relationships'
            ? normalizeRelationshipsNodeData(node.data, entityRelationshipOptions)
            : node.type === 'entities'
              ? normalizeEntitiesNodeData(node.data)
              : node.type === 'fallback'
                ? normalizeFallbackNodeData(node.data)
                : { ...node.data },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      type: 'deletable',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
    })),
  };
}

// Convert React Flow state back to persisted workflow graph JSON.
// Explain what the min match score threshold means for entity auto-mapping.
function explainMinMatchScore(minMatchScore: number, entityFieldCount: number): string {
  if (minMatchScore <= 0) {
    return 'Score 0: any record with at least one matching field name will map (most permissive).';
  }
  if (entityFieldCount > 0 && minMatchScore >= entityFieldCount) {
    return `Score ${minMatchScore}: every field on the entity must appear in the payload — only complete records will map.`;
  }
  if (minMatchScore === 1) {
    return 'Score 1: at least one payload key must match an entity field (good default for mixed data).';
  }
  return `Score ${minMatchScore}: at least ${minMatchScore} payload keys must match entity field names. Higher scores are stricter; unmatched records go to Fallback.`;
}

// Resolve entity id from node data (single entity; legacy workflows may use entityIds[]).
function resolveSelectedEntityIdFromNode(selectedNode: Node | null): number | null {
  if (!selectedNode || selectedNode.type !== 'entities') {
    return null;
  }
  const nodeData = selectedNode.data as Record<string, unknown>;
  if (nodeData.entityId !== undefined && nodeData.entityId !== null && nodeData.entityId !== '') {
    const parsed = Number(nodeData.entityId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (Array.isArray(nodeData.entityIds) && nodeData.entityIds.length > 0) {
    const parsed = Number(nodeData.entityIds[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function flowStateToGraph(nodes: Node[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type as WorkflowNodeType,
      position: node.position,
      data: node.data as Record<string, unknown>,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      type: edge.type || 'deletable',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    })),
  };
}

export function WorkflowEditorPage() {
  const { workflowId: workflowIdRaw } = useParams();
  const navigate = useNavigate();
  const isNewWorkflow = workflowIdRaw === 'new';

  const [workflowName, setWorkflowName] = useState('New workflow');
  const [workflowNumericId, setWorkflowNumericId] = useState<number | null>(null);
  const [entityOptions, setEntityOptions] = useState<EntitySummary[]>([]);
  const [entityRelationshipOptions, setEntityRelationshipOptions] = useState<
    EntityRelationshipDefinition[]
  >([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runInputText, setRunInputText] = useState('[\n  {\n    "name": "Example",\n    "email": "user@example.com"\n  }\n]');
  const [dryRun, setDryRun] = useState(true);
  const [runResult, setRunResult] = useState<WorkflowExecutionResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedEntityDefinitions, setSelectedEntityDefinitions] = useState<EntityDefinition[]>([]);
  const [loadingEntityFields, setLoadingEntityFields] = useState(false);
  const [webhookCopyMessage, setWebhookCopyMessage] = useState('');

  const initialFlow = useMemo(() => graphToFlowState(defaultGraph, []), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) || null;

  const edgesWithSelection = edges.map((edge) => ({
    ...edge,
    type: edge.type || 'deletable',
    selected: edge.id === selectedEdgeId,
  }));

  // Remove a connection edge from the workflow canvas.
  function removeConnectionEdge(edgeId: string) {
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
    if (selectedEdgeId === edgeId) {
      setSelectedEdgeId(null);
    }
  }

  // Resolve a node id to a display label for connection details.
  function nodeLabelById(nodeId: string): string {
    const workflowNode = nodes.find((node) => node.id === nodeId);
    if (!workflowNode) {
      return nodeId;
    }
    return String(workflowNode.data.label || workflowNode.type || nodeId);
  }

  useEffect(() => {
    void loadEntityOptions();
    if (!isNewWorkflow && workflowIdRaw) {
      void loadWorkflow(Number(workflowIdRaw));
    }
  }, [workflowIdRaw, isNewWorkflow]);

  async function loadEntityOptions() {
    try {
      const [entitiesResponse, relationshipsResponse] = await Promise.all([
        ontologyApi.listEntities(),
        ontologyApi.listEntityRelationships(),
      ]);
      setEntityOptions(entitiesResponse.data);
      setEntityRelationshipOptions(relationshipsResponse.data);
    } catch {
      setEntityOptions([]);
      setEntityRelationshipOptions([]);
    }
  }

  async function loadWorkflow(workflowId: number) {
    try {
      const response = await ontologyApi.getWorkflow(workflowId);
      const workflow = response.data;
      setWorkflowNumericId(workflow.id);
      setWorkflowName(workflow.name);
      let relationshipDefinitions = entityRelationshipOptions;
      if (relationshipDefinitions.length === 0) {
        try {
          const relationshipsResponse = await ontologyApi.listEntityRelationships();
          relationshipDefinitions = relationshipsResponse.data;
          setEntityRelationshipOptions(relationshipDefinitions);
        } catch {
          relationshipDefinitions = [];
        }
      }
      const flowState = graphToFlowState(workflow.graph, relationshipDefinitions);
      setNodes(flowState.nodes);
      setEdges(flowState.edges);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load workflow');
    }
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: 'deletable',
            id: `edge-${connection.source}-${connection.sourceHandle || 'out'}-${connection.target}`,
          },
          currentEdges,
        ),
      );
    },
    [setEdges],
  );

  // Add a new node of the given type to the canvas (optional drop position in flow coordinates).
  const addWorkflowNode = useCallback(
    (nodeType: WorkflowNodeType, position?: { x: number; y: number }) => {
      const nodeId = `${nodeType}-${Date.now()}`;
      const defaultData: Record<string, unknown> = {
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
      };
      if (nodeType === 'trigger') {
        defaultData.triggerType = 'manual';
      }
      if (nodeType === 'field_mapper') {
        defaultData.label = 'Field Mapper';
        defaultData.entityId = null;
        defaultData.mappings = [];
      }
      if (nodeType === 'validate') {
        defaultData.label = 'Validate';
        defaultData.rules = [];
      }
      if (nodeType === 'entities') {
        defaultData.entityId = null;
        defaultData.minMatchScore = 1;
      }
      if (nodeType === 'relationships') {
        defaultData.label = 'Relationships';
        defaultData.entityRelationshipId = null;
        defaultData.payloadLinkField = '';
        defaultData.objectEntityField = '';
      }
      if (nodeType === 'fallback') {
        defaultData.action = 'landing_zone';
      }

      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: nodeId,
          type: nodeType,
          position: position ?? {
            x: 120 + currentNodes.length * 40,
            y: 120 + currentNodes.length * 30,
          },
          data: defaultData,
        },
      ]);
    },
    [setNodes],
  );

  // Update data on the currently selected node.
  function updateSelectedNodeData(patch: Record<string, unknown>) {
    if (!selectedNodeId) {
      return;
    }
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  }

  async function handleSaveWorkflow() {
    const graph = flowStateToGraph(nodes, edges);
    try {
      if (isNewWorkflow || workflowNumericId === null) {
        const response = await ontologyApi.createWorkflow({
          name: workflowName.trim(),
          graph,
        });
        setWorkflowNumericId(response.data.id);
        setSaveMessage('Workflow created.');
        navigate(`/workflows/${response.data.id}`, { replace: true });
      } else {
        await ontologyApi.updateWorkflow(workflowNumericId, {
          name: workflowName.trim(),
          graph,
        });
        setSaveMessage('Workflow saved.');
      }
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  }

  async function handleRunWorkflow() {
    if (workflowNumericId === null) {
      setErrorMessage('Save the workflow before running.');
      return;
    }
    try {
      const parsedInput = JSON.parse(runInputText) as unknown;
      const response = await ontologyApi.runWorkflow(workflowNumericId, {
        input: parsedInput,
        dry_run: dryRun,
      });
      setRunResult(response.data.result);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Workflow run failed');
    }
  }

  const selectedEntityId = resolveSelectedEntityIdFromNode(selectedNode);
  const selectedTriggerType =
    selectedNode?.type === 'trigger' ? String(selectedNode.data.triggerType || 'manual') : 'manual';
  const dashboardApiBase = 'http://127.0.0.1:5180';
  const webhookApiUrl =
    workflowNumericId !== null
      ? `${dashboardApiBase.replace(/\/+$/, '')}/api/workflows/${workflowNumericId}/webhook`
      : '';
  const webhookProxyUrl =
    workflowNumericId !== null && typeof window !== 'undefined'
      ? `${window.location.origin}/api/workflows/${workflowNumericId}/webhook`
      : '';

  // Copy webhook URL to the clipboard for external systems.
  async function copyWebhookUrl(urlText: string) {
    try {
      await navigator.clipboard.writeText(urlText);
      setWebhookCopyMessage('Webhook URL copied.');
    } catch {
      setWebhookCopyMessage('Could not copy — select and copy the URL manually.');
    }
  }

  useEffect(() => {
    if (selectedNode?.type !== 'entities') {
      setSelectedEntityDefinitions([]);
      return;
    }

    if (selectedEntityId === null) {
      setSelectedEntityDefinitions([]);
      return;
    }

    let cancelled = false;
    setLoadingEntityFields(true);

    void (async () => {
      try {
        const response = await ontologyApi.getEntity(selectedEntityId);
        if (!cancelled) {
          setSelectedEntityDefinitions([response.data]);
        }
      } catch {
        if (!cancelled) {
          setSelectedEntityDefinitions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEntityFields(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedNode?.type, selectedEntityId]);

  return (
    <Stack spacing={2} sx={{ height: 'calc(100vh - 120px)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box sx={{ flex: 1, minWidth: 200, maxWidth: 560 }}>
          <TextField
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            placeholder="Workflow name"
            variant="standard"
            fullWidth
            InputProps={{
              sx: { fontSize: '1.75rem', fontWeight: 700 },
            }}
          />
          <Button component={RouterLink} to="/workflows" size="small" sx={{ mt: 0.5 }}>
            Back to list
          </Button>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setRunDialogOpen(true)}>
            Run
          </Button>
          <Button variant="contained" onClick={() => void handleSaveWorkflow()}>
            Save
          </Button>
        </Stack>
      </Stack>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}

      <Stack direction="row" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Card variant="outlined" sx={{ width: 220, flexShrink: 0 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Add nodes
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Drag onto the canvas or click to add.
            </Typography>
            <Stack spacing={1}>
              <WorkflowPaletteItem
                nodeType="trigger"
                label="Trigger"
                onClick={() => addWorkflowNode('trigger')}
              />
              <WorkflowPaletteItem
                nodeType="field_mapper"
                label="Field Mapper"
                onClick={() => addWorkflowNode('field_mapper')}
              />
              <WorkflowPaletteItem
                nodeType="validate"
                label="Validate"
                onClick={() => addWorkflowNode('validate')}
              />
              <WorkflowPaletteItem
                nodeType="entities"
                label="Entities"
                onClick={() => addWorkflowNode('entities')}
              />
              <WorkflowPaletteItem
                nodeType="relationships"
                label="Relationships"
                onClick={() => addWorkflowNode('relationships')}
              />
              <WorkflowPaletteItem
                nodeType="fallback"
                label="Fallback"
                onClick={() => addWorkflowNode('fallback')}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
          <ReactFlowProvider>
            <WorkflowEditorCanvas
              nodes={nodes}
              edges={edgesWithSelection}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              onNodeClick={(_event, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(_event, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
              }}
              onEdgesDelete={(deletedEdges) => {
                if (deletedEdges.some((edge) => edge.id === selectedEdgeId)) {
                  setSelectedEdgeId(null);
                }
              }}
              onAddNodeAtPosition={addWorkflowNode}
            />
          </ReactFlowProvider>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, py: 0.5 }}>
            Use the bin icon on a connection to remove it, or select the line and press Delete.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ width: 300, flexShrink: 0, overflow: 'auto' }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              {selectedEdge ? 'Connection' : 'Node settings'}
            </Typography>
            {selectedEdge ? (
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  <strong>{nodeLabelById(selectedEdge.source)}</strong>
                  {selectedEdge.sourceHandle ? ` (${selectedEdge.sourceHandle})` : ''}
                  {' → '}
                  <strong>{nodeLabelById(selectedEdge.target)}</strong>
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => removeConnectionEdge(selectedEdge.id)}
                >
                  Remove connection
                </Button>
              </Stack>
            ) : !selectedNode ? (
              <Typography variant="body2" color="text.secondary">
                Select a node or connection on the canvas to edit settings.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  label="Label"
                  size="small"
                  value={String(selectedNode.data.label || '')}
                  onChange={(event) => updateSelectedNodeData({ label: event.target.value })}
                  fullWidth
                />

                {selectedNode.type === 'trigger' ? (
                  <>
                    <TextField
                      select
                      label="Trigger type"
                      size="small"
                      value={selectedTriggerType}
                      onChange={(event) => updateSelectedNodeData({ triggerType: event.target.value })}
                      fullWidth
                    >
                      <MenuItem value="manual">manual</MenuItem>
                      <MenuItem value="webhook">webhook</MenuItem>
                    </TextField>

                    {selectedTriggerType === 'webhook' ? (
                      workflowNumericId !== null ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Webhook URL — POST with JSON body (array of records or{' '}
                            <code>{'{ "records": [...] }'}</code>)
                          </Typography>
                          <TextField
                            size="small"
                            fullWidth
                            label="API URL"
                            value={webhookApiUrl}
                            InputProps={{
                              readOnly: true,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Button
                                    size="small"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={() => void copyWebhookUrl(webhookApiUrl)}
                                  >
                                    Copy
                                  </Button>
                                </InputAdornment>
                              ),
                            }}
                            sx={{ mb: 1, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 12 } }}
                          />
                          {webhookProxyUrl && webhookProxyUrl !== webhookApiUrl ? (
                            <TextField
                              size="small"
                              fullWidth
                              label="Via dashboard dev proxy"
                              value={webhookProxyUrl}
                              InputProps={{
                                readOnly: true,
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Button
                                      size="small"
                                      startIcon={<ContentCopyIcon />}
                                      onClick={() => void copyWebhookUrl(webhookProxyUrl)}
                                    >
                                      Copy
                                    </Button>
                                  </InputAdornment>
                                ),
                              }}
                              sx={{ mb: 1, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 12 } }}
                            />
                          ) : null}
                          {webhookCopyMessage ? (
                            <Typography variant="caption" color="success.main">
                              {webhookCopyMessage}
                            </Typography>
                          ) : null}
                          <Alert severity="info" sx={{ mt: 1 }}>
                            External callers should use the API URL (port 5180). Runs are always live
                            (not dry run).
                          </Alert>
                        </Box>
                      ) : (
                        <Alert severity="warning">
                          Save this workflow first to generate the webhook URL.
                        </Alert>
                      )
                    ) : null}
                  </>
                ) : null}

                {selectedNode.type === 'validate' ? (
                  <ValidateNodeSettings
                    rules={
                      Array.isArray(selectedNode.data.rules)
                        ? (selectedNode.data.rules as FieldValidationRule[])
                        : []
                    }
                    onUpdate={updateSelectedNodeData}
                  />
                ) : null}

                {selectedNode.type === 'field_mapper' ? (
                  <FieldMapperNodeSettings
                    mappings={
                      Array.isArray(selectedNode.data.mappings)
                        ? (selectedNode.data.mappings as FieldMappingRule[])
                        : []
                    }
                    entityId={
                      selectedNode.data.entityId !== undefined &&
                      selectedNode.data.entityId !== null &&
                      selectedNode.data.entityId !== ''
                        ? Number(selectedNode.data.entityId)
                        : null
                    }
                    entityOptions={entityOptions}
                    onUpdate={updateSelectedNodeData}
                  />
                ) : null}

                {selectedNode.type === 'entities' ? (
                  <>
                    <TextField
                      select
                      label="Entity"
                      size="small"
                      value={selectedEntityId ?? ''}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        const nextEntityId = rawValue === '' ? null : Number(rawValue);
                        updateSelectedNodeData({
                          entityId: Number.isFinite(nextEntityId) ? nextEntityId : null,
                          entityIds: undefined,
                        });
                      }}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>Select an entity</em>
                      </MenuItem>
                      {entityOptions.map((entity) => (
                        <MenuItem key={entity.id} value={entity.id}>
                          {entity.name} (id {entity.id})
                        </MenuItem>
                      ))}
                    </TextField>
                    {(() => {
                      const minMatchScore = Number(selectedNode.data.minMatchScore ?? 1);
                      const entityFieldCount = selectedEntityDefinitions[0]?.fields.length ?? 0;
                      const sliderMaximum = 5;
                      const clampedScore = Math.min(Math.max(0, minMatchScore), sliderMaximum);

                      return (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Min match score: {clampedScore}
                          </Typography>
                          <Slider
                            value={clampedScore}
                            min={0}
                            max={sliderMaximum}
                            step={1}
                            marks
                            valueLabelDisplay="auto"
                            onChange={(_event, value) =>
                              updateSelectedNodeData({ minMatchScore: value as number })
                            }
                            sx={{ mt: 0.5, mb: 0.5 }}
                          />
                          <Alert severity="info" sx={{ py: 0.5 }}>
                            <Typography variant="caption" component="div">
                              {explainMinMatchScore(clampedScore, entityFieldCount)}
                            </Typography>
                          </Alert>
                        </Box>
                      );
                    })()}

                    {selectedEntityId !== null ? (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Fields used for auto-mapping
                          {loadingEntityFields ? ' (loading…)' : ''}
                        </Typography>
                        <Stack spacing={1}>
                          {selectedEntityDefinitions.map((entityDefinition) => (
                            <Box
                              key={entityDefinition.id}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                padding: 1,
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {entityDefinition.display_name || entityDefinition.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {entityDefinition.name} (id {entityDefinition.id})
                              </Typography>
                              {entityDefinition.fields.length === 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  No fields defined
                                </Typography>
                              ) : (
                                <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                                  {entityDefinition.fields.map((field) => (
                                    <Typography key={field.id} variant="caption" display="block">
                                      {field.field_name}{' '}
                                      <Typography component="span" variant="caption" color="text.secondary">
                                        ({field.field_type}
                                        {field.is_required ? ', required' : ''})
                                      </Typography>
                                    </Typography>
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          ))}
                          {!loadingEntityFields && selectedEntityDefinitions.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                              Could not load field definitions.
                            </Typography>
                          ) : null}
                        </Stack>
                      </Box>
                    ) : null}
                  </>
                ) : null}

                {selectedNode.type === 'relationships' ? (
                  <RelationshipsNodeSettings
                    entityRelationshipId={
                      selectedNode.data.entityRelationshipId !== undefined &&
                      selectedNode.data.entityRelationshipId !== null &&
                      selectedNode.data.entityRelationshipId !== ''
                        ? Number(selectedNode.data.entityRelationshipId)
                        : null
                    }
                    payloadLinkField={String(selectedNode.data.payloadLinkField || '')}
                    objectEntityField={String(selectedNode.data.objectEntityField || '')}
                    entityRelationshipOptions={entityRelationshipOptions}
                    entityOptions={entityOptions}
                    onUpdate={updateSelectedNodeData}
                  />
                ) : null}

                {selectedNode.type === 'fallback' ? (
                  <>
                    <TextField
                      select
                      label="Action"
                      size="small"
                      value={
                        String(selectedNode.data.action || 'landing_zone') === 'stop'
                          ? 'stop'
                          : 'landing_zone'
                      }
                      onChange={(event) => updateSelectedNodeData({ action: event.target.value })}
                      fullWidth
                    >
                      <MenuItem value="landing_zone">Send to landing zone</MenuItem>
                      <MenuItem value="stop">Stop (do not save)</MenuItem>
                    </TextField>
                    <Typography variant="caption" color="text.secondary">
                      Unmapped records are listed under Landing zone in the menu when “Send to
                      landing zone” is selected (live runs only, not dry run).
                    </Typography>
                  </>
                ) : null}

                <Chip size="small" label={`Type: ${selectedNode.type}`} />
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={runDialogOpen} onClose={() => setRunDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Run workflow</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />}
              label="Dry run (preview only, no writes to data-layer)"
            />
            <TextField
              label="Input JSON"
              multiline
              minRows={10}
              fullWidth
              value={runInputText}
              onChange={(event) => setRunInputText(event.target.value)}
              sx={{ fontFamily: 'monospace' }}
            />
            {runResult ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  Result
                </Typography>
                <WorkflowRunResultView result={runResult} />
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => void handleRunWorkflow()}>
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
