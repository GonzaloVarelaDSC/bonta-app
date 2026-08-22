import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, ListChecks, Kanban, Users, Settings, Wrench,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canManageUsers } from '../../lib/permissions';

// "Clientes" se sacó del menú a pedido: los clientes no se administran acá, viven en
// Copernico. La ruta /clientes y la tabla siguen existiendo (el wizard las usa para
// autocompletar y crear al vuelo), solo dejó de tener una pantalla de gestión propia.
const ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trabajos', label: 'Trabajos', icon: ListChecks },
  { to: '/kanban', label: 'Kanban', icon: Kanban },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useStore((s) => s.currentUser);
  return (
    <aside onClick={onNavigate} className="w-60 shrink-0 bg-ink-950 text-ink-100 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="font-brand font-extrabold text-lg tracking-tight text-white">Estudio Bonta</div>
        <div className="text-[11px] text-ink-400 mt-0.5 uppercase tracking-wide">Gestión de producción</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-brand-500/20 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon size={17} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
        {user && canManageUsers(user.role) && (
          <>
            <div className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Administración</div>
            <NavLink to="/usuarios" className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-brand-500/20 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
            )}>
              <Users size={17} /> Usuarios
            </NavLink>
            <NavLink to="/configuracion" className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-brand-500/20 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
            )}>
              <Settings size={17} /> Configuración
            </NavLink>
          </>
        )}
      </nav>
      <div className="px-4 py-4 border-t border-white/10 text-[11px] text-ink-500 flex items-center gap-2">
        <Wrench size={13} /> Fase 1 — MVP interno
      </div>
    </aside>
  );
}
