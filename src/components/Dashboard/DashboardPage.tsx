import { useMemo, useState } from 'react';
import { Flame, Zap, CalendarClock, TriangleAlert, Ban, Factory, CircleCheckBig, CircleHelp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { computeCounts, isOverdue, isBlocked, isDueToday, isMissingInfo, sortByPriority } from '../../lib/selectors';
import { isSilent } from '../../lib/risk';
import { KpiCard } from './KpiCard';
import { JobsTable } from '../Jobs/JobsTable';

type FilterKey = 'critical' | 'urgent' | 'dueToday' | 'overdue' | 'blocked' | 'inProduction' | 'readyToDeliver' | 'waitingInfo' | 'silent' | null;

export function DashboardPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const jobs = useMemo(() => visibleJobs(user, allJobs), [user, allJobs]);
  const counts = useMemo(() => computeCounts(jobs), [jobs]);
  const [filter, setFilter] = useState<FilterKey>(null);

  const filtered = useMemo(() => {
    let base = jobs;
    switch (filter) {
      case 'critical': base = jobs.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'CRITICO'); break;
      case 'urgent': base = jobs.filter((j) => (j.priorityManual ?? j.priorityAuto) === 'URGENTE'); break;
      case 'dueToday': base = jobs.filter(isDueToday); break;
      case 'overdue': base = jobs.filter(isOverdue); break;
      case 'blocked': base = jobs.filter(isBlocked); break;
      case 'inProduction': base = jobs.filter((j) => j.status === 'EN_PRODUCCION'); break;
      case 'readyToDeliver': base = jobs.filter((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION'); break;
      case 'waitingInfo': base = jobs.filter(isMissingInfo); break;
      case 'silent': base = jobs.filter((j) => isSilent(j)); break;
      default: base = jobs.filter((j) => j.status !== 'TERMINADO' && j.status !== 'CANCELADO');
    }
    return sortByPriority(base);
  }, [jobs, filter]);

  const cards: { key: FilterKey; label: string; value: number; icon: LucideIcon; tone: 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'neutral' }[] = [
    { key: 'critical', label: 'Críticos', value: counts.critical, icon: Flame, tone: 'crit' },
    { key: 'urgent', label: 'Urgentes', value: counts.urgent, icon: Zap, tone: 'urg' },
    { key: 'dueToday', label: 'Para hoy', value: counts.dueToday, icon: CalendarClock, tone: 'norm' },
    { key: 'overdue', label: 'Atrasados', value: counts.overdue, icon: TriangleAlert, tone: 'crit' },
    { key: 'blocked', label: 'Bloqueados', value: counts.blocked, icon: Ban, tone: 'wait' },
    { key: 'inProduction', label: 'En producción', value: counts.inProduction, icon: Factory, tone: 'neutral' },
    { key: 'readyToDeliver', label: 'Listos para entregar', value: counts.readyToDeliver, icon: CircleCheckBig, tone: 'plan' },
    { key: 'waitingInfo', label: 'Esperando información', value: counts.waitingInfo, icon: CircleHelp, tone: 'wait' },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-display font-bold text-ink-900">Dashboard de producción</h1>
        <span className="text-xs text-ink-400">Actualizado en vivo</span>
      </div>
      <p className="text-sm text-ink-500 mb-5">Tocá una tarjeta para filtrar la tabla de abajo.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
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

      <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-800">
            {filter ? `Filtrado: ${cards.find((c) => c.key === filter)?.label ?? 'sin movimiento'}` : 'Trabajos activos, ordenados por prioridad'}
          </span>
          {filter && <button onClick={() => setFilter(null)} className="text-xs text-brand-600 hover:underline">Ver todos</button>}
        </div>
        <JobsTable jobs={filtered} compact />
      </div>
    </div>
  );
}
