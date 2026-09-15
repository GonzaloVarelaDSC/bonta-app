import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

// AUDITORIA_UXUI_2026-09-15.md, ítem #4: loadError/dataLoading existían en el
// store pero ningún componente los leía — si fallaba la carga inicial (boot o
// justo después de loguearse), la pantalla quedaba vacía sin ninguna señal de
// que fue un error y no "no hay trabajos hoy". jobs/users/clients NO se
// resetean en el catch de get_loadAll (quedan en lo que tenían antes, que en
// boot/post-login es `[]`) — por eso el copy es explícito sobre que lo que se
// ve abajo puede estar vacío por el error, no porque no haya nada cargado.
function DataLoadBanner() {
  const dataLoading = useStore((s) => s.dataLoading);
  const loadError = useStore((s) => s.loadError);
  const refreshAll = useStore((s) => s.refreshAll);

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 bg-crit-bg text-crit-text text-sm px-4 py-2.5" role="alert">
        <span className="flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden />
          No se pudieron cargar los datos — lo que ves en esta pantalla (trabajos,
          clientes, usuarios) puede estar vacío o desactualizado, no que no haya
          nada cargado hoy. {loadError}
        </span>
        <button
          onClick={() => refreshAll()}
          className="shrink-0 text-xs font-semibold bg-white/70 hover:bg-white rounded-md px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (dataLoading) {
    return (
      <div className="bg-ink-100 text-ink-700 text-xs px-4 py-1.5" role="status" aria-live="polite">
        Actualizando datos...
      </div>
    );
  }
  return null;
}

// Toast liviano para el aviso de "cayó una ficha nueva" (u otra notificación en
// vivo). Se cierra solo a los 7s o con la X. No apila: siempre el último.
function Toast() {
  const toast = useStore((s) => s.toast);
  const clearToast = useStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 7000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm" role="status" aria-live="polite">
      <div className="flex items-start gap-2.5 bg-ink-950 text-white rounded-xl shadow-pop px-4 py-3">
        <Bell size={16} className="shrink-0 mt-0.5 text-brand-300" aria-hidden />
        <span className="text-sm leading-snug">{toast}</span>
        <button onClick={clearToast} aria-label="Cerrar aviso" className="shrink-0 text-ink-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const user = useStore((s) => s.currentUser);
  const [navOpen, setNavOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-50">
      {navOpen && (
        <div className="fixed inset-0 bg-ink-950/40 z-30 lg:hidden" onClick={() => setNavOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setNavOpen((v) => !v)} />
        <DataLoadBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
