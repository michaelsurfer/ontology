import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from 'reactflow';
import { Box } from '@mui/material';
import { workflowNodeTypes } from './WorkflowCanvasNodes';
import { workflowEdgeTypes } from './workflowEdgeTypes';
import type { WorkflowNodeType } from '../../types/workflow';

export const WORKFLOW_NODE_DRAG_MIME = 'application/reactflow';

// Start dragging a palette item onto the workflow canvas.
export function startWorkflowNodeDrag(event: React.DragEvent, nodeType: WorkflowNodeType) {
  event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, nodeType);
  event.dataTransfer.effectAllowed = 'move';
}

type WorkflowEditorCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onPaneClick: () => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  onAddNodeAtPosition: (nodeType: WorkflowNodeType, position: { x: number; y: number }) => void;
};

// React Flow canvas with drop-to-add support (must be used inside ReactFlowProvider).
export function WorkflowEditorCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onPaneClick,
  onNodeClick,
  onEdgeClick,
  onEdgesDelete,
  onAddNodeAtPosition,
}: WorkflowEditorCanvasProps) {
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME) as WorkflowNodeType;
      if (!nodeType || !reactFlowWrapperRef.current) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onAddNodeAtPosition(nodeType, position);
    },
    [screenToFlowPosition, onAddNodeAtPosition],
  );

  return (
    <Box
      ref={reactFlowWrapperRef}
      sx={{ width: '100%', height: '100%', minHeight: 480 }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgesDelete={onEdgesDelete}
        defaultEdgeOptions={{ deletable: true }}
        elementsSelectable
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={workflowNodeTypes}
        edgeTypes={workflowEdgeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </Box>
  );
}
