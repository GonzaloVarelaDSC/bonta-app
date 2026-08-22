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

export function PriorityBadge({ priority, manual, size = 'md' }: { priority: Priority; manual?: boolean; size?: 'sm' | 'md' }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        TONE_CLASSES[PRIORITY_TONE[priority]],
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}>
        <span aria-hidden>{meta.emoji}</span>{meta.label}
      </span>
      {manual && (
        <span className="text-[10px] uppercase tracking-wide text-ink-400 font-medium" title="Prioridad modificada manualmente, pisa el cálculo automático">
          manual
        </span>
      )}
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

export function StatusBadge({ status }: { status: JobStatus }) {
  const tone = status === 'BLOQUEADO' ? 'crit' : status === 'CANCELADO' ? 'wait' : status === 'TERMINADO' ? 'plan' : 'norm';
  return (
    <span className={clsx('inline-flex items-center rounded-md text-xs font-medium px-2 py-1 border',
      tone === 'crit' ? 'border-crit/30 bg-crit-bg text-crit-text' :
      tone === 'wait' ? 'border-wait/30 bg-wait-bg text-wait-text' :
      tone === 'plan' ? 'border-plan/30 bg-plan-bg text-plan-text' :
      'border-ink-200 bg-ink-50 text-ink-600')}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function CountdownBadge({ iso }: { iso: string }) {
  const c = countdown(iso);
  const tone = c.tone === 'ok' ? 'plan' : c.tone;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md text-xs font-semibold px-2 py-1 tabular', TONE_CLASSES[tone])}>
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
