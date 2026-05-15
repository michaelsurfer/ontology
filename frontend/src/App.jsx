import React, { useMemo } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

import './App.css'
import { AppShell } from './components/AppShell'
import { ColorModeProvider, useColorMode } from './theme/ColorModeContext'
import { HomePage } from './pages/HomePage'
import { RelationshipsPage } from './pages/RelationshipsPage'
import { GraphPage } from './pages/GraphPage'
import { RdfExportPage } from './pages/RdfExportPage'
import { SparqlPage } from './pages/SparqlPage'
import { MappingsPage } from './pages/MappingsPage'
import { RulesPage } from './pages/RulesPage'
import { CustomEntitiesPage } from './pages/CustomEntitiesPage'
import { CustomEntityTablePage } from './pages/CustomEntityTablePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DocsPage } from './pages/DocsPage'
import { AutomationPage } from './pages/AutomationPage'
import { LandingZonePage } from './pages/LandingZonePage'
import { DataPage } from './pages/DataPage'
import { AiPage } from './pages/AiPage'
import { AiPlanningPage } from './pages/AiPlanningPage'
import { DashboardPage } from './pages/DashboardPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { PolicyEnginePage } from './pages/PolicyEnginePage'

/* Inner tree: theme follows color mode from context. */
function ThemedRoutes() {
  const { colorMode } = useColorMode()
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: colorMode,
        },
        shape: {
          borderRadius: 12,
        },
      }),
    [colorMode],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ai" element={<AiPage />} />
            <Route path="/ai-planning" element={<AiPlanningPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/relationships" element={<RelationshipsPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/policy-engine" element={<PolicyEnginePage />} />
            <Route path="/rdf" element={<RdfExportPage />} />
            <Route path="/sparql" element={<SparqlPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/custom-entities" element={<CustomEntitiesPage />} />
            <Route path="/custom/:entityName" element={<CustomEntityTablePage />} />
            <Route path="/mappings" element={<MappingsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/landing-zone" element={<LandingZonePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

/* Root component: color mode provider wraps MUI theme and routes. */
function App() {
  return (
    <ColorModeProvider>
      <ThemedRoutes />
    </ColorModeProvider>
  )
}

export default App
