import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, ListChecks, Kanban, Users, Settings, FileCheck2, BookOpen, Zap, Archive, Receipt, Hammer, BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canManageUsers, canCreateJobs, canViewHistorico, canManageQuotes, canViewMetrics } from '../../lib/permissions';

// "Clientes" se sacó del menú a pedido: los clientes no se administran acá, viven en
// Copernico. La ruta /clientes y la tabla siguen existiendo (el wizard las usa para
// autocompletar y crear al vuelo), solo dejó de tener una pantalla de gestión propia.
const ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trabajos', label: 'Trabajos', icon: ListChecks },
  { to: '/kanban', label: 'Kanban', icon: Kanban },
  { to: '/chequeo-archivos', label: 'Chequeo de archivos', icon: FileCheck2 },
  { to: '/manual', label: 'Manual de uso', icon: BookOpen },
  { to: '/materiales', label: 'Materiales y máquinas', icon: Hammer },
];

// Ítem activo: fondo bronce translúcido + barrita bronce a la izquierda (no solo
// color). Foco visible con brand-300 (8,7:1 sobre ink-950).
function linkCls(isActive: boolean, accent = false) {
  return clsx(
    'relative flex items-center gap-3 px-3 py-3 lg:py-2 rounded-ctl text-sm font-medium transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
    isActive
      ? 'bg-brand-500/20 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-brand-300'
      : accent ? 'text-brand-300 hover:bg-white/5 hover:text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div className="pt-4 pb-1 px-3 text-2xs uppercase tracking-wider text-ink-500 font-semibold">{children}</div>;
}

function Item({ to, icon: Icon, label, active }: { to: string; icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <NavLink to={to} end className={({ isActive }) => linkCls(isActive || !!active)}>
      <Icon size={17} strokeWidth={2} aria-hidden /> {label}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useStore((s) => s.currentUser);
  const { pathname } = useLocation();
  // "Trabajos" queda activo también en la ficha (/trabajos/:id), pero no en Carga
  // rápida (/trabajos/rapido), que tiene su propio ítem.
  const inJobDetail = /^\/trabajos\/(?!rapido)/.test(pathname);
  return (
    <aside onClick={onNavigate} className="w-60 shrink-0 bg-ink-950 text-ink-100 flex flex-col h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Link to="/" className="block px-5 py-5 border-b border-white/10 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300">
        <div className="font-brand font-extrabold text-lg tracking-tight text-white">Estudio Bonta</div>
        <div className="text-meta text-ink-400 mt-0.5 uppercase tracking-wide">Gestión de producción</div>
      </Link>
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-0.5">
        {user && canCreateJobs(user.role) && (
          <NavLink to="/trabajos/rapido" className={({ isActive }) => clsx(linkCls(isActive, true), 'mb-2')}>
            <Zap size={17} strokeWidth={2} aria-hidden /> Carga rápida
          </NavLink>
        )}
        {ITEMS.map((item) => (
          <Item key={item.to} {...item} active={item.to === '/trabajos' && inJobDetail} />
        ))}
        {/* Separado a propósito del resto: un presupuesto es un posible trabajo
            que el cliente todavía no confirmó (ver types/index.ts, Quote). */}
        {user && canManageQuotes(user.role) && (
          <>
            <SectionTitle>Ventas</SectionTitle>
            <NavLink to="/presupuestos" className={({ isActive }) => linkCls(isActive)}>
              <Receipt size={17} strokeWidth={2} aria-hidden /> Presupuestos
            </NavLink>
          </>
        )}
        {/* Métricas (19/10): solo admin, sección propia — es análisis, no operación diaria. */}
        {user && canViewMetrics(user.role) && (
          <>
            <SectionTitle>Análisis</SectionTitle>
            <Item to="/metricas" icon={BarChart3} label="Métricas" />
          </>
        )}
        {user && (canManageUsers(user.role) || canViewHistorico(user.role)) && (
          <>
            <SectionTitle>Administración</SectionTitle>
            {canManageUsers(user.role) && <Item to="/usuarios" icon={Users} label="Usuarios" />}
            {canManageUsers(user.role) && <Item to="/configuracion" icon={Settings} label="Configuración" />}
            {canViewHistorico(user.role) && <Item to="/historico" icon={Archive} label="Histórico" />}
          </>
        )}
      </nav>
    </aside>
  );
}
