import { useMemo } from 'react';
import { stageStats, summarize, groupStats, ageDays, FLOW_STAGES, STAGE_LABEL, STAGE_TONE, MIN_N } from '../../lib/metrics';
import { BLOCK_REASON_LABELS } from '../../data/catalog';
import { PRIORITY_META } from '../../lib/priority';
import type { MetricsCtx } from './context';
import { Card, InfoTip, LimitNote } from './ui';
import { fmtNum, fmtPct, fmtDays } from './fmt';
import { AgingChart, BarList } from './charts';
import { TONE_BG } from './fmt';
import clsx from 'clsx';
import { FlowExtras } from './FlowExtras';

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700';
const td = 'px-3 py-2 text-sm text-ink-900 tabular-nums';

export function ProductionView({ ctx }: { ctx: MetricsCtx }) {
  const { facts, period, mode, unit, drill, now } = ctx;
  const stages = useMemo(() => stageStats(facts, period, mode, now), [facts, period, mode, now]);
  const sum = useMemo(() => summarize(facts, period, mode), [facts, period, mode]);
  const complete = facts.filter((f) => f.historyComplete).length;
  const byType = useMemo(() => groupStats(facts, period, mode, (f) => f.job.jobTypeId).filter((g) => g.delivered > 0 || g.open > 0).sort((a, b) => b.delivered - a.delivered), [facts, period, mode]);
  const byPriority = useMemo(() => groupStats(facts, period, mode, (f) => f.priority), [facts, period, mode]);

  const load = useMemo(() => {
    const open = facts.filter((f) => f.open);
    const ids = [...new Set(open.map((f) => f.job.responsibleUserId))];
    return ids.map((id) => ({ id, total: open.filter((f) => f.job.responsibleUserId === id).length, byStage: FLOW_STAGES.map((s) => open.filter((f) => f.job.responsibleUserId === id && f.stage === s).length) }))
      .sort((a, b) => b.total - a.total);
  }, [facts]);

  const blocks = useMemo(() => {
    const inP = (iso: string) => { const t = new Date(iso).getTime(); return t >= period.from.getTime() && t < period.to.getTime(); };
    const recs = facts.flatMap((f) => f.job.blockRecords.filter((b) => inP(b.openedAt)));
    const reasons = new Map<string, { n: number; durations: number[] }>();
    for (const b of recs) {
      const r = reasons.get(b.reason) ?? { n: 0, durations: [] };
      r.n++;
      if (b.closedAt) r.durations.push((new Date(b.closedAt).getTime() - new Date(b.openedAt).getTime()) / 86400000);
      reasons.set(b.reason, r);
    }
    return { total: recs.length, open: facts.filter((f) => f.job.blockRecords.some((b) => !b.closedAt)).length, reasons: [...reasons.entries()].sort((a, b) => b[1].n - a[1].n) };
  }, [facts, period]);

  const agingCols = FLOW_STAGES.map((s) => ({
    key: s, label: STAGE_LABEL[s].replace('Listo para entregar', 'Listo'),
    dots: facts.filter((f) => f.open && f.stage === s).map((f) => ({ id: f.job.id, value: ageDays(f, mode, now) ?? 0, alert: f.overdueOpen, title: `${f.job.code ?? 'Sin N°'} · ${f.job.name}` })),
  }));
  const refOk = sum.cycleP85.value !== null && sum.cycleP85.n >= MIN_N;
  const maxMedian = Math.max(1, ...stages.map((s) => s.p85 ?? s.median ?? 0));

  return (
    <div className="space-y-4">
      <Card title="Tiempo y flujo por etapa" subtitle={`Pasos por cada etapa que terminaron dentro del período. ${unit === 'días' ? 'Días corridos' : 'Días hábiles (sin feriados)'}; la app no registra horas trabajadas, así que es tiempo de espera + trabajo, no esfuerzo.`}
        actions={<InfoTip text="Se reconstruye con el Historial de cada ficha (cada cambio de estado con su fecha y hora). Solo entran los trabajos cuyo historial reproduce su estado actual sin huecos. Mediana = la mitad de los pasos tardó menos; p85 = el 85% tardó eso o menos. Entraron/salieron: movimientos dentro del período." />}>
        <div className="overflow-x-auto -mx-4">
          <table className="min-w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className={th}>Etapa</th><th className={th}>Hoy</th><th className={th}>Entraron</th><th className={th}>Salieron</th>
                <th className={th}>Mediana</th><th className={th}>p85</th><th className={clsx(th, 'w-[32%]')}>Permanencia (mediana · p85)</th><th className={th}>Casos</th><th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {stages.map((s) => (
                <tr key={s.stage}>
                  <td className={clsx(td, 'font-medium whitespace-nowrap')}>
                    <span className={clsx('inline-block w-2 h-2 rounded-full mr-2', TONE_BG[STAGE_TONE[s.stage]])} aria-hidden="true" />{STAGE_LABEL[s.stage]}
                  </td>
                  <td className={td}><button type="button" className="hover:underline text-brand-600 font-medium" onClick={() => drill({ state: 'open', stage: s.stage })} aria-label={`Ver los ${s.wipNow} trabajos hoy en ${STAGE_LABEL[s.stage]}`}>{s.wipNow}</button></td>
                  <td className={td}>{s.entered}</td>
                  <td className={clsx(td, s.entered - s.exited >= 3 && 'text-urg-text font-semibold')}>{s.exited}</td>
                  <td className={td}>{fmtDays(s.median, '')}</td>
                  <td className={td}>{fmtDays(s.p85, '')}</td>
                  <td className="px-3 py-2">
                    {s.median !== null ? (
                      <div className="relative h-2.5 bg-ink-100 rounded-r-[4px]" title={`Mediana ${fmtNum(s.median, 1)} · p85 ${fmtNum(s.p85, 1)} ${unit}`}>
                        <div className={clsx('absolute inset-y-0 left-0 rounded-r-[4px] opacity-35', TONE_BG[STAGE_TONE[s.stage]])} style={{ width: `${((s.p85 ?? s.median) / maxMedian) * 100}%` }} />
                        <div className={clsx('absolute inset-y-0 left-0 rounded-r-[4px]', TONE_BG[STAGE_TONE[s.stage]])} style={{ width: `${(s.median / maxMedian) * 100}%` }} />
                      </div>
                    ) : <span className="text-xs text-ink-600">Sin pasos terminados</span>}
                  </td>
                  <td className={clsx(td, s.durations.length < MIN_N && s.durations.length > 0 && 'text-urg-text')}>{s.durations.length}</td>
                  <td className="px-3 py-2 text-right">
                    {s.durations.length > 0 && <button type="button" onClick={() => drill({ exitedStage: s.stage })} className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap">Ver casos →</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1.5">
          <LimitNote>Historial completo en {complete} de {facts.length} trabajos ({fmtPct(facts.length ? (complete / facts.length) * 100 : null)}). Los demás no entran en tiempos por etapa. "Casos" en naranja = menos de {MIN_N}: valor poco representativo. Una etapa con mucho tiempo no implica culpa de nadie: incluye esperas del cliente, de proveedores y bloqueos.</LimitNote>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Antigüedad de los trabajos abiertos" subtitle={`Un punto por trabajo, altura = ${unit} desde el alta. Rojo = fecha comprometida vencida. Click para abrir la ficha.`}>
          <AgingChart columns={agingCols} unit={unit} onDot={ctx.openJob}
            refLine={refOk ? sum.cycleP85.value : null} refLabel={`85% de los entregados del período tardó ≤ ${fmtNum(sum.cycleP85.value, 1)}`} />
          {!refOk && <LimitNote>Sin línea de referencia: hacen falta al menos {MIN_N} entregas en el período para calcularla.</LimitNote>}
        </Card>
        <Card title="Bloqueos" subtitle="Abiertos en el período, por motivo.">
          <div className="flex gap-6 mb-3">
            <div><div className="text-2xl font-display font-bold text-ink-900">{blocks.total}</div><div className="text-[11px] text-ink-700">bloqueos en el período</div></div>
            <div><div className="text-2xl font-display font-bold text-crit-text">{blocks.open}</div><div className="text-[11px] text-ink-700">trabajos bloqueados hoy</div></div>
          </div>
          <BarList emptyText="No se registraron bloqueos en el período." rows={blocks.reasons.map(([reason, r]) => ({
            key: reason, label: BLOCK_REASON_LABELS[reason as keyof typeof BLOCK_REASON_LABELS] ?? reason, value: r.n, tone: 'crit',
            sub: r.durations.length ? `mediana ${fmtNum(r.durations.sort((a, b) => a - b)[Math.floor((r.durations.length - 1) / 2)], 1)} d` : 'sin cerrar',
          }))} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Cumplimiento por tipo de trabajo" subtitle="Entregados en el período. Click en una fila para ver sus entregas.">
          <div className="overflow-x-auto -mx-4">
            <table className="min-w-full">
              <thead className="border-b border-ink-200 bg-ink-50"><tr><th className={th}>Tipo</th><th className={th}>Entregados</th><th className={th}>A tiempo</th><th className={th}>Mediana ingreso→entrega</th><th className={th}>Abiertos</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {byType.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-sm text-ink-700">Sin trabajos en el período.</td></tr>}
                {byType.map((g) => (
                  <tr key={g.key} className="hover:bg-ink-50 cursor-pointer" onClick={() => drill({ typeId: g.key, dateField: 'delivered', state: 'delivered' })}>
                    <td className={clsx(td, 'font-medium')}>{ctx.typeLabel(g.key)}</td>
                    <td className={td}>{g.delivered}</td>
                    <td className={clsx(td, g.onTime.n > 0 && g.onTime.n < MIN_N && 'text-ink-600')}>{fmtPct(g.onTime.value)}{g.onTime.n > 0 && g.onTime.n < MIN_N && ' *'}</td>
                    <td className={td}>{fmtDays(g.cycleMedian.value, unit)}</td>
                    <td className={clsx(td, 'whitespace-nowrap')}>{g.open}{g.overdue > 0 && <span className="text-crit-text text-xs"> · {g.overdue} vencidos</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-ink-600 mt-2">* menos de {MIN_N} entregas: poco representativo.</p>
        </Card>
        <Card title="Carga abierta por responsable" subtitle="Trabajos abiertos hoy, por etapa. Es carga asignada, no rendimiento: no mide quién causó una demora.">
          <div className="overflow-x-auto -mx-4">
            <table className="min-w-full">
              <thead className="border-b border-ink-200 bg-ink-50"><tr><th className={th}>Responsable</th>{FLOW_STAGES.map((s) => <th key={s} className={clsx(th, 'normal-case !px-1.5')} title={STAGE_LABEL[s]}>{STAGE_LABEL[s].split(' ')[0]}</th>)}<th className={th}>Total</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {load.map((r) => (
                  <tr key={r.id}>
                    <td className={clsx(td, 'font-medium whitespace-nowrap')}>{ctx.userName(r.id)}</td>
                    {r.byStage.map((n, i) => <td key={i} className={clsx(td, '!px-1.5', n === 0 && 'text-ink-400')}>{n || '·'}</td>)}
                    <td className={td}><button type="button" className="text-brand-600 font-semibold hover:underline" onClick={() => drill({ state: 'open', responsibleId: r.id })}>{r.total}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <div className="text-xs font-medium text-ink-800 mb-1">Entregas a tiempo por prioridad (período)</div>
            <BarList max={100} rows={(['CRITICO', 'URGENTE', 'NORMAL', 'PLANIFICADO', 'EN_ESPERA'] as const).map((p) => {
              const g = byPriority.find((x) => x.key === p);
              return { key: p, label: PRIORITY_META[p].label, value: g?.onTime.value ?? 0, display: fmtPct(g?.onTime.value ?? null), sub: g?.onTime.n ? `${g.onTime.n} entregas` : 'sin entregas', tone: 'plan', onClick: () => drill({ priority: p, dateField: 'delivered', state: 'delivered' }) };
            })} />
            <p className="text-[11px] text-ink-600 mt-1">Prioridad actual de la ficha (si se cambió en el camino, cuenta la última).</p>
          </div>
        </Card>
      </div>

      <FlowExtras ctx={ctx} />
    </div>
  );
}
