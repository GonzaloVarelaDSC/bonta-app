import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'info' | 'review' | 'site' | 'done' | 'neutral';
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

// Borde perimetral con el color del estado, siempre visible (no solo al pasar el
// mouse) — así cada tarjeta se identifica por color de un vistazo, como semáforo.
const TONE_BORDER: Record<string, string> = {
  crit: 'border-crit/50 hover:border-crit',
  urg: 'border-urg/60 hover:border-urg',
  norm: 'border-norm/60 hover:border-norm',
  plan: 'border-plan/50 hover:border-plan',
  wait: 'border-wait/50 hover:border-wait',
  info: 'border-info/50 hover:border-info',
  review: 'border-review/50 hover:border-review',
  site: 'border-site/50 hover:border-site',
  done: 'border-ink-300 hover:border-ink-400',
  neutral: 'border-ink-300 hover:border-ink-400',
};

const TONE_TEXT: Record<string, string> = {
  crit: 'text-crit-text', urg: 'text-urg-text', norm: 'text-norm-text',
  plan: 'text-plan-text', wait: 'text-wait-text', info: 'text-info-text',
  review: 'text-review-text', site: 'text-site-text', done: 'text-ink-700', neutral: 'text-ink-800',
};

const TONE_ICON_BG: Record<string, string> = {
  crit: 'bg-crit-bg text-crit-text', urg: 'bg-urg-bg text-urg-text', norm: 'bg-norm-bg text-norm-text',
  plan: 'bg-plan-bg text-plan-text', wait: 'bg-wait-bg text-wait-text', info: 'bg-info-bg text-info-text',
  review: 'bg-review-bg text-review-text', site: 'bg-site-bg text-site-text', done: 'bg-ink-100 text-ink-700', neutral: 'bg-ink-100 text-ink-700',
};

export function KpiCard({ label, value, icon: Icon, tone, active, compact, onClick, className }: Props) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      className={clsx(
        'text-left bg-white rounded-xl border-2 shadow-card transition-all',
        compact ? 'px-2.5 py-2' : 'px-4 py-3.5',
        TONE_BORDER[tone],
        active && 'ring-2 ring-offset-1 ring-brand-500',
        className
      )}
    >
      <div className={clsx('flex items-center', compact ? 'gap-1.5' : 'gap-2.5')}>
        <span className={clsx('inline-flex items-center justify-center rounded-lg shrink-0', compact ? 'w-6 h-6' : 'w-7 h-7', TONE_ICON_BG[tone])}>
          <Icon size={compact ? 13 : 15} strokeWidth={2.25} />
        </span>
        <span className={clsx(compact ? 'text-xl' : 'text-2xl', 'font-display font-extrabold tabular', TONE_TEXT[tone])}>{value}</span>
      </div>
      <div className={clsx('text-ink-700 font-medium', compact ? 'text-[11px] leading-tight mt-1' : 'text-xs mt-1.5')}>{label}</div>
    </button>
  );
}
