import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';
import { addDays, format, parseISO, startOfDay, startOfYear, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStore } from '../../store/useStore';
import { buildFacts, previousPeriod, EMPTY_FILTERS, type DaysMode, type ExplorerFilters, type Period } from '../../lib/metrics';
import { friendlyError } from '../../lib/errors';
import type { MetricsCtx } from './context';
import { SummaryView } from './SummaryView';
import { ProductionView } from './ProductionView';
import { ClientsView } from './ClientsView';
import { ExplorerView } from './ExplorerView';
import { GoalsView } from './GoalsView';
import { RevenueView } from './RevenueView';
import { LimitNote } from './ui';

// Métricas (19/10, CLAUDE.md §73) — solo admin (ruta con RequireRole + la base
// lo exige en 028_metrics.sql). Todo el estado de la pantalla (pestaña, período,
// filtros del Explorador) vive en la URL: así un click en un gráfico lleva al
// Explorador con el contexto armado, y "Atrás" del navegador vuelve a donde estaba.

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'produccion', label: 'Producción y tiempos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'facturacion', label: 'Importes' },
  { key: 'explorador', label: 'Explorador de trabajos' },
  { key: 'objetivos', label: 'Objetivos' },
] as const;
type TabKey = typeof TABS[number]['key'];

const PRESETS: { key: string; label: string }[] = [
  { key: '30', label: 'Últimos 30 días' }, { key: '90', label: 'Últimos 90 días' }, { key: '180', label: 'Últimos 6 meses' },
  { key: '365', label: 'Últimos 12 meses' }, { key: 'ytd', label: 'Este año' }, { key: 'all', label: 'Desde el inicio' }, { key: 'custom', label: 'Fechas a elección' },
];

const F_KEYS = Object.keys(EMPTY_FILTERS) as (keyof ExplorerFilters)[];

export function MetricsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const jobTypes = useStore((s) => s.jobTypes);
  const events = useStore((s) => s.metricsEvents);
  const prices = useStore((s) => s.jobPrices);
  const loadedAt = useStore((s) => s.metricsLoadedAt);
  const loadMetrics = useStore((s) => s.loadMetrics);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const loadQuotes = useStore((s) => s.loadQuotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true); setError(null);
    try { await loadMetrics(); } catch (e) {
      const msg = friendlyError(e);
      setError(/metrics_status_events|metric_goals|function|schema cache/i.test(String((e as { message?: string })?.message)) ? `${msg} Probablemente falta correr la migración 028_metrics.sql en Supabase.` : msg);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    if (!loadedAt) void Promise.resolve().then(refresh);
    if (!quotesLoaded) loadQuotes().catch(() => { /* sin presupuestos: esa sección lo avisa */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tab = (params.get('tab') as TabKey) ?? 'resumen';
  const range = params.get('range') ?? '90';
  const mode: DaysMode = params.get('days') === 'business' ? 'business' : 'calendar';
  const now = useMemo(() => new Date(), [loadedAt, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const facts = useMemo(() => buildFacts(jobs, events, prices), [jobs, events, prices]);
  const dataSince = useMemo(() => facts.length ? startOfDay(new Date(facts.reduce((m, f) => (f.job.createdAt < m ? f.job.createdAt : m), facts[0].job.createdAt))) : null, [facts]);

  const period: Period = useMemo(() => {
    const end = addDays(startOfDay(now), 1);
    if (range === 'custom') {
      const from = params.get('from'); const to = params.get('to');
      if (from && to) return { from: parseISO(from), to: addDays(parseISO(to), 1) };
    }
    if (range === 'ytd') return { from: startOfYear(now), to: end };
    if (range === 'all') return { from: dataSince ?? subDays(end, 365), to: end };
    const n = Number(range) || 90;
    return { from: subDays(end, n), to: end };
  }, [range, params, now, dataSince]);
  const prev = previousPeriod(period);
  const comparable = !!dataSince && prev.from >= dataSince;
  const periodLabel = `${format(period.from, 'd MMM yyyy', { locale: es })} – ${format(subDays(period.to, 1), 'd MMM yyyy', { locale: es })}`;

  const filters: ExplorerFilters = useMemo(() => {
    const f = { ...EMPTY_FILTERS } as Record<string, string>;
    for (const k of F_KEYS) { const v = params.get(`f_${k}`); if (v !== null) f[k] = v; }
    return f as unknown as ExplorerFilters;
  }, [params]);

  function update(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params); mut(p); setParams(p);
  }
  function setFilters(f: ExplorerFilters) {
    update((p) => { for (const k of F_KEYS) { if (f[k] === EMPTY_FILTERS[k]) p.delete(`f_${k}`); else p.set(`f_${k}`, String(f[k])); } });
  }

  const ctx: MetricsCtx = {
    facts, period, prev, periodLabel, comparable, dataSince, mode, now,
    unit: mode === 'business' ? 'días hábiles' : 'días',
    typeLabel: (id) => jobTypes.find((t) => t.id === id)?.label ?? id,
    clientName: (id) => clients.find((c) => c.id === id)?.name ?? 'Cliente sin nombre',
    userName: (id) => (id ? users.find((u) => u.id === id)?.name ?? '—' : '—'),
    openJob: (id) => navigate(`/trabajos/${id}`),
    drill: (f, per) => {
      const p = new URLSearchParams(params);
      p.set('tab', 'explorador');
      for (const k of F_KEYS) p.delete(`f_${k}`);
      const full = { ...EMPTY_FILTERS, dateField: f.dateField ?? (per ? 'created' : 'none'), ...f };
      for (const k of F_KEYS) if (full[k] !== EMPTY_FILTERS[k]) p.set(`f_${k}`, String(full[k]));
      if (per) {
        const from = dataSince && per.from < dataSince ? dataSince : per.from;
        p.set('range', 'custom'); p.set('from', format(from, 'yyyy-MM-dd')); p.set('to', format(subDays(per.to, 1), 'yyyy-MM-dd'));
      }
      setParams(p);
      window.scrollTo({ top: 0 });
    },
  };

  const sel = 'text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-display font-bold text-ink-900">Métricas</h1>
          <p className="text-sm text-ink-700">Cómo funciona el estudio según lo que se registra en la app. Todo número se puede abrir hasta los trabajos que lo explican.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Período" className={sel} value={range} onChange={(e) => update((p) => {
            p.set('range', e.target.value);
            if (e.target.value === 'custom' && !p.get('from')) { p.set('from', format(period.from, 'yyyy-MM-dd')); p.set('to', format(subDays(period.to, 1), 'yyyy-MM-dd')); }
          })}>
            {PRESETS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          {range === 'custom' && (
            <>
              <input type="date" aria-label="Desde" className={sel} value={params.get('from') ?? ''} onChange={(e) => update((p) => p.set('from', e.target.value))} />
              <input type="date" aria-label="Hasta" className={sel} value={params.get('to') ?? ''} onChange={(e) => update((p) => p.set('to', e.target.value))} />
            </>
          )}
          <div role="group" aria-label="Cómo contar los días" className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5 text-xs">
            {(['calendar', 'business'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => update((p) => (m === 'calendar' ? p.delete('days') : p.set('days', m)))}
                className={clsx('px-2.5 py-2.5 md:py-1 rounded-md font-medium', mode === m ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50')}>
                {m === 'calendar' ? 'Días corridos' : 'Días hábiles'}
              </button>
            ))}
          </div>
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 min-h-[44px] md:min-h-0 bg-white hover:bg-ink-50 disabled:opacity-60" title={loadedAt ? `Historial leído a las ${format(new Date(loadedAt), 'HH:mm')}` : undefined}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden="true" /> Actualizar
          </button>
        </div>
      </div>
      <div className="text-xs text-ink-700 mb-3">
        Período: <b className="text-ink-900">{periodLabel}</b>
        {comparable ? <> · se compara con {format(prev.from, 'd MMM', { locale: es })} – {format(subDays(prev.to, 1), 'd MMM yyyy', { locale: es })}</> : <> · sin período anterior completo para comparar</>}
        {dataSince && <> · datos desde el {format(dataSince, 'd MMM yyyy', { locale: es })}</>}
      </div>

      {/* En el celular las 6 secciones no entran y las últimas quedaban fuera de vista: un selector las muestra todas. */}
      <label className="md:hidden block mb-4">
        <span className="sr-only">Sección de Métricas</span>
        <select className={clsx(sel, 'w-full min-h-[44px] font-medium')} value={tab} onChange={(e) => update((p) => p.set('tab', e.target.value))}>
          {TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>
      <nav role="tablist" aria-label="Secciones de Métricas" className="hidden md:flex gap-1 border-b border-ink-200 mb-4 overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => update((p) => p.set('tab', t.key))}
            className={clsx('px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px', tab === t.key ? 'border-brand-500 text-ink-900' : 'border-transparent text-ink-700 hover:text-ink-900')}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="mb-4 rounded-lg border border-crit/30 bg-crit-bg text-crit-text text-sm px-3 py-2">No se pudo leer el historial: {error}</div>}
      {!loadedAt && !error ? (
        <div className="py-16 text-center text-sm text-ink-700">Leyendo el historial de los trabajos…</div>
      ) : !loadedAt ? null : facts.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink-700">Todavía no hay trabajos cargados para analizar.</div>
      ) : (
        <div role="tabpanel">
          {tab === 'resumen' && <SummaryView ctx={ctx} />}
          {tab === 'produccion' && <ProductionView ctx={ctx} />}
          {tab === 'clientes' && <ClientsView ctx={ctx} />}
          {tab === 'facturacion' && <RevenueView ctx={ctx} />}
          {tab === 'explorador' && <ExplorerView ctx={ctx} filters={filters} setFilters={setFilters} />}
          {tab === 'objetivos' && <GoalsView ctx={ctx} />}
          <div className="mt-6"><LimitNote>
            Qué no puede medir la app hoy: horas trabajadas (los tiempos son de calendario, incluyen esperas), costos (no hay rentabilidad), facturación real (los importes se cargan a mano en cada ficha),
            fecha real de entrega distinta del día en que se marca "Entregado", retrabajos, y la fecha de confirmación de un presupuesto. Los trabajos eliminados no cuentan.
          </LimitNote></div>
        </div>
      )}
    </div>
  );
}
