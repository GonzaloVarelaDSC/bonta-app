import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { addMonths, startOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { clientStats, concentration, quoteSummary, summarize } from '../../lib/metrics';
import { useStore } from '../../store/useStore';
import { QUOTE_STATUS_LABELS } from '../../data/catalog';
import type { MetricsCtx } from './context';
import { Card, LimitNote, InfoTip } from './ui';
import { fmtNum, fmtPct, fmtDays } from './fmt';
import { BarList, LineChart } from './charts';

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700';
const td = 'px-3 py-2 text-sm text-ink-900 tabular-nums';
const money = (x: number) => x.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
type SortKey = 'inPeriod' | 'change' | 'total' | 'lastAt' | 'name';

export function ClientsView({ ctx }: { ctx: MetricsCtx }) {
  const { facts, period, comparable } = ctx;
  const quotes = useStore((s) => s.quotes);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const stats = useMemo(() => clientStats(facts, period), [facts, period]);
  const conc = useMemo(() => concentration(stats), [stats]);
  const qs = useMemo(() => quoteSummary(quotes, period), [quotes, period]);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'inPeriod', desc: true });
  const [selected, setSelected] = useState<string | null>(null);

  const segments = { nuevo: stats.filter((c) => c.segment === 'nuevo').length, recurrente: stats.filter((c) => c.segment === 'recurrente').length };
  const rows = useMemo(() => {
    const val = (c: typeof stats[number]) => sort.key === 'name' ? ctx.clientName(c.clientId).toLowerCase() : sort.key === 'change' ? c.inPeriod - c.inPrev : sort.key === 'lastAt' ? c.lastAt : c[sort.key];
    return [...stats].filter((c) => c.inPeriod > 0 || c.inPrev > 0)
      .sort((a, b) => { const x = val(a); const y = val(b); const r = x < y ? -1 : x > y ? 1 : 0; return sort.desc ? -r : r; });
  }, [stats, sort, ctx]);

  const sortProps = { sort, onSort: (k: SortKey) => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true })) };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Clientes con trabajos" value={fmtNum(conc.activeClients)} sub={`${conc.total} trabajos en el período`} help="Clientes distintos con al menos un trabajo ingresado en el período." />
        <Stat label="Nuevos / recurrentes" value={`${segments.nuevo} / ${segments.recurrente}`} sub="Nuevo = su primer trabajo cayó en el período" help="Nuevo: el primer trabajo de ese cliente en la app es de este período. Recurrente: ya tenía trabajos antes. Ojo: la app tiene datos desde que se empezó a usar; un cliente viejo del estudio figura como 'nuevo' la primera vez que se carga." />
        <Stat label="Concentración" value={conc.clientsFor80 ? `${conc.clientsFor80}` : '—'} sub="clientes suman el 80% de los trabajos" help="Cuántos clientes (de más a menos pedidos) hacen falta para llegar al 80% de los trabajos ingresados. Pocos clientes = más dependencia de ellos." />
        <Stat label="Top 5 clientes" value={fmtPct(conc.top5Share)} sub="de los trabajos del período" help="Participación de los 5 clientes con más trabajos ingresados en el período. Cuenta trabajos, no importe." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Clientes con más trabajos" subtitle="Ingresados en el período. Click para ver su evolución.">
          <BarList rows={rows.filter((c) => c.inPeriod > 0).sort((a, b) => b.inPeriod - a.inPeriod).slice(0, 10).map((c) => ({
            key: c.clientId, label: ctx.clientName(c.clientId), value: c.inPeriod, tone: 'brand', sub: comparable ? `antes ${c.inPrev}` : undefined, onClick: () => setSelected(c.clientId),
          }))} emptyText="Sin trabajos ingresados en el período." />
        </Card>
        <Card className="xl:col-span-2" title="Todos los clientes" subtitle={comparable ? 'Con actividad en este período o en el anterior.' : 'Con actividad en el período. No hay período anterior completo: la comparación queda incompleta.'}>
          <div className="overflow-x-auto -mx-4 max-h-[420px] overflow-y-auto">
            <table className="min-w-full">
              <thead className="border-b border-ink-200 bg-ink-50 sticky top-0">
                <tr><SortTh {...sortProps} k="name">Cliente</SortTh><SortTh {...sortProps} k="inPeriod">Período</SortTh><SortTh {...sortProps} k="change">Cambio</SortTh><SortTh {...sortProps} k="total">Histórico</SortTh><th className={th}>Cada cuánto pide</th><SortTh {...sortProps} k="lastAt">Último</SortTh><th className={th}>Tipo</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((c) => {
                  const change = c.inPeriod - c.inPrev;
                  return (
                    <tr key={c.clientId} className={clsx('hover:bg-ink-50 cursor-pointer', selected === c.clientId && 'bg-brand-100/50')} onClick={() => setSelected(c.clientId)}>
                      <td className={clsx(td, 'font-medium max-w-[220px] truncate')} title={ctx.clientName(c.clientId)}>{ctx.clientName(c.clientId)}</td>
                      <td className={td}>{c.inPeriod}</td>
                      <td className={clsx(td, change > 0 ? 'text-plan-text' : change < 0 ? 'text-crit-text' : 'text-ink-600')}>{change > 0 ? `+${change}` : change}</td>
                      <td className={td}>{c.total}</td>
                      <td className={td}>{c.avgGapDays !== null ? `cada ${fmtNum(c.avgGapDays, 0)} días` : <span className="text-ink-600">1 solo pedido</span>}</td>
                      <td className={clsx(td, 'whitespace-nowrap')}>{format(new Date(c.lastAt), 'd MMM yy', { locale: es })}</td>
                      <td className="px-3 py-2 text-[11px]">{c.segment === 'nuevo' ? <span className="text-info-text font-medium">Nuevo</span> : c.segment === 'recurrente' ? 'Recurrente' : <span className="text-ink-600">Sin pedidos</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selected && <ClientDetail ctx={ctx} clientId={selected} onClose={() => setSelected(null)} />}

      <Card title="Presupuestos" subtitle="Creados en el período, según su estado actual. Es lo presupuestado: no es facturación, cobro ni rentabilidad (la app no registra costos ni facturas)."
        actions={<InfoTip text="La app no guarda la fecha en que se confirmó o rechazó un presupuesto, así que se agrupan por fecha de creación. Conversión = confirmados / (confirmados + rechazados). Los importes no se suman entre sí si mezclan IVA incluido y + IVA." />}>
        {!quotesLoaded ? <p className="text-sm text-ink-700">Cargando presupuestos…</p> : qs.created === 0 ? <p className="text-sm text-ink-700">No hay presupuestos creados en el período.</p> : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-display font-bold text-ink-900">{qs.created}</div>
              <div className="text-[11px] text-ink-700 mb-2">presupuestos creados</div>
              <ul className="text-xs text-ink-800 space-y-0.5">
                {Object.entries(qs.byStatus).map(([s, n]) => <li key={s}>{QUOTE_STATUS_LABELS[s as keyof typeof QUOTE_STATUS_LABELS] ?? s}: <b>{n}</b></li>)}
              </ul>
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-ink-900">{fmtPct(qs.conversion.value)}</div>
              <div className="text-[11px] text-ink-700">conversión ({qs.conversion.n} con respuesta del cliente)</div>
            </div>
            <div className="text-xs text-ink-800 space-y-0.5">
              <div className="font-medium text-ink-900 mb-1">Monto de los confirmados</div>
              {qs.confirmedIvaIncl > 0 && <div>{money(qs.confirmedIvaIncl)} <span className="text-ink-600">IVA incluido</span></div>}
              {qs.confirmedPlusIva > 0 && <div>{money(qs.confirmedPlusIva)} <span className="text-ink-600">+ IVA</span></div>}
              {qs.confirmedNoIva > 0 && <div>{money(qs.confirmedNoIva)} <span className="text-ink-600">sin aclarar IVA</span></div>}
              {qs.confirmedNoPrice > 0 && <div className="text-ink-600">{qs.confirmedNoPrice} confirmado(s) sin importe cargado</div>}
              {qs.confirmedIvaIncl + qs.confirmedPlusIva + qs.confirmedNoIva === 0 && qs.confirmedNoPrice === 0 && <div className="text-ink-600">Ninguno confirmado en el período.</div>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SortTh({ k, children, sort, onSort }: { k: SortKey; children: string; sort: { key: SortKey; desc: boolean }; onSort: (k: SortKey) => void }) {
  return (
    <th className={th} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="uppercase hover:text-ink-900" onClick={() => onSort(k)}>{children}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  );
}

function Stat({ label, value, sub, help }: { label: string; value: string; sub: string; help: string }) {
  return (
    <div className="bg-white rounded-xl border border-ink-200 shadow-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">{label}<InfoTip text={help} /></div>
      <div className="mt-1 text-[26px] leading-none font-display font-bold text-ink-900">{value}</div>
      <div className="text-[11px] text-ink-700 mt-1.5">{sub}</div>
    </div>
  );
}

function ClientDetail({ ctx, clientId, onClose }: { ctx: MetricsCtx; clientId: string; onClose: () => void }) {
  const fs = ctx.facts.filter((f) => f.job.clientId === clientId);
  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(ctx.now, i - 11)));
  const counts = months.map((m) => fs.filter((f) => { const d = new Date(f.job.createdAt); return d >= m && d < addMonths(m, 1); }).length);
  const types = new Map<string, number>();
  for (const f of fs) types.set(f.job.jobTypeId, (types.get(f.job.jobTypeId) ?? 0) + 1);
  const all = summarize(fs, { from: new Date(0), to: new Date(ctx.now.getTime() + 86400000) }, ctx.mode);
  return (
    <Card title={`${ctx.clientName(clientId)} — evolución`} subtitle="Toda la historia del cliente en la app, no solo el período."
      actions={<button type="button" onClick={onClose} aria-label="Cerrar detalle del cliente" className="p-1 rounded text-ink-600 hover:bg-ink-100"><X size={16} /></button>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LineChart unit="trabajos" height={170} labels={months.map((m) => format(m, 'MMM yy', { locale: es }))}
            series={[{ key: 'm', label: 'Trabajos ingresados por mes', tone: 'brand', values: counts }]}
            onPick={(i) => ctx.drill({ clientId, dateField: 'created' }, { from: months[i], to: addMonths(months[i], 1) })} pickHint="Click para ver los trabajos de ese mes" />
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><div className="text-xl font-bold text-ink-900">{fs.length}</div><div className="text-[11px] text-ink-700">trabajos en total</div></div>
            <div><div className="text-xl font-bold text-ink-900">{fmtPct(all.onTimeRate.value)}</div><div className="text-[11px] text-ink-700">a tiempo ({all.onTimeRate.n} entregas)</div></div>
            <div><div className="text-xl font-bold text-ink-900">{fmtDays(all.cycleMedian.value, '')}</div><div className="text-[11px] text-ink-700">mediana ingreso→entrega ({ctx.unit})</div></div>
            <div><div className="text-xl font-bold text-ink-900">{fs.filter((f) => f.open).length}</div><div className="text-[11px] text-ink-700">abiertos hoy</div></div>
          </div>
          <div>
            <div className="text-xs font-medium text-ink-800 mb-1">Tipos de trabajo</div>
            <BarList rows={[...types.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ key: t, label: ctx.typeLabel(t), value: n, tone: 'brand' }))} />
          </div>
          <button type="button" onClick={() => ctx.drill({ clientId }, { from: new Date(0), to: new Date(ctx.now.getTime() + 86400000) })} className="text-xs font-medium text-brand-600 hover:underline">Ver todos sus trabajos en el Explorador →</button>
        </div>
      </div>
      <div className="mt-3"><LimitNote>Cantidad de trabajos, no importe ni rentabilidad. Un atraso no indica que el cliente sea "problemático": puede deberse a plazos acordados, cambios pedidos o esperas propias.</LimitNote></div>
    </Card>
  );
}
