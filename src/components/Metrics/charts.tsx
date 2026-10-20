import { useState } from 'react';
import clsx from 'clsx';
import { useWidth, fmtNum, TONE_BG } from './fmt';

// Gráficos del módulo Métricas — SVG propio, sin librería nueva (lo que hace
// falta es poco: líneas, barras horizontales y puntos). Reglas de la skill de
// visualización: un solo eje, trazos finos, grilla tenue, leyenda con 2+ series,
// tooltip al pasar el mouse y valores de texto en tinta, nunca en el color de la serie.

const TONE_STROKE: Record<string, string> = { info: 'stroke-info', brand: 'stroke-brand-500', ink: 'stroke-ink-500', plan: 'stroke-plan' };
const TONE_FILL: Record<string, string> = { info: 'fill-info', brand: 'fill-brand-500', ink: 'fill-ink-500', plan: 'fill-plan', crit: 'fill-crit' };

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

export interface LineSeries { key: string; label: string; tone: 'info' | 'brand' | 'ink' | 'plan'; values: (number | null)[] }

/** Evolución temporal. Click en un tramo → `onPick(i)` (para ver los trabajos de ese tramo). */
export function LineChart({ labels, series, height = 200, unit, onPick, pickHint }: {
  labels: string[]; series: LineSeries[]; height?: number; unit: string; onPick?: (i: number) => void; pickHint?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 32, r: 12, t: 10, b: 24 };
  const w = Math.max(width, 200); const ih = height - pad.t - pad.b; const iw = w - pad.l - pad.r;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const tick = (t: number) => (max >= 10000 ? (t >= 1e6 ? `${fmtNum(t / 1e6, 1)} M` : `${fmtNum(t / 1000, 0)} mil`) : fmtNum(t, 0));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 56))));

  return (
    <div ref={ref} className="relative w-full select-none">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-ink-800" aria-hidden="true">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={clsx('inline-block w-3 h-[2px] rounded', TONE_BG[s.tone] ?? 'bg-ink-500')} />{s.label}
            </span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={`Gráfico de líneas: ${series.map((s) => s.label).join(', ')}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left;
            const i = n <= 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
            setHover(Math.min(n - 1, Math.max(0, i)));
          }}
          onClick={() => { if (hover !== null && onPick) onPick(hover); }}
          className={onPick ? 'cursor-pointer' : undefined}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-ink-200" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-600 text-[10px]">{tick(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => i % labelEvery === 0 && (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-ink-600 text-[10px]">{l}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="stroke-ink-300" strokeWidth={1} />}
          {series.map((s) => {
            const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`));
            const segs: string[][] = []; let cur: string[] = [];
            pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
            if (cur.length) segs.push(cur);
            return (
              <g key={s.key}>
                {segs.map((sg, k) => <polyline key={k} points={sg.join(' ')} fill="none" className={TONE_STROKE[s.tone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
                {s.values.map((v, i) => v !== null && (hover === i || n <= 12) && (
                  <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} className={clsx(TONE_FILL[s.tone], 'stroke-white')} strokeWidth={2} />
                ))}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="pointer-events-none absolute z-20 top-6 rounded-lg bg-white border border-ink-200 shadow-pop px-2.5 py-1.5 text-xs"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), w - 150) }}>
          <div className="font-semibold text-ink-900 mb-0.5">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-ink-800">
              <span className={clsx('w-2 h-2 rounded-full', TONE_BG[s.tone])} />{s.label}: <b className="tabular-nums">{s.values[hover] === null ? '—' : fmtNum(s.values[hover], 1)}</b> {unit}
            </div>
          ))}
          {onPick && <div className="text-[10px] text-ink-600 mt-0.5">{pickHint ?? 'Click para ver los trabajos'}</div>}
        </div>
      )}
      {/* Vista de tabla para lectores de pantalla */}
      <table className="sr-only">
        <thead><tr><th>Tramo</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td>{series.map((s) => <td key={s.key}>{s.values[i] ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export interface BarRow { key: string; label: string; value: number; display?: string; sub?: string; tone?: string; onClick?: () => void }

/** Barras horizontales para comparar categorías. Toda la fila es clickeable si tiene `onClick`. */
export function BarList({ rows, max, emptyText = 'Sin datos' }: { rows: BarRow[]; max?: number; emptyText?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <div className="text-sm text-ink-700 py-4">{emptyText}</div>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="w-36 shrink-0 truncate text-left text-ink-800" title={r.label}>{r.label}</span>
            <span className="flex-1 h-2.5 bg-ink-100 rounded-r-[4px] overflow-hidden">
              <span className={clsx('block h-full rounded-r-[4px]', TONE_BG[r.tone ?? 'info'])} style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / m) * 100)}%` }} />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums font-semibold text-ink-900">{r.display ?? fmtNum(r.value)}</span>
            {r.sub !== undefined && <span className="w-28 shrink-0 text-right text-[11px] text-ink-700 truncate">{r.sub}</span>}
          </>
        );
        return (
          <li key={r.key}>
            {r.onClick ? (
              <button type="button" onClick={r.onClick} className="w-full flex items-center gap-2 text-xs py-1 px-1 -mx-1 rounded hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{inner}</button>
            ) : <div className="flex items-center gap-2 text-xs py-1">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export interface DotColumn { key: string; label: string; dots: { id: string; value: number; alert: boolean; title: string }[] }

/**
 * Antigüedad de los trabajos abiertos por etapa ("aging"): un punto por trabajo,
 * altura = días desde el ingreso. La línea de referencia es el p85 del tiempo de
 * ciclo de los entregados: un punto por encima ya tardó más que la mayoría.
 */
export function AgingChart({ columns, refLine, refLabel, unit, onDot, height = 240 }: {
  columns: DotColumn[]; refLine: number | null; refLabel: string; unit: string; onDot: (id: string) => void; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; title: string } | null>(null);
  const pad = { l: 32, r: 8, t: 12, b: 34 };
  const w = Math.max(width, 300); const iw = w - pad.l - pad.r; const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(refLine ?? 0, 1, ...columns.flatMap((c) => c.dots.map((d) => d.value))));
  const cw = iw / columns.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label="Antigüedad de los trabajos abiertos por etapa">
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-ink-200" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-600 text-[10px]">{fmtNum(t, 0)}</text>
            </g>
          ))}
          {columns.map((c, ci) => (
            <g key={c.key}>
              {ci > 0 && <line x1={pad.l + ci * cw} x2={pad.l + ci * cw} y1={pad.t} y2={pad.t + ih} className="stroke-ink-100" strokeWidth={1} />}
              <text x={pad.l + ci * cw + cw / 2} y={height - 18} textAnchor="middle" className="fill-ink-800 text-[10px] font-medium">{c.label}</text>
              <text x={pad.l + ci * cw + cw / 2} y={height - 5} textAnchor="middle" className="fill-ink-600 text-[10px]">{c.dots.length} abiertos</text>
              {c.dots.map((d, di) => {
                // Dispersión horizontal determinística para que no se tapen.
                const jitter = ((di * 37) % 11) / 10 - 0.5;
                const cx = pad.l + ci * cw + cw / 2 + jitter * Math.min(cw * 0.6, 60);
                const cy = y(d.value);
                return (
                  <circle key={d.id} cx={cx} cy={cy} r={5} className={clsx(d.alert ? 'fill-crit' : 'fill-info', 'stroke-white cursor-pointer')} strokeWidth={2}
                    tabIndex={0} role="button" aria-label={`${d.title}: ${fmtNum(d.value, 1)} ${unit}`}
                    onMouseEnter={() => setHover({ x: cx, y: cy, title: `${d.title} · ${fmtNum(d.value, 1)} ${unit}` })} onMouseLeave={() => setHover(null)}
                    onClick={() => onDot(d.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDot(d.id); }} />
                );
              })}
            </g>
          ))}
          {refLine !== null && (
            <g>
              <line x1={pad.l} x2={w - pad.r} y1={y(refLine)} y2={y(refLine)} className="stroke-brand-500" strokeWidth={1.5} />
              <text x={w - pad.r - 2} y={y(refLine) - 4} textAnchor="end" className="fill-brand-700 text-[10px] font-medium">{refLabel}</text>
            </g>
          )}
        </svg>
      )}
      {hover && (
        <div className="pointer-events-none absolute z-20 rounded-lg bg-ink-900 text-white text-xs px-2 py-1 shadow-pop whitespace-nowrap"
          style={{ left: Math.min(hover.x + 8, w - 220), top: Math.max(0, hover.y - 30) }}>{hover.title}</div>
      )}
    </div>
  );
}
