import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { EntitiesPage } from './pages/EntitiesPage';
import { EntityDetailPage } from './pages/EntityDetailPage';
import { RecordHubPage } from './pages/RecordHubPage';
import { EntityRelationshipsPage } from './pages/EntityRelationshipsPage';
import { RowRelationshipsPage } from './pages/RowRelationshipsPage';
import { RdfGraphPage } from './pages/RdfGraphPage';
import { WorkflowsListPage } from './pages/WorkflowsListPage';
import { WorkflowEditorPage } from './pages/WorkflowEditorPage';
import { LandingZonePage } from './pages/LandingZonePage';
import { PlaybooksPage } from './pages/PlaybooksPage';
import { PlaybookDetailPage } from './pages/PlaybookDetailPage';
import { PlaybookInstalledViewPage } from './pages/PlaybookInstalledViewPage';
import { CachingSettingsPage } from './pages/settings/CachingSettingsPage';
import { McpSettingsPage } from './pages/settings/McpSettingsPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/playbooks" element={<PlaybooksPage />} />
        <Route path="/playbooks/:playbookId/view" element={<PlaybookInstalledViewPage />} />
        <Route path="/playbooks/:playbookId" element={<PlaybookDetailPage />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/entities/:entityId" element={<EntityDetailPage />} />
        <Route path="/entities/:entityId/rows/:rowId" element={<RecordHubPage />} />
        <Route path="/entity-relationships" element={<EntityRelationshipsPage />} />
        <Route path="/relationships" element={<RowRelationshipsPage />} />
        <Route path="/rdf-graph" element={<RdfGraphPage />} />
        <Route path="/workflows" element={<WorkflowsListPage />} />
        <Route path="/workflows/new" element={<WorkflowEditorPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowEditorPage />} />
        <Route path="/landing-zone" element={<LandingZonePage />} />
        <Route path="/settings/caching" element={<CachingSettingsPage />} />
        <Route path="/settings/mcp" element={<McpSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
