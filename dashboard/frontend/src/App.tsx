import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { EntitiesPage } from './pages/EntitiesPage';
import { EntityDetailPage } from './pages/EntityDetailPage';
import { EntityRelationshipsPage } from './pages/EntityRelationshipsPage';
import { RowRelationshipsPage } from './pages/RowRelationshipsPage';
import { RdfGraphPage } from './pages/RdfGraphPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/entities/:entityId" element={<EntityDetailPage />} />
        <Route path="/entity-relationships" element={<EntityRelationshipsPage />} />
        <Route path="/relationships" element={<RowRelationshipsPage />} />
        <Route path="/rdf-graph" element={<RdfGraphPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
