// Métricas (19/10, CLAUDE.md §73) — ÚNICO lugar donde se calcula cada indicador.
// Lógica pura: recibe trabajos + eventos de historial y devuelve hechos por
// trabajo y agregados. Ningún componente debe recalcular un KPI por su cuenta:
// si un número aparece en dos pantallas, sale de la misma función de acá.
//
// Reglas de confiabilidad (no negociables):
// - Nunca se inventan fechas. Si un dato no existe, el trabajo queda fuera de ese
//   indicador y se informa cuántos quedaron afuera.
// - Los tiempos por etapa salen SOLO de la cronología real del Historial
//   (activity_log). Un trabajo cuyo historial no reproduce su estado actual
//   ("historial incompleto") no se usa para tiempos por etapa.
// - "Entregado" = marcado como Entregado en la app (jobs.finished_at). No es lo
//   mismo que "producción terminada" (primera llegada a Listo para entregar).
import { differenceInCalendarDays, startOfWeek, startOfMonth, addWeeks, addMonths, startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Job, JobStatus, Priority, Quote } from '../types';
import { KANBAN_COLUMNS } from '../data/catalog';
import { isOverdue } from './selectors';
import { effectivePriority } from './priority';

// ---------------------------------------------------------------- tipos base

export type StageKey = 'pendiente' | 'diseno' | 'produccion' | 'control_calidad' | 'listo' | 'instalacion' | 'terminado' | 'cancelado';
export const FLOW_STAGES: StageKey[] = ['pendiente', 'diseno', 'produccion', 'control_calidad', 'listo', 'instalacion'];
export const STAGE_LABEL: Record<StageKey, string> = {
  ...Object.fromEntries(KANBAN_COLUMNS.map((c) => [c.key, c.label])) as Record<string, string>,
  cancelado: 'Cancelado',
} as Record<StageKey, string>;
export const STAGE_TONE: Record<StageKey, string> = {
  ...Object.fromEntries(KANBAN_COLUMNS.map((c) => [c.key, c.tone])) as Record<string, string>,
  cancelado: 'crit',
} as Record<StageKey, string>;

/** Fila de activity_log relevante para la cronología (crear / estado / instalación completada). */
export interface StatusEvent {
  id: string;
  jobId: string;
  userId: string;
  action: string;
  detail: string;
  from: string | null;
  to: string | null;
  at: string;
}

export type DaysMode = 'calendar' | 'business';

export interface Period { from: Date; to: Date } // `to` exclusivo

const DAY_MS = 86400000;

/** Columna del Kanban de un estado. Estados viejos (NUEVO/APROBADO) caen en Pendiente; BLOQUEADO viejo no es etapa → null. */
export function stageOf(status: string | null | undefined): StageKey | null {
  if (!status) return null;
  if (status === 'CANCELADO') return 'cancelado';
  if (status === 'NUEVO' || status === 'APROBADO') return 'pendiente';
  const col = KANBAN_COLUMNS.find((c) => c.statuses.includes(status as JobStatus));
  return (col?.key as StageKey) ?? null;
}

/** Estado destino de un evento. Antes de la migración 025 no había `to_status`: sale del texto "Cambió el estado a X.". */
export function eventTarget(e: StatusEvent): string | null {
  if (e.action === 'instalacion') return 'TERMINADO'; // completeInstallation pasa a Entregado sin evento 'estado'
  if (e.action !== 'estado') return null;
  if (e.to) return e.to;
  const m = /Cambió el estado a ([A-Z_]+)\./.exec(e.detail);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- utilidades numéricas

export function median(xs: number[]): number | null { return percentile(xs, 50); }
/** Percentil con interpolación lineal (mismo método que Excel PERCENTIL.INC). */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
export function mean(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

/** Días entre dos instantes. "business" descuenta sábados y domingos (no conoce feriados ni horarios). */
export function durationDays(startIso: string, endIso: string, mode: DaysMode): number {
  const a = new Date(startIso).getTime(); const b = new Date(endIso).getTime();
  if (b <= a) return 0;
  if (mode === 'calendar') return (b - a) / DAY_MS;
  let total = 0;
  let cur = a;
  while (cur < b) {
    const d = new Date(cur);
    const next = Math.min(b, startOfDay(new Date(cur + DAY_MS)).getTime());
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) total += next - cur;
    cur = next;
  }
  return total / DAY_MS;
}

const inP = (iso: string | undefined | null, p: Period) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= p.from.getTime() && t < p.to.getTime();
};

export function previousPeriod(p: Period): Period {
  const len = p.to.getTime() - p.from.getTime();
  return { from: new Date(p.from.getTime() - len), to: new Date(p.from) };
}

// ---------------------------------------------------------------- cronología por trabajo

export interface Segment { stage: StageKey; start: string; end: string | null }

export interface JobFacts {
  job: Job;
  stage: StageKey | null; // etapa actual (columna del Kanban)
  priority: Priority;
  segments: Segment[];
  /** El historial reproduce el estado actual sin huecos → sirve para tiempos por etapa. */
  historyComplete: boolean;
  deliveredAt: string | null; // jobs.finished_at con estado Entregado
  cancelledAt: string | null; // del historial; null si el historial no lo registra
  firstReadyAt: string | null; // primera llegada a Listo/Instalación/Entregado (del historial)
  open: boolean;
  overdueOpen: boolean; // mismo criterio que el Dashboard (isOverdue)
  price: number | null; // importe final sin IVA (job_prices), null = no cargado
  reschedules: string[]; // fechas en que se cambió la fecha comprometida (evento 'fecha')
  responsibleChanges: number;
  /** Pasos para atrás en el flujo (ej. Control de calidad → Producción): indicio de retrabajo. */
  backMoves: { from: StageKey; to: StageKey; at: string }[];
  leadDays: number; // días corridos entre el alta y la fecha comprometida (plazo que se dio)
}

const STAGE_ORDER: Record<string, number> = { pendiente: 0, diseno: 1, produccion: 2, control_calidad: 3, listo: 4, instalacion: 5, terminado: 6 };

export function buildFacts(jobs: Job[], events: StatusEvent[], prices: Record<string, { amountNet: number }> = {}): JobFacts[] {
  const byJob = new Map<string, StatusEvent[]>();
  for (const e of events) {
    const arr = byJob.get(e.jobId);
    if (arr) arr.push(e); else byJob.set(e.jobId, [e]);
  }
  return jobs.filter((j) => !j.deletedAt).map((job) => {
    const evs = (byJob.get(job.id) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const segments: Segment[] = [{ stage: 'pendiente', start: job.createdAt, end: null }];
    let consistent = true;
    for (const e of evs) {
      const target = eventTarget(e);
      if (!target) continue;
      const cur = segments[segments.length - 1];
      if (e.from) {
        const fromStage = stageOf(e.from);
        if (fromStage && fromStage !== cur.stage) consistent = false; // falta un paso en el historial
      }
      const next = stageOf(target);
      if (!next) { consistent = false; continue; } // estado viejo sin etapa (BLOQUEADO)
      if (next === cur.stage) continue; // cambio dentro de la misma columna (ej. En diseño → Diseño listo)
      const at = e.at < cur.start ? cur.start : e.at;
      cur.end = at;
      segments.push({ stage: next, start: at, end: null });
    }
    const stage = stageOf(job.status);
    const last = segments[segments.length - 1];
    const historyComplete = consistent && last.stage === stage;
    const firstReady = segments.find((s) => s.stage === 'listo' || s.stage === 'instalacion' || s.stage === 'terminado');
    const cancelledAt = job.status === 'CANCELADO' && last.stage === 'cancelado' ? last.start : null;
    const deliveredAt = job.status === 'TERMINADO' && job.finishedAt ? job.finishedAt : null;
    const open = job.status !== 'TERMINADO' && job.status !== 'CANCELADO';
    const backMoves = segments.slice(1).flatMap((sg, i) => {
      const prevSt = segments[i].stage;
      return sg.stage !== 'cancelado' && prevSt !== 'cancelado' && STAGE_ORDER[sg.stage] < STAGE_ORDER[prevSt] ? [{ from: prevSt, to: sg.stage, at: sg.start }] : [];
    });
    return {
      price: prices[job.id]?.amountNet ?? null,
      reschedules: evs.filter((e) => e.action === 'fecha').map((e) => e.at),
      responsibleChanges: evs.filter((e) => e.action === 'responsable').length,
      backMoves,
      leadDays: differenceInCalendarDays(new Date(job.committedDate), new Date(job.createdAt)),
      job, stage, priority: effectivePriority(job), segments, historyComplete,
      deliveredAt, cancelledAt, firstReadyAt: firstReady?.start ?? null, open,
      overdueOpen: isOverdue(job),
    };
  });
}

/** Días de atraso de la entrega respecto de la fecha comprometida (≤ 0 = a tiempo). Comparación por día calendario. */
export function deliveryLateDays(f: JobFacts): number | null {
  if (!f.deliveredAt) return null;
  return differenceInCalendarDays(new Date(f.deliveredAt), new Date(f.job.committedDate));
}
export function readyLateDays(f: JobFacts): number | null {
  if (!f.firstReadyAt) return null;
  return differenceInCalendarDays(new Date(f.firstReadyAt), new Date(f.job.committedDate));
}
export function cycleDays(f: JobFacts, mode: DaysMode): number | null {
  return f.deliveredAt ? durationDays(f.job.createdAt, f.deliveredAt, mode) : null;
}
export function ageDays(f: JobFacts, mode: DaysMode, now = new Date()): number | null {
  return f.open ? durationDays(f.job.createdAt, now.toISOString(), mode) : null;
}
/** Días en la etapa actual — solo si el historial está completo (si no, no se sabe desde cuándo). */
export function daysInCurrentStage(f: JobFacts, mode: DaysMode, now = new Date()): number | null {
  if (!f.open || !f.historyComplete) return null;
  return durationDays(f.segments[f.segments.length - 1].start, now.toISOString(), mode);
}

// ---------------------------------------------------------------- resumen

export interface Stat { value: number | null; n: number }

export interface PeriodSummary {
  created: number;
  delivered: number;
  cancelled: number;
  onTimeRate: Stat; // % de entregados del período con entrega ≤ fecha comprometida
  cycleMedian: Stat; // mediana ingreso → entregado (entregados del período)
  cycleP85: Stat;
  readyOnTimeRate: Stat; // % que llegó a Listo antes de la fecha (de los entregados con historial)
}

export function summarize(facts: JobFacts[], p: Period, mode: DaysMode): PeriodSummary {
  const delivered = facts.filter((f) => inP(f.deliveredAt, p));
  const late = delivered.map(deliveryLateDays).filter((x): x is number => x !== null);
  const cycles = delivered.map((f) => cycleDays(f, mode)).filter((x): x is number => x !== null);
  const ready = delivered.map(readyLateDays).filter((x): x is number => x !== null);
  return {
    created: facts.filter((f) => inP(f.job.createdAt, p)).length,
    delivered: delivered.length,
    cancelled: facts.filter((f) => inP(f.cancelledAt, p)).length,
    onTimeRate: { value: late.length ? (late.filter((d) => d <= 0).length / late.length) * 100 : null, n: late.length },
    cycleMedian: { value: median(cycles), n: cycles.length },
    cycleP85: { value: percentile(cycles, 85), n: cycles.length },
    readyOnTimeRate: { value: ready.length ? (ready.filter((d) => d <= 0).length / ready.length) * 100 : null, n: ready.length },
  };
}

export interface Snapshot { open: number; overdue: number; overdueNotReady: number; overdueReady: number; ageMedian: Stat; blocked: number }
export function snapshot(facts: JobFacts[], mode: DaysMode, now = new Date()): Snapshot {
  const open = facts.filter((f) => f.open);
  const overdue = open.filter((f) => f.overdueOpen);
  const ages = open.map((f) => ageDays(f, mode, now)).filter((x): x is number => x !== null);
  return {
    open: open.length,
    overdue: overdue.length,
    overdueNotReady: overdue.filter((f) => !isReadyStage(f.stage)).length,
    overdueReady: overdue.filter((f) => isReadyStage(f.stage)).length,
    ageMedian: { value: median(ages), n: ages.length },
    blocked: open.filter((f) => f.job.blockRecords.some((b) => !b.closedAt)).length,
  };
}
export const isReadyStage = (s: StageKey | null) => s === 'listo' || s === 'instalacion';

// ---------------------------------------------------------------- series temporales

export interface Bucket { start: Date; end: Date; label: string }
export function buckets(p: Period): Bucket[] {
  const days = (p.to.getTime() - p.from.getTime()) / DAY_MS;
  const monthly = days > 120;
  const out: Bucket[] = [];
  let cur = monthly ? startOfMonth(p.from) : startOfWeek(p.from, { weekStartsOn: 1 });
  while (cur < p.to) {
    const next = monthly ? addMonths(cur, 1) : addWeeks(cur, 1);
    out.push({ start: cur, end: next, label: monthly ? format(cur, 'MMM yy', { locale: es }) : format(cur, 'd MMM', { locale: es }) });
    cur = next;
  }
  return out;
}

export interface FlowPoint { bucket: Bucket; created: number; delivered: number; wip: number | null }
/**
 * Ingresos y entregas por semana/mes + trabajos abiertos al cierre de cada tramo.
 * El "abiertos al cierre" usa fecha de ingreso y de entrega/cancelación; los
 * cancelados sin fecha en el historial no se pueden ubicar y quedan fuera (se informa aparte).
 */
export function flowSeries(facts: JobFacts[], p: Period): { points: FlowPoint[]; wipExcluded: number } {
  const bs = buckets(p);
  const unknownCancel = facts.filter((f) => f.job.status === 'CANCELADO' && !f.cancelledAt);
  const known = facts.filter((f) => !(f.job.status === 'CANCELADO' && !f.cancelledAt));
  const now = Date.now();
  const points = bs.map((b) => {
    const end = Math.min(b.end.getTime(), now);
    const wip = b.start.getTime() > now ? null : known.filter((f) => {
      const c = new Date(f.job.createdAt).getTime();
      const out = f.deliveredAt ?? f.cancelledAt;
      return c < end && (!out || new Date(out).getTime() >= end);
    }).length;
    const range = { from: b.start, to: b.end };
    return {
      bucket: b,
      created: facts.filter((f) => inP(f.job.createdAt, range)).length,
      delivered: facts.filter((f) => inP(f.deliveredAt, range)).length,
      wip,
    };
  });
  return { points, wipExcluded: unknownCancel.length };
}

// ---------------------------------------------------------------- etapas

export interface StageStat {
  stage: StageKey;
  wipNow: number; // trabajos hoy en la etapa (todos)
  entered: number; // entradas en el período (historial completo)
  exited: number; // salidas en el período (historial completo)
  durations: number[]; // permanencia de cada paso por la etapa que TERMINÓ en el período
  median: number | null;
  p85: number | null;
  currentAges: number[]; // días en la etapa de los que siguen ahí (historial completo)
}
export function stageStats(facts: JobFacts[], p: Period, mode: DaysMode, now = new Date()): StageStat[] {
  const complete = facts.filter((f) => f.historyComplete);
  return FLOW_STAGES.map((stage) => {
    const segs = complete.flatMap((f) => f.segments.filter((s) => s.stage === stage));
    const ended = segs.filter((s) => s.end && inP(s.end, p));
    const durations = ended.map((s) => durationDays(s.start, s.end!, mode));
    const current = complete.filter((f) => f.open && f.stage === stage).map((f) => daysInCurrentStage(f, mode, now)!).filter((x) => x !== null);
    return {
      stage,
      wipNow: facts.filter((f) => f.open && f.stage === stage).length,
      entered: segs.filter((s) => inP(s.start, p)).length,
      exited: ended.length,
      durations, median: median(durations), p85: percentile(durations, 85), currentAges: current,
    };
  });
}

/** IDs de trabajos que salieron de una etapa en el período (para el drill-down de tiempos por etapa). */
export function jobsExitingStage(facts: JobFacts[], stage: StageKey, p: Period): Set<string> {
  return new Set(facts.filter((f) => f.historyComplete && f.segments.some((s) => s.stage === stage && s.end && inP(s.end, p))).map((f) => f.job.id));
}

// ---------------------------------------------------------------- cortes por dimensión

export interface GroupStat { key: string; delivered: number; onTime: Stat; cycleMedian: Stat; open: number; overdue: number }
export function groupStats(facts: JobFacts[], p: Period, mode: DaysMode, keyOf: (f: JobFacts) => string): GroupStat[] {
  const groups = new Map<string, JobFacts[]>();
  for (const f of facts) { const k = keyOf(f); const a = groups.get(k); if (a) a.push(f); else groups.set(k, [f]); }
  return [...groups.entries()].map(([key, fs]) => {
    const s = summarize(fs, p, mode);
    return { key, delivered: s.delivered, onTime: s.onTimeRate, cycleMedian: s.cycleMedian, open: fs.filter((f) => f.open).length, overdue: fs.filter((f) => f.overdueOpen).length };
  });
}

// ---------------------------------------------------------------- clientes

export interface ClientStat {
  clientId: string;
  inPeriod: number;
  inPrev: number;
  total: number;
  firstAt: string;
  lastAt: string;
  avgGapDays: number | null; // promedio de días entre pedidos (≥ 2 pedidos)
  segment: 'nuevo' | 'recurrente' | 'sin_actividad';
  typeCounts: Record<string, number>; // tipos de trabajo en el período
}
export function clientStats(facts: JobFacts[], p: Period): ClientStat[] {
  const prev = previousPeriod(p);
  const by = new Map<string, JobFacts[]>();
  for (const f of facts) { const a = by.get(f.job.clientId); if (a) a.push(f); else by.set(f.job.clientId, [f]); }
  return [...by.entries()].map(([clientId, fs]) => {
    const dates = fs.map((f) => f.job.createdAt).sort();
    const gaps = dates.slice(1).map((d, i) => (new Date(d).getTime() - new Date(dates[i]).getTime()) / DAY_MS);
    const period = fs.filter((f) => inP(f.job.createdAt, p));
    const before = fs.filter((f) => new Date(f.job.createdAt) < p.from);
    const typeCounts: Record<string, number> = {};
    for (const f of period) typeCounts[f.job.jobTypeId] = (typeCounts[f.job.jobTypeId] ?? 0) + 1;
    return {
      clientId, inPeriod: period.length, inPrev: fs.filter((f) => inP(f.job.createdAt, prev)).length, total: fs.length,
      firstAt: dates[0], lastAt: dates[dates.length - 1], avgGapDays: mean(gaps),
      segment: period.length === 0 ? 'sin_actividad' : before.length === 0 ? 'nuevo' : 'recurrente',
      typeCounts,
    };
  });
}
/** Cuántos clientes concentran el 80% de los trabajos del período, y la participación del top 5. */
export function concentration(stats: ClientStat[]): { clientsFor80: number; top5Share: number | null; activeClients: number; total: number } {
  const active = stats.filter((c) => c.inPeriod > 0).sort((a, b) => b.inPeriod - a.inPeriod);
  const total = active.reduce((a, c) => a + c.inPeriod, 0);
  let acc = 0; let n = 0;
  for (const c of active) { if (acc >= total * 0.8) break; acc += c.inPeriod; n++; }
  const top5 = active.slice(0, 5).reduce((a, c) => a + c.inPeriod, 0);
  return { clientsFor80: n, top5Share: total ? (top5 / total) * 100 : null, activeClients: active.length, total };
}

export interface QuoteSummary { created: number; byStatus: Record<string, number>; conversion: Stat; confirmedIvaIncl: number; confirmedPlusIva: number; confirmedNoIva: number; confirmedNoPrice: number }
/** Presupuestos creados en el período (no hay fecha de confirmación guardada: se usa la cohorte por fecha de creación). */
export function quoteSummary(quotes: Quote[], p: Period): QuoteSummary {
  const qs = quotes.filter((q) => inP(q.createdAt, p));
  const byStatus: Record<string, number> = {};
  for (const q of qs) byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
  const conf = qs.filter((q) => q.status === 'CONFIRMADO');
  const decided = conf.length + (byStatus.RECHAZADO ?? 0);
  const sum = (xs: Quote[]) => xs.reduce((a, q) => a + (q.price ?? 0), 0);
  return {
    created: qs.length, byStatus,
    conversion: { value: decided ? (conf.length / decided) * 100 : null, n: decided },
    confirmedIvaIncl: sum(conf.filter((q) => q.price !== null && q.priceIncludesIva === true)),
    confirmedPlusIva: sum(conf.filter((q) => q.price !== null && q.priceIncludesIva === false)),
    confirmedNoIva: sum(conf.filter((q) => q.price !== null && q.priceIncludesIva === null)),
    confirmedNoPrice: conf.filter((q) => q.price === null).length,
  };
}

// ---------------------------------------------------------------- explorador (filtros compartidos con el drill-down)

export type DateField = 'created' | 'delivered' | 'committed' | 'none';
export interface ExplorerFilters {
  dateField: DateField;
  state: 'all' | 'open' | 'delivered' | 'cancelled';
  deadline: 'all' | 'on_time' | 'late' | 'overdue_open' | 'no_data';
  stage: StageKey | '';
  exitedStage: StageKey | ''; // salió de esta etapa dentro del período
  clientId: string;
  typeId: string;
  priority: Priority | '';
  responsibleId: string;
  price: '' | 'with' | 'without';
  installation: '' | 'yes' | 'no';
  sample: '' | 'yes' | 'no';
  outsourced: '' | 'yes' | 'no';
  lead: '' | LeadBucket;
  rework: '' | 'yes';
  rescheduled: '' | 'yes' | 'no';
  q: string;
}
export const EMPTY_FILTERS: ExplorerFilters = {
  dateField: 'none', state: 'all', deadline: 'all', stage: '', exitedStage: '', clientId: '', typeId: '', priority: '', responsibleId: '', price: '', installation: '', sample: '', outsourced: '', lead: '', rework: '', rescheduled: '', q: '',
};

export function deadlineOf(f: JobFacts): 'on_time' | 'late' | 'overdue_open' | 'no_data' | 'open_ok' {
  if (f.deliveredAt) return (deliveryLateDays(f) ?? 0) <= 0 ? 'on_time' : 'late';
  if (f.open) return f.overdueOpen ? 'overdue_open' : 'open_ok';
  return 'no_data'; // cancelado, o entregado sin fecha de entrega
}

export function applyFilters(facts: JobFacts[], fl: ExplorerFilters, p: Period, clientName: (id: string) => string): JobFacts[] {
  const exited = fl.exitedStage ? jobsExitingStage(facts, fl.exitedStage, p) : null;
  const q = fl.q.trim().toLowerCase();
  return facts.filter((f) => {
    const j = f.job;
    if (fl.dateField === 'created' && !inP(j.createdAt, p)) return false;
    if (fl.dateField === 'delivered' && !inP(f.deliveredAt, p)) return false;
    if (fl.dateField === 'committed' && !inP(j.committedDate, p)) return false;
    if (fl.state === 'open' && !f.open) return false;
    if (fl.state === 'delivered' && !f.deliveredAt) return false;
    if (fl.state === 'cancelled' && j.status !== 'CANCELADO') return false;
    if (fl.deadline !== 'all' && deadlineOf(f) !== fl.deadline) return false;
    if (fl.stage && f.stage !== fl.stage) return false;
    if (exited && !exited.has(j.id)) return false;
    if (fl.clientId && j.clientId !== fl.clientId) return false;
    if (fl.typeId && j.jobTypeId !== fl.typeId) return false;
    if (fl.priority && f.priority !== fl.priority) return false;
    if (fl.responsibleId && j.responsibleUserId !== fl.responsibleId) return false;
    if (fl.price === 'with' && f.price === null) return false;
    if (fl.price === 'without' && f.price !== null) return false;
    if (fl.installation && (fl.installation === 'yes') !== j.requiresInstallation) return false;
    if (fl.sample && (fl.sample === 'yes') !== hasSample(f)) return false;
    if (fl.outsourced && (fl.outsourced === 'yes') !== hasOutsourced(f)) return false;
    if (fl.lead && leadBucket(f) !== fl.lead) return false;
    if (fl.rework && f.backMoves.length === 0) return false;
    if (fl.rescheduled && (fl.rescheduled === 'yes') !== f.reschedules.length > 0) return false;
    if (q && !((j.code ?? '').toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || clientName(j.clientId).toLowerCase().includes(q))) return false;
    return true;
  });
}

// ---------------------------------------------------------------- objetivos

export type GoalMetricKey = string; // 'on_time_rate' | 'ready_on_time_rate' | 'cycle_median' | 'delivered_per_week' | `stage_median:${StageKey}`
export interface GoalMetricDef { key: GoalMetricKey; label: string; unit: string; better: 'higher' | 'lower' }
export const GOAL_METRICS: GoalMetricDef[] = [
  { key: 'on_time_rate', label: 'Entregas a tiempo', unit: '%', better: 'higher' },
  { key: 'ready_on_time_rate', label: 'Producción lista a tiempo', unit: '%', better: 'higher' },
  { key: 'cycle_median', label: 'Mediana de días de ingreso a entrega', unit: 'días', better: 'lower' },
  { key: 'delivered_per_week', label: 'Trabajos entregados por semana', unit: 'por semana', better: 'higher' },
  ...FLOW_STAGES.map((s) => ({ key: `stage_median:${s}`, label: `Mediana de días en ${STAGE_LABEL[s]}`, unit: 'días', better: 'lower' as const })),
];
/** Mínimo de casos para considerar un valor (o una comparación) representativo. */
export const MIN_N = 5;

export function goalMetricValue(key: GoalMetricKey, facts: JobFacts[], p: Period, mode: DaysMode): Stat {
  if (key === 'on_time_rate') return summarize(facts, p, mode).onTimeRate;
  if (key === 'ready_on_time_rate') return summarize(facts, p, mode).readyOnTimeRate;
  if (key === 'cycle_median') return summarize(facts, p, mode).cycleMedian;
  if (key === 'delivered_per_week') {
    const weeks = (p.to.getTime() - p.from.getTime()) / (7 * DAY_MS);
    const d = summarize(facts, p, mode).delivered;
    return { value: weeks > 0 ? d / weeks : null, n: d };
  }
  if (key.startsWith('stage_median:')) {
    const st = stageStats(facts, p, mode).find((s) => s.stage === key.split(':')[1]);
    return { value: st?.median ?? null, n: st?.durations.length ?? 0 };
  }
  return { value: null, n: 0 };
}

// ---------------------------------------------------------------- hallazgos

export interface Finding {
  id: string;
  kind: 'atencion' | 'mejora' | 'datos';
  title: string;
  evidence: string; // qué datos lo respaldan
  comparison: string; // contra qué se comparó
  limitation: string;
  drill: Partial<ExplorerFilters>;
}

/**
 * Reglas simples y explicables (sin IA ni predicción): cada una exige un mínimo
 * de casos y un cambio grande en términos absolutos y relativos, para no
 * "descubrir" ruido. Señalan dónde mirar, no explican por qué pasó.
 */
export function findings(facts: JobFacts[], p: Period, mode: DaysMode, typeLabel: (id: string) => string, clientName: (id: string) => string, comparable: boolean, now = new Date()): Finding[] {
  const out: Finding[] = [];
  const prev = previousPeriod(p);
  const unit = mode === 'business' ? 'días hábiles' : 'días';
  const f1 = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1 });

  // 1) Permanencia en una etapa que cambió mucho frente al período anterior.
  const cur = stageStats(facts, p, mode, now); const old = stageStats(facts, prev, mode, now);
  for (const s of comparable ? cur : []) {
    const o = old.find((x) => x.stage === s.stage)!;
    if (s.median === null || o.median === null || s.durations.length < MIN_N || o.durations.length < MIN_N) continue;
    const diff = s.median - o.median;
    if (Math.abs(diff) >= 1 && (s.median >= o.median * 1.5 || s.median <= o.median / 1.5)) {
      out.push({
        id: `stage-${s.stage}`, kind: diff > 0 ? 'atencion' : 'mejora',
        title: `${diff > 0 ? 'Más' : 'Menos'} tiempo en ${STAGE_LABEL[s.stage]}: mediana de ${f1(s.median)} ${unit} (antes ${f1(o.median)})`,
        evidence: `${s.durations.length} pasos por la etapa terminados en el período, ${o.durations.length} en el anterior.`,
        comparison: 'Mismo largo de período, inmediatamente anterior.',
        limitation: 'Solo trabajos con historial completo. Un aumento puede deberse a trabajos más grandes, esperas del cliente o bloqueos: abrí los casos antes de sacar conclusiones.',
        drill: { exitedStage: s.stage },
      });
    }
  }

  // 2) Acumulación: entran bastante más trabajos de los que salen de una etapa.
  for (const s of cur) {
    if (s.stage === 'pendiente') continue;
    if (s.entered - s.exited >= 3 && s.exited < s.entered * 0.7) {
      out.push({
        id: `acc-${s.stage}`, kind: 'atencion',
        title: `Se acumula trabajo en ${STAGE_LABEL[s.stage]}: entraron ${s.entered} y salieron ${s.exited}`,
        evidence: `Hoy hay ${s.wipNow} trabajos en esa etapa.`, comparison: 'Entradas contra salidas dentro del mismo período.',
        limitation: 'Solo cuenta trabajos con historial completo.', drill: { stage: s.stage, state: 'open' },
      });
    }
  }

  // 3) Tipo de trabajo con cumplimiento bastante peor que el promedio.
  const overall = summarize(facts, p, mode).onTimeRate;
  if (overall.value !== null && overall.n >= 10) {
    for (const g of groupStats(facts, p, mode, (f) => f.job.jobTypeId)) {
      if (g.onTime.value === null || g.onTime.n < MIN_N) continue;
      if (g.onTime.value <= overall.value - 20) {
        out.push({
          id: `type-${g.key}`, kind: 'atencion',
          title: `${typeLabel(g.key)}: ${Math.round(g.onTime.value)}% de entregas a tiempo (promedio general ${Math.round(overall.value)}%)`,
          evidence: `${g.onTime.n} entregas de este tipo en el período.`, comparison: 'Contra todas las entregas del período.',
          limitation: 'Que un tipo de trabajo se atrase más no indica la causa (plazos acordados, complejidad, proveedores).',
          drill: { typeId: g.key, dateField: 'delivered', state: 'delivered' },
        });
      }
    }
  }

  // 4) Crecimiento de trabajos abiertos.
  const startOpen = facts.filter((f) => {
    const c = new Date(f.job.createdAt).getTime(); const out2 = f.deliveredAt ?? f.cancelledAt;
    if (f.job.status === 'CANCELADO' && !f.cancelledAt) return false;
    return c < p.from.getTime() && (!out2 || new Date(out2).getTime() >= p.from.getTime());
  }).length;
  const openNow = facts.filter((f) => f.open).length;
  if (p.to.getTime() >= now.getTime() - DAY_MS && openNow - startOpen >= 3 && openNow >= startOpen * 1.25) {
    out.push({
      id: 'wip-growth', kind: 'atencion',
      title: `Hay más trabajos abiertos: ${openNow} hoy contra ${startOpen} al inicio del período`,
      evidence: 'Trabajos ni entregados ni cancelados.', comparison: 'Inicio del período contra hoy.',
      limitation: 'Los cancelados sin fecha en el historial no se pueden ubicar en el tiempo y quedan fuera del conteo inicial.',
      drill: { state: 'open' },
    });
  }

  // 5) Cambios grandes en la actividad de un cliente.
  // (solo si el período anterior tiene datos completos: si no, "antes 0" sería falso)
  for (const c of comparable ? clientStats(facts, p) : []) {
    if (c.inPrev >= 3 && c.inPeriod === 0) {
      out.push({ id: `cli-down-${c.clientId}`, kind: 'atencion', title: `${clientName(c.clientId)} no pidió trabajos en el período (antes ${c.inPrev})`, evidence: `Último trabajo: ${format(new Date(c.lastAt), 'd MMM yyyy', { locale: es })}.`, comparison: 'Período anterior de igual largo.', limitation: 'Puede ser estacional o haber pedidos que todavía no se cargaron.', drill: { clientId: c.clientId } });
    } else if (c.inPeriod >= 4 && c.inPeriod >= c.inPrev * 2) {
      out.push({ id: `cli-up-${c.clientId}`, kind: 'mejora', title: `${clientName(c.clientId)} duplicó sus pedidos: ${c.inPeriod} (antes ${c.inPrev})`, evidence: `${c.inPeriod} trabajos ingresados en el período.`, comparison: 'Período anterior de igual largo.', limitation: 'Cuenta trabajos, no tamaño ni importe.', drill: { clientId: c.clientId, dateField: 'created' } });
    }
  }

  // 6) Listos que esperan entrega hace mucho.
  const waiting = facts.filter((f) => f.open && isReadyStage(f.stage) && (daysInCurrentStage(f, 'calendar', now) ?? 0) > 7);
  if (waiting.length) {
    out.push({ id: 'ready-waiting', kind: 'atencion', title: `${waiting.length} trabajo${waiting.length > 1 ? 's' : ''} listo${waiting.length > 1 ? 's' : ''} hace más de 7 días sin marcar como entregado`, evidence: 'Etapa Listo para entregar / Instalación, según el historial.', comparison: 'Umbral fijo de 7 días corridos.', limitation: 'Puede que ya se hayan entregado y falte marcarlos: eso además distorsiona los tiempos de ciclo.', drill: { stage: 'listo', state: 'open' } });
  }

  // 7) Calidad de datos.
  const del = facts.filter((f) => inP(f.deliveredAt, p));
  const incomplete = del.filter((f) => !f.historyComplete).length;
  if (del.length >= MIN_N && incomplete / del.length > 0.2) {
    out.push({ id: 'data-history', kind: 'datos', title: `${incomplete} de ${del.length} entregas del período tienen el historial de estados incompleto`, evidence: 'El historial no reproduce el estado final del trabajo.', comparison: '—', limitation: 'Esos trabajos no cuentan para los tiempos por etapa. Suele pasar si alguien cambió el estado y falló el registro del historial.', drill: { dateField: 'delivered', state: 'delivered' } });
  }
  return out;
}

// ---------------------------------------------------------------- importes (029)

export const hasSample = (f: JobFacts) => f.job.sampleReview !== 'none';
export const hasOutsourced = (f: JobFacts) => f.job.products.some((p) => p.outsourced);
export type LeadBucket = '0-3' | '4-7' | '8-14' | '15+';
export const LEAD_LABEL: Record<LeadBucket, string> = { '0-3': '3 días o menos', '4-7': '4 a 7 días', '8-14': '8 a 14 días', '15+': '15 días o más' };
export function leadBucket(f: JobFacts): LeadBucket {
  return f.leadDays <= 3 ? '0-3' : f.leadDays <= 7 ? '4-7' : f.leadDays <= 14 ? '8-14' : '15+';
}

export interface RevenueSummary { delivered: number; withPrice: number; total: number; avg: number | null; median: number | null; coverage: number | null }
/** Importe (sin IVA) de los trabajos ENTREGADOS en el período que tienen importe cargado. */
export function revenue(facts: JobFacts[], p: Period): RevenueSummary {
  const del = facts.filter((f) => inP(f.deliveredAt, p));
  const priced = del.map((f) => f.price).filter((x): x is number => x !== null);
  const total = priced.reduce((a, b) => a + b, 0);
  return { delivered: del.length, withPrice: priced.length, total, avg: mean(priced), median: median(priced), coverage: del.length ? (priced.length / del.length) * 100 : null };
}
export function revenueSeries(facts: JobFacts[], p: Period): { bucket: Bucket; total: number; n: number }[] {
  return buckets(p).map((b) => { const r = revenue(facts, { from: b.start, to: b.end }); return { bucket: b, total: r.total, n: r.withPrice }; });
}
export function revenueBy(facts: JobFacts[], p: Period, keyOf: (f: JobFacts) => string): { key: string; total: number; n: number }[] {
  const m = new Map<string, { total: number; n: number }>();
  for (const f of facts) {
    if (!inP(f.deliveredAt, p) || f.price === null) continue;
    const k = keyOf(f); const cur = m.get(k) ?? { total: 0, n: 0 };
    cur.total += f.price; cur.n++; m.set(k, cur);
  }
  return [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total);
}

export interface QuoteDiff { facts: JobFacts; quoteNet: number; finalNet: number; diffPct: number }
/**
 * Presupuesto contra importe final, para trabajos entregados en el período que
 * nacieron de un presupuesto con importe y aclaración de IVA. Si el presupuesto
 * decía "IVA incluido" se pasa a neto con 21%; si no aclaraba IVA, se excluye.
 */
export function quoteVsFinal(facts: JobFacts[], quotes: Quote[], p: Period): { rows: QuoteDiff[]; excluded: number } {
  const rows: QuoteDiff[] = []; let excluded = 0;
  for (const f of facts) {
    if (!inP(f.deliveredAt, p) || !f.job.sourceQuoteId || f.price === null) continue;
    const q = quotes.find((x) => x.id === f.job.sourceQuoteId);
    if (!q || q.price === null || q.priceIncludesIva === null || q.price === 0) { excluded++; continue; }
    const quoteNet = q.priceIncludesIva ? q.price / 1.21 : q.price;
    rows.push({ facts: f, quoteNet, finalNet: f.price, diffPct: ((f.price - quoteNet) / quoteNet) * 100 });
  }
  return { rows, excluded };
}

// ---------------------------------------------------------------- características asociadas a los plazos

export interface FactorRow { factor: string; label: string; drill: Partial<ExplorerFilters>; n: number; onTime: number | null; cycleMedian: number | null }
/**
 * Entregados del período partidos por características que la app ya registra.
 * Es una comparación descriptiva: que un grupo se atrase más no prueba que esa
 * característica sea la causa (puede haber otras diferencias entre los grupos).
 */
export function factorStats(facts: JobFacts[], p: Period, mode: DaysMode): FactorRow[] {
  const del = facts.filter((f) => inP(f.deliveredAt, p));
  const row = (factor: string, label: string, drill: Partial<ExplorerFilters>, test: (f: JobFacts) => boolean): FactorRow => {
    const fs = del.filter(test);
    const s = summarize(fs, p, mode);
    return { factor, label, drill: { ...drill, dateField: 'delivered', state: 'delivered' }, n: fs.length, onTime: s.onTimeRate.value, cycleMedian: s.cycleMedian.value };
  };
  return [
    row('Instalación', 'Con instalación', { installation: 'yes' }, (f) => f.job.requiresInstallation),
    row('Instalación', 'Sin instalación', { installation: 'no' }, (f) => !f.job.requiresInstallation),
    row('Muestra al cliente', 'Hubo muestra', { sample: 'yes' }, hasSample),
    row('Muestra al cliente', 'Sin muestra', { sample: 'no' }, (f) => !hasSample(f)),
    row('Piezas tercerizadas', 'Con tercerizado', { outsourced: 'yes' }, hasOutsourced),
    row('Piezas tercerizadas', 'Todo hecho acá', { outsourced: 'no' }, (f) => !hasOutsourced(f)),
    ...(Object.keys(LEAD_LABEL) as LeadBucket[]).map((b) => row('Plazo dado al tomarlo', LEAD_LABEL[b], { lead: b }, (f) => leadBucket(f) === b)),
    row('Fecha comprometida', 'Se reprogramó', { rescheduled: 'yes' }, (f) => f.reschedules.length > 0),
    row('Fecha comprometida', 'Nunca se cambió', { rescheduled: 'no' }, (f) => f.reschedules.length === 0),
  ];
}

export interface ReworkSummary { moves: number; jobs: number; byPath: { path: string; n: number }[]; deliveredWithRework: number; delivered: number }
/** Vueltas para atrás en el flujo ocurridas en el período (solo historiales completos). */
export function reworkStats(facts: JobFacts[], p: Period): ReworkSummary {
  const moves = facts.filter((f) => f.historyComplete).flatMap((f) => f.backMoves.filter((m) => inP(m.at, p)).map((m) => ({ ...m, job: f.job.id })));
  const paths = new Map<string, number>();
  for (const m of moves) { const k = STAGE_LABEL[m.from] + " → " + STAGE_LABEL[m.to]; paths.set(k, (paths.get(k) ?? 0) + 1); }
  const del = facts.filter((f) => f.historyComplete && inP(f.deliveredAt, p));
  return {
    moves: moves.length, jobs: new Set(moves.map((m) => m.job)).size,
    byPath: [...paths.entries()].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n),
    deliveredWithRework: del.filter((f) => f.backMoves.length > 0).length, delivered: del.length,
  };
}
export function rescheduleStats(facts: JobFacts[], p: Period): { events: number; jobs: number; deliveredRescheduled: number; delivered: number } {
  const ev = facts.flatMap((f) => f.reschedules.filter((at) => inP(at, p)).map(() => f.job.id));
  const del = facts.filter((f) => inP(f.deliveredAt, p));
  return { events: ev.length, jobs: new Set(ev).size, deliveredRescheduled: del.filter((f) => f.reschedules.length > 0).length, delivered: del.length };
}
