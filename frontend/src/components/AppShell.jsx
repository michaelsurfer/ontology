import React from 'react'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Container,
  Toolbar,
  Typography,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

const drawerWidthPixels = 264

/* Render the left navigation and the main content area. */
export function AppShell() {
  const location = useLocation()
  const theme = useTheme()
  const isDesktopViewport = useMediaQuery(theme.breakpoints.up('md'))
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false)
  const [isAdvancedMenuOpen, setIsAdvancedMenuOpen] = React.useState(false)

  /* Toggle the mobile drawer open or closed. */
  function toggleMobileDrawer() {
    setIsMobileDrawerOpen((previousValue) => !previousValue)
  }

  /* Close the mobile drawer after a navigation click. */
  function closeMobileDrawer() {
    setIsMobileDrawerOpen(false)
  }

  const primaryNavigationItems = getPrimaryNavigationItems()
  const advancedItems = getAdvancedMenuItems()

  const topNavigationItemPaths = ['/dashboard', '/ai']
  const topNavigationItems = primaryNavigationItems.filter((item) => topNavigationItemPaths.includes(item.to))
  const dashboardMenuItem = topNavigationItems.find((item) => item.to === '/dashboard') || null
  const aiMenuItem = topNavigationItems.find((item) => item.to === '/ai') || null
  const primaryItemsAfterTopSection = primaryNavigationItems.filter((item) => !topNavigationItemPaths.includes(item.to))

  const isAdvancedSectionActive = advancedItems.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(item.to),
  )

  React.useEffect(() => {
    if (isAdvancedSectionActive) {
      setIsAdvancedMenuOpen(true)
    }
  }, [isAdvancedSectionActive])

  /* Render the drawer content used by desktop and mobile. */
  function renderDrawerContent() {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: 2, py: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              lineHeight: 1.05,
              fontSize: 22,
              letterSpacing: 0.2,
            }}
          >
            FaistOS
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, lineHeight: 1.2 }}
          >
            The context layer that keeps AI accurate
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ flexGrow: 1, py: 1 }}>
          <List dense sx={{ px: 1 }}>
            {dashboardMenuItem ? (
              <NavigationListItem
                key={dashboardMenuItem.to}
                to={dashboardMenuItem.to}
                label={dashboardMenuItem.label}
                currentPath={location.pathname}
                onNavigate={isDesktopViewport ? null : closeMobileDrawer}
              />
            ) : null}

            {dashboardMenuItem && aiMenuItem ? <Divider sx={{ my: 1 }} /> : null}

            {aiMenuItem ? (
              <NavigationListItem
                key={aiMenuItem.to}
                to={aiMenuItem.to}
                label={aiMenuItem.label}
                currentPath={location.pathname}
                onNavigate={isDesktopViewport ? null : closeMobileDrawer}
              />
            ) : null}

            {topNavigationItems.length > 0 ? <Divider sx={{ my: 1 }} /> : null}

            {primaryItemsAfterTopSection.map((item) => (
              <NavigationListItem
                key={item.to}
                to={item.to}
                label={item.label}
                currentPath={location.pathname}
                onNavigate={isDesktopViewport ? null : closeMobileDrawer}
              />
            ))}

            <Divider sx={{ my: 1 }} />

            <NavigationListItem
              to="/data"
              label="Records"
              currentPath={location.pathname}
              onNavigate={isDesktopViewport ? null : closeMobileDrawer}
            />

            <Divider sx={{ my: 1 }} />

            <AdvancedMenuSection
              label="Developer Tools"
              currentPath={location.pathname}
              isOpen={isAdvancedMenuOpen}
              setIsOpen={setIsAdvancedMenuOpen}
              items={advancedItems}
              onNavigate={isDesktopViewport ? null : closeMobileDrawer}
            />

            <Divider sx={{ my: 1 }} />

            <NavigationListItem
              to="/docs"
              label="Doc"
              currentPath={location.pathname}
              onNavigate={isDesktopViewport ? null : closeMobileDrawer}
            />
          </List>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: drawerWidthPixels }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={!isDesktopViewport && isMobileDrawerOpen}
          onClose={toggleMobileDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidthPixels,
            },
          }}
        >
          {renderDrawerContent()}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidthPixels,
            },
          }}
        >
          {renderDrawerContent()}
        </Drawer>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            display: { xs: 'block', md: 'none' },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
            <IconButton color="inherit" edge="start" onClick={toggleMobileDrawer}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: 0.2,
                }}
              >
                FaistOS
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                The context layer that keeps AI accurate
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, py: 3 }}>
          <Container
            maxWidth={false}
            sx={{
              maxWidth: 1700,
              px: { xs: 2, sm: 3, md: 4 },
            }}
          >
            <Outlet />
          </Container>
        </Box>
      </Box>
    </Box>
  )
}

/* Provide the primary navigation list shown above the separators. */
function getPrimaryNavigationItems() {
  return [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/ai', label: 'AI Assistant' },
    { to: '/custom-entities', label: 'Objects' },
    { to: '/relationships', label: 'Relationships' },
    { to: '/graph', label: 'Context Map' },
  ]
}

/* Provide navigation items under the Advanced mode section. */
function getAdvancedMenuItems() {
  return [
    { to: '/sparql', label: 'Query Studio' },
    { to: '/rdf', label: 'Standards Export' },
    { to: '/integrations', label: 'Integrations' },
    { to: '/automation', label: 'Ingestion Pipelines' },
    { to: '/rules', label: 'Guardrails' },
    { to: '/mappings', label: 'Identifiers & Naming' },
  ]
}

/* Render a navigation list item that highlights when active. */
function NavigationListItem({ to, label, currentPath, onNavigate }) {
  const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to))

  return (
    <ListItemButton
      component={RouterLink}
      to={to}
      selected={isActive}
      onClick={() => {
        if (onNavigate) {
          onNavigate()
        }
      }}
      sx={{
        borderRadius: 2,
        '&.Mui-selected': {
          backgroundColor: 'rgba(25, 118, 210, 0.10)',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.16)',
        },
      }}
    >
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          fontWeight: isActive ? 800 : 600,
          fontSize: 14,
        }}
      />
    </ListItemButton>
  )
}

/* Render a collapsible navigation section with child routes. */
function AdvancedMenuSection({ label, currentPath, isOpen, setIsOpen, items, onNavigate }) {
  const isSectionActive = items.some(
    (item) => currentPath === item.to || currentPath.startsWith(item.to),
  )

  return (
    <Box>
      <ListItemButton
        selected={isSectionActive}
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        sx={{
          borderRadius: 2,
          '&.Mui-selected': {
            backgroundColor: 'rgba(25, 118, 210, 0.10)',
          },
          '&.Mui-selected:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.16)',
          },
        }}
      >
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontWeight: isSectionActive ? 800 : 600,
            fontSize: 14,
          }}
        />
        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>

      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List dense sx={{ px: 1, pl: 2 }}>
          {items.map((item) => (
            <NavigationListItem
              key={item.to}
              to={item.to}
              label={item.label}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

