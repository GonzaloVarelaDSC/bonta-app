import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'crit' | 'urg' | 'norm' | 'plan' | 'wait' | 'neutral';
  active?: boolean;
  onClick?: () => void;
}

const TONE_RING: Record<string, string> = {
  crit: 'ring-crit/20 hover:ring-crit/40',
  urg: 'ring-urg/20 hover:ring-urg/40',
  norm: 'ring-norm/20 hover:ring-norm/40',
  plan: 'ring-plan/20 hover:ring-plan/40',
  wait: 'ring-wait/20 hover:ring-wait/40',
  neutral: 'ring-ink-200 hover:ring-ink-300',
};

const TONE_TEXT: Record<string, string> = {
  crit: 'text-crit-text', urg: 'text-urg-text', norm: 'text-norm-text',
  plan: 'text-plan-text', wait: 'text-wait-text', neutral: 'text-ink-800',
};

const TONE_ICON_BG: Record<string, string> = {
  crit: 'bg-crit-bg text-crit-text', urg: 'bg-urg-bg text-urg-text', norm: 'bg-norm-bg text-norm-text',
  plan: 'bg-plan-bg text-plan-text', wait: 'bg-wait-bg text-wait-text', neutral: 'bg-ink-100 text-ink-600',
};

export function KpiCard({ label, value, icon: Icon, tone, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'text-left bg-white rounded-xl border border-ink-100 shadow-card px-4 py-3.5 ring-1 transition-all',
        TONE_RING[tone],
        active && 'ring-2 ring-offset-1'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={clsx('inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0', TONE_ICON_BG[tone])}>
          <Icon size={15} strokeWidth={2.25} />
        </span>
        <span className={clsx('text-2xl font-display font-extrabold tabular', TONE_TEXT[tone])}>{value}</span>
      </div>
      <div className="text-xs text-ink-500 mt-1.5 font-medium">{label}</div>
    </button>
  );
}
