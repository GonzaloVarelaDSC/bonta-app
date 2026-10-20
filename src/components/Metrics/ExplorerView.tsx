import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { applyFilters, deadlineOf, deliveryLateDays, cycleDays, ageDays, EMPTY_FILTERS, FLOW_STAGES, STAGE_LABEL, STAGE_TONE, type ExplorerFilters, type JobFacts } from '../../lib/metrics';
import { PRIORITY_META } from '../../lib/priority';
import { useStore } from '../../store/useStore';
import { visibleJobTypes } from '../../data/catalog';
import type { MetricsCtx } from './context';

import { fmtNum } from './fmt';
import { TONE_BG } from './fmt';

const PAGE = 25;
const th = 'px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700 whitespace-nowrap';
const td = 'px-2.5 py-2 text-[13px] text-ink-900 whitespace-nowrap';
const sel = 'text-sm border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500';
const d = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd/MM/yy') : '—');

type ColKey = 'code' | 'name' | 'client' | 'type' | 'stage' | 'priority' | 'resp' | 'created' | 'committed' | 'delivered' | 'cycle' | 'deadline';

export function ExplorerView({ ctx, filters, setFilters }: { ctx: MetricsCtx; filters: ExplorerFilters; setFilters: (f: ExplorerFilters) => void }) {
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const jobTypes = useStore((s) => s.jobTypes);
  // La página vuelve a 1 sola cuando cambian los filtros o el período.
  const sig = JSON.stringify(filters) + ctx.period.from.getTime() + ctx.period.to.getTime();
  const [pg, setPg] = useState({ sig, n: 0 });
  const page = pg.sig === sig ? pg.n : 0;
  const setPage = (fn: (n: number) => number) => setPg({ sig, n: fn(page) });
  const [sort, setSort] = useState<{ key: ColKey; desc: boolean }>({ key: 'created', desc: true });

  const rows = useMemo(() => applyFilters(ctx.facts, filters, ctx.period, ctx.clientName), [ctx, filters]);
  const sortVal = (f: JobFacts, k: ColKey): string | number => {
    switch (k) {
      case 'code': return f.job.code ?? '';
      case 'name': return f.job.name.toLowerCase();
      case 'client': return ctx.clientName(f.job.clientId).toLowerCase();
      case 'type': return ctx.typeLabel(f.job.jobTypeId);
      case 'stage': return f.stage ? FLOW_STAGES.indexOf(f.stage as never) : 99;
      case 'priority': return PRIORITY_META[f.priority].order;
      case 'resp': return ctx.userName(f.job.responsibleUserId);
      case 'created': return f.job.createdAt;
      case 'committed': return f.job.committedDate;
      case 'delivered': return f.deliveredAt ?? '';
      case 'cycle': return cycleDays(f, ctx.mode) ?? ageDays(f, ctx.mode, ctx.now) ?? -1;
      case 'deadline': return deliveryLateDays(f) ?? (f.overdueOpen ? 999 : -999);
    }
  };
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = sortVal(a, sort.key); const y = sortVal(b, sort.key);
    const r = x < y ? -1 : x > y ? 1 : 0; return sort.desc ? -r : r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, sort]);
  const pageRows = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const set = <K extends keyof ExplorerFilters>(k: K, v: ExplorerFilters[K]) => setFilters({ ...filters, [k]: v });
  const active = (Object.keys(EMPTY_FILTERS) as (keyof ExplorerFilters)[]).filter((k) => filters[k] !== EMPTY_FILTERS[k]).length;

  function downloadCsv() {
    const head = ['N°', 'Trabajo', 'Cliente', 'Tipo', 'Etapa', 'Prioridad', 'Responsable', 'Alta', 'Comprometida', 'Entregado', `Ingreso a entrega (${ctx.unit})`, 'Plazo', 'Historial completo'];
    const lines = sorted.map((f) => [
      f.job.code ?? '', f.job.name, ctx.clientName(f.job.clientId), ctx.typeLabel(f.job.jobTypeId), f.stage ? STAGE_LABEL[f.stage] : '', PRIORITY_META[f.priority].label,
      ctx.userName(f.job.responsibleUserId), d(f.job.createdAt), d(f.job.committedDate), d(f.deliveredAt),
      cycleDays(f, ctx.mode)?.toFixed(1).replace('.', ',') ?? '', deadlineText(f), f.historyComplete ? 'sí' : 'no',
    ]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `metricas-trabajos-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const hp = { sort, onSort: (k: ColKey) => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true })) };

  return (
    <div className="bg-white rounded-xl border border-ink-200 shadow-card">
      <div className="p-3 border-b border-ink-200 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Buscar N°, trabajo o cliente…" aria-label="Buscar"
            className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 w-56 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <label className="text-xs text-ink-700 inline-flex items-center gap-1">Período por
            <select className={sel} value={filters.dateField} onChange={(e) => set('dateField', e.target.value as ExplorerFilters['dateField'])}>
              <option value="none">— no filtrar por fecha —</option>
              <option value="created">fecha de alta</option>
              <option value="delivered">fecha de entrega</option>
              <option value="committed">fecha comprometida</option>
            </select>
          </label>
          <select aria-label="Situación" className={sel} value={filters.state} onChange={(e) => set('state', e.target.value as ExplorerFilters['state'])}>
            <option value="all">Abiertos y cerrados</option><option value="open">Abiertos</option><option value="delivered">Entregados</option><option value="cancelled">Cancelados</option>
          </select>
          <select aria-label="Plazo" className={sel} value={filters.deadline} onChange={(e) => set('deadline', e.target.value as ExplorerFilters['deadline'])}>
            <option value="all">Cualquier plazo</option><option value="on_time">Entregados a tiempo</option><option value="late">Entregados con atraso</option><option value="overdue_open">Abiertos vencidos</option><option value="no_data">Sin dato de entrega</option>
          </select>
          <select aria-label="Etapa actual" className={sel} value={filters.stage} onChange={(e) => set('stage', e.target.value as ExplorerFilters['stage'])}>
            <option value="">Toda etapa</option>{[...FLOW_STAGES, 'terminado' as const, 'cancelado' as const].map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
          <select aria-label="Cliente" className={clsx(sel, 'max-w-[180px]')} value={filters.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Todo cliente</option>{[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Tipo de trabajo" className={sel} value={filters.typeId} onChange={(e) => set('typeId', e.target.value)}>
            <option value="">Todo tipo</option>{jobTypes.filter((t) => visibleJobTypes([t]).length || filters.typeId === t.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select aria-label="Prioridad" className={sel} value={filters.priority} onChange={(e) => set('priority', e.target.value as ExplorerFilters['priority'])}>
            <option value="">Toda prioridad</option>{(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          <select aria-label="Responsable" className={sel} value={filters.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}>
            <option value="">Todo responsable</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {filters.exitedStage && (
            <span className="inline-flex items-center gap-1 rounded-full bg-info-bg text-info-text border border-info/30 px-2 py-0.5">
              Salieron de {STAGE_LABEL[filters.exitedStage]} en el período
              <button type="button" aria-label="Quitar este filtro" onClick={() => set('exitedStage', '')}><X size={12} /></button>
            </span>
          )}
          <span className="text-ink-800"><b>{sorted.length}</b> trabajo{sorted.length === 1 ? '' : 's'}{filters.dateField !== 'none' && ` · ${ctx.periodLabel}`}</span>
          {active > 0 && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-brand-600 hover:underline">Limpiar filtros</button>}
          <button type="button" onClick={downloadCsv} disabled={!sorted.length} className="ml-auto inline-flex items-center gap-1 border border-ink-200 rounded-lg px-2.5 py-1 text-ink-800 hover:bg-ink-50 disabled:opacity-50">
            <Download size={13} aria-hidden="true" /> Descargar CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr>
              <H {...hp} k="code">N°</H><H {...hp} k="name">Trabajo</H><H {...hp} k="client">Cliente</H><H {...hp} k="type">Tipo</H><H {...hp} k="stage">Etapa</H><H {...hp} k="priority">Prioridad</H><H {...hp} k="resp">Responsable</H>
              <H {...hp} k="created">Alta</H><H {...hp} k="committed">Comprometida</H><H {...hp} k="delivered">Entregado</H>
              <H {...hp} k="cycle" title="Entregados: ingreso → entrega. Abiertos: antigüedad hasta hoy.">Días</H><H {...hp} k="deadline">Plazo</H>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {pageRows.length === 0 && <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-ink-700">Ningún trabajo cumple estos filtros en el período.</td></tr>}
            {pageRows.map((f) => {
              const cyc = cycleDays(f, ctx.mode); const age = ageDays(f, ctx.mode, ctx.now);
              return (
                <tr key={f.job.id} className="hover:bg-ink-50">
                  <td className={clsx(td, 'font-mono text-xs')}>{f.job.code ?? <span className="text-ink-500">—</span>}</td>
                  <td className={clsx(td, 'max-w-[220px] truncate')}><Link to={`/trabajos/${f.job.id}`} className="text-brand-600 hover:underline font-medium" title={f.job.name}>{f.job.name}</Link></td>
                  <td className={clsx(td, 'max-w-[160px] truncate')} title={ctx.clientName(f.job.clientId)}>{ctx.clientName(f.job.clientId)}</td>
                  <td className={clsx(td, 'max-w-[140px] truncate')}>{ctx.typeLabel(f.job.jobTypeId)}</td>
                  <td className={td}>{f.stage && <span className="inline-flex items-center gap-1.5"><span className={clsx('w-2 h-2 rounded-full', TONE_BG[STAGE_TONE[f.stage]])} aria-hidden="true" />{STAGE_LABEL[f.stage]}</span>}</td>
                  <td className={td}>{PRIORITY_META[f.priority].label}</td>
                  <td className={td}>{ctx.userName(f.job.responsibleUserId)}</td>
                  <td className={td}>{d(f.job.createdAt)}</td>
                  <td className={td}>{d(f.job.committedDate)}</td>
                  <td className={td}>{d(f.deliveredAt)}</td>
                  <td className={clsx(td, 'tabular-nums')}>{cyc !== null ? fmtNum(cyc, 1) : age !== null ? <span className="text-ink-600" title="Abierto: antigüedad hasta hoy">{fmtNum(age, 1)} (abierto)</span> : '—'}</td>
                  <td className={td}><DeadlinePill f={f} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-ink-200 text-xs text-ink-800">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded border border-ink-200 disabled:opacity-40">Anterior</button>
          <span>Página {page + 1} de {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded border border-ink-200 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}

function H({ k, children, title, sort, onSort }: { k: ColKey; children: string; title?: string; sort: { key: ColKey; desc: boolean }; onSort: (k: ColKey) => void }) {
  return (
    <th className={th} title={title} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="uppercase hover:text-ink-900" onClick={() => onSort(k)}>{children}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  );
}

function deadlineText(f: JobFacts): string {
  const k = deadlineOf(f);
  if (k === 'on_time') return 'A tiempo';
  if (k === 'late') return `Atrasado ${deliveryLateDays(f)} d`;
  if (k === 'overdue_open') return 'Vencido (abierto)';
  if (k === 'open_ok') return 'En plazo';
  return f.job.status === 'CANCELADO' ? 'Cancelado' : 'Sin dato';
}

function DeadlinePill({ f }: { f: JobFacts }) {
  const k = deadlineOf(f);
  const cls = k === 'on_time' ? 'bg-plan-bg text-plan-text border-plan/30' : k === 'late' || k === 'overdue_open' ? 'bg-crit-bg text-crit-text border-crit/30' : 'bg-ink-50 text-ink-700 border-ink-200';
  return <span className={clsx('inline-flex text-[11px] px-2 py-0.5 rounded-full border', cls)}>{deadlineText(f)}</span>;
}
