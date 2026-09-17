import { PenTool } from 'lucide-react';
import type { Job, User } from '../../types';
import { Avatar } from '../Common/Badges';

// Tope de puntos visibles por fila — más allá de esto se resume en "+N" en vez
// de dejar la fila crecer sin límite (un productor con 20 trabajos en diseño
// no debería alargar la tarjeta 20 puntos).
const MAX_DOTS = 10;

/**
 * Comparación de carga de diseño entre productores — para decidir a quién
 * conviene asignar el próximo trabajo sin sobrecargar a una sola persona
 * (Gonzalo, 16/09). Cuenta EN_DISENO + DISENO_LISTO por responsable, sobre
 * TODOS los trabajos visibles — a propósito no respeta el toggle A mí/Por mí/
 * Todos del resto del Dashboard, porque acá siempre importa el panorama
 * completo del equipo, no la vista personal de quien mira. Mismo tono `info`
 * que ya usa toda la app para "en diseño" (StatusTone, KPI "En diseño") — no
 * se inventa un color nuevo para esta comparación.
 *
 * Un punto por trabajo (no una barra continua) — la primera versión escalaba
 * el ancho de una barra contra el máximo del grupo, así que quien tuviera más
 * trabajos quedaba siempre al 100% de ancho sin importar si eran 3 o 30
 * (Gonzalo, 16/09: "¿hace falta que vayan hasta el fondo?"). Sin ningún
 * concepto de "capacidad" en esta app, esa barra sugería falsamente "lleno".
 * Un punto = un trabajo real es honesto en cualquier escala, y reusa el mismo
 * lenguaje de chip/pill que ya tiene el resto de la UI en vez de importar un
 * control de bar-chart genérico.
 */
export function DesignLoadWidget({ jobs, users }: { jobs: Job[]; users: User[] }) {
  const producers = users.filter((u) => u.active && u.isProducer);
  if (producers.length < 2) return null;

  const counts = producers
    .map((u) => ({
      user: u,
      count: jobs.filter((j) => j.responsibleUserId === u.id && (j.status === 'EN_DISENO' || j.status === 'DISENO_LISTO')).length,
    }))
    .sort((a, b) => a.count - b.count);

  const minCount = counts[0].count;
  const allTied = counts.every((c) => c.count === minCount);

  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card p-4 mb-5">
      <div className="flex items-center gap-2 mb-0.5">
        <PenTool size={14} className="text-info-text" aria-hidden />
        <h2 className="text-sm font-semibold text-ink-900">Carga de diseño</h2>
      </div>
      <p className="text-xs text-ink-700 mb-3">Para decidir a quién asignar el próximo trabajo sin sobrecargar a nadie.</p>
      <div className="space-y-2.5">
        {counts.map(({ user, count }) => {
          const isLeast = !allTied && count === minCount;
          const visibleDots = Math.min(count, MAX_DOTS);
          const overflow = count - visibleDots;
          return (
            <div
              key={user.id} role="group" className="flex items-center gap-3"
              aria-label={`${user.name}: ${count} trabajo${count === 1 ? '' : 's'} en diseño${isLeast ? ', el que menos tiene' : ''}`}
            >
              <div className="flex items-center gap-2 w-32 shrink-0" aria-hidden>
                <Avatar name={user.name} color={user.avatarColor} size={22} />
                <span className="text-sm font-medium text-ink-800 truncate">{user.name.split(' ')[0]}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap flex-1 min-h-[14px]" aria-hidden>
                {count === 0 ? (
                  <span className="text-xs text-ink-700 italic">Sin trabajos en diseño</span>
                ) : (
                  <>
                    {Array.from({ length: visibleDots }).map((_, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded-full bg-info shrink-0" />
                    ))}
                    {overflow > 0 && <span className="text-xs font-semibold text-info-text">+{overflow}</span>}
                  </>
                )}
              </div>
              <span className="text-sm font-semibold text-ink-900 tabular w-5 text-right" aria-hidden>{count}</span>
              {isLeast && (
                <span className="text-[11px] font-semibold text-plan-text bg-plan-bg rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap" aria-hidden>
                  Menos cargado
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
