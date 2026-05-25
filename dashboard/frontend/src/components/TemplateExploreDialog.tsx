import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import type { TemplateSummary } from '../pages/TemplatesPage';

type TemplateExploreDialogProps = {
  open: boolean;
  template: TemplateSummary;
  onClose: () => void;
  onNavigateEntity: (entityId: number) => void;
  onNavigateWorkflow: (workflowId: number) => void;
  onNavigateEntityRelationships: () => void;
  onNavigateGraphView: () => void;
  onOpenPublicLink: () => void;
  onOpenInstructions: () => void;
};

// Dialog listing all record types, schema relationships, and workflows for an installed template.
export function TemplateExploreDialog({
  open,
  template,
  onClose,
  onNavigateEntity,
  onNavigateWorkflow,
  onNavigateEntityRelationships,
  onNavigateGraphView,
  onOpenPublicLink,
  onOpenInstructions,
}: TemplateExploreDialogProps) {
  const entityRows = template.entities || [];
  const relationshipRows = template.entityRelationships || [];
  const workflowRows = template.workflows || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>View — {template.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {template.description}
          </Typography>

          <Alert severity="info" icon={false}>
            Ingest structured JSON via the workflow webhook (Public link). Use Graph View after syncing
            RDF cache to explore the ontology.
          </Alert>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Record types ({entityRows.length})
            </Typography>
            {entityRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No record types linked yet.
              </Typography>
            ) : (
              <List dense disablePadding>
                {entityRows.map((entityRow) => (
                  <ListItem key={entityRow.entity_id} disablePadding>
                    <ListItemButton onClick={() => onNavigateEntity(entityRow.entity_id)}>
                      <ListItemIconWrap>
                        <StorageOutlinedIcon fontSize="small" color="primary" />
                      </ListItemIconWrap>
                      <ListItemText
                        primary={entityRow.display_name}
                        secondary={entityRow.name}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Schema relationships ({relationshipRows.length})
            </Typography>
            {relationshipRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                This template has no schema-level relationships.
              </Typography>
            ) : (
              <List dense disablePadding>
                {relationshipRows.map((relationshipRow) => (
                  <ListItem key={relationshipRow.entity_relationship_id} disablePadding>
                    <ListItemButton onClick={onNavigateEntityRelationships}>
                      <ListItemIconWrap>
                        <HubOutlinedIcon fontSize="small" color="primary" />
                      </ListItemIconWrap>
                      <ListItemText
                        primary={relationshipRow.relationship_name}
                        secondary={`${relationshipRow.subject_display_name} → ${relationshipRow.object_display_name}`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Workflows ({workflowRows.length})
            </Typography>
            {workflowRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No workflows linked yet.
              </Typography>
            ) : (
              <List dense disablePadding>
                {workflowRows.map((workflowRow) => (
                  <ListItem key={workflowRow.workflow_id} disablePadding>
                    <ListItemButton onClick={() => onNavigateWorkflow(workflowRow.workflow_id)}>
                      <ListItemIconWrap>
                        <TimelineOutlinedIcon fontSize="small" color="primary" />
                      </ListItemIconWrap>
                      <ListItemText
                        primary={workflowRow.name}
                        secondary={workflowRow.description || 'Ingest workflow'}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountTreeOutlinedIcon />}
              onClick={onNavigateGraphView}
            >
              Graph View
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LinkOutlinedIcon />}
              onClick={onOpenPublicLink}
            >
              Public webhook
            </Button>
            <Button size="small" variant="text" onClick={onOpenInstructions}>
              Instructions
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Small icon column for list rows.
function ListItemIconWrap({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, mr: 1 }}>
      {children}
    </Box>
  );
}
