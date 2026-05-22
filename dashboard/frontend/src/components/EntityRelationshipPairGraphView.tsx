import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Alert, Box, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { GraphViewModel } from '../types';
import type { ResolvedRelationshipLink } from './entityRelationshipLinksUtils';

const subjectRowNodeColor = '#e3f2fd';
const subjectRowNodeBorder = '#1565c0';
const objectRowNodeColor = '#fce4ec';
const objectRowNodeBorder = '#c2185b';

type EntityRelationshipPairGraphViewProps = {
  links: ResolvedRelationshipLink[];
  subjectEntityName: string;
  objectEntityName: string;
};

type FlowNodeData = {
  label: string;
  side: 'subject' | 'object';
};

// Build bipartite graph nodes and edges from resolved row links.
function buildPairGraphModel(links: ResolvedRelationshipLink[]): GraphViewModel {
  const subjectLabelsByKey = new Map<string, string>();
  const objectLabelsByKey = new Map<string, string>();

  for (const link of links) {
    subjectLabelsByKey.set(link.subjectLabel, link.subjectLabel);
    objectLabelsByKey.set(link.objectLabel, link.objectLabel);
  }

  const nodes = [
    ...Array.from(subjectLabelsByKey.values()).map((label) => ({
      id: `subject-${label}`,
      label,
      kind: 'instance' as const,
    })),
    ...Array.from(objectLabelsByKey.values()).map((label) => ({
      id: `object-${label}`,
      label,
      kind: 'instance' as const,
    })),
  ];

  const edges = links.map((link) => ({
    id: `link-${link.recordId}`,
    source: `subject-${link.subjectLabel}`,
    target: `object-${link.objectLabel}`,
    label: link.relationshipName,
  }));

  return { nodes, edges, turtlePreview: '' };
}

// Place subject rows on the left and object rows on the right.
function layoutPairGraphNodes(graphNodes: GraphViewModel['nodes']): Node<FlowNodeData>[] {
  const subjectNodes = graphNodes.filter((node) => node.id.startsWith('subject-'));
  const objectNodes = graphNodes.filter((node) => node.id.startsWith('object-'));
  const flowNodes: Node<FlowNodeData>[] = [];

  subjectNodes.forEach((node, index) => {
    flowNodes.push({
      id: node.id,
      data: { label: node.label, side: 'subject' },
      position: { x: 0, y: index * 90 },
      draggable: true,
      style: {
        background: subjectRowNodeColor,
        border: `2px solid ${subjectRowNodeBorder}`,
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        width: 220,
      },
    });
  });

  objectNodes.forEach((node, index) => {
    flowNodes.push({
      id: node.id,
      data: { label: node.label, side: 'object' },
      position: { x: 300, y: index * 90 },
      draggable: true,
      style: {
        background: objectRowNodeColor,
        border: `2px solid ${objectRowNodeBorder}`,
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        width: 220,
      },
    });
  });

  return flowNodes;
}

// Convert graph edges to React Flow edges with arrows.
function buildFlowEdges(graphEdges: GraphViewModel['edges'], nodeIds: Set<string>): Edge[] {
  return graphEdges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      labelStyle: { fontSize: 11, fill: '#37474f' },
      style: { stroke: '#546e7a', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#546e7a',
      },
    }));
}

// Inner React Flow canvas for row-level pair graph.
function EntityRelationshipPairGraphCanvas({
  links,
  subjectEntityName,
  objectEntityName,
}: EntityRelationshipPairGraphViewProps) {
  const graphModel = useMemo(() => buildPairGraphModel(links), [links]);

  const initialNodes = useMemo(() => layoutPairGraphNodes(graphModel.nodes), [graphModel.nodes]);
  const initialEdges = useMemo(() => {
    const nodeIds = new Set(initialNodes.map((node) => node.id));
    return buildFlowEdges(graphModel.edges, nodeIds);
  }, [graphModel.edges, initialNodes]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const nextNodes = layoutPairGraphNodes(graphModel.nodes);
    setFlowNodes(nextNodes);
    const nodeIds = new Set(nextNodes.map((node) => node.id));
    setFlowEdges(buildFlowEdges(graphModel.edges, nodeIds));
  }, [graphModel, setFlowNodes, setFlowEdges]);

  if (links.length === 0) {
    return (
      <Alert severity="info">
        No row links to graph yet.{' '}
        <Link component={RouterLink} to="/relationships">
          Create links on Row links
        </Link>
        .
      </Alert>
    );
  }

  const subjectCount = graphModel.nodes.filter((node) => node.id.startsWith('subject-')).length;
  const objectCount = graphModel.nodes.filter((node) => node.id.startsWith('object-')).length;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
        <Chip label={`${links.length} linked pairs`} size="small" color="primary" />
        <Chip label={`${subjectCount} ${subjectEntityName}`} size="small" />
        <Chip label={`${objectCount} ${objectEntityName}`} size="small" />
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
          ← {subjectEntityName}
        </Typography>
        <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 600 }}>
          {objectEntityName} →
        </Typography>
      </Stack>
      <Box sx={{ height: 420, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </Box>
    </Box>
  );
}

// Bipartite graph of subject rows linked to object rows.
export function EntityRelationshipPairGraphView(props: EntityRelationshipPairGraphViewProps) {
  return (
    <ReactFlowProvider>
      <EntityRelationshipPairGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
