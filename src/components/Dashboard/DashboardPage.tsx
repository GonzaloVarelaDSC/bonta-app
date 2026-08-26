import { useMemo, useState } from 'react';
import { Flame, Zap, CalendarClock, TriangleAlert, Factory, CircleCheckBig, CircleHelp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { computeCounts, isOverdue, isDueToday, isMissingInfo, sortByPriority } from '../../lib/selectors';
import { isSilent } from '../../lib/risk';
import { KpiCard } from './KpiCard';
import { DashboardJobCard } from './DashboardJobCard';

type FilterKey = 'critical' | 'urgent' | 'dueToday' | 'overdue' | 'inProduction' | 'readyToDeliver' | 'waitingInfo' | 'silent' | null;

export function DashboardPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const jobs = useMemo(() => visibleJobs(user, allJobs), [user, allJobs]);
  const counts = useMemo(() => computeCounts(jobs), [jobs]);
  const [filter, setFilter] = useState<FilterKey>(null);
  const [onlyMine, setOnlyMine] = useState(true);

  const filtered = useMemo(() => {
    let base = jobs;
    switch (filter) {
      case 'critical': base = jobs.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'CRITICO'); break;
      case 'urgent': base = jobs.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'URGENTE'); break;
      case 'dueToday': base = jobs.filter(isDueToday); break;
      case 'overdue': base = jobs.filter(isOverdue); break;
      case 'inProduction': base = jobs.filter((j) => j.status === 'EN_PRODUCCION'); break;
      case 'readyToDeliver': base = jobs.filter((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION'); break;
      case 'waitingInfo': base = jobs.filter(isMissingInfo); break;
      case 'silent': base = jobs.filter((j) => isSilent(j)); break;
      default: base = jobs.filter((j) => j.status !== 'TERMINADO' && j.status !== 'CANCELADO');
    }
    if (onlyMine) base = base.filter((j) => j.responsibleUserId === user.id || j.assignedUserIds.includes(user.id));
    return sortByPriority(base);
  }, [jobs, filter, onlyMine, user.id]);

  // Orden pedido por Gonzalo: lo más operativo (listos para entregar, en producción)
  // primero, después el resto por urgencia.
  const cards: { key: FilterKey; label: string; value: number; icon: LucideIcon; tone: 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'neutral' }[] = [
    { key: 'readyToDeliver', label: 'Listos para entregar', value: counts.readyToDeliver, icon: CircleCheckBig, tone: 'plan' },
    { key: 'inProduction', label: 'En producción', value: counts.inProduction, icon: Factory, tone: 'neutral' },
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

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
        {cards.map((c) => (
          <KpiCard key={c.key} label={c.label} value={c.value} icon={c.icon} tone={c.tone}
            active={filter === c.key} onClick={() => setFilter(filter === c.key ? null : c.key)} />
        ))}
      </div>

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
          <label className="flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer select-none">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="rounded" />
            Solo asignados a mí
          </label>
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
