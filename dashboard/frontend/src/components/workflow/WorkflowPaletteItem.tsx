import { Box } from '@mui/material';
import { startWorkflowNodeDrag } from './WorkflowEditorCanvas';
import type { WorkflowNodeType } from '../../types/workflow';

type WorkflowPaletteItemProps = {
  nodeType: WorkflowNodeType;
  label: string;
  onClick: () => void;
};

// Draggable palette entry; click still adds a node at the default canvas position.
export function WorkflowPaletteItem({ nodeType, label, onClick }: WorkflowPaletteItemProps) {
  return (
    <Box
      draggable
      onDragStart={(event) => startWorkflowNodeDrag(event, nodeType)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        cursor: 'grab',
        fontSize: 14,
        textAlign: 'center',
        userSelect: 'none',
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      {label}
    </Box>
  );
}
