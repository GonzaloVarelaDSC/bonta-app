import clsx from 'clsx';
import type { Priority, RiskLevel, JobStatus, SampleReview } from '../../types';
import { PRIORITY_META } from '../../lib/priority';
import { RISK_META } from '../../lib/risk';
import { STATUS_LABELS, SAMPLE_REVIEW_META } from '../../data/catalog';
import { countdown, fmtDate } from '../../lib/dates';
import { isClosedStatus } from '../../lib/statusChange';

const TONE_CLASSES: Record<string, string> = {
  crit: 'bg-crit-bg text-crit-text',
  urg: 'bg-urg-bg text-urg-text',
  norm: 'bg-norm-bg text-norm-text',
  plan: 'bg-plan-bg text-plan-text',
  wait: 'bg-wait-bg text-wait-text',
};

const PRIORITY_TONE: Record<Priority, keyof typeof TONE_CLASSES> = {
  CRITICO: 'crit', URGENTE: 'urg', NORMAL: 'norm', PLANIFICADO: 'plan', EN_ESPERA: 'wait',
};

export function PriorityBadge({ priority, size = 'md' }: { priority: Priority; size?: 'sm' | 'md' }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      title={meta.sla}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        TONE_CLASSES[PRIORITY_TONE[priority]],
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}>
      <span aria-hidden>{meta.emoji}</span>{meta.label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const meta = RISK_META[risk];
  const tone = risk === 'CRITICO' ? 'crit' : risk === 'ALTO' ? 'urg' : risk === 'MEDIO' ? 'norm' : 'plan';
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5', TONE_CLASSES[tone])}>
      <span aria-hidden>{meta.emoji}</span>{meta.label}
    </span>
  );
}

type StatusTone = 'crit' | 'urg' | 'info' | 'norm' | 'review' | 'wait' | 'plan' | 'site' | 'done';

// Mismas 7 macro-etapas y mismo color que el Kanban (KANBAN_COLUMNS en
// data/catalog.ts) — antes esta tabla solo tenía 5 tonos y agrupaba Producción/
// Control de calidad/Instalación en el mismo azul "info", así que alguien que
// aprendía "dorado = en producción" mirando el Kanban veía ese mismo trabajo en
// azul en la Tabla/Dashboard/ficha (AUDITORIA_UXUI_2026-09-15.md, ítem #8).
// `FALTA_INFORMACION` es la única excepción a propósito: el Kanban no tiene
// columna propia para ese estado (se mezcla dentro de "Pendiente", tono `wait`,
// porque ahí no hace falta resaltarlo — se ve por separado en otro lado), pero
// fuera del Kanban sí importa que salte a la vista (naranja `urg`) porque no
// tiene ninguna columna/sección propia donde ya esté agrupado. Iguales de un
// vistazo, como en Linear/GitHub/Trello: gris = no arrancado, azul = diseño,
// dorado = producción, violeta = control de calidad, verde = listo, verde
// azulado = instalación, gris oscuro = entregado, rojo = bloqueado.
const STATUS_TONE: Record<JobStatus, StatusTone> = {
  PENDIENTE: 'wait', NUEVO: 'wait', APROBADO: 'wait',
  FALTA_INFORMACION: 'urg',
  EN_DISENO: 'info', DISENO_LISTO: 'info',
  EN_PRODUCCION: 'norm',
  EN_CONTROL_CALIDAD: 'review',
  EN_INSTALACION: 'site',
  LISTO_PARA_ENTREGA: 'plan', LISTO_PARA_INSTALACION: 'plan',
  TERMINADO: 'done',
  BLOQUEADO: 'crit',
  CANCELADO: 'wait',
};

export function statusTone(status: JobStatus): StatusTone {
  return STATUS_TONE[status];
}

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  crit: 'border-crit/30 bg-crit-bg text-crit-text',
  urg: 'border-urg/30 bg-urg-bg text-urg-text',
  info: 'border-info/30 bg-info-bg text-info-text',
  norm: 'border-norm/30 bg-norm-bg text-norm-text',
  review: 'border-review/30 bg-review-bg text-review-text',
  wait: 'border-wait/30 bg-wait-bg text-wait-text',
  plan: 'border-plan/30 bg-plan-bg text-plan-text',
  site: 'border-site/30 bg-site-bg text-site-text',
  // Sin token nuevo — "Entregado" ya se ve gris neutro en el Kanban (COLUMN_TONE_CLASSES.done
  // en KanbanPage.tsx), acá se arma con las mismas clases `ink-*` que usa el resto de la app.
  done: 'border-ink-300 bg-ink-100 text-ink-700',
};

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  crit: 'bg-crit', urg: 'bg-urg', info: 'bg-info', norm: 'bg-norm', review: 'bg-review',
  wait: 'bg-wait', plan: 'bg-plan', site: 'bg-site', done: 'bg-ink-500',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 border', STATUS_TONE_CLASSES[statusTone(status)])}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT_CLASSES[statusTone(status)])} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Select de prioridad con los mismos colores que PriorityBadge — para cambiar la
 *  prioridad desde la lista sin abrir la ficha, sin que la fecha limite la opción
 *  (un trabajo a 10 días puede ser crítico igual si es muy grande). */
export function PrioritySelect({ priority, onChange, disabled }: { priority: Priority; onChange: (p: Priority) => void; disabled?: boolean }) {
  return (
    <select
      value={priority}
      disabled={disabled}
      aria-label="Prioridad"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as Priority)}
      className={clsx(
        'text-[11px] font-semibold rounded-full px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        TONE_CLASSES[PRIORITY_TONE[priority]]
      )}
    >
      {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
        <option key={p} value={p}>{PRIORITY_META[p].emoji} {PRIORITY_META[p].label}</option>
      ))}
    </select>
  );
}

/** Select de estado con los mismos colores que StatusBadge — para cambiar el estado sin salir de la tarjeta/tabla. */
export function StatusSelect({ status, options, onChange, disabled }: { status: JobStatus; options: JobStatus[]; onChange: (s: JobStatus) => void; disabled?: boolean }) {
  return (
    <select
      value={status}
      disabled={disabled}
      aria-label="Estado"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as JobStatus)}
      className={clsx(
        'text-xs font-semibold rounded-full border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        STATUS_TONE_CLASSES[statusTone(status)]
      )}
    >
      {options.map((s) => <option key={s} value={s}>● {STATUS_LABELS[s]}</option>)}
    </select>
  );
}

// Etiqueta de "cuánto falta / cuánto se atrasó" hasta la fecha de entrega. Una
// vez que el trabajo está listo para entregar, entregado o cancelado deja de
// tener sentido contar días — directamente no se muestra nada (Gonzalo, 08/09).
// `compact` (Gonzalo, 15/09: la versión normal "rarísima, mucho espacio mal
// usado" en la tarjeta angosta del Kanban) saca el emoji y baja tamaño/padding
// al mismo nivel que el resto de los chips chicos de esa tarjeta (el N° de
// Copernico, `text-[10px] px-1.5 py-0.5`) — el color ya comunica la urgencia,
// no hace falta el ícono para leerlo de un vistazo en un espacio tan chico.
export function CountdownBadge({ iso, status, compact }: { iso: string; status?: JobStatus; compact?: boolean }) {
  if (status && isClosedStatus(status)) return null;
  const c = countdown(iso);
  const tone = c.tone === 'ok' ? 'plan' : c.tone;
  // Cuando faltan pocos días (tono crit/urg) suma un borde del mismo color —
  // el fondo pastel solo no llamaba suficiente la atención.
  const urgent = tone === 'crit' || tone === 'urg';
  if (compact) {
    return (
      <span className={clsx(
        'inline-flex items-center rounded text-[10px] font-semibold px-1.5 py-0.5 tabular whitespace-nowrap shrink-0',
        TONE_CLASSES[tone],
        urgent && 'border border-current/30'
      )}>
        {c.label}
      </span>
    );
  }
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-md text-xs font-semibold px-2 py-1 tabular',
      TONE_CLASSES[tone],
      urgent && 'border border-current/30'
    )}>
      {c.overdue ? '⚠️' : '⏱️'} {c.label}
    </span>
  );
}

// Pill discreto de "muestra/prueba al cliente" — no aparece si el trabajo no
// tiene muestra en juego (`none`). Ámbar = falta el OK; verde = aprobada.
export function SampleReviewBadge({ state, at, size = 'md' }: { state: SampleReview; at?: string; size?: 'sm' | 'md' }) {
  if (state === 'none') return null;
  const meta = SAMPLE_REVIEW_META[state];
  const tone = state === 'awaiting' ? 'norm' : 'plan';
  return (
    <span
      title={at ? `${meta.chip} · ${fmtDate(at)}` : meta.chip}
      className={clsx(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap border border-current/25',
        TONE_CLASSES[tone],
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}
    >
      {meta.chip}
    </span>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {initials}
    </span>
  );
}
