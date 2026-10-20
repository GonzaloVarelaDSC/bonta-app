import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Target, Archive } from 'lucide-react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { goalMetricValue, buckets, GOAL_METRICS, MIN_N, type Period } from '../../lib/metrics';
import { useStore } from '../../store/useStore';
import { friendlyError } from '../../lib/errors';
import type { MetricGoal } from '../../types';
import type { MetricsCtx } from './context';
import { Card, LimitNote, Empty } from './ui';
import { fmtNum } from './fmt';
import { LineChart } from './charts';

const input = 'w-full text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
/** Fechas de los objetivos: día completo, `to` exclusivo. */
const dayRange = (from: string, to: string): Period => ({ from: parseISO(from), to: addDays(parseISO(to), 1) });
const metricDef = (key: string) => GOAL_METRICS.find((m) => m.key === key);
const fmtVal = (v: number | null, unit: string) => (v === null ? '—' : unit === '%' ? `${Math.round(v)}%` : `${fmtNum(v, 1)} ${unit}`);

export function GoalsView({ ctx }: { ctx: MetricsCtx }) {
  const goals = useStore((s) => s.goals);
  const archiveGoal = useStore((s) => s.archiveGoal);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const list = goals.filter((g) => showArchived || !g.archivedAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-700 max-w-2xl">
          Primero se mide la situación real (línea de base) y recién después se fija una meta. La línea de base queda guardada tal como se midió;
          el valor actual se recalcula siempre con la misma definición. No hay metas cargadas de antemano.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-ink-700 inline-flex items-center gap-1.5"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Ver archivados</label>
          {!creating && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"><Plus size={15} /> Nuevo objetivo</button>}
        </div>
      </div>
      {creating && <GoalForm ctx={ctx} onDone={() => setCreating(false)} />}
      {list.length === 0 && !creating && <Card><Empty><Target className="mx-auto mb-2 text-ink-400" size={28} />Todavía no hay objetivos. Mirá primero el Resumen y Producción, y cuando algo valga la pena mejorar, creá uno desde acá.</Empty></Card>}
      {list.map((g) => <GoalCard key={g.id} ctx={ctx} goal={g} onArchive={async () => { try { await archiveGoal(g.id); } catch (e) { alert(friendlyError(e)); } }} />)}
    </div>
  );
}

function GoalCard({ ctx, goal, onArchive }: { ctx: MetricsCtx; goal: MetricGoal; onArchive: () => void }) {
  const def = metricDef(goal.metricKey);
  const unit = def?.unit === 'días' ? ctx.unit : def?.unit ?? '';
  const today = ctx.now;
  const evalEnd = addDays(parseISO(goal.endDate), 1);
  const p: Period = { from: parseISO(goal.startDate), to: evalEnd < today ? evalEnd : addDays(new Date(today.toDateString()), 1) };
  const started = parseISO(goal.startDate) <= today;
  const cur = useMemo(() => started ? goalMetricValue(goal.metricKey, ctx.facts, p, ctx.mode) : { value: null, n: 0 }, [goal, ctx, started]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = useMemo(() => started ? buckets(p).map((b) => ({ label: b.label, s: goalMetricValue(goal.metricKey, ctx.facts, { from: b.start, to: b.end }, ctx.mode) })) : [], [goal, ctx, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ¿Cambió la mezcla de tipos de trabajo respecto de la línea de base? (distancia de variación total)
  const mixShift = useMemo(() => {
    const share = (per: Period) => {
      const fs = ctx.facts.filter((f) => { const t = new Date(f.job.createdAt).getTime(); return t >= per.from.getTime() && t < per.to.getTime(); });
      const m = new Map<string, number>(); fs.forEach((f) => m.set(f.job.jobTypeId, (m.get(f.job.jobTypeId) ?? 0) + 1));
      return { m, n: fs.length };
    };
    const a = share(dayRange(goal.baselineFrom, goal.baselineTo)); const b = share(p);
    if (a.n < MIN_N || b.n < MIN_N) return null;
    const keys = new Set([...a.m.keys(), ...b.m.keys()]);
    let tv = 0; keys.forEach((k) => { tv += Math.abs((a.m.get(k) ?? 0) / a.n - (b.m.get(k) ?? 0) / b.n); });
    return tv / 2;
  }, [goal, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const better = def?.better ?? 'higher';
  const reached = cur.value !== null && (better === 'higher' ? cur.value >= goal.targetValue : cur.value <= goal.targetValue);
  const ended = evalEnd <= today;
  let status: { txt: string; cls: string };
  if (!started) status = { txt: 'Todavía no empezó', cls: 'bg-ink-50 text-ink-700 border-ink-200' };
  else if (cur.n < MIN_N) status = { txt: `Datos insuficientes (${cur.n} casos)`, cls: 'bg-ink-50 text-ink-700 border-ink-200' };
  else if (ended) status = reached ? { txt: 'Cumplido', cls: 'bg-plan-bg text-plan-text border-plan/30' } : { txt: 'No cumplido', cls: 'bg-crit-bg text-crit-text border-crit/30' };
  else status = reached ? { txt: 'En camino: ya alcanza la meta', cls: 'bg-plan-bg text-plan-text border-plan/30' } : { txt: 'En curso', cls: 'bg-info-bg text-info-text border-info/30' };

  // Avance de la línea de base a la meta (0–100), solo si hay datos.
  const progress = goal.baselineValue !== null && cur.value !== null && goal.targetValue !== goal.baselineValue
    ? Math.max(0, Math.min(100, ((cur.value - goal.baselineValue) / (goal.targetValue - goal.baselineValue)) * 100)) : null;

  return (
    <Card title={goal.title} subtitle={<>{def?.label ?? goal.metricKey} · {format(parseISO(goal.startDate), 'dd/MM/yy')} al {format(parseISO(goal.endDate), 'dd/MM/yy')} · Responsable: {ctx.userName(goal.ownerUserId)}</>}
      actions={<div className="flex items-center gap-2">
        <span className={clsx('text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap', status.cls)}>{status.txt}</span>
        {!goal.archivedAt && <button type="button" onClick={onArchive} title="Archivar (no se borra)" aria-label="Archivar objetivo" className="p-1 rounded text-ink-600 hover:bg-ink-100"><Archive size={15} /></button>}
      </div>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-ink-50 py-2"><div className="text-[11px] text-ink-700">Línea de base</div><div className="text-lg font-bold text-ink-900">{fmtVal(goal.baselineValue, unit)}</div><div className="text-[10px] text-ink-600">{goal.baselineN} casos</div></div>
            <div className="rounded-lg bg-ink-50 py-2"><div className="text-[11px] text-ink-700">Actual</div><div className="text-lg font-bold text-ink-900">{fmtVal(cur.value, unit)}</div><div className="text-[10px] text-ink-600">{cur.n} casos</div></div>
            <div className="rounded-lg bg-brand-100 py-2"><div className="text-[11px] text-brand-700">Meta</div><div className="text-lg font-bold text-brand-700">{fmtVal(goal.targetValue, unit)}</div><div className="text-[10px] text-brand-700">{better === 'higher' ? 'o más' : 'o menos'}</div></div>
          </div>
          {progress !== null && (
            <div>
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-plan rounded-full" style={{ width: `${progress}%` }} /></div>
              <div className="text-[11px] text-ink-700 mt-1">{Math.round(progress)}% del camino entre la línea de base y la meta</div>
            </div>
          )}
          <div className="text-[11px] text-ink-700">Línea de base medida del {format(parseISO(goal.baselineFrom), 'dd/MM/yy')} al {format(parseISO(goal.baselineTo), 'dd/MM/yy')}.</div>
          {goal.notes && <div className="text-xs text-ink-800 bg-ink-50 rounded-lg px-2.5 py-2"><b>Qué se cambia:</b> {goal.notes}</div>}
        </div>
        <div className="lg:col-span-2">
          {series.length > 1 ? (
            <LineChart unit={unit} height={170} labels={series.map((x) => x.label)} series={[{ key: 'v', label: def?.label ?? '', tone: 'info', values: series.map((x) => x.s.n >= 1 ? x.s.value : null) }]} />
          ) : <Empty>La evolución aparece cuando el objetivo lleve al menos dos semanas.</Empty>}
          <div className="mt-2 space-y-1.5">
            {mixShift !== null && mixShift > 0.25 && <LimitNote>Cambió bastante la mezcla de tipos de trabajo respecto de la línea de base ({Math.round(mixShift * 100)}% de diferencia): la comparación puede no ser pareja.</LimitNote>}
            <LimitNote>Cada punto es el valor de esa semana/mes con sus propios casos; con pocos casos un punto puede saltar mucho sin que haya un cambio real.</LimitNote>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GoalForm({ ctx, onDone }: { ctx: MetricsCtx; onDone: () => void }) {
  const saveGoal = useStore((s) => s.saveGoal);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUser);
  const today = new Date(ctx.now.toDateString());
  const [f, setF] = useState({
    title: '', metricKey: GOAL_METRICS[0].key,
    baselineFrom: ymd(subDays(today, 90)), baselineTo: ymd(subDays(today, 1)),
    target: '', startDate: ymd(today), endDate: ymd(addDays(today, 90)), ownerUserId: me?.id ?? '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const def = metricDef(f.metricKey)!;
  const unit = def.unit === 'días' ? ctx.unit : def.unit;
  const baseline = useMemo(() => goalMetricValue(f.metricKey, ctx.facts, dayRange(f.baselineFrom, f.baselineTo), ctx.mode), [f.metricKey, f.baselineFrom, f.baselineTo, ctx]);
  const target = Number(f.target.replace(',', '.'));
  const valid = f.title.trim() && f.target.trim() && Number.isFinite(target) && f.baselineFrom <= f.baselineTo && f.startDate <= f.endDate;

  async function save() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      await saveGoal({
        title: f.title.trim(), metricKey: f.metricKey, baselineFrom: f.baselineFrom, baselineTo: f.baselineTo,
        baselineValue: baseline.value, baselineN: baseline.n, targetValue: target,
        startDate: f.startDate, endDate: f.endDate, ownerUserId: f.ownerUserId || null, notes: f.notes.trim(),
      });
      onDone();
    } catch (e) { setErr(friendlyError(e)); } finally { setSaving(false); }
  }

  return (
    <Card title="Nuevo objetivo" subtitle="La meta la decide el equipo mirando la línea de base; la app no sugiere valores.">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-ink-800 md:col-span-2">Nombre del objetivo
          <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: Entregar más trabajos en fecha" />
        </label>
        <label className="text-xs font-medium text-ink-800">Indicador
          <select className={input} value={f.metricKey} onChange={(e) => setF({ ...f, metricKey: e.target.value })}>
            {GOAL_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.better === 'higher' ? 'más es mejor' : 'menos es mejor'})</option>)}
          </select>
        </label>
        <div className="text-xs font-medium text-ink-800">Línea de base (período medido)
          <div className="flex gap-2">
            <input type="date" aria-label="Línea de base desde" className={input} value={f.baselineFrom} onChange={(e) => setF({ ...f, baselineFrom: e.target.value })} />
            <input type="date" aria-label="Línea de base hasta" className={input} value={f.baselineTo} onChange={(e) => setF({ ...f, baselineTo: e.target.value })} />
          </div>
        </div>
        <div className="md:col-span-2 rounded-lg bg-ink-50 border border-ink-200 px-3 py-2 text-sm">
          Línea de base medida: <b>{fmtVal(baseline.value, unit)}</b> <span className="text-ink-700">({baseline.n} casos)</span>
          {baseline.n < MIN_N && <span className="block text-xs text-urg-text mt-0.5">Menos de {MIN_N} casos: conviene un período más largo antes de fijar una meta.</span>}
        </div>
        <label className="text-xs font-medium text-ink-800">Meta ({unit})
          <input className={input} inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder={def.better === 'higher' ? 'Valor a alcanzar o superar' : 'Valor a no superar'} />
        </label>
        <label className="text-xs font-medium text-ink-800">Responsable del seguimiento
          <select className={input} value={f.ownerUserId} onChange={(e) => setF({ ...f, ownerUserId: e.target.value })}>
            <option value="">—</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="text-xs font-medium text-ink-800">Período de evaluación
          <div className="flex gap-2">
            <input type="date" aria-label="Evaluación desde" className={input} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            <input type="date" aria-label="Evaluación hasta" className={input} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </div>
        </div>
        <label className="text-xs font-medium text-ink-800">Qué se va a cambiar para lograrlo
          <input className={input} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej.: revisar plazos con el cliente antes de confirmar" />
        </label>
      </div>
      {err && <p className="text-sm text-crit-text mt-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={onDone} className="text-sm px-3 py-1.5 rounded-lg border border-ink-200 hover:bg-ink-50">Cancelar</button>
        <button type="button" disabled={!valid || saving} onClick={save} className="text-sm px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar objetivo'}</button>
      </div>
    </Card>
  );
}
