import { useMemo } from 'react';
import clsx from 'clsx';
import { AlertTriangle, TrendingUp, Database, ArrowRight } from 'lucide-react';
import { summarize, snapshot, flowSeries, findings, FLOW_STAGES, STAGE_LABEL, STAGE_TONE, MIN_N } from '../../lib/metrics';
import type { MetricsCtx } from './context';
import { Card, KpiTile, Delta, LimitNote } from './ui';
import { fmtNum, fmtPct, fmtDays } from './fmt';
import { LineChart, BarList } from './charts';

export function SummaryView({ ctx }: { ctx: MetricsCtx }) {
  const { facts, period, prev, mode, unit, comparable, drill } = ctx;
  const cur = useMemo(() => summarize(facts, period, mode), [facts, period, mode]);
  const old = useMemo(() => summarize(facts, prev, mode), [facts, prev, mode]);
  const snap = useMemo(() => snapshot(facts, mode, ctx.now), [facts, mode, ctx.now]);
  const flow = useMemo(() => flowSeries(facts, period), [facts, period]);
  const found = useMemo(() => findings(facts, period, mode, ctx.typeLabel, ctx.clientName, comparable, ctx.now), [facts, period, mode, ctx, comparable]);
  const bucketWord = flow.points.length && (flow.points[0].bucket.end.getTime() - flow.points[0].bucket.start.getTime()) > 8 * 86400000 ? 'mes' : 'semana';

  const lowN = (n: number) => n > 0 && n < MIN_N ? <span className="text-urg-text">Pocos casos ({n}): tomalo con cuidado.</span> : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Trabajos ingresados" value={fmtNum(cur.created)} unit="OTs"
          delta={<Delta cur={cur.created} prev={old.created} better="neutral" comparable={comparable} />}
          help="Fichas creadas en la app dentro del período (fecha de alta). Cuenta trabajos únicos, no productos ni unidades. Excluye eliminados."
          onOpen={() => drill({ dateField: 'created' })} />
        <KpiTile label="Trabajos entregados" value={fmtNum(cur.delivered)} unit="OTs"
          delta={<Delta cur={cur.delivered} prev={old.delivered} better="higher" comparable={comparable} />}
          help="Trabajos marcados como Entregado con fecha de entrega dentro del período. Es la fecha en que alguien lo marcó en la app: si se marca días después, se corre."
          onOpen={() => drill({ dateField: 'delivered', state: 'delivered' })} />
        <KpiTile label="Entregas a tiempo" value={fmtPct(cur.onTimeRate.value)} unit={cur.onTimeRate.n ? `de ${cur.onTimeRate.n}` : undefined}
          delta={<Delta cur={cur.onTimeRate.value} prev={old.onTimeRate.value} better="higher" kind="pp" comparable={comparable} />}
          note={lowN(cur.onTimeRate.n)}
          help="De los entregados en el período: cuántos se marcaron Entregado el mismo día de la fecha comprometida o antes. Denominador: entregados del período. Los cancelados no cuentan."
          onOpen={() => drill({ dateField: 'delivered', state: 'delivered', deadline: 'late' })} />
        <KpiTile label="Ingreso → entrega (mediana)" value={fmtNum(cur.cycleMedian.value, 1)} unit={unit}
          delta={<Delta cur={cur.cycleMedian.value} prev={old.cycleMedian.value} better="lower" kind="abs" unit={unit} comparable={comparable} />}
          note={cur.cycleP85.value !== null ? <>85% tardó {fmtDays(cur.cycleP85.value, unit)} o menos{lowN(cur.cycleMedian.n) && <> · {lowN(cur.cycleMedian.n)}</>}</> : null}
          help={`Tiempo de ciclo: desde que se creó la ficha hasta que se marcó Entregado, para los entregados del período. Mediana = la mitad tardó menos. ${mode === 'business' ? 'Días hábiles: sin sábados ni domingos (no descuenta feriados).' : 'Días corridos.'}`}
          onOpen={() => drill({ dateField: 'delivered', state: 'delivered' })} />
        <KpiTile label="Abiertos hoy" value={fmtNum(snap.open)} unit="OTs"
          note={snap.ageMedian.value !== null ? `Antigüedad mediana: ${fmtDays(snap.ageMedian.value, unit)}` : null}
          help="Trabajos que no están Entregados ni Cancelados, hoy (no depende del período). Antigüedad = desde la fecha de alta; no se mezcla con el tiempo de ciclo de los ya entregados."
          onOpen={() => drill({ state: 'open' })} />
        <KpiTile label="Atrasados hoy" value={fmtNum(snap.overdue)} unit="OTs" emphasis={snap.overdue ? 'crit' : undefined}
          note={snap.overdue ? `${snap.overdueNotReady} sin terminar · ${snap.overdueReady} listos sin entregar` : null}
          help="Abiertos cuya fecha comprometida ya pasó (mismo criterio que el Dashboard). Se separan los que todavía no llegaron a Listo de los que ya están listos esperando entrega o instalación."
          onOpen={() => drill({ state: 'open', deadline: 'overdue_open' })} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={`Ingresos y entregas por ${bucketWord}`} subtitle="Trabajos únicos. Si las entregas quedan por debajo de los ingresos varias semanas seguidas, se acumula trabajo.">
          <LineChart unit="OTs" labels={flow.points.map((p) => p.bucket.label)}
            series={[
              { key: 'c', label: 'Ingresados', tone: 'brand', values: flow.points.map((p) => p.created) },
              { key: 'd', label: 'Entregados', tone: 'info', values: flow.points.map((p) => p.delivered) },
            ]}
            onPick={(i) => { const b = flow.points[i].bucket; drill({ dateField: 'created' }, { from: b.start, to: b.end }); }}
            pickHint="Click para ver los ingresados de ese tramo" />
        </Card>
        <Card title="Trabajos abiertos" subtitle={`Al cierre de cada ${bucketWord}`}>
          <LineChart unit="abiertos" labels={flow.points.map((p) => p.bucket.label)} series={[{ key: 'w', label: 'Abiertos', tone: 'ink', values: flow.points.map((p) => p.wip) }]} height={180} />
          {flow.wipExcluded > 0 && <div className="mt-2"><LimitNote>{flow.wipExcluded} cancelado{flow.wipExcluded > 1 ? 's' : ''} sin fecha de cancelación en el historial no se pueden ubicar en el tiempo y no cuentan acá.</LimitNote></div>}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Dónde están hoy los abiertos" subtitle="Por etapa del Kanban. Click para ver los trabajos.">
          <BarList rows={FLOW_STAGES.map((s) => {
            const n = facts.filter((f) => f.open && f.stage === s).length;
            return { key: s, label: STAGE_LABEL[s], value: n, tone: STAGE_TONE[s], onClick: () => drill({ state: 'open', stage: s }) };
          })} />
        </Card>
        <Card className="xl:col-span-2" title="Hallazgos del período" subtitle="Reglas simples con un mínimo de casos. Señalan dónde mirar; no explican la causa.">
          {found.length === 0 ? (
            <p className="text-sm text-ink-700 py-3">No aparece nada fuera de lo común con los datos de este período{!comparable && ' (y no hay período anterior completo para comparar)'}.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {found.map((h) => {
                const Icon = h.kind === 'mejora' ? TrendingUp : h.kind === 'datos' ? Database : AlertTriangle;
                return (
                  <li key={h.id} className="py-2.5 flex gap-3">
                    <span className={clsx('mt-0.5 w-6 h-6 shrink-0 rounded-md inline-flex items-center justify-center',
                      h.kind === 'mejora' ? 'bg-plan-bg text-plan-text' : h.kind === 'datos' ? 'bg-ink-100 text-ink-700' : 'bg-urg-bg text-urg-text')}>
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900">{h.title}</div>
                      <div className="text-xs text-ink-700 mt-0.5">{h.evidence} <span className="text-ink-600">Comparación: {h.comparison}</span></div>
                      <div className="text-[11px] text-ink-600 mt-0.5">Ojo: {h.limitation}</div>
                    </div>
                    <button type="button" onClick={() => drill(h.drill)} className="self-start shrink-0 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
                      Investigar <ArrowRight size={12} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
