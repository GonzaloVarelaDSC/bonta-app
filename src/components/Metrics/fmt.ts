import { useEffect, useRef, useState } from 'react';

// Formatos y helpers compartidos del módulo Métricas (separados de los
// componentes para que el recargado en caliente de Vite funcione bien).
export const fmtNum = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : x.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const fmtPct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x)}%`);
export const fmtDays = (x: number | null | undefined, unit: string) => (x === null || x === undefined ? '—' : `${fmtNum(x, 1)} ${unit}`.trim());

// Clases completas a propósito (Tailwind solo genera las que ve escritas).
export const TONE_BG: Record<string, string> = {
  wait: 'bg-wait', info: 'bg-info', norm: 'bg-norm', review: 'bg-review', plan: 'bg-plan', site: 'bg-site',
  done: 'bg-ink-500', crit: 'bg-crit', urg: 'bg-urg', brand: 'bg-brand-500', ink: 'bg-ink-500',
};

/** Ancho real de un contenedor, para que los gráficos SVG no deformen el texto. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
