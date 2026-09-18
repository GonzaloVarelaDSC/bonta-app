import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import type { RoleId } from '../../types';

// Guard de ruta reutilizable — antes cada pantalla admin-only decidía por su
// cuenta cómo protegerse (ConfigPage se auto-degradaba a solo lectura, UsersPage
// no validaba nada y quedaba completamente expuesta a quien navegara a /usuarios
// a mano, aunque el guardado real fallara por RLS — ver auditoría del 17/09).
// Este componente centraliza el criterio: sin el permiso, redirige al Dashboard
// en vez de mostrar la pantalla.
export function RequireRole({ allow, children }: { allow: (role: RoleId) => boolean; children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user || !allow(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
