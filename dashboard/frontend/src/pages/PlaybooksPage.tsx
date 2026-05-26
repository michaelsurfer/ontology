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
import IntegrationInstructionsOutlinedIcon from '@mui/icons-material/IntegrationInstructionsOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { PageHeader } from '../components/PageHeader';
import { PlaybookInstructionsDialog } from '../components/PlaybookInstructionsDialog';
import { PlaybookMcpConnectDialog } from '../components/PlaybookMcpConnectDialog';
import { ontologyApi } from '../api/client';
import type { PlaybookSummary } from '../types/playbook';
import { buildPlaybookInstalledViewPath } from '../utils/playbookNavigation';

// Fixed width for playbook cards so rows stay even in the flex wrap grid.
const PLAYBOOK_CARD_WIDTH_PX = 340;

// Catalog sections for available playbooks (ids must match JSON files in backend/playbook/playbooks).
const PLAYBOOK_CATALOG_SECTIONS: Array<{ title: string; description: string; playbookIds: string[] }> = [
  {
    title: 'Start here',
    description: 'Classic graph and CRM patterns for onboarding and demos.',
    playbookIds: ['organizational-graph', 'crm-relationship-graph'],
  },
  {
    title: 'Integrate data',
    description: 'Field mapping, validation, and cross-system identity.',
    playbookIds: [
      'reference-data-alignment',
      'data-quality-stewardship',
      'identity-golden-record',
    ],
  },
  {
    title: 'Operations',
    description: 'Finance, support, and structured operational ingest.',
    playbookIds: [
      'invoice-records-structured',
      'procure-to-pay',
      'support-case-management',
    ],
  },
  {
    title: 'AI & documents',
    description: 'Metadata registries and context for agents and RAG pipelines.',
    playbookIds: ['document-registry'],
  },
  {
    title: 'Advanced',
    description: 'Multi-entity supply chain and composition ontologies.',
    playbookIds: ['product-composition'],
  },
];

const playbookCardGridSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
} as const;

const playbookCardCellSx = {
  width: PLAYBOOK_CARD_WIDTH_PX,
  minWidth: PLAYBOOK_CARD_WIDTH_PX,
  maxWidth: PLAYBOOK_CARD_WIDTH_PX,
  flexShrink: 0,
} as const;

type InstalledPlaybookCardProps = {
  playbook: PlaybookSummary;
  deleting: boolean;
  onExplore: () => void;
  onDelete: () => void;
  onMcpConnect: () => void;
  onInstruction: () => void;
};

// Card for an installed playbook with Explore and a three-dot actions menu.
function InstalledPlaybookCard({
  playbook,
  deleting,
  onExplore,
  onDelete,
  onMcpConnect,
  onInstruction,
}: InstalledPlaybookCardProps) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorElement);

  function closeMenu() {
    setMenuAnchorElement(null);
  }

  function runMenuAction(action: () => void) {
    closeMenu();
    action();
  }

  const entityCount = playbook.entities?.length ?? 0;
  const relationshipCount = playbook.entityRelationships?.length ?? 0;
  const workflowCount = playbook.workflows?.length ?? 0;

  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {playbook.name}
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
              aria-label="Playbook actions"
              disabled={deleting}
              onClick={(event) => setMenuAnchorElement(event.currentTarget)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1,
            flexGrow: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {playbook.description}
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
          <MenuItem onClick={() => runMenuAction(onMcpConnect)}>
            <ListItemIcon>
              <IntegrationInstructionsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Connect via MCP" secondary="Playbook id and setup" />
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

// Card for a playbook that is not installed yet.
function AvailablePlaybookCard({
  playbook,
  onExplore,
}: {
  playbook: PlaybookSummary;
  onExplore: () => void;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {playbook.name}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            flexGrow: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {playbook.description}
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

export function PlaybooksPage() {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [installMessage, setInstallMessage] = useState('');
  const [deletingPlaybookId, setDeletingPlaybookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mcpConnectPlaybook, setMcpConnectPlaybook] = useState<PlaybookSummary | null>(null);
  const [instructionPlaybook, setInstructionPlaybook] = useState<PlaybookSummary | null>(null);

  const installedPlaybooks = useMemo(
    () => playbooks.filter((playbook) => playbook.installed),
    [playbooks],
  );
  const availablePlaybookById = useMemo(() => {
    const map = new Map<string, PlaybookSummary>();
    for (const playbook of playbooks) {
      if (!playbook.installed) {
        map.set(playbook.id, playbook);
      }
    }
    return map;
  }, [playbooks]);

  const catalogedAvailableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of PLAYBOOK_CATALOG_SECTIONS) {
      for (const playbookId of section.playbookIds) {
        ids.add(playbookId);
      }
    }
    return ids;
  }, []);

  const uncategorizedAvailablePlaybooks = useMemo(() => {
    const rows: PlaybookSummary[] = [];
    for (const [playbookId, playbook] of availablePlaybookById) {
      if (!catalogedAvailableIds.has(playbookId)) {
        rows.push(playbook);
      }
    }
    return rows.sort((left, right) => left.name.localeCompare(right.name));
  }, [availablePlaybookById, catalogedAvailableIds]);

  useEffect(() => {
    void loadPlaybooks();
  }, []);

  async function loadPlaybooks() {
    setLoading(true);
    try {
      const response = await ontologyApi.listPlaybooks();
      setPlaybooks(
        response.data.map((row) => ({
          ...row,
          installed: Boolean(row.installed),
        })),
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlaybook(playbookId: string, playbookName: string) {
    const confirmed = window.confirm(
      `Delete "${playbookName}"? This removes its record types, relationships, and workflows from this environment.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingPlaybookId(playbookId);
    setInstallMessage('');
    setErrorMessage('');
    try {
      await ontologyApi.uninstallPlaybook(playbookId);
      setInstallMessage(`Removed playbook "${playbookName}" from this environment.`);
      if (mcpConnectPlaybook?.id === playbookId) {
        setMcpConnectPlaybook(null);
      }
      if (instructionPlaybook?.id === playbookId) {
        setInstructionPlaybook(null);
      }
      await loadPlaybooks();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Playbook delete failed');
    } finally {
      setDeletingPlaybookId(null);
    }
  }

  function buildDefaultInstructions(playbook: PlaybookSummary): string {
    return (
      playbook.instructions ||
      `Install "${playbook.name}" and use Explore to open record types, schema relationships, and workflows. Connect AI agents via MCP using playbook id "${playbook.id}".`
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Playbooks"
        subtitle="Enterprise ontology showcases: record types, schema relationships, ingest workflows, and Graph View. Install a pack, then Explore to navigate everything it creates."
        actions={
          <Button variant="outlined" onClick={() => void loadPlaybooks()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {installMessage ? <Alert severity="success">{installMessage}</Alert> : null}
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {loading ? (
        <Typography color="text.secondary">Loading playbooks…</Typography>
      ) : (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Installed
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click View to open record types, schema relationships, and workflows for each pack.
            </Typography>
            {installedPlaybooks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No installed playbooks yet. Install one from the section below.
              </Typography>
            ) : (
              <Box sx={playbookCardGridSx}>
                {installedPlaybooks.map((playbook) => (
                  <Box key={playbook.id} sx={playbookCardCellSx}>
                    <InstalledPlaybookCard
                      playbook={playbook}
                      deleting={deletingPlaybookId === playbook.id}
                      onExplore={() => navigate(buildPlaybookInstalledViewPath(playbook.id))}
                      onDelete={() => void handleDeletePlaybook(playbook.id, playbook.name)}
                      onMcpConnect={() => setMcpConnectPlaybook(playbook)}
                      onInstruction={() => setInstructionPlaybook(playbook)}
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
              Click Explore to preview a pack, install from the detail page, then use View for the
              full playbook hub.
            </Typography>
            {availablePlaybookById.size === 0 ? (
              <Typography variant="body2" color="text.secondary">
                All playbooks are installed.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {PLAYBOOK_CATALOG_SECTIONS.map((section) => {
                  const sectionPlaybooks = section.playbookIds
                    .map((playbookId) => availablePlaybookById.get(playbookId))
                    .filter((playbook): playbook is PlaybookSummary => Boolean(playbook));

                  if (sectionPlaybooks.length === 0) {
                    return null;
                  }

                  return (
                    <Box key={section.title}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {section.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {section.description}
                      </Typography>
                      <Box sx={playbookCardGridSx}>
                        {sectionPlaybooks.map((playbook) => (
                          <Box key={playbook.id} sx={playbookCardCellSx}>
                            <AvailablePlaybookCard
                              playbook={playbook}
                              onExplore={() => navigate(`/playbooks/${playbook.id}`)}
                            />
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}
                {uncategorizedAvailablePlaybooks.length > 0 ? (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                      More
                    </Typography>
                    <Box sx={playbookCardGridSx}>
                      {uncategorizedAvailablePlaybooks.map((playbook) => (
                        <Box key={playbook.id} sx={playbookCardCellSx}>
                          <AvailablePlaybookCard
                            playbook={playbook}
                            onExplore={() => navigate(`/playbooks/${playbook.id}`)}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Stack>
            )}
          </Box>
        </Stack>
      )}

      {mcpConnectPlaybook ? (
        <PlaybookMcpConnectDialog
          open
          playbookId={mcpConnectPlaybook.id}
          playbookName={mcpConnectPlaybook.name}
          entityNames={(mcpConnectPlaybook.entities || []).map((entityRow) => entityRow.name)}
          onClose={() => setMcpConnectPlaybook(null)}
        />
      ) : null}

      {instructionPlaybook ? (
        <PlaybookInstructionsDialog
          open
          playbookName={instructionPlaybook.name}
          instructions={buildDefaultInstructions(instructionPlaybook)}
          onClose={() => setInstructionPlaybook(null)}
        />
      ) : null}
    </Stack>
  );
}
