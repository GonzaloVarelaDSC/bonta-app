import { PenTool } from 'lucide-react';
import clsx from 'clsx';
import type { Job, User } from '../../types';
import { Avatar } from '../Common/Badges';

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
 * Solo el conteo, sin barra ni puntos — dos vueltas atrás (Gonzalo, 16/09):
 * una barra relativa al máximo del grupo queda siempre al 100% para quien
 * tenga más, sin importar si son 3 o 30 (sin un concepto de "capacidad" en
 * esta app, eso sugiere falsamente "lleno"); una fila de puntos + el número
 * aparte dejaba mucho espacio vacío raro entre ambos. Herramientas como
 * Linear resuelven exactamente este caso (comparar carga sin un número de
 * capacidad real) así: agrupar y mostrar el conteo, nada más.
 *
 * **Chips compactos, no filas `justify-between`** (3ra vuelta, Gonzalo:
 * "MUY espaciado los nombres a los números"): una fila `justify-between` en
 * una tarjeta tan ancha como esta (mismo ancho que la grilla de KPI, hasta
 * 1800px) empuja el nombre a un extremo y el número al otro, con un hueco
 * enorme en el medio. Nombre y número ahora viven **dentro del mismo chip**
 * (fondo `ink-50`, como un pill de asignación), uno al lado del otro sin
 * espacio artificial — varios productores se leen como una fila de chips
 * cortos, no como una lista de renglones anchos. El número reusa el mismo
 * estilo de los contadores de columna del Kanban (`KanbanPage.tsx`,
 * `toneCls.count`), fusionado adentro del chip en vez de flotar aparte.
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
      <div className="flex flex-wrap items-center gap-2">
        {counts.map(({ user, count }) => {
          const isLeast = !allTied && count === minCount;
          return (
            <div
              key={user.id} role="group"
              aria-label={`${user.name}: ${count} trabajo${count === 1 ? '' : 's'} en diseño${isLeast ? ', el que menos tiene' : ''}`}
              className="inline-flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-full pl-1.5 pr-2.5 py-1.5"
            >
              <Avatar name={user.name} color={user.avatarColor} size={22} aria-hidden />
              <span className="text-sm font-medium text-ink-800" aria-hidden>{user.name.split(' ')[0]}</span>
              <span className={clsx(
                'inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-bold tabular border',
                'bg-info-bg text-info-text border-info/30'
              )} aria-hidden>
                {count}
              </span>
              {isLeast && (
                <span className="text-[11px] font-semibold text-plan-text whitespace-nowrap" aria-hidden>
                  · menos cargado
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
