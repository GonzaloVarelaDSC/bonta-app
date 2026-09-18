import { useMemo, useState } from 'react';
import { Flame, Zap, CalendarClock, TriangleAlert, Factory, CircleCheckBig, CircleHelp, PenTool, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { computeCounts, isOverdue, isDueToday, isMissingInfo, sortByPriority } from '../../lib/selectors';
import { isSilent } from '../../lib/risk';
import { KpiCard } from './KpiCard';
import { DashboardJobCard } from './DashboardJobCard';
import { DesignLoadWidget } from './DesignLoadWidget';

type FilterKey = 'pending' | 'critical' | 'urgent' | 'dueToday' | 'overdue' | 'inDesign' | 'inProduction' | 'readyToDeliver' | 'waitingInfo' | 'silent' | null;

// A mí = soy responsable o estoy asignado. Por mí = yo asigné el trabajo (lo
// cargué). Todos = todo lo que puedo ver. El default se acomoda al perfil:
// un admin (Pancho, Martín, Gonzalo) arranca en "Todos" — pidieron
// explícitamente poder ver TODA la app apenas entran, no solo lo que ellos
// cargaron (Gonzalo, 16/09). Quien produce y no es admin (Gastón) arranca en
// "A mí" (su cola de trabajo); quien coordina/dirige sin producir y no es admin
// (Alejandra, Richard, Nancy) arranca en "Por mí" (lo que metió en la máquina).
// Cada uno lo puede cambiar y queda guardado en su propio navegador.
type ScopeMode = 'mine' | 'byMe' | 'all';
const SCOPE_LABELS: Record<ScopeMode, string> = { mine: 'A mí', byMe: 'Por mí', all: 'Todos' };
const SCOPE_KEY = 'bonta-dash-scope';

export function DashboardPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  // Eliminados (Fase 4) nunca aparecen en el Dashboard — Histórico es el único
  // lugar para consultarlos/restaurarlos.
  const jobs = useMemo(() => visibleJobs(user, allJobs).filter((j) => !j.deletedAt), [user, allJobs]);
  const [filter, setFilter] = useState<FilterKey>(null);
  const [scope, setScope] = useState<ScopeMode>(() => {
    const saved = localStorage.getItem(SCOPE_KEY);
    if (saved === 'mine' || saved === 'byMe' || saved === 'all') return saved;
    if (user.role === 'admin') return 'all';
    return user.isProducer ? 'mine' : 'byMe';
  });
  function changeScope(next: ScopeMode) {
    setScope(next);
    localStorage.setItem(SCOPE_KEY, next);
  }

  // Los cubos de arriba tienen que contar sobre el mismo conjunto que después
  // se ve al hacer click — si no, un cubo puede mostrar "1" y al tocarlo
  // aparecer vacío. Se escopea acá, antes de calcular counts, para que el
  // número y la lista siempre coincidan.
  const scoped = useMemo(() => {
    if (scope === 'all') return jobs;
    if (scope === 'byMe') return jobs.filter((j) => j.createdByUserId === user.id);
    return jobs.filter((j) => j.responsibleUserId === user.id || j.assignedUserIds.includes(user.id));
  }, [jobs, scope, user.id]);
  const counts = useMemo(() => computeCounts(scoped), [scoped]);

  const filtered = useMemo(() => {
    let base = scoped;
    switch (filter) {
      case 'critical': base = scoped.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'CRITICO'); break;
      case 'urgent': base = scoped.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'URGENTE'); break;
      case 'dueToday': base = scoped.filter(isDueToday); break;
      case 'overdue': base = scoped.filter(isOverdue); break;
      case 'pending': base = scoped.filter((j) => j.status === 'PENDIENTE'); break;
      case 'inDesign': base = scoped.filter((j) => j.status === 'EN_DISENO' || j.status === 'DISENO_LISTO'); break;
      case 'inProduction': base = scoped.filter((j) => j.status === 'EN_PRODUCCION'); break;
      case 'readyToDeliver': base = scoped.filter((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION'); break;
      case 'waitingInfo': base = scoped.filter(isMissingInfo); break;
      case 'silent': base = scoped.filter((j) => isSilent(j)); break;
      default: base = scoped.filter((j) => j.status !== 'TERMINADO' && j.status !== 'CANCELADO');
    }
    return sortByPriority(base);
  }, [scoped, filter]);

  // Orden pedido por Gonzalo: lo más operativo (listos para entregar, en producción)
  // primero, después el resto por urgencia.
  const cards: { key: FilterKey; label: string; value: number; icon: LucideIcon; tone: 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'info' | 'neutral' }[] = [
    { key: 'readyToDeliver', label: 'Listos para entregar', value: counts.readyToDeliver, icon: CircleCheckBig, tone: 'plan' },
    { key: 'inProduction', label: 'En producción', value: counts.inProduction, icon: Factory, tone: 'neutral' },
    { key: 'inDesign', label: 'En diseño', value: counts.inDesign, icon: PenTool, tone: 'info' },
    { key: 'pending', label: 'Pendientes', value: counts.pending, icon: Inbox, tone: 'wait' },
    { key: 'critical', label: 'Críticos', value: counts.critical, icon: Flame, tone: 'crit' },
    { key: 'urgent', label: 'Urgentes', value: counts.urgent, icon: Zap, tone: 'urg' },
    { key: 'dueToday', label: 'Para hoy', value: counts.dueToday, icon: CalendarClock, tone: 'norm' },
    { key: 'overdue', label: 'Atrasados', value: counts.overdue, icon: TriangleAlert, tone: 'crit' },
    { key: 'waitingInfo', label: 'Esperando información', value: counts.waitingInfo, icon: CircleHelp, tone: 'wait' },
  ];

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-display font-bold text-ink-900">Dashboard de producción</h1>
        <span className="text-xs text-ink-700">Actualizado en vivo</span>
      </div>
      <p className="text-sm text-ink-700 mb-5">Tocá una tarjeta para filtrar la lista de abajo.</p>

      {/* 9 tarjetas: `xl:grid-cols-9` (divisor exacto de 9, nunca sobra un hueco)
          reemplaza el `xl:grid-cols-7` original, que dejaba una fila de 2 sueltas
          con un vacío grande al lado (AUDITORIA_UXUI_2026-09-15.md, 🟢 Bajo,
          "grilla de KPI asimétrica"). En los dos tiers más chicos (2 y 4
          columnas) sigue sobrando 1 tarjeta — la última se estira a todo el
          ancho (`col-span-full`) en vez de quedar sola con un hueco al lado, y
          vuelve a ocupar una sola columna en `xl` donde ya no sobra nada. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3 mb-4">
        {cards.map((c, i) => (
          <KpiCard key={c.key} label={c.label} value={c.value} icon={c.icon} tone={c.tone}
            active={filter === c.key} onClick={() => setFilter(filter === c.key ? null : c.key)}
            className={i === cards.length - 1 ? 'col-span-full xl:col-span-1' : undefined} />
        ))}
      </div>

      <DesignLoadWidget jobs={jobs} users={users} />

      {counts.silent > 0 && (
        <button
          onClick={() => setFilter(filter === 'silent' ? null : 'silent')}
          className="w-full mb-5 text-left bg-wait-bg border border-wait/30 rounded-lg px-4 py-2.5 text-sm text-wait-text flex items-center gap-2 hover:brightness-95 transition"
        >
          <span>💤</span>
          <span><strong>{counts.silent}</strong> {counts.silent === 1 ? 'trabajo lleva' : 'trabajos llevan'} más de 48h sin ningún movimiento ni comentario — puede que nadie los esté mirando.</span>
        </button>
      )}

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className="text-sm font-semibold text-ink-800">
          {filter ? `Filtrado: ${cards.find((c) => c.key === filter)?.label ?? 'sin movimiento'}` : 'Trabajos activos, ordenados por prioridad'}
          <span className="text-ink-700 font-normal"> · {filtered.length}</span>
        </span>
        <div className="flex items-center gap-3">
          {filter && <button onClick={() => setFilter(null)} className="text-xs text-brand-600 hover:underline">Ver todos</button>}
          <div role="group" aria-label="Qué trabajos ver" className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
            {(['mine', 'byMe', 'all'] as ScopeMode[]).map((m) => (
              <button
                key={m} onClick={() => changeScope(m)} aria-pressed={scope === m}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  scope === m ? 'bg-ink-950 text-white' : 'text-ink-700 hover:text-ink-900'
                }`}
              >
                {SCOPE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 shadow-card px-4 py-10 text-center text-sm text-ink-700">
          No hay trabajos que coincidan con este filtro.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((j) => <DashboardJobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}
