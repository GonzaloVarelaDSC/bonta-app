import { useStore } from '../../store/useStore';
import { Avatar } from '../Common/Badges';
import { ROLES } from '../../data/catalog';

export function UsersPage() {
  const users = useStore((s) => s.users);
  const setUserActive = useStore((s) => s.setUserActive);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Usuarios</h1>
      <p className="text-sm text-ink-700 mb-5">Alta, baja y roles. La creación de nuevas cuentas queda conectada al backend real en Fase 2 — por ahora se administra el estado de las cuentas de prueba.</p>
      <div className="bg-white rounded-xl border border-ink-100 shadow-card divide-y divide-ink-50">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={u.name} color={u.avatarColor} size={32} />
              <div>
                <div className="text-sm font-medium text-ink-900">{u.name}</div>
                <div className="text-xs text-ink-700">{u.email} · {ROLES.find((r) => r.id === u.role)?.label} · {u.sector}</div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-700">
              <input type="checkbox" checked={u.active} onChange={(e) => setUserActive(u.id, e.target.checked)} className="rounded" />
              Activo
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
