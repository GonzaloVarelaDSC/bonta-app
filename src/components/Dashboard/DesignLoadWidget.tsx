import { PenTool } from 'lucide-react';
import clsx from 'clsx';
import type { Job, User } from '../../types';
import { Avatar } from '../Common/Badges';

// Piso de la escala de la barra: sin esto, con 2-4 trabajos totales (el caso
// normal de este equipo chico) cualquiera con el número más alto queda con la
// barra al 100%, lo mismo que si tuviera 30 — sugiere falsamente "lleno" (ver
// comentario largo más abajo). Con un piso de 5, 1-4 trabajos se ven cortos de
// verdad; recién si alguien llega a 5+ la barra empieza a acercarse al final.
const SCALE_FLOOR = 5;

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
 * **Historial de este widget (4 vueltas, Gonzalo probando cada una en vivo):**
 * barra relativa al máximo del grupo → siempre 100% para quien tenga más,
 * aunque sean 3 o 30 (sugiere "lleno" sin que haya noción de capacidad en esta
 * app) → puntos por trabajo → hueco raro entre los puntos y el número → filas
 * con solo el número (`justify-between`) → mismo hueco, ahora entre nombre y
 * número, porque la tarjeta es tan ancha como la grilla de KPI (hasta 1800px)
 * y una fila que reparte sus dos extremos ahí dentro queda con muchísimo aire
 * → chips compactos → "difícil de leer, no es clara la situación de cada uno"
 * (perder la barra le sacó la comparación visual instantánea que SÍ servía).
 * **Versión final (6ta vuelta):** la barra volvió (Gonzalo: "la barra estaba
 * ok, hay que pulirla"), resolviendo los dos problemas reales identificados en
 * el camino — (a) el 100% falso: la barra escala contra
 * `max(SCALE_FLOOR, conteo real)`, no contra el máximo del grupo, así que 1-4
 * trabajos se ven proporcionalmente cortos en vez de siempre llenos; (b) el
 * aire: la tarjeta no ocupa el ancho completo del dashboard. Último ajuste
 * (Gonzalo, 17/09): **las filas van en paralelo, no apiladas** — un productor
 * al lado del otro en la misma línea en vez de una fila por renglón, para que
 * el widget sea "más fino que alto" y no le robe altura a la lista de
 * trabajos de abajo. La tarjeta pasa de `max-w-sm` a `max-w-md` para darle
 * lugar a los 2 (o más) productores lado a lado sin apretarlos.
 */
export function DesignLoadWidget({ jobs, users }: { jobs: Job[]; users: User[] }) {
  const producers = users.filter((u) => u.active && u.isProducer);
  if (producers.length < 2) return null;

  const counts = producers
    .map((u) => ({
      user: u,
      count: jobs.filter((j) => j.responsibleUserId === u.id && (j.status === 'EN_DISENO' || j.status === 'DISENO_LISTO')).length,
    }))
    .sort((a, b) => b.count - a.count);

  const scaleMax = Math.max(SCALE_FLOOR, ...counts.map((c) => c.count));
  const minCount = Math.min(...counts.map((c) => c.count));
  const allTied = counts.every((c) => c.count === minCount);

  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card p-4 mb-5 max-w-md">
      <div className="flex items-center gap-2 mb-0.5">
        <PenTool size={14} className="text-info-text" aria-hidden />
        <h2 className="text-sm font-semibold text-ink-900">Carga de diseño</h2>
      </div>
      <p className="text-xs text-ink-700 mb-3">Para decidir a quién asignar el próximo trabajo sin sobrecargar a nadie.</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {counts.map(({ user, count }) => {
          const isLeast = !allTied && count === minCount;
          return (
            <div
              key={user.id} role="group" className="flex items-center gap-1.5"
              aria-label={`${user.name}: ${count} trabajo${count === 1 ? '' : 's'} en diseño${isLeast ? ', el que menos tiene' : ''}`}
            >
              <Avatar name={user.name} color={user.avatarColor} size={18} aria-hidden />
              <span className="text-xs font-medium text-ink-800 whitespace-nowrap" aria-hidden>{user.name.split(' ')[0]}</span>
              <div className="w-16 h-1.5 rounded-full bg-ink-100 overflow-hidden shrink-0" aria-hidden>
                <div
                  className={clsx('h-full rounded-full transition-all', isLeast && !allTied ? 'bg-plan' : 'bg-info')}
                  style={{ width: count === 0 ? '0%' : `${Math.max(10, (count / scaleMax) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-ink-900 tabular" aria-hidden>{count}</span>
            </div>
          );
        })}
      </div>
      {!allTied && (
        <p className="text-[11px] text-ink-700 mt-2">
          <span className="font-semibold text-plan-text">{counts.find((c) => c.count === minCount)?.user.name.split(' ')[0]}</span> tiene menos carga.
        </p>
      )}
    </div>
  );
}
