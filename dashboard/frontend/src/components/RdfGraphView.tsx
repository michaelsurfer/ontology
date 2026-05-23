import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { GraphViewModel } from '../types';
import { rdfSchemaGraphNodeTypes } from './RdfSchemaGraphNodes';

const nodeColors: Record<string, string> = {
  class: '#e3f2fd',
  instance: '#e8f5e9',
  property: '#fff3e0',
};

interface RdfGraphViewProps {
  graph: GraphViewModel;
}

interface FlowNodeData {
  label: string;
  kind: GraphViewModel['nodes'][number]['kind'];
  entityId?: number;
}

// Collect the focused node plus every node linked by one edge (undirected).
function computeNeighborNodeIds(
  focusedNodeId: string | null,
  graphEdges: GraphViewModel['edges'],
): Set<string> | null {
  if (!focusedNodeId) {
    return null;
  }

  const visibleNodeIds = new Set<string>([focusedNodeId]);
  for (const edge of graphEdges) {
    if (edge.source === focusedNodeId) {
      visibleNodeIds.add(edge.target);
    }
    if (edge.target === focusedNodeId) {
      visibleNodeIds.add(edge.source);
    }
  }
  return visibleNodeIds;
}

// Build React Flow nodes from the RDF graph model with an initial grid layout (schema only).
function buildFlowNodes(graphNodes: GraphViewModel['nodes']): Node<FlowNodeData>[] {
  const schemaNodes = graphNodes.filter((node) => node.kind !== 'instance');
  return schemaNodes.map((node, index) => ({
    id: node.id,
    type: node.kind === 'class' ? 'rdfClass' : 'rdfProperty',
    data: {
      label: node.label,
      kind: node.kind,
      entityId: node.entityId,
    },
    position: {
      x: (index % 6) * 220,
      y: Math.floor(index / 6) * 120,
    },
    draggable: true,
    style: {
      background: 'transparent',
      border: 'none',
      padding: 0,
      width: 'auto',
      cursor: 'pointer',
    },
  }));
}

// Build React Flow edges from the RDF graph model (endpoints must be schema nodes).
function buildFlowEdges(
  graphEdges: GraphViewModel['edges'],
  schemaNodeIds: Set<string>,
): Edge[] {
  return graphEdges
    .filter((edge) => schemaNodeIds.has(edge.source) && schemaNodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.label === 'rdf:type',
      type: 'default',
      style: { stroke: '#546e7a', strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fill: '#37474f' },
    }));
}

// Nodes and edges shown in the chart (classes and properties only).
function filterSchemaGraph(graph: GraphViewModel): {
  nodes: GraphViewModel['nodes'];
  edges: GraphViewModel['edges'];
} {
  const nodes = graph.nodes.filter((node) => node.kind !== 'instance');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
  return { nodes, edges };
}

// Zoom the viewport to fit only the nodes that are currently visible.
function FitViewToVisibleNodes({
  focusedNodeId,
  visibleNodeIds,
}: {
  focusedNodeId: string | null;
  visibleNodeIds: Set<string> | null;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!focusedNodeId || !visibleNodeIds || visibleNodeIds.size === 0) {
      return;
    }
    const nodeIdList = Array.from(visibleNodeIds).map((nodeId) => ({ id: nodeId }));
    requestAnimationFrame(() => {
      void fitView({ nodes: nodeIdList, padding: 0.25, duration: 250 });
    });
  }, [focusedNodeId, visibleNodeIds, fitView]);

  return null;
}

// Inner chart: draggable nodes; click a node to show only its neighbors.
function RdfGraphCanvas({ graph }: RdfGraphViewProps) {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const schemaGraph = useMemo(() => filterSchemaGraph(graph), [graph]);

  const initialNodes = useMemo(() => buildFlowNodes(schemaGraph.nodes), [schemaGraph.nodes]);
  const initialEdges = useMemo(() => {
    const nodeIds = new Set(schemaGraph.nodes.map((node) => node.id));
    return buildFlowEdges(schemaGraph.edges, nodeIds);
  }, [schemaGraph.edges, schemaGraph.nodes]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  const visibleNodeIds = useMemo(
    () => computeNeighborNodeIds(focusedNodeId, schemaGraph.edges),
    [focusedNodeId, schemaGraph.edges],
  );

  useEffect(() => {
    setFocusedNodeId(null);
    setFlowNodes(buildFlowNodes(schemaGraph.nodes));
    const nodeIds = new Set(schemaGraph.nodes.map((node) => node.id));
    setFlowEdges(buildFlowEdges(schemaGraph.edges, nodeIds));
  }, [schemaGraph, setFlowNodes, setFlowEdges]);

  const displayNodes = useMemo(() => {
    return flowNodes.map((node) => {
      const isVisible = !visibleNodeIds || visibleNodeIds.has(node.id);
      const isFocused = focusedNodeId === node.id;

      return {
        ...node,
        hidden: !isVisible,
        selected: isFocused,
        style: {
          ...node.style,
          opacity: isVisible ? 1 : 0,
        },
      };
    });
  }, [flowNodes, visibleNodeIds, focusedNodeId]);

  const displayEdges = useMemo(() => {
    return flowEdges.map((edge) => {
      const isVisible =
        !visibleNodeIds ||
        (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
      return {
        ...edge,
        hidden: !isVisible,
      };
    });
  }, [flowEdges, visibleNodeIds]);

  const visibleCount = visibleNodeIds ? visibleNodeIds.size : schemaGraph.nodes.length;

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setFocusedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  const handleShowAllClick = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  const focusedLabel = useMemo(() => {
    if (!focusedNodeId) {
      return '';
    }
    const match = schemaGraph.nodes.find((node) => node.id === focusedNodeId);
    return match ? match.label : focusedNodeId;
  }, [focusedNodeId, schemaGraph.nodes]);

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip label={`${schemaGraph.nodes.length} nodes`} size="small" />
        <Chip label={`${schemaGraph.edges.length} edges`} size="small" />
        {focusedNodeId ? (
          <Chip
            label={`Showing ${visibleCount} connected`}
            size="small"
            color="primary"
            variant="outlined"
          />
        ) : null}
        <Chip label="class" size="small" sx={{ bgcolor: nodeColors.class }} />
        <Chip label="property" size="small" sx={{ bgcolor: nodeColors.property }} />
        {focusedNodeId ? (
          <Button size="small" variant="outlined" onClick={handleShowAllClick}>
            Show all nodes
          </Button>
        ) : null}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {focusedNodeId
          ? `Focused on "${focusedLabel}" — only directly linked nodes are shown. Click the background or "Show all nodes" to reset.`
          : 'Click a node to show only that node and its direct connections. Use the storage icon on class nodes to open entity data. Drag nodes to rearrange.'}
      </Typography>
      <Box sx={{ height: 520, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          nodeTypes={rdfSchemaGraphNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FitViewToVisibleNodes focusedNodeId={focusedNodeId} visibleNodeIds={visibleNodeIds} />
          <Background />
          <MiniMap zoomable pannable nodeColor={(node) => (node.hidden ? '#eee' : '#90caf9')} />
          <Controls />
        </ReactFlow>
      </Box>
    </Box>
  );
}

// RDF graph visualization with draggable nodes and click-to-focus neighbors.
export function RdfGraphView({ graph }: RdfGraphViewProps) {
  return (
    <ReactFlowProvider>
      <RdfGraphCanvas graph={graph} />
    </ReactFlowProvider>
  );
}
