// Recetas de clases compartidas (rediseño "Pulido", 08/11): una sola forma de
// botón, de campo y de rótulo para toda la app. Antes cada pantalla tenía su
// copia de `inputCls` y botones con 6 alturas distintas.
//
// Alturas: sm 28px (acciones dentro de tablas/tarjetas), md 36px (default), y en
// celular todo control sube a 44px (`max-md:min-h-touch`).

const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-ctl font-semibold whitespace-nowrap transition-colors ' +
  'disabled:cursor-not-allowed ' + focus;

const btnSize = {
  sm: 'h-ctl-sm px-2.5 text-xs max-md:h-auto max-md:min-h-touch max-md:px-3',
  md: 'h-ctl px-3.5 text-sm max-md:h-auto max-md:min-h-touch',
  lg: 'h-ctl-lg px-5 text-sm',
} as const;

const btnVariant = {
  // Una sola acción principal por pantalla: crear, guardar, confirmar.
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-700',
  secondary: 'bg-white text-ink-900 border border-ink-300 hover:bg-ink-50 hover:border-ink-450 disabled:opacity-60',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-60',
  danger: 'bg-white text-crit-text border border-crit/40 hover:bg-crit-bg disabled:opacity-60',
} as const;

export function btn(variant: keyof typeof btnVariant = 'secondary', size: keyof typeof btnSize = 'md'): string {
  return `${btnBase} ${btnSize[size]} ${btnVariant[variant]}`;
}

/** Campo de texto/select/fecha: borde que llega a 3:1 (ink-450) y foco bronce. */
export const fieldCls =
  'w-full h-ctl max-md:h-auto max-md:min-h-touch rounded-ctl border border-ink-450 bg-white px-3 text-sm text-ink-900 ' +
  'transition-colors hover:border-ink-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

/** Igual que fieldCls pero para <select>: chevron propio (index.css). */
export const selectCls = `${fieldCls} select-chevron cursor-pointer`;

/** Rótulo de campo: sentence case, 12px, peso medio. */
export const labelCls = 'block text-xs font-medium text-ink-800 mb-1.5';

/** Tarjeta blanca base. */
export const cardCls = 'bg-white rounded-card border border-ink-200/80 shadow-card';
