import { useMemo } from 'react';
import clsx from 'clsx';
import { factorStats, reworkStats, rescheduleStats, MIN_N } from '../../lib/metrics';
import type { MetricsCtx } from './context';
import { Card, InfoTip, LimitNote } from './ui';
import { fmtPct, fmtDays } from './fmt';
import { BarList } from './charts';

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700';
const td = 'px-3 py-2 text-sm text-ink-900 tabular-nums';

// Análisis agregados el 19/10 (§74) con datos que la app ya registraba y no se
// miraban: instalación, muestra, tercerizados, plazo dado, reprogramaciones y
// vueltas para atrás en el flujo.
export function FlowExtras({ ctx }: { ctx: MetricsCtx }) {
  const { facts, period, mode, unit, drill } = ctx;
  const factors = useMemo(() => factorStats(facts, period, mode), [facts, period, mode]);
  const rework = useMemo(() => reworkStats(facts, period), [facts, period]);
  const resched = useMemo(() => rescheduleStats(facts, period), [facts, period]);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2" title="Qué características acompañan a los atrasos" subtitle="Entregados del período, partidos por datos que ya se cargan. Click en una fila para ver los trabajos."
        actions={<InfoTip text="Es una comparación, no una explicación: si los trabajos con instalación se atrasan más, puede ser por la instalación o por otra cosa que tengan en común (más grandes, otros clientes). 'Plazo dado' = días entre el alta y la fecha comprometida. 'A tiempo' se mide contra la fecha comprometida actual: si se reprogramó, cuenta la última." />}>
        <div className="overflow-x-auto -mx-4">
          <table className="min-w-full">
            <thead className="bg-ink-50 border-b border-ink-200"><tr><th className={th}>Característica</th><th className={th}>Grupo</th><th className={th}>Entregados</th><th className={th}>A tiempo</th><th className={th}>Mediana ingreso→entrega</th></tr></thead>
            <tbody>
              {factors.map((r, i) => {
                const first = i === 0 || factors[i - 1].factor !== r.factor;
                const few = r.n > 0 && r.n < MIN_N;
                return (
                  <tr key={r.factor + r.label} className={clsx('hover:bg-ink-50 cursor-pointer', first && 'border-t border-ink-200')} onClick={() => drill(r.drill)}>
                    <td className={clsx(td, 'text-ink-700 text-xs')}>{first ? r.factor : ''}</td>
                    <td className={clsx(td, 'font-medium')}>{r.label}</td>
                    <td className={td}>{r.n}</td>
                    <td className={clsx(td, few && 'text-ink-600')}>{fmtPct(r.onTime)}{few && ' *'}</td>
                    <td className={clsx(td, few && 'text-ink-600')}>{fmtDays(r.cycleMedian, unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink-600 mt-2">* menos de {MIN_N} entregas en el grupo: no alcanza para comparar.</p>
      </Card>

      <div className="space-y-4">
        <Card title="Vueltas para atrás" subtitle="Trabajos que retrocedieron de etapa en el período (ej. Control de calidad → Producción). Es un indicio de retrabajo, no la prueba."
          actions={<InfoTip text="Sale del Historial: cada vez que un trabajo pasó a una etapa anterior del flujo. Puede ser un retrabajo real, una corrección de un estado mal puesto o un cambio pedido por el cliente. La app no registra el motivo." />}>
          <div className="flex gap-6 mb-2">
            <div><div className="text-2xl font-display font-bold text-ink-900">{rework.moves}</div><div className="text-[11px] text-ink-700">vueltas en {rework.jobs} trabajos</div></div>
            <div><div className="text-2xl font-display font-bold text-ink-900">{fmtPct(rework.delivered ? (rework.deliveredWithRework / rework.delivered) * 100 : null)}</div><div className="text-[11px] text-ink-700">de los entregados tuvo alguna</div></div>
          </div>
          <BarList emptyText="Ningún trabajo volvió para atrás en el período." rows={rework.byPath.slice(0, 6).map((r) => ({ key: r.path, label: r.path, value: r.n, tone: 'urg' }))} />
          {rework.moves > 0 && <button type="button" onClick={() => drill({ rework: 'yes' })} className="mt-2 text-xs font-medium text-brand-600 hover:underline">Ver trabajos con vueltas →</button>}
        </Card>
        <Card title="Reprogramaciones de fecha" subtitle="Cambios de la fecha comprometida después de cargar la ficha.">
          <div className="flex gap-6">
            <div><div className="text-2xl font-display font-bold text-ink-900">{resched.events}</div><div className="text-[11px] text-ink-700">cambios en {resched.jobs} trabajos</div></div>
            <div><div className="text-2xl font-display font-bold text-ink-900">{fmtPct(resched.delivered ? (resched.deliveredRescheduled / resched.delivered) * 100 : null)}</div><div className="text-[11px] text-ink-700">de los entregados se reprogramó</div></div>
          </div>
          {resched.jobs > 0 && <button type="button" onClick={() => drill({ rescheduled: 'yes' })} className="mt-2 text-xs font-medium text-brand-600 hover:underline">Ver trabajos reprogramados →</button>}
          <div className="mt-2"><LimitNote>El Historial no guarda la fecha anterior, solo que se cambió: no se puede medir cuántos días se corrió.</LimitNote></div>
        </Card>
      </div>
    </div>
  );
}
