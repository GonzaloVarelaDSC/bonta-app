import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

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
    </div>
  );
}
