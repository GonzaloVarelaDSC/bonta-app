import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type Tone = 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'info' | 'review' | 'site' | 'done' | 'neutral';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  /** flow = etapa del Kanban (neutra, solo un punto de color); alert = requiere atención. */
  variant?: 'flow' | 'alert';
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

// Rediseño "Pulido" (08/11): el semáforo pierde sentido si todo es semáforo.
// Las 7 etapas del flujo van neutras (un punto con el color de su columna del
// Kanban); el color fuerte queda solo para los cubos de atención y solo cuando
// valen más de 0 — con 0 se ven grises.
const DOT: Record<Tone, string> = {
  crit: 'bg-crit', urg: 'bg-urg-text', norm: 'bg-norm-text', plan: 'bg-plan', wait: 'bg-wait',
  info: 'bg-info', review: 'bg-review', site: 'bg-site', done: 'bg-ink-700', neutral: 'bg-ink-700',
};

const ALERT_ON: Record<Tone, string> = {
  crit: 'bg-crit-bg border-crit/40 text-crit-text',
  urg: 'bg-urg-bg border-urg/50 text-urg-text',
  norm: 'bg-norm-bg border-norm/50 text-norm-text',
  plan: 'bg-plan-bg border-plan/40 text-plan-text',
  wait: 'bg-wait-bg border-wait/40 text-wait-text',
  info: 'bg-info-bg border-info/40 text-info-text',
  review: 'bg-review-bg border-review/40 text-review-text',
  site: 'bg-site-bg border-site/40 text-site-text',
  done: 'bg-ink-100 border-ink-300 text-ink-800',
  neutral: 'bg-ink-100 border-ink-300 text-ink-800',
};

export function KpiCard({ label, value, icon: Icon, tone, variant = 'flow', active, onClick, className }: Props) {
  const lit = variant === 'alert' && value > 0;
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      className={clsx(
        'group min-w-0 text-left rounded-card border px-2 py-2.5 transition-[box-shadow,border-color,background-color] duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        lit ? ALERT_ON[tone] : 'bg-white border-ink-200 text-ink-900 hover:border-ink-300',
        'shadow-card hover:shadow-lift',
        active && 'ring-2 ring-brand-500 ring-offset-1',
        className
      )}
    >
      {/* El rótulo usa todo el ancho del cubo (el punto/ícono va al lado del número)
          para que las palabras entren enteras: nunca se parten con guion. */}
      <div className={clsx('min-h-[32px] text-meta font-medium leading-tight line-clamp-2 hyphens-none break-normal', lit ? 'text-current' : 'text-ink-700')} title={label}>
        {label}
      </div>
      <div className={clsx('mt-1 flex items-center gap-1.5 text-kpi font-bold tabular tracking-tight', lit ? 'text-current' : value === 0 ? 'text-ink-700' : 'text-ink-900')}>
        {value}
        {variant === 'flow'
          ? <span className={clsx('w-2 h-2 rounded-full', DOT[tone])} aria-hidden />
          : <Icon size={14} strokeWidth={2.25} aria-hidden className={lit ? 'text-current' : 'text-ink-700'} />}
      </div>
    </button>
  );
}
