import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { revenue, revenueSeries, revenueBy, quoteVsFinal, median } from '../../lib/metrics';
import { useStore } from '../../store/useStore';
import { friendlyError } from '../../lib/errors';
import type { MetricsCtx } from './context';
import type { JobFacts } from '../../lib/metrics';
import { Card, KpiTile, Delta, LimitNote, InfoTip } from './ui';
import { fmtNum, fmtPct } from './fmt';
import { LineChart, BarList } from './charts';

const money = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700';
const td = 'px-3 py-2 text-sm text-ink-900 tabular-nums';

// Facturación (19/10, §74): sale del importe final que se carga a mano en cada
// ficha (job_prices, siempre sin IVA). Se agrupa por fecha de ENTREGA. No es
// factura ni cobro, y no hay rentabilidad porque la app no registra costos.
export function RevenueView({ ctx }: { ctx: MetricsCtx }) {
  const { facts, period, prev, comparable, drill } = ctx;
  const quotes = useStore((s) => s.quotes);
  const priceErr = useStore((s) => s.jobPricesError);
  const cur = useMemo(() => revenue(facts, period), [facts, period]);
  const old = useMemo(() => revenue(facts, prev), [facts, prev]);
  const series = useMemo(() => revenueSeries(facts, period), [facts, period]);
  const byClient = useMemo(() => revenueBy(facts, period, (f) => f.job.clientId), [facts, period]);
  const byType = useMemo(() => revenueBy(facts, period, (f) => f.job.jobTypeId), [facts, period]);
  const qv = useMemo(() => quoteVsFinal(facts, quotes, period), [facts, quotes, period]);
  const missing = useMemo(() => facts.filter((f) => f.deliveredAt && f.price === null && f.deliveredAt >= period.from.toISOString() && f.deliveredAt < period.to.toISOString())
    .sort((a, b) => b.deliveredAt!.localeCompare(a.deliveredAt!)), [facts, period]);
  const partial = cur.coverage !== null && cur.coverage < 80;

  if (priceErr) {
    return <Card><p className="text-sm text-crit-text">No se pudieron leer los importes: {priceErr} Si todavía no corriste la migración 029 en Supabase, corrila y tocá "Actualizar".</p></Card>;
  }

  return (
    <div className="space-y-4">
      {partial && (
        <LimitNote>
          Solo {cur.withPrice} de {cur.delivered} trabajos entregados en el período tienen el importe cargado ({fmtPct(cur.coverage)}). Los totales son parciales:
          sirven para ver tendencias recién cuando la carga sea casi completa. Abajo está la lista para completarlos rápido.
        </LimitNote>
      )}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Importe de lo entregado" value={money(cur.total)} unit="sin IVA"
          delta={<Delta cur={cur.total} prev={old.total} better="higher" comparable={comparable && old.coverage !== null && old.coverage >= 80 && !partial} />}
          help="Suma del importe final (sin IVA) de los trabajos marcados Entregado en el período que tienen importe cargado. No es facturado ni cobrado: es lo que se cargó en cada ficha. Solo se compara con el período anterior si en los dos períodos está cargado al menos el 80%."
          onOpen={() => drill({ dateField: 'delivered', state: 'delivered', price: 'with' })} />
        <KpiTile label="Trabajos con importe" value={`${cur.withPrice} de ${cur.delivered}`} unit={cur.coverage !== null ? `(${fmtPct(cur.coverage)})` : undefined}
          help="Cuántos de los entregados del período tienen el importe final cargado. Mientras falten, todos los totales de esta pestaña quedan cortos."
          onOpen={() => drill({ dateField: 'delivered', state: 'delivered', price: 'without' })} />
        <KpiTile label="Importe promedio por trabajo" value={money(cur.avg)} unit="sin IVA"
          delta={<Delta cur={cur.avg} prev={old.avg} better="neutral" comparable={comparable && old.withPrice >= 5 && cur.withPrice >= 5} />}
          help="Promedio de los importes cargados. Un par de trabajos grandes lo mueven mucho: mirá también la mediana." />
        <KpiTile label="Importe mediano" value={money(cur.median)} unit="sin IVA"
          help="La mitad de los trabajos entregados con importe estuvo por debajo de este valor. Es más estable que el promedio." />
      </div>

      <Card title="Importe entregado en el tiempo" subtitle="Por fecha de entrega, sin IVA. Click en un tramo para ver esos trabajos.">
        <LineChart unit="$" labels={series.map((x) => x.bucket.label)} series={[{ key: 'r', label: 'Importe', tone: 'brand', values: series.map((x) => x.total) }]}
          onPick={(i) => drill({ dateField: 'delivered', state: 'delivered', price: 'with' }, { from: series[i].bucket.start, to: series[i].bucket.end })} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Por cliente" subtitle="Importe de lo entregado en el período y su parte del total.">
          <BarList emptyText="Sin importes cargados en el período." rows={byClient.slice(0, 10).map((r) => ({
            key: r.key, label: ctx.clientName(r.key), value: r.total, display: compactMoney(r.total), tone: 'brand',
            sub: `${fmtPct(cur.total ? (r.total / cur.total) * 100 : null)} · ${r.n} trab.`, onClick: () => drill({ clientId: r.key, dateField: 'delivered', state: 'delivered' }),
          }))} />
          {byClient.length > 0 && <p className="text-[11px] text-ink-600 mt-2">Que un cliente sume mucho no dice si es rentable: no hay costos cargados.</p>}
        </Card>
        <Card title="Por tipo de trabajo" subtitle="Importe de lo entregado e importe mediano por trabajo.">
          <BarList emptyText="Sin importes cargados en el período." rows={byType.map((r) => {
            const med = median(facts.filter((f) => f.job.jobTypeId === r.key && f.price !== null && f.deliveredAt && f.deliveredAt >= period.from.toISOString() && f.deliveredAt < period.to.toISOString()).map((f) => f.price!));
            return { key: r.key, label: ctx.typeLabel(r.key), value: r.total, display: compactMoney(r.total), tone: 'brand', sub: `mediana ${compactMoney(med)}`, onClick: () => drill({ typeId: r.key, dateField: 'delivered', state: 'delivered' }) };
          })} />
        </Card>
      </div>

      <Card title="Presupuesto contra importe final" subtitle="Trabajos entregados en el período que nacieron de un presupuesto. Ambos sin IVA."
        actions={<InfoTip text="Si el presupuesto decía 'IVA incluido', se pasa a sin IVA dividiendo por 1,21. Los presupuestos sin importe o sin aclarar el IVA quedan afuera. Una diferencia puede ser un cambio pedido por el cliente, un ajuste de precio o un error de carga: abrí el trabajo para ver." />}>
        {qv.rows.length === 0 ? <p className="text-sm text-ink-700">Todavía no hay trabajos de presupuestos con los dos importes cargados en el período.{qv.excluded > 0 && ` (${qv.excluded} quedaron afuera por falta de datos del presupuesto.)`}</p> : (
          <>
            <p className="text-sm text-ink-800 mb-2">Diferencia mediana: <b>{fmtNum(median(qv.rows.map((r) => r.diffPct)), 1)}%</b> en {qv.rows.length} trabajo{qv.rows.length > 1 ? 's' : ''}{qv.excluded > 0 && <span className="text-ink-600"> · {qv.excluded} sin datos suficientes</span>}</p>
            <div className="overflow-x-auto -mx-4">
              <table className="min-w-full">
                <thead className="bg-ink-50 border-b border-ink-200"><tr><th className={th}>Trabajo</th><th className={th}>Cliente</th><th className={th}>Presupuesto</th><th className={th}>Final</th><th className={th}>Diferencia</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {qv.rows.sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct)).map((r) => (
                    <tr key={r.facts.job.id}>
                      <td className={td}><Link className="text-brand-600 hover:underline" to={`/trabajos/${r.facts.job.id}`}>{r.facts.job.name}</Link></td>
                      <td className={td}>{ctx.clientName(r.facts.job.clientId)}</td>
                      <td className={td}>{money(r.quoteNet)}</td>
                      <td className={td}>{money(r.finalNet)}</td>
                      <td className={clsx(td, r.diffPct > 0.5 ? 'text-plan-text' : r.diffPct < -0.5 ? 'text-crit-text' : 'text-ink-700')}>{r.diffPct > 0 ? '+' : ''}{fmtNum(r.diffPct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title={`Entregados sin importe (${missing.length})`} subtitle="Completalos acá mismo; también se pueden cargar desde la ficha de cada trabajo (pestaña General).">
        {missing.length === 0 ? <p className="text-sm text-ink-700">Todos los entregados del período tienen importe. 👌</p> : (
          <ul className="divide-y divide-ink-100">
            {missing.slice(0, 25).map((f) => <QuickPrice key={f.job.id} f={f} ctx={ctx} />)}
          </ul>
        )}
        {missing.length > 25 && <button type="button" onClick={() => drill({ dateField: 'delivered', state: 'delivered', price: 'without' })} className="mt-2 text-xs font-medium text-brand-600 hover:underline">Ver los {missing.length} en el Explorador →</button>}
      </Card>

      <LimitNote>
        Qué NO es esto: no es lo facturado (eso está en Copérnico) ni lo cobrado, y no hay rentabilidad ni márgenes porque la app no registra costos (material, horas, tercerizados).
        Los importes se guardan siempre sin IVA; si se cargan con IVA, se descuenta el 21%.
      </LimitNote>
    </div>
  );
}

function compactMoney(x: number | null): string {
  if (x === null) return '—';
  if (x >= 1_000_000) return `$${fmtNum(x / 1_000_000, 1)} M`;
  if (x >= 10_000) return `$${fmtNum(x / 1000, 0)} mil`;
  return `$${fmtNum(x, 0)}`;
}

function QuickPrice({ f, ctx }: { f: JobFacts; ctx: MetricsCtx }) {
  const setJobPrice = useStore((s) => s.setJobPrice);
  const [amount, setAmount] = useState('');
  const [withIva, setWithIva] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = Number(amount.replace(/\./g, '').replace(',', '.'));
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  async function save() {
    if (!valid) return;
    setSaving(true);
    try { await setJobPrice(f.job.id, { enteredAmount: parsed, withIva, note: '' }); } catch (e) { alert(friendlyError(e)); setSaving(false); }
  }
  return (
    <li className="py-2 flex flex-wrap items-center gap-2 text-sm">
      <Link to={`/trabajos/${f.job.id}`} className="text-brand-600 hover:underline font-medium min-w-0 max-w-[260px] truncate">{f.job.code ? `${f.job.code} · ` : ''}{f.job.name}</Link>
      <span className="text-ink-700 text-xs truncate max-w-[180px]">{ctx.clientName(f.job.clientId)}</span>
      <span className="ml-auto inline-flex items-center gap-1.5">
        <span className="text-ink-600">$</span>
        <input aria-label={`Importe de ${f.job.name}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="w-28 text-sm border border-ink-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <label className="text-xs text-ink-700 inline-flex items-center gap-1"><input type="checkbox" checked={withIva} onChange={(e) => setWithIva(e.target.checked)} /> con IVA</label>
        <button type="button" disabled={!valid || saving} onClick={save} className="text-xs px-2.5 py-1 rounded-lg bg-brand-500 text-white font-medium disabled:opacity-40">{saving ? '…' : 'Guardar'}</button>
      </span>
    </li>
  );
}
