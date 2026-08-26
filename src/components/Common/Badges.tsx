import clsx from 'clsx';
import type { Priority, RiskLevel, JobStatus } from '../../types';
import { PRIORITY_META } from '../../lib/priority';
import { RISK_META } from '../../lib/risk';
import { STATUS_LABELS } from '../../data/catalog';
import { countdown } from '../../lib/dates';

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
    <span className={clsx(
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

type StatusTone = 'crit' | 'urg' | 'info' | 'wait' | 'plan';

// Un color por macro-etapa (no por estado individual) para que se lea de un
// vistazo, como en Linear/GitHub/Trello: gris = no arrancado, azul = en curso,
// naranja = necesita atención, verde = listo/terminado, rojo = bloqueado.
const STATUS_TONE: Record<JobStatus, StatusTone> = {
  PENDIENTE: 'wait', NUEVO: 'wait', APROBADO: 'wait',
  FALTA_INFORMACION: 'urg',
  EN_DISENO: 'info', DISENO_LISTO: 'info', EN_PRODUCCION: 'info', EN_CONTROL_CALIDAD: 'info', EN_INSTALACION: 'info',
  LISTO_PARA_ENTREGA: 'plan', LISTO_PARA_INSTALACION: 'plan', TERMINADO: 'plan',
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
  wait: 'border-wait/30 bg-wait-bg text-wait-text',
  plan: 'border-plan/30 bg-plan-bg text-plan-text',
};

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  crit: 'bg-crit', urg: 'bg-urg', info: 'bg-info', wait: 'bg-wait', plan: 'bg-plan',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 border', STATUS_TONE_CLASSES[statusTone(status)])}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT_CLASSES[statusTone(status)])} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Select de estado con los mismos colores que StatusBadge — para cambiar el estado sin salir de la tarjeta/tabla. */
export function StatusSelect({ status, options, onChange, disabled }: { status: JobStatus; options: JobStatus[]; onChange: (s: JobStatus) => void; disabled?: boolean }) {
  return (
    <select
      value={status}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as JobStatus)}
      className={clsx(
        'text-xs font-semibold rounded-full border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        STATUS_TONE_CLASSES[statusTone(status)]
      )}
    >
      {options.map((s) => <option key={s} value={s}>● {STATUS_LABELS[s]}</option>)}
    </select>
  );
}

export function CountdownBadge({ iso }: { iso: string }) {
  const c = countdown(iso);
  const tone = c.tone === 'ok' ? 'plan' : c.tone;
  // Cuando faltan pocos días (tono crit/urg) suma un borde del mismo color —
  // el fondo pastel solo no llamaba suficiente la atención.
  const urgent = tone === 'crit' || tone === 'urg';
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
