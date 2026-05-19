import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Box,
  Container,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { ontologyApi } from '../api/client';

const drawerWidth = 260;

const navigationItems = [
  { to: '/', label: 'Home' },
  { to: '/entities', label: 'Entities' },
  { to: '/entity-relationships', label: 'Entity relationships' },
  { to: '/relationships', label: 'Row links' },
  { to: '/rdf-graph', label: 'RDF graph' },
];

export function AppShell() {
  const location = useLocation();
  const [syncingCache, setSyncingCache] = useState(false);
  const [syncAlert, setSyncAlert] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  // Export Turtle from data-layer and load it into rdf-cache-service.
  async function handleSyncCacheClick() {
    setSyncingCache(true);
    setSyncAlert(null);
    try {
      const response = await ontologyApi.syncRdfCache({ entity_ids: '*' });
      const result = response.data;
      setSyncAlert({
        severity: 'success',
        message: `RDF cache synced (version ${result.version}, ${result.turtle_bytes.toLocaleString()} bytes).`,
      });
    } catch (error) {
      setSyncAlert({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sync failed. Is data-layer-service (8182) and rdf-cache-service (8181) running?',
      });
    } finally {
      setSyncingCache(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Ontology
          </Typography>
        </Toolbar>
        <List>
          {navigationItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={location.pathname === item.to}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton onClick={() => void handleSyncCacheClick()} disabled={syncingCache}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SyncIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={syncingCache ? 'Syncing cache…' : 'Sync cache'} />
          </ListItemButton>
        </List>
        {syncAlert ? (
          <Box sx={{ px: 2, pb: 2 }}>
            <Alert severity={syncAlert.severity} onClose={() => setSyncAlert(null)}>
              {syncAlert.message}
            </Alert>
          </Box>
        ) : null}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'grey.50' }}>
        <AppBar position="sticky" color="default" elevation={0} sx={{ bgcolor: 'background.paper' }}>
          <Toolbar>
            <Typography variant="subtitle1" color="text.secondary">
              Data layer dashboard
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
