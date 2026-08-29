import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { LoginPage } from './components/Auth/LoginPage';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { JobsPage } from './components/Jobs/JobsPage';
import { ClientsPage } from './components/Jobs/ClientsPage';
import { KanbanPage } from './components/Kanban/KanbanPage';
import { JobDetailPage } from './components/JobDetail/JobDetailPage';
import { JobExportPage } from './components/JobDetail/JobExportPage';
import { QuickJobPage } from './components/QuickJob/QuickJobPage';
import { UsersPage } from './components/Users/UsersPage';
import { ConfigPage } from './components/Common/ConfigPage';
import { ChequeoArchivosPage } from './components/Herramientas/ChequeoArchivosPage';
import { ManualPage } from './components/Manual/ManualPage';
import { useStore } from './store/useStore';
import { supabaseConfigured } from './lib/supabaseClient';

export default function App() {
  const init = useStore((s) => s.init);
  const authReady = useStore((s) => s.authReady);

  useEffect(() => {
    if (supabaseConfigured) init();
  }, [init]);

  if (supabaseConfigured && !authReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-ink-50">
        <div className="text-sm text-ink-400">Cargando Estudio Bonta...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/trabajos/:id/exportar" element={<JobExportPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/trabajos" element={<JobsPage />} />
          <Route path="/trabajos/nuevo" element={<Navigate to="/trabajos/rapido" replace />} />
          <Route path="/trabajos/rapido" element={<QuickJobPage />} />
          <Route path="/trabajos/:id" element={<JobDetailPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/chequeo-archivos" element={<ChequeoArchivosPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/configuracion" element={<ConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
