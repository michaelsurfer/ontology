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
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import { PageHeader } from '../components/PageHeader';
import { ontologyApi } from '../api/client';

type QuickLinkCardProps = {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
};

// Overview card linking to a primary workspace area.
function QuickLinkCard({ title, description, to, icon }: QuickLinkCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
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

  useEffect(() => {
    void loadHealth();
  }, []);

  async function loadHealth() {
    try {
      const response = await ontologyApi.health();
      const dataLayerUrl = response.data.dataLayerUrl || 'data-layer-service';
      setHealthOk(Boolean(response.data.ok));
      setHealthMessage(`Platform API is healthy. Connected to ${dataLayerUrl}.`);
    } catch (error) {
      setHealthOk(false);
      setHealthMessage(
        error instanceof Error
          ? error.message
          : 'Dashboard API or data-layer-service is not reachable.',
      );
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Overview"
        subtitle="Manage record types, row data, relationships, workflows, and RDF exports from a single control plane."
      />

      <Alert severity={healthOk ? 'success' : 'warning'}>{healthMessage}</Alert>

      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        <Box sx={{ flex: '1 1 220px', minWidth: 220, maxWidth: 320 }}>
          <QuickLinkCard
            title="Templates"
            description="Install starter packs with record types and ingest workflows."
            to="/templates"
            icon={<ViewModuleOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: '1 1 220px', minWidth: 220, maxWidth: 320 }}>
          <QuickLinkCard
            title="Record types"
            description="Define what to extract and manage instance row data."
            to="/entities"
            icon={<StorageOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: '1 1 220px', minWidth: 220, maxWidth: 320 }}>
          <QuickLinkCard
            title="Relationships"
            description="Schema-level and row-level links between record types."
            to="/entity-relationships"
            icon={<HubOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: '1 1 220px', minWidth: 220, maxWidth: 320 }}>
          <QuickLinkCard
            title="Workflows"
            description="Ingest, validate, map, and quarantine records."
            to="/workflows"
            icon={<TimelineOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: '1 1 220px', minWidth: 220, maxWidth: 320 }}>
          <QuickLinkCard
            title="RDF graph"
            description="Explore record types and properties as an interactive schema graph."
            to="/rdf-graph"
            icon={<AccountTreeOutlinedIcon />}
          />
        </Box>
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <DashboardCustomizeOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="h6">Recommended workflow</Typography>
          </Stack>
          <Box component="ol" sx={{ pl: 2.5, m: 0, color: 'text.secondary' }}>
            <li>
              <RouterLink to="/templates">Install a template</RouterLink> or create record types
              manually
            </li>
            <li>Define how record types link to each other</li>
            <li>Add row data and row-level links</li>
            <li>Run ingest workflows with fallback to landing zone</li>
            <li>Sync RDF cache and validate in the graph explorer</li>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
