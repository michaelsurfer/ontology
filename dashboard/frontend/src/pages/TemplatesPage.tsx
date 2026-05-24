import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { PageHeader } from '../components/PageHeader';
import { TemplateInstructionsDialog } from '../components/TemplateInstructionsDialog';
import { TemplateOpenDialog } from '../components/TemplateOpenDialog';
import { TemplatePublicLinkDialog } from '../components/TemplatePublicLinkDialog';
import { ontologyApi } from '../api/client';

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
  publicWebhookPath?: string | null;
  publicDocumentUploadPath?: string | null;
};

type InstalledTemplateCardProps = {
  template: TemplateSummary;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onPublicLink: () => void;
  onInstruction: () => void;
  onViewEntity: () => void;
  onViewWorkflow: () => void;
};

// Card for an installed template with Open and a three-dot actions menu.
function InstalledTemplateCard({
  template,
  deleting,
  onOpen,
  onDelete,
  onPublicLink,
  onInstruction,
  onViewEntity,
  onViewWorkflow,
}: InstalledTemplateCardProps) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorElement);
  const canViewEntity = Boolean(template.primaryEntityId);
  const canViewWorkflow = Boolean(template.primaryWorkflowId);

  function closeMenu() {
    setMenuAnchorElement(null);
  }

  function runMenuAction(action: () => void) {
    closeMenu();
    action();
  }

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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flexGrow: 1 }}>
          {template.description}
        </Typography>

        <Button variant="contained" size="small" onClick={onOpen} disabled={deleting}>
          Open
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
            <ListItemText primary="Public link" secondary="Webhook and upload URLs" />
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onInstruction)}>
            <ListItemIcon>
              <MenuBookOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Instruction" />
          </MenuItem>
          <MenuItem disabled={!canViewEntity} onClick={() => runMenuAction(onViewEntity)}>
            <ListItemIcon>
              <StorageOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="View entity"
              secondary={template.primaryEntityName || 'Record type'}
            />
          </MenuItem>
          <MenuItem disabled={!canViewWorkflow} onClick={() => runMenuAction(onViewWorkflow)}>
            <ListItemIcon>
              <TimelineOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="View workflow"
              secondary={template.primaryWorkflowName || 'Ingest workflow'}
            />
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
  installing,
  onInstall,
}: {
  template: TemplateSummary;
  installing: boolean;
  onInstall: () => void;
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
          onClick={onInstall}
          disabled={installing}
          startIcon={installing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {installing ? 'Installing…' : 'Install'}
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
  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTemplate, setOpenTemplate] = useState<TemplateSummary | null>(null);
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

  async function handleInstallTemplate(templateId: string) {
    setInstallingTemplateId(templateId);
    setInstallMessage('');
    setErrorMessage('');
    try {
      const response = await ontologyApi.installTemplate(templateId);
      const createdEntities = response.data.entities.filter((row) => row.created).length;
      const createdWorkflows = response.data.workflows.filter((row) => row.created).length;
      setInstallMessage(
        `Installed "${response.data.templateName}": ${createdEntities} new record type(s), ${createdWorkflows} new workflow(s).`,
      );
      await loadTemplates();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Template install failed');
    } finally {
      setInstallingTemplateId(null);
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
      if (openTemplate?.id === templateId) {
        setOpenTemplate(null);
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
      `Use Open to upload a file for ${template.name}. Configure OPENAI_API_KEY for PDF and text extraction, or upload JSON/CSV.`
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Templates"
        subtitle="Starter packs that create record types and ingest workflows. Installed templates include a menu for public links, instructions, and navigation."
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
              Use the ⋮ menu on each card for public links, instructions, navigation, and delete.
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
                      onOpen={() => setOpenTemplate(template)}
                      onDelete={() => void handleDeleteTemplate(template.id, template.name)}
                      onPublicLink={() => setPublicLinkTemplate(template)}
                      onInstruction={() => setInstructionTemplate(template)}
                      onViewEntity={() => {
                        if (template.primaryEntityId) {
                          navigate(`/entities/${template.primaryEntityId}`);
                        }
                      }}
                      onViewWorkflow={() => {
                        if (template.primaryWorkflowId) {
                          navigate(`/workflows/${template.primaryWorkflowId}`);
                        }
                      }}
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
              Templates not yet fully present in this environment.
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
                      installing={installingTemplateId === template.id}
                      onInstall={() => void handleInstallTemplate(template.id)}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Stack>
      )}

      {openTemplate ? (
        <TemplateOpenDialog
          open
          templateId={openTemplate.id}
          templateName={openTemplate.name}
          onClose={() => setOpenTemplate(null)}
        />
      ) : null}

      {publicLinkTemplate ? (
        <TemplatePublicLinkDialog
          open
          templateName={publicLinkTemplate.name}
          webhookPath={publicLinkTemplate.publicWebhookPath ?? null}
          documentUploadPath={publicLinkTemplate.publicDocumentUploadPath ?? null}
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
