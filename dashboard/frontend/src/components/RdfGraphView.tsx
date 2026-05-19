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

// Build React Flow nodes from the RDF graph model with an initial grid layout.
function buildFlowNodes(graphNodes: GraphViewModel['nodes']): Node<FlowNodeData>[] {
  return graphNodes.map((node, index) => ({
    id: node.id,
    data: {
      label: `${node.label} (${node.kind})`,
      kind: node.kind,
    },
    position: {
      x: (index % 6) * 220,
      y: Math.floor(index / 6) * 120,
    },
    draggable: true,
    style: {
      background: nodeColors[node.kind] || '#f5f5f5',
      border: '1px solid #90a4ae',
      borderRadius: 8,
      padding: 8,
      fontSize: 12,
      width: 200,
      cursor: 'pointer',
    },
  }));
}

// Build React Flow edges from the RDF graph model.
function buildFlowEdges(graphEdges: GraphViewModel['edges']): Edge[] {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.label === 'rdf:type',
  }));
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

  const initialNodes = useMemo(() => buildFlowNodes(graph.nodes), [graph.nodes]);
  const initialEdges = useMemo(() => buildFlowEdges(graph.edges), [graph.edges]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  const visibleNodeIds = useMemo(
    () => computeNeighborNodeIds(focusedNodeId, graph.edges),
    [focusedNodeId, graph.edges],
  );

  useEffect(() => {
    setFocusedNodeId(null);
    setFlowNodes(buildFlowNodes(graph.nodes));
    setFlowEdges(buildFlowEdges(graph.edges));
  }, [graph, setFlowNodes, setFlowEdges]);

  const displayNodes = useMemo(() => {
    return flowNodes.map((node) => {
      const nodeData = node.data as FlowNodeData;
      const isVisible = !visibleNodeIds || visibleNodeIds.has(node.id);
      const isFocused = focusedNodeId === node.id;

      return {
        ...node,
        hidden: !isVisible,
        selected: isFocused,
        style: {
          ...node.style,
          background: nodeColors[nodeData.kind] || '#f5f5f5',
          border: isFocused ? '2px solid #1565c0' : '1px solid #90a4ae',
          boxShadow: isFocused ? '0 0 0 3px rgba(21, 101, 192, 0.2)' : undefined,
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

  const visibleCount = visibleNodeIds ? visibleNodeIds.size : graph.nodes.length;

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
    const match = graph.nodes.find((node) => node.id === focusedNodeId);
    return match ? match.label : focusedNodeId;
  }, [focusedNodeId, graph.nodes]);

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip label={`${graph.nodes.length} nodes`} size="small" />
        <Chip label={`${graph.edges.length} edges`} size="small" />
        {focusedNodeId ? (
          <Chip
            label={`Showing ${visibleCount} connected`}
            size="small"
            color="primary"
            variant="outlined"
          />
        ) : null}
        <Chip label="class" size="small" sx={{ bgcolor: nodeColors.class }} />
        <Chip label="instance" size="small" sx={{ bgcolor: nodeColors.instance }} />
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
          : 'Click a node to show only that node and its direct connections. Drag nodes to rearrange.'}
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
