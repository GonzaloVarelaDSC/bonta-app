import clsx from 'clsx';
import type { ReactNode } from 'react';
import { TrendingUp, Timer, AlertTriangle, Lock, ShieldAlert } from 'lucide-react';
import type { Job, Priority, RiskLevel, JobStatus, SampleReview, QuoteStatus } from '../../types';
import { PRIORITY_META, chosenPriority, isEscalatedByDate } from '../../lib/priority';
import { RISK_META } from '../../lib/risk';
import { STATUS_LABELS, SAMPLE_REVIEW_META, QUOTE_STATUS_LABELS } from '../../data/catalog';
import { countdown, fmtDate } from '../../lib/dates';
import { isClosedStatus } from '../../lib/statusChange';

// Rediseño "Pulido" (08/11): todos los pills comparten una misma receta —
// fondo claro + texto -text + borde fino + punto/ícono adelante, rounded-full.
// Sin emojis (cambiaban de aspecto según el sistema operativo).

const TONE_CLASSES: Record<string, string> = {
  crit: 'bg-crit-bg text-crit-text border-crit/30',
  urg: 'bg-urg-bg text-urg-text border-urg/40',
  norm: 'bg-norm-bg text-norm-text border-norm/40',
  plan: 'bg-plan-bg text-plan-text border-plan/30',
  wait: 'bg-wait-bg text-wait-text border-wait/30',
  info: 'bg-info-bg text-info-text border-info/30',
};

const PRIORITY_TONE: Record<Priority, keyof typeof TONE_CLASSES> = {
  CRITICO: 'crit', URGENTE: 'urg', NORMAL: 'norm', PLANIFICADO: 'plan', EN_ESPERA: 'wait',
};

// Punto de color de cada prioridad. urg/norm usan su variante -text: el DEFAULT
// no llega a 3:1 como elemento gráfico.
const PRIORITY_DOT: Record<Priority, string> = {
  CRITICO: 'bg-crit', URGENTE: 'bg-urg-text', NORMAL: 'bg-norm-text', PLANIFICADO: 'bg-plan', EN_ESPERA: 'bg-wait',
};


function Dot({ cls }: { cls: string }) {
  return <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cls)} aria-hidden />;
}

const PILL = 'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap';
const PILL_SIZE = { sm: 'text-meta px-2 py-0.5', md: 'text-xs px-2.5 py-1' } as const;

export function PriorityBadge({ priority, size = 'md' }: { priority: Priority; size?: 'sm' | 'md' }) {
  const meta = PRIORITY_META[priority];
  return (
    <span title={meta.sla} className={clsx(PILL, TONE_CLASSES[PRIORITY_TONE[priority]], PILL_SIZE[size])}>
      <Dot cls={PRIORITY_DOT[priority]} />{meta.label}
    </span>
  );
}

/** Aclara que la prioridad que se ve subió sola por la fecha de entrega (04/11). */
export function EscalatedHint({ job }: { job: Job }) {
  if (!isEscalatedByDate(job)) return null;
  const chosen = PRIORITY_META[chosenPriority(job)].label;
  return (
    <span title={`Se cargó como ${chosen}; subió sola porque se acerca la fecha de entrega.`}
      className="inline-flex items-center gap-0.5 text-meta font-medium text-ink-700 whitespace-nowrap">
      <TrendingUp size={12} aria-hidden /> por fecha <span className="sr-only">(se cargó como {chosen})</span>
    </span>
  );
}

// Riesgo: neutro y con rótulo propio, para no confundirse con un pill de
// prioridad (antes era un "● Alto" naranja idéntico a "Urgente").
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const meta = RISK_META[risk];
  const strong = risk === 'CRITICO' || risk === 'ALTO';
  return (
    <span
      title="Riesgo estimado según plazo, instalación y bloqueos"
      className={clsx('inline-flex items-center gap-1 rounded-full border bg-white text-xs font-medium px-2.5 py-1 whitespace-nowrap',
        strong ? 'border-ink-300 text-ink-900' : 'border-ink-200 text-ink-700')}
    >
      <ShieldAlert size={13} aria-hidden className={strong ? 'text-urg-text' : 'text-ink-700'} />
      Riesgo {meta.label.toLowerCase()}
    </span>
  );
}

type StatusTone = 'crit' | 'urg' | 'info' | 'norm' | 'review' | 'wait' | 'plan' | 'site' | 'done';

// Mismas 7 macro-etapas y mismo color que el Kanban (KANBAN_COLUMNS en
// data/catalog.ts). `FALTA_INFORMACION` es la única excepción a propósito: fuera
// del Kanban importa que salte a la vista (naranja `urg`). "Bloqueado" no es un
// estado (Fase 3, 17/09): se muestra con `BlockedBadge`, nunca reemplazando el
// estado real.
const STATUS_TONE: Record<JobStatus, StatusTone> = {
  PENDIENTE: 'wait',
  FALTA_INFORMACION: 'urg',
  EN_DISENO: 'info', DISENO_LISTO: 'info',
  EN_PRODUCCION: 'norm',
  EN_CONTROL_CALIDAD: 'review',
  EN_INSTALACION: 'site',
  LISTO_PARA_ENTREGA: 'plan', LISTO_PARA_INSTALACION: 'plan',
  TERMINADO: 'done',
  CANCELADO: 'wait',
};

export function statusTone(status: JobStatus): StatusTone {
  return STATUS_TONE[status];
}

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  crit: 'border-crit/30 bg-crit-bg text-crit-text',
  urg: 'border-urg/40 bg-urg-bg text-urg-text',
  info: 'border-info/30 bg-info-bg text-info-text',
  norm: 'border-norm/40 bg-norm-bg text-norm-text',
  review: 'border-review/30 bg-review-bg text-review-text',
  wait: 'border-wait/30 bg-wait-bg text-wait-text',
  plan: 'border-plan/30 bg-plan-bg text-plan-text',
  site: 'border-site/30 bg-site-bg text-site-text',
  done: 'border-ink-300 bg-ink-100 text-ink-700',
};

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  crit: 'bg-crit', urg: 'bg-urg-text', info: 'bg-info', norm: 'bg-norm-text', review: 'bg-review',
  wait: 'bg-wait', plan: 'bg-plan', site: 'bg-site', done: 'bg-ink-700',
};

export function StatusBadge({ status, size = 'md' }: { status: JobStatus; size?: 'sm' | 'md' }) {
  const tone = statusTone(status);
  return (
    <span className={clsx(PILL, STATUS_TONE_CLASSES[tone], PILL_SIZE[size])}>
      <Dot cls={STATUS_DOT_CLASSES[tone]} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Clases de superficie (borde + fondo + texto) del tono de un estado — para pintar una franja con el color del estado sin ser un badge. */
export function statusSurfaceClasses(status: JobStatus): string {
  return STATUS_TONE_CLASSES[statusTone(status)];
}

// Select con forma de pill: punto de color superpuesto a la izquierda y chevron
// propio (index.css) a la derecha. En celular sube a 44px de alto.
const SELECT_PILL =
  'select-chevron appearance-none rounded-full border font-semibold cursor-pointer ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-touch';

function PillSelectWrap({ dot, children, className }: { dot: string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('relative inline-flex items-center max-w-full', className)}>
      <span className={clsx('pointer-events-none absolute left-2.5 w-1.5 h-1.5 rounded-full z-[1]', dot)} aria-hidden />
      {children}
    </span>
  );
}

/** Select de prioridad con los mismos colores que PriorityBadge — para cambiar la
 *  prioridad desde la lista sin abrir la ficha. El plazo de cada prioridad va en
 *  el `title`, no en el texto de la opción (se cortaba en celular). */
export function PrioritySelect({ priority, onChange, disabled, size = 'sm', className }: { priority: Priority; onChange: (p: Priority) => void; disabled?: boolean; size?: 'sm' | 'md'; className?: string }) {
  return (
    <PillSelectWrap dot={PRIORITY_DOT[priority]} className={className}>
      <select
        value={priority}
        disabled={disabled}
        aria-label="Prioridad"
        title={PRIORITY_META[priority].sla}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value as Priority)}
        className={clsx(SELECT_PILL, TONE_CLASSES[PRIORITY_TONE[priority]],
          size === 'sm' ? 'text-meta pl-6 py-0.5 h-6' : 'text-xs pl-6 py-1 h-ctl-sm')}
      >
        {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
          <option key={p} value={p}>{PRIORITY_META[p].label}</option>
        ))}
      </select>
    </PillSelectWrap>
  );
}

/** Select de estado con los mismos colores que StatusBadge — para cambiar el estado sin salir de la tarjeta/tabla. */
export function StatusSelect({ status, options, onChange, disabled, size = 'md', className }: { status: JobStatus; options: JobStatus[]; onChange: (s: JobStatus) => void; disabled?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const tone = statusTone(status);
  return (
    <PillSelectWrap dot={STATUS_DOT_CLASSES[tone]} className={className}>
      <select
        value={status}
        disabled={disabled}
        aria-label="Estado"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value as JobStatus)}
        className={clsx(SELECT_PILL, STATUS_TONE_CLASSES[tone],
          size === 'sm' ? 'text-meta pl-6 py-0.5 h-6' : 'text-xs pl-6 py-1 h-ctl-sm', 'max-w-full')}
      >
        {options.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    </PillSelectWrap>
  );
}

// Estado de presupuesto — mismo lenguaje de pill+punto que StatusBadge/
// StatusSelect. Gris = borrador, azul = listo para enviar, violeta = enviado,
// verde = confirmado, rojo = rechazado.
const QUOTE_STATUS_TONE: Record<QuoteStatus, StatusTone> = {
  BORRADOR: 'wait',
  LISTO_PARA_ENVIAR: 'info',
  ENVIADO: 'review',
  CONFIRMADO: 'plan',
  RECHAZADO: 'crit',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const tone = QUOTE_STATUS_TONE[status];
  return (
    <span className={clsx(PILL, STATUS_TONE_CLASSES[tone], PILL_SIZE.md)}>
      <Dot cls={STATUS_DOT_CLASSES[tone]} />
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}

// "Confirmado" solo se alcanza con la acción "Confirmar presupuesto" (genera el
// trabajo vinculado, 22/09) — por eso no está entre las opciones elegibles.
const SELECTABLE_QUOTE_STATUSES = (Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).filter((s) => s !== 'CONFIRMADO');

export function QuoteStatusSelect({ status, onChange, disabled }: { status: QuoteStatus; onChange: (s: QuoteStatus) => void; disabled?: boolean }) {
  const tone = QUOTE_STATUS_TONE[status];
  return (
    <PillSelectWrap dot={STATUS_DOT_CLASSES[tone]}>
      <select
        value={status}
        disabled={disabled}
        aria-label="Estado del presupuesto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value as QuoteStatus)}
        className={clsx(SELECT_PILL, STATUS_TONE_CLASSES[tone], 'text-xs pl-6 py-1 h-ctl-sm')}
      >
        {SELECTABLE_QUOTE_STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
      </select>
    </PillSelectWrap>
  );
}

// "Cuánto falta / cuánto se atrasó" hasta la fecha de entrega, en días (la
// entrega es solo fecha). Listo/entregado/cancelado no muestran nada (08/09).
// Nunca se parte en dos líneas.
export function CountdownBadge({ iso, status, compact }: { iso: string; status?: JobStatus; compact?: boolean }) {
  if (status && isClosedStatus(status)) return null;
  const c = countdown(iso);
  const tone = c.tone === 'ok' ? 'plan' : c.tone;
  const Icon = c.overdue ? AlertTriangle : Timer;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full border font-semibold tabular whitespace-nowrap shrink-0',
      TONE_CLASSES[tone],
      compact ? 'text-meta px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      <Icon size={compact ? 11 : 12} aria-hidden />{c.label}
    </span>
  );
}

// Bloqueado ya no es un valor de `status` — este badge es el indicador visual,
// independiente del estado real. La ficha además tiene su banner con el motivo.
export function BlockedBadge({ blocked, reason, size = 'md' }: { blocked: boolean; reason?: string; size?: 'sm' | 'md' }) {
  if (!blocked) return null;
  return (
    <span title={reason ? `Bloqueado — ${reason}` : 'Bloqueado'} className={clsx(PILL, TONE_CLASSES.crit, PILL_SIZE[size])}>
      <Lock size={size === 'sm' ? 11 : 12} aria-hidden />Bloqueado
    </span>
  );
}

// Pill discreto de "muestra/prueba al cliente" — no aparece si no hay muestra en
// juego. Azul = en producción; ámbar = falta el OK; verde = aprobada.
export function SampleReviewBadge({ state, at, size = 'md' }: { state: SampleReview; at?: string; size?: 'sm' | 'md' }) {
  if (state === 'none') return null;
  const meta = SAMPLE_REVIEW_META[state];
  const tone = state === 'approved' ? 'plan' : state === 'awaiting' ? 'norm' : 'info';
  return (
    <span title={at ? `${meta.chip} · ${fmtDate(at)}` : meta.chip} className={clsx(PILL, TONE_CLASSES[tone], PILL_SIZE[size])}>
      {meta.chip}
    </span>
  );
}

// Avatar: con nombre al lado (casi siempre) se oculta al lector de pantalla para
// no anunciar las iniciales dos veces. Debajo de 20px no hay iniciales (se leían
// a 5-7px): queda el círculo de color.
export function Avatar({ name, color, size = 28, decorative }: { name: string; color: string; size?: number; decorative?: boolean }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ring-1 ring-black/5"
      style={{ background: color, width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      title={name}
      aria-hidden={decorative || undefined}
    >
      {size >= 20 ? initials : null}
    </span>
  );
}
