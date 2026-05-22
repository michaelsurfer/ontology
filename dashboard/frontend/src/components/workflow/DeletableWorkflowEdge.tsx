import type { MouseEvent } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { IconButton } from '@mui/material';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from 'reactflow';

// Workflow connection line with a delete (rubbish bin) control at the midpoint.
export function DeletableWorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Remove this edge from the canvas when the user clicks the bin icon.
  function handleDeleteEdgeClick(event: MouseEvent) {
    event.stopPropagation();
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== id));
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : style?.strokeWidth,
          stroke: selected ? '#d32f2f' : style?.stroke,
        }}
      />
      <EdgeLabelRenderer>
        <IconButton
          className="workflow-edge-delete-button"
          size="small"
          aria-label="Remove connection"
          onClick={handleDeleteEdgeClick}
          sx={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            width: 28,
            height: 28,
            backgroundColor: '#fff',
            border: '1px solid',
            borderColor: selected ? 'error.main' : 'divider',
            boxShadow: 1,
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText',
            },
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </EdgeLabelRenderer>
    </>
  );
}
