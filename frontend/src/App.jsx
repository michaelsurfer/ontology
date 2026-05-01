import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

import './App.css'
import { AppShell } from './components/AppShell'
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
import { DataPage } from './pages/DataPage'
import { AiPage } from './pages/AiPage'
import { AiPlanningPage } from './pages/AiPlanningPage'
import { DashboardPage } from './pages/DashboardPage'
import { IntegrationsPage } from './pages/IntegrationsPage'

const appTheme = createTheme({
  palette: {
    mode: 'light',
  },
  shape: {
    borderRadius: 12,
  },
})

/* Root component that defines theme and routes. */
function App() {
  return (
    <ThemeProvider theme={appTheme}>
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
            <Route path="/rdf" element={<RdfExportPage />} />
            <Route path="/sparql" element={<SparqlPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/custom-entities" element={<CustomEntitiesPage />} />
            <Route path="/custom/:entityName" element={<CustomEntityTablePage />} />
            <Route path="/mappings" element={<MappingsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
