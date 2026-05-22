import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from '@mui/material';

const drawerWidth = 260;

const navigationItems = [
  { to: '/', label: 'Home' },
  { to: '/entities', label: 'Entities' },
  { to: '/entity-relationships', label: 'Entity relationships' },
  { to: '/relationships', label: 'Row links' },
  { to: '/rdf-graph', label: 'RDF graph' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/landing-zone', label: 'Landing zone' },
];

const settingsNavigationItems = [
  { to: '/settings/caching', label: 'Caching' },
  { to: '/settings/mcp', label: 'MCP' },
];

// Returns whether a sidebar route should appear selected for the current path.
function isNavigationItemSelected(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) {
    return true;
  }
  if (itemPath === '/workflows' && pathname.startsWith('/workflows')) {
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

export function AppShell() {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
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
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Ontology
          </Typography>
        </Toolbar>
        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {navigationItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={isNavigationItemSelected(location.pathname, item.to)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <List subheader={<ListSubheader>Settings</ListSubheader>} sx={{ flexShrink: 0 }}>
          {settingsNavigationItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={isNavigationItemSelected(location.pathname, item.to)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'grey.50' }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
