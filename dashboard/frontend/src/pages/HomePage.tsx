import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import { PageHeader } from '../components/PageHeader';
import { ontologyApi, readApiErrorMessage } from '../api/client';

// Fixed width for overview quick-link cards so rows stay even in the flex wrap grid.
const OVERVIEW_CARD_WIDTH_PX = 340;

const overviewCardGridSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
} as const;

const overviewCardCellSx = {
  width: OVERVIEW_CARD_WIDTH_PX,
  minWidth: OVERVIEW_CARD_WIDTH_PX,
  maxWidth: OVERVIEW_CARD_WIDTH_PX,
  flexShrink: 0,
} as const;

type QuickLinkCardProps = {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
};

// Overview card linking to a primary workspace area.
function QuickLinkCard({ title, description, to, icon }: QuickLinkCardProps) {
  return (
    <Card sx={{ height: '100%', width: '100%' }}>
      <CardContent>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
          {description}
        </Typography>
        <Button component={RouterLink} to={to} variant="outlined" size="small">
          Open
        </Button>
      </CardContent>
    </Card>
  );
}

export function HomePage() {
  const [healthMessage, setHealthMessage] = useState('Checking services…');
  const [healthOk, setHealthOk] = useState(false);
  const [landingZoneRecordCount, setLandingZoneRecordCount] = useState<number | null>(null);
  const [overviewLoadError, setOverviewLoadError] = useState('');

  useEffect(() => {
    void loadOverview();
  }, []);

  // Load platform health and landing zone queue size for the overview dashboard.
  async function loadOverview() {
    setOverviewLoadError('');
    try {
      const [healthResponse, landingZoneResponse] = await Promise.all([
        ontologyApi.health(),
        ontologyApi.listLandingZoneRecords(),
      ]);
      const dataLayerUrl = healthResponse.data.dataLayerUrl || 'data-layer-service';
      setHealthOk(Boolean(healthResponse.data.ok));
      setHealthMessage(`Platform API is healthy. Connected to ${dataLayerUrl}.`);
      setLandingZoneRecordCount(landingZoneResponse.data.length);
    } catch (error) {
      setHealthOk(false);
      setHealthMessage(readApiErrorMessage(error));
      setLandingZoneRecordCount(null);
      setOverviewLoadError(readApiErrorMessage(error));
    }
  }

  const landingZoneDescription =
    landingZoneRecordCount === null
      ? 'Review records quarantined by workflow fallback nodes.'
      : landingZoneRecordCount === 0
        ? 'No records waiting for review.'
        : `${landingZoneRecordCount} new record${landingZoneRecordCount === 1 ? '' : 's'} waiting for review.`;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Overview"
        subtitle="Manage record types, row data, relationships, workflows, and RDF exports from a single control plane."
      />

      <Alert severity={healthOk ? 'success' : 'warning'}>{healthMessage}</Alert>

      {overviewLoadError && landingZoneRecordCount === null ? (
        <Alert severity="info">Landing zone count unavailable until the API is healthy.</Alert>
      ) : null}

      {landingZoneRecordCount !== null && landingZoneRecordCount > 0 ? (
        <Alert
          severity="warning"
          action={
            <Button component={RouterLink} to="/landing-zone" color="inherit" size="small">
              Review
            </Button>
          }
        >
          <strong>{landingZoneRecordCount}</strong> new record
          {landingZoneRecordCount === 1 ? '' : 's'} in the landing zone — failed ingest or validation,
          awaiting review.
        </Alert>
      ) : null}

      <Box sx={overviewCardGridSx}>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Playbooks"
            description="Install starter packs with record types and ingest workflows."
            to="/playbooks"
            icon={<ViewModuleOutlinedIcon />}
          />
        </Box>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Record types"
            description="Define what to extract and manage instance row data."
            to="/entities"
            icon={<StorageOutlinedIcon />}
          />
        </Box>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Relationships"
            description="Schema-level and row-level links between record types."
            to="/entity-relationships"
            icon={<HubOutlinedIcon />}
          />
        </Box>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Workflows"
            description="Ingest, validate, map, and quarantine records."
            to="/workflows"
            icon={<TimelineOutlinedIcon />}
          />
        </Box>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Graph View"
            description="Explore record types and properties as an interactive schema graph."
            to="/rdf-graph"
            icon={<AccountTreeOutlinedIcon />}
          />
        </Box>
        <Box sx={overviewCardCellSx}>
          <QuickLinkCard
            title="Landing zone"
            description={landingZoneDescription}
            to="/landing-zone"
            icon={<InboxOutlinedIcon />}
          />
        </Box>
      </Box>
    </Stack>
  );
}
