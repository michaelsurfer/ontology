import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { PageHeader } from '../components/PageHeader';
import { TemplateExploreDialog } from '../components/TemplateExploreDialog';
import { TemplateInstructionsDialog } from '../components/TemplateInstructionsDialog';
import { TemplatePublicLinkDialog } from '../components/TemplatePublicLinkDialog';
import { ontologyApi } from '../api/client';

export type TemplateInstalledEntityLink = {
  name: string;
  display_name: string;
  entity_id: number;
};

export type TemplateInstalledEntityRelationshipLink = {
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
  subject_display_name: string;
  object_display_name: string;
  entity_relationship_id: number;
};

export type TemplateInstalledWorkflowLink = {
  name: string;
  description?: string;
  workflow_id: number;
};

export type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  installed: boolean;
  primaryWorkflowId?: number | null;
  primaryWorkflowName?: string | null;
  primaryEntityId?: number | null;
  primaryEntityName?: string | null;
  entities?: TemplateInstalledEntityLink[];
  entityRelationships?: TemplateInstalledEntityRelationshipLink[];
  workflows?: TemplateInstalledWorkflowLink[];
  publicWebhookPath?: string | null;
};

type InstalledTemplateCardProps = {
  template: TemplateSummary;
  deleting: boolean;
  onExplore: () => void;
  onDelete: () => void;
  onPublicLink: () => void;
  onInstruction: () => void;
};

// Card for an installed template with Explore and a three-dot actions menu.
function InstalledTemplateCard({
  template,
  deleting,
  onExplore,
  onDelete,
  onPublicLink,
  onInstruction,
}: InstalledTemplateCardProps) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorElement);

  function closeMenu() {
    setMenuAnchorElement(null);
  }

  function runMenuAction(action: () => void) {
    closeMenu();
    action();
  }

  const entityCount = template.entities?.length ?? 0;
  const relationshipCount = template.entityRelationships?.length ?? 0;
  const workflowCount = template.workflows?.length ?? 0;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.5,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {template.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleOutlineIcon />}
              label="Installed"
            />
            <IconButton
              size="small"
              aria-label="Template actions"
              disabled={deleting}
              onClick={(event) => setMenuAnchorElement(event.currentTarget)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, flexGrow: 1 }}>
          {template.description}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
          {entityCount} record type(s) · {relationshipCount} schema relationship(s) ·{' '}
          {workflowCount} workflow(s)
        </Typography>

        <Button
          variant="contained"
          size="small"
          startIcon={<VisibilityOutlinedIcon />}
          onClick={onExplore}
          disabled={deleting}
        >
          View
        </Button>

        <Menu
          anchorEl={menuAnchorElement}
          open={menuOpen}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => runMenuAction(onPublicLink)}>
            <ListItemIcon>
              <LinkOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Public webhook" secondary="JSON ingest URL" />
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onInstruction)}>
            <ListItemIcon>
              <MenuBookOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Instructions" />
          </MenuItem>
          <MenuItem
            onClick={() => runMenuAction(onDelete)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <DeleteOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={deleting ? 'Deleting…' : 'Delete'} />
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
}

// Card for a template that is not installed yet.
function AvailableTemplateCard({
  template,
  onExplore,
}: {
  template: TemplateSummary;
  onExplore: () => void;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          {template.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
          {template.description}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<ExploreOutlinedIcon />}
          onClick={onExplore}
        >
          Explore
        </Button>
      </CardContent>
    </Card>
  );
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [installMessage, setInstallMessage] = useState('');
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exploreTemplate, setExploreTemplate] = useState<TemplateSummary | null>(null);
  const [publicLinkTemplate, setPublicLinkTemplate] = useState<TemplateSummary | null>(null);
  const [instructionTemplate, setInstructionTemplate] = useState<TemplateSummary | null>(null);

  const installedTemplates = useMemo(
    () => templates.filter((template) => template.installed),
    [templates],
  );
  const availableTemplates = useMemo(
    () => templates.filter((template) => !template.installed),
    [templates],
  );

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const response = await ontologyApi.listTemplates();
      setTemplates(
        response.data.map((row) => ({
          ...row,
          installed: Boolean(row.installed),
        })),
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTemplate(templateId: string, templateName: string) {
    const confirmed = window.confirm(
      `Delete "${templateName}"? This removes its record types, relationships, and workflows from this environment.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(templateId);
    setInstallMessage('');
    setErrorMessage('');
    try {
      await ontologyApi.uninstallTemplate(templateId);
      setInstallMessage(`Removed template "${templateName}" from this environment.`);
      if (exploreTemplate?.id === templateId) {
        setExploreTemplate(null);
      }
      if (publicLinkTemplate?.id === templateId) {
        setPublicLinkTemplate(null);
      }
      if (instructionTemplate?.id === templateId) {
        setInstructionTemplate(null);
      }
      await loadTemplates();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Template delete failed');
    } finally {
      setDeletingTemplateId(null);
    }
  }

  function buildDefaultInstructions(template: TemplateSummary): string {
    return (
      template.instructions ||
      `Install "${template.name}" and use Explore to open record types, schema relationships, and workflows. Ingest data via the public webhook with JSON payloads.`
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Templates"
        subtitle="Enterprise ontology showcases: record types, schema relationships, ingest workflows, and Graph View. Install a pack, then Explore to navigate everything it creates."
        actions={
          <Button variant="outlined" onClick={() => void loadTemplates()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {installMessage ? <Alert severity="success">{installMessage}</Alert> : null}
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {loading ? (
        <Typography color="text.secondary">Loading templates…</Typography>
      ) : (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Installed
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click View to open record types, schema relationships, and workflows for each pack.
            </Typography>
            {installedTemplates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No installed templates yet. Install one from the section below.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {installedTemplates.map((template) => (
                  <Box key={template.id} sx={{ flex: '1 1 300px', minWidth: 280, maxWidth: 420 }}>
                    <InstalledTemplateCard
                      template={template}
                      deleting={deletingTemplateId === template.id}
                      onExplore={() => setExploreTemplate(template)}
                      onDelete={() => void handleDeleteTemplate(template.id, template.name)}
                      onPublicLink={() => setPublicLinkTemplate(template)}
                      onInstruction={() => setInstructionTemplate(template)}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Available to install
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click Explore to preview record types, relationships, and workflows, then install from
              the detail page.
            </Typography>
            {availableTemplates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                All templates are installed.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {availableTemplates.map((template) => (
                  <Box key={template.id} sx={{ flex: '1 1 280px', minWidth: 260, maxWidth: 400 }}>
                    <AvailableTemplateCard
                      template={template}
                      onExplore={() => navigate(`/templates/${template.id}`)}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Stack>
      )}

      {exploreTemplate ? (
        <TemplateExploreDialog
          open
          template={exploreTemplate}
          onClose={() => setExploreTemplate(null)}
          onNavigateEntity={(entityId) => {
            setExploreTemplate(null);
            navigate(`/entities/${entityId}`);
          }}
          onNavigateWorkflow={(workflowId) => {
            setExploreTemplate(null);
            navigate(`/workflows/${workflowId}`);
          }}
          onNavigateEntityRelationships={() => {
            setExploreTemplate(null);
            navigate('/entity-relationships');
          }}
          onNavigateGraphView={() => {
            setExploreTemplate(null);
            navigate('/rdf-graph');
          }}
          onOpenPublicLink={() => {
            setPublicLinkTemplate(exploreTemplate);
          }}
          onOpenInstructions={() => {
            setInstructionTemplate(exploreTemplate);
          }}
        />
      ) : null}

      {publicLinkTemplate ? (
        <TemplatePublicLinkDialog
          open
          templateName={publicLinkTemplate.name}
          webhookPath={publicLinkTemplate.publicWebhookPath ?? null}
          onClose={() => setPublicLinkTemplate(null)}
        />
      ) : null}

      {instructionTemplate ? (
        <TemplateInstructionsDialog
          open
          templateName={instructionTemplate.name}
          instructions={buildDefaultInstructions(instructionTemplate)}
          onClose={() => setInstructionTemplate(null)}
        />
      ) : null}
    </Stack>
  );
}
