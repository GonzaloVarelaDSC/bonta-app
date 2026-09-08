import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
