import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import HubIcon from '@mui/icons-material/Hub';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VerifiedIcon from '@mui/icons-material/Verified';

const nodeShellStyle = {
  minWidth: 160,
  borderRadius: 2,
  border: '2px solid',
  padding: 1.5,
  backgroundColor: '#fff',
};

// Trigger node — workflow entry point.
export function TriggerWorkflowNode({ data }: NodeProps) {
  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#1976d2' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PlayArrowIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Trigger'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {(data.triggerType as string) || 'manual'}
      </Typography>
      <Handle type="source" position={Position.Right} id="success" />
    </Box>
  );
}

// Field Mapper node — rename incoming JSON keys before entity mapping.
export function FieldMapperWorkflowNode({ data }: NodeProps) {
  const mappings = Array.isArray(data.mappings) ? data.mappings : [];
  const mappingCount = mappings.filter((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const mappingObject = entry as Record<string, unknown>;
    return (
      Boolean(String(mappingObject.sourceField || '').trim()) &&
      Boolean(String(mappingObject.targetField || '').trim())
    );
  }).length;

  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#7b1fa2' }}>
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SwapHorizIcon sx={{ color: '#7b1fa2' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Field Mapper'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {mappingCount === 0
          ? 'no mappings configured'
          : `${mappingCount} field mapping${mappingCount === 1 ? '' : 's'}`}
      </Typography>
      <Handle type="source" position={Position.Right} id="success" />
    </Box>
  );
}

// Validate node — quality gate on incoming JSON fields.
export function ValidateWorkflowNode({ data }: NodeProps) {
  const rules = Array.isArray(data.rules) ? data.rules : [];
  const ruleCount = rules.filter((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    return Boolean(String((entry as Record<string, unknown>).jsonField || '').trim());
  }).length;

  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#00838f' }}>
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VerifiedIcon sx={{ color: '#00838f' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Validate'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {ruleCount === 0
          ? 'no rules configured'
          : `${ruleCount} validation rule${ruleCount === 1 ? '' : 's'}`}
      </Typography>
      <Handle type="source" position={Position.Right} id="success" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="failure" style={{ top: '70%' }} />
    </Box>
  );
}

// Entities node — auto-map records to selected entities.
export function EntitiesWorkflowNode({ data }: NodeProps) {
  const entityId =
    data.entityId !== undefined && data.entityId !== null
      ? Number(data.entityId)
      : Array.isArray(data.entityIds) && data.entityIds.length > 0
        ? Number(data.entityIds[0])
        : null;
  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#2e7d32' }}>
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorageIcon sx={{ color: '#2e7d32' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Entities'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {entityId ? `entity id ${entityId}` : 'no entity selected'} · min score{' '}
        {String(data.minMatchScore ?? 1)}
      </Typography>
      <Handle type="source" position={Position.Right} id="success" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="failure" style={{ top: '70%' }} />
    </Box>
  );
}

// Relationships node — link subject rows to object rows via a chosen entity relationship.
export function RelationshipsWorkflowNode({ data }: NodeProps) {
  const relationshipId =
    data.entityRelationshipId !== undefined && data.entityRelationshipId !== null
      ? Number(data.entityRelationshipId)
      : null;
  const payloadLinkField = String(data.payloadLinkField || '').trim();
  const objectEntityField = String(data.objectEntityField || '').trim();

  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#ed6c02' }}>
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HubIcon sx={{ color: '#ed6c02' }} fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Relationships'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 180 }}>
        {relationshipId
          ? `relationship #${relationshipId}`
          : 'no relationship selected'}
        {payloadLinkField && objectEntityField
          ? ` · ${payloadLinkField} → ${objectEntityField}`
          : ''}
      </Typography>
      <Handle type="source" position={Position.Right} id="success" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="failure" style={{ top: '70%' }} />
    </Box>
  );
}

// Fallback node — capture unmapped records.
export function FallbackWorkflowNode({ data }: NodeProps) {
  return (
    <Box sx={{ ...nodeShellStyle, borderColor: '#d32f2f' }}>
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReportProblemIcon color="error" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {(data.label as string) || 'Fallback'}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {(data.action as string) === 'stop' ? 'stop' : 'send to landing zone'}
      </Typography>
    </Box>
  );
}

export const workflowNodeTypes = {
  trigger: TriggerWorkflowNode,
  field_mapper: FieldMapperWorkflowNode,
  validate: ValidateWorkflowNode,
  entities: EntitiesWorkflowNode,
  relationships: RelationshipsWorkflowNode,
  fallback: FallbackWorkflowNode,
};
