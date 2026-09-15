import type { ReactNode } from 'react';

/**
 * Wrapper de "tarjeta con título" reusado en Carga rápida y Configuración —
 * antes cada pantalla reimplementaba el mismo bloque por separado (ver
 * AUDITORIA_UXUI_2026-09-15.md, sección 🟢 Bajo, "3 componentes Section
 * triplicados"). `variant="plain"` es el bloque sin tarjeta/sombra que usa la
 * hoja de exportación para el cliente (`JobExportPage`) — ahí una tarjeta
 * blanca con sombra no tiene sentido en una hoja pensada para imprimir.
 */
export function Section({
  title, hint, variant = 'card', children,
}: {
  title: string;
  hint?: string;
  variant?: 'card' | 'plain';
  children: ReactNode;
}) {
  if (variant === 'plain') {
    return (
      <div className="mb-5 break-inside-avoid">
        <div className="text-[11px] uppercase tracking-wide text-ink-700 font-semibold mb-1.5">{title}</div>
        <div className="text-sm text-ink-900 leading-relaxed">{children}</div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {hint && <p className="text-xs text-ink-700 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
