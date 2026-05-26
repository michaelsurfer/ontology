import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import IntegrationInstructionsOutlinedIcon from '@mui/icons-material/IntegrationInstructionsOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { PageHeader } from '../components/PageHeader';
import { PlaybookInstructionsDialog } from '../components/PlaybookInstructionsDialog';
import { PlaybookMcpConnectDialog } from '../components/PlaybookMcpConnectDialog';
import { ontologyApi, readApiErrorMessage } from '../api/client';
import type { PlaybookSummary } from '../types/playbook';
import { buildPlaybookNavigationState } from '../utils/playbookNavigation';

// Full-page explorer for an installed playbook (record types, schema links, workflows).
export function PlaybookInstalledViewPage() {
  const { playbookId = '' } = useParams();
  const navigate = useNavigate();
  const [playbook, setPlaybook] = useState<PlaybookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [instructionsDialogOpen, setInstructionsDialogOpen] = useState(false);

  const navigationState = useMemo(
    () => (playbook ? buildPlaybookNavigationState(playbook) : null),
    [playbook],
  );

  useEffect(() => {
    void loadInstalledPlaybook();
  }, [playbookId]);

  async function loadInstalledPlaybook() {
    if (!playbookId) {
      setErrorMessage('Playbook id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await ontologyApi.listPlaybooks();
      const match = response.data.find((row) => row.id === playbookId);
      if (!match) {
        setPlaybook(null);
        setErrorMessage('Playbook not found.');
        return;
      }
      if (!match.installed) {
        navigate(`/playbooks/${playbookId}`, { replace: true });
        return;
      }
      setPlaybook({
        ...match,
        installed: true,
      });
    } catch (error) {
      setPlaybook(null);
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function navigateWithPlaybookStack(targetPath: string) {
    if (!navigationState) {
      navigate(targetPath);
      return;
    }
    navigate(targetPath, { state: navigationState });
  }

  function buildDefaultInstructions(summary: PlaybookSummary): string {
    return (
      summary.instructions ||
      `Use "${summary.name}" record types, schema relationships, and workflows. Connect AI agents via MCP using playbook id "${summary.id}".`
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!playbook) {
    return (
      <Stack spacing={2}>
        <Button component={RouterLink} to="/playbooks" startIcon={<ArrowBackIcon />} sx={{ alignSelf: 'flex-start' }}>
          Back to playbooks
        </Button>
        <Alert severity="error">{errorMessage || 'Playbook not available.'}</Alert>
      </Stack>
    );
  }

  const entityRows = playbook.entities || [];
  const relationshipRows = playbook.entityRelationships || [];
  const workflowRows = playbook.workflows || [];

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/playbooks"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start', mb: -1 }}
      >
        All playbooks
      </Button>

      <PageHeader
        title={playbook.name}
        subtitle={playbook.description}
        actions={
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleOutlineIcon />}
              label="Installed"
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<IntegrationInstructionsOutlinedIcon />}
              onClick={() => setMcpDialogOpen(true)}
            >
              Connect via MCP
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MenuBookOutlinedIcon />}
              onClick={() => setInstructionsDialogOpen(true)}
            >
              Instructions
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountTreeOutlinedIcon />}
              onClick={() => navigateWithPlaybookStack('/rdf-graph')}
            >
              Graph View
            </Button>
          </Stack>
        }
      />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Alert severity="info">
        Open a record type, schema relationship, or workflow below. Use <strong>Back to {playbook.name}</strong>{' '}
        on the next screen to return here.
      </Alert>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <PlaybookResourceSection
          title="Record types"
          count={entityRows.length}
          emptyMessage="No record types linked yet."
          icon={<StorageOutlinedIcon color="primary" />}
        >
          {entityRows.map((entityRow) => (
            <PlaybookResourceCard
              key={entityRow.entity_id}
              primary={entityRow.display_name}
              secondary={entityRow.name}
              onClick={() => navigateWithPlaybookStack(`/entities/${entityRow.entity_id}`)}
            />
          ))}
        </PlaybookResourceSection>

        <PlaybookResourceSection
          title="Schema relationships"
          count={relationshipRows.length}
          emptyMessage="No schema-level relationships in this playbook."
          icon={<HubOutlinedIcon color="primary" />}
        >
          {relationshipRows.map((relationshipRow) => (
            <PlaybookResourceCard
              key={relationshipRow.entity_relationship_id}
              primary={relationshipRow.relationship_name}
              secondary={`${relationshipRow.subject_display_name} → ${relationshipRow.object_display_name}`}
              onClick={() =>
                navigateWithPlaybookStack(
                  `/entity-relationships?highlight=${relationshipRow.entity_relationship_id}`,
                )
              }
            />
          ))}
        </PlaybookResourceSection>

        <PlaybookResourceSection
          title="Workflows"
          count={workflowRows.length}
          emptyMessage="No workflows linked yet."
          icon={<TimelineOutlinedIcon color="primary" />}
        >
          {workflowRows.map((workflowRow) => (
            <PlaybookResourceCard
              key={workflowRow.workflow_id}
              primary={workflowRow.name}
              secondary={workflowRow.description || 'Ingest workflow'}
              onClick={() => navigateWithPlaybookStack(`/workflows/${workflowRow.workflow_id}`)}
            />
          ))}
        </PlaybookResourceSection>
      </Box>

      <Divider />

      <Typography variant="body2" color="text.secondary">
        Playbook id: <code>{playbook.id}</code>
        {playbook.primaryWorkflowName ? (
          <>
            {' '}
            · Primary workflow: <strong>{playbook.primaryWorkflowName}</strong>
          </>
        ) : null}
      </Typography>

      <PlaybookMcpConnectDialog
        open={mcpDialogOpen}
        playbookId={playbook.id}
        playbookName={playbook.name}
        entityNames={entityRows.map((entityRow) => entityRow.name)}
        onClose={() => setMcpDialogOpen(false)}
      />

      <PlaybookInstructionsDialog
        open={instructionsDialogOpen}
        playbookName={playbook.name}
        instructions={buildDefaultInstructions(playbook)}
        onClose={() => setInstructionsDialogOpen(false)}
      />
    </Stack>
  );
}

type PlaybookResourceSectionProps = {
  title: string;
  count: number;
  emptyMessage: string;
  icon: ReactNode;
  children: ReactNode;
};

// One column of clickable resources on the installed playbook view.
function PlaybookResourceSection({
  title,
  count,
  emptyMessage,
  icon,
  children,
}: PlaybookResourceSectionProps) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          {icon}
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {title}
          </Typography>
          <Chip size="small" label={count} />
        </Stack>
        {count === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          <Stack spacing={1}>{children}</Stack>
        )}
      </CardContent>
    </Card>
  );
}

type PlaybookResourceCardProps = {
  primary: string;
  secondary: string;
  onClick: () => void;
};

// Clickable row inside a playbook resource section.
function PlaybookResourceCard({ primary, secondary, onClick }: PlaybookResourceCardProps) {
  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {primary}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {secondary}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
