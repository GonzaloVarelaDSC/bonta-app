import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtNum, fmtPct } from './fmt';
import clsx from 'clsx';
import { Info, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

// Piezas visuales chicas del módulo Métricas. Usan los mismos tokens que el
// resto de la app (ink/brand/plan/crit...), sin colores nuevos.


export function Card({ title, subtitle, actions, children, className }: { title?: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('bg-white rounded-xl border border-ink-200 shadow-card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-700 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

/** Ayuda contextual: definición del indicador al pasar el mouse o con foco de teclado. */
export function InfoTip({ text, label = 'Cómo se calcula' }: { text: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="text-ink-500 hover:text-ink-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-30 left-1/2 -translate-x-1/2 top-5 w-72 rounded-lg bg-ink-900 text-white text-xs leading-relaxed px-3 py-2 shadow-pop font-normal normal-case tracking-normal text-left">
          {text}
        </span>
      )}
    </span>
  );
}

export type Better = 'higher' | 'lower' | 'neutral';

/**
 * Variación frente al período anterior. `kind: 'pp'` = diferencia en puntos
 * porcentuales (para tasas); si no, % de cambio. Si no hay base comparable,
 * lo dice en vez de inventar una flecha.
 */
export function Delta({ cur, prev, better, kind = 'pct', unit = '', comparable = true }: { cur: number | null; prev: number | null; better: Better; kind?: 'pct' | 'pp' | 'abs'; unit?: string; comparable?: boolean }) {
  if (!comparable) return <span className="text-[11px] text-ink-600">Sin período anterior comparable</span>;
  if (cur === null || prev === null) return <span className="text-[11px] text-ink-600">Sin datos para comparar</span>;
  const diff = cur - prev;
  const prevTxt = kind === 'pp' ? fmtPct(prev) : `${fmtNum(prev, 1)}${unit ? ` ${unit}` : ''}`;
  if (Math.abs(diff) < 1e-9) return <span className="text-[11px] text-ink-700 inline-flex items-center gap-0.5"><Minus size={12} aria-hidden="true" />Igual que antes ({prevTxt})</span>;
  const up = diff > 0;
  const good = better === 'neutral' ? null : (better === 'higher') === up;
  let txt: string;
  if (kind === 'pp') txt = `${up ? '+' : '−'}${fmtNum(Math.abs(diff), 0)} pts`;
  else if (kind === 'abs' || prev === 0) txt = `${up ? '+' : '−'}${fmtNum(Math.abs(diff), 1)}${unit ? ` ${unit}` : ''}`;
  else txt = `${up ? '+' : '−'}${fmtNum(Math.abs(diff / prev) * 100, 0)}%`;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('text-[11px] inline-flex items-center gap-0.5 font-medium', good === null ? 'text-ink-700' : good ? 'text-plan-text' : 'text-crit-text')}>
      <Icon size={12} aria-hidden="true" />{txt}<span className="font-normal text-ink-700"> vs. anterior ({prevTxt})</span>
    </span>
  );
}

/** Tarjeta de indicador: valor + unidad/período + variación + definición + acceso al detalle. */
export function KpiTile({ label, value, unit, note, delta, help, onOpen, emphasis }: {
  label: string; value: string; unit?: string; note?: ReactNode; delta?: ReactNode; help: ReactNode; onOpen?: () => void; emphasis?: 'crit';
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-200 shadow-card px-4 py-3 flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
        <span className="leading-tight">{label}</span><InfoTip text={help} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={clsx('text-[26px] leading-none font-display font-bold', emphasis === 'crit' ? 'text-crit-text' : 'text-ink-900')}>{value}</span>
        {unit && <span className="text-xs text-ink-700">{unit}</span>}
      </div>
      <div className="mt-1.5 min-h-[16px]">{delta}</div>
      {note && <div className="text-[11px] text-ink-700 mt-0.5">{note}</div>}
      {onOpen && (
        <button type="button" onClick={onOpen} className="mt-auto pt-2 self-start text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
          Ver trabajos →
        </button>
      )}
    </div>
  );
}

/** Aviso de limitación / datos insuficientes, siempre en el mismo formato. */
export function LimitNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-ink-700 bg-ink-50 border border-ink-200 rounded-lg px-2.5 py-1.5">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-ink-700 py-8 text-center">{children}</div>;
}

