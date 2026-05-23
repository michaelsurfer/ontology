import { Link as RouterLink } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import { Handle, Position, type NodeProps } from 'reactflow';

const classNodeStyle = {
  minWidth: 180,
  borderRadius: 2,
  border: '1px solid #90a4ae',
  padding: 1.25,
  backgroundColor: '#e3f2fd',
};

const propertyNodeStyle = {
  minWidth: 180,
  borderRadius: 2,
  border: '1px solid #90a4ae',
  padding: 1.25,
  backgroundColor: '#fff3e0',
};

// Stop React Flow from treating icon clicks as node selection or drag.
function stopGraphPointerEvent(event: React.MouseEvent) {
  event.stopPropagation();
}

// OWL class node with icon link to entity row data.
export function RdfClassGraphNode({ data, selected }: NodeProps) {
  const entityId = typeof data.entityId === 'number' ? data.entityId : null;

  return (
    <Box
      sx={{
        ...classNodeStyle,
        border: selected ? '2px solid #1565c0' : classNodeStyle.border,
        boxShadow: selected ? '0 0 0 3px rgba(21, 101, 192, 0.2)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            class
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {String(data.label || 'Class')}
          </Typography>
        </Box>
        {entityId ? (
          <Tooltip title="View entity data">
            <IconButton
              component={RouterLink}
              to={`/entities/${entityId}`}
              size="small"
              color="primary"
              aria-label="View entity data"
              sx={{ mt: -0.25, flexShrink: 0 }}
              onClick={stopGraphPointerEvent}
              onMouseDown={stopGraphPointerEvent}
            >
              <StorageOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}

// OWL property node for schema graph visualization.
export function RdfPropertyGraphNode({ data, selected }: NodeProps) {
  return (
    <Box
      sx={{
        ...propertyNodeStyle,
        border: selected ? '2px solid #1565c0' : propertyNodeStyle.border,
        boxShadow: selected ? '0 0 0 3px rgba(21, 101, 192, 0.2)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        property
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {String(data.label || 'Property')}
      </Typography>
    </Box>
  );
}

export const rdfSchemaGraphNodeTypes = {
  rdfClass: RdfClassGraphNode,
  rdfProperty: RdfPropertyGraphNode,
};
