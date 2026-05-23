import type { ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import IntegrationInstructionsOutlinedIcon from '@mui/icons-material/IntegrationInstructionsOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { sidebarPalette } from '../theme/enterpriseTheme';

const drawerWidth = 272;

type NavigationItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

const navigationItems: NavigationItem[] = [
  { to: '/', label: 'Overview', icon: <HomeOutlinedIcon fontSize="small" /> },
  { to: '/entities', label: 'Entities', icon: <StorageOutlinedIcon fontSize="small" /> },
  {
    to: '/entity-relationships',
    label: 'Entity relationships',
    icon: <HubOutlinedIcon fontSize="small" />,
  },
  { to: '/relationships', label: 'Row links', icon: <LinkOutlinedIcon fontSize="small" /> },
  { to: '/rdf-graph', label: 'RDF graph', icon: <AccountTreeOutlinedIcon fontSize="small" /> },
  { to: '/workflows', label: 'Workflows', icon: <TimelineOutlinedIcon fontSize="small" /> },
  { to: '/landing-zone', label: 'Landing zone', icon: <InboxOutlinedIcon fontSize="small" /> },
];

const settingsNavigationItems: NavigationItem[] = [
  { to: '/settings/caching', label: 'Caching', icon: <CloudSyncOutlinedIcon fontSize="small" /> },
  {
    to: '/settings/mcp',
    label: 'MCP integration',
    icon: <IntegrationInstructionsOutlinedIcon fontSize="small" />,
  },
];

// Returns whether a sidebar route should appear selected for the current path.
function isNavigationItemSelected(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) {
    return true;
  }
  if (itemPath === '/workflows' && pathname.startsWith('/workflows')) {
    return true;
  }
  if (itemPath === '/entities' && pathname.startsWith('/entities/')) {
    return true;
  }
  if (itemPath === '/landing-zone' && pathname.startsWith('/landing-zone')) {
    return true;
  }
  if (itemPath.startsWith('/settings') && pathname.startsWith('/settings')) {
    return pathname === itemPath;
  }
  return false;
}

// Resolve a short label for the top app bar from the current route.
function resolveTopBarTitle(pathname: string): string {
  const mainMatch = navigationItems.find((item) => isNavigationItemSelected(pathname, item.to));
  if (mainMatch) {
    return mainMatch.label;
  }
  const settingsMatch = settingsNavigationItems.find((item) =>
    isNavigationItemSelected(pathname, item.to),
  );
  if (settingsMatch) {
    return settingsMatch.label;
  }
  return 'Ontology platform';
}

// Enterprise shell: dark sidebar navigation and light content workspace.
export function AppShell() {
  const location = useLocation();
  const topBarTitle = resolveTopBarTitle(location.pathname);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Toolbar
          sx={{
            px: 2,
            minHeight: { xs: 64, sm: 72 },
            borderBottom: `1px solid ${sidebarPalette.textMuted}22`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: sidebarPalette.accent,
                color: '#fff',
              }}
            >
              <LayersOutlinedIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                Ontology
              </Typography>
              <Typography variant="caption" sx={{ color: sidebarPalette.textMuted }}>
                Data layer platform
              </Typography>
            </Box>
          </Box>
        </Toolbar>

        <List sx={{ flexGrow: 1, overflow: 'auto', pt: 1, px: 0.5 }}>
          <ListSubheader sx={{ pl: 2 }}>Workspace</ListSubheader>
          {navigationItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={isNavigationItemSelected(location.pathname, item.to)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ borderColor: `${sidebarPalette.textMuted}33`, mx: 2 }} />

        <List sx={{ flexShrink: 0, pb: 2, px: 0.5 }}>
          <ListSubheader sx={{ pl: 2 }}>Settings</ListSubheader>
          {settingsNavigationItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={isNavigationItemSelected(location.pathname, item.to)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600, fontSize: '1.0625rem' }}>
              {topBarTitle}
            </Typography>
            <Chip label="Enterprise" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 3 }, py: 3, maxWidth: 1440, width: '100%', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
