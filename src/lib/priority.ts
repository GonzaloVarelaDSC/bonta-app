import type { Job, Priority } from '../types';

// La prioridad ya NO se calcula sola por fecha/bloqueo/cliente importante — Gonzalo
// pidió (25/08, segunda ronda) que la urgencia sea siempre una decisión manual suya,
// elegida al crear el trabajo y editable después desde la ficha. `priorityAuto` sigue
// existiendo en el esquema como respaldo (default 'NORMAL' en la base) solo para los
// pocos trabajos viejos que quedaran sin `priorityManual` cargado.
export function effectivePriority(job: Job): Priority {
  return job.priorityManual ?? job.priorityAuto;
}

// `sla` es una propuesta de referencia (Gonzalo pidió dejar el plazo de cada
// prioridad visible en algún lado — esto es un punto de partida a confirmar/
// ajustar, no una regla ya cerrada). Se muestra como tooltip del badge y como
// parte del texto de cada opción en los selects de prioridad.
export const PRIORITY_META: Record<Priority, { label: string; emoji: string; order: number; sla: string }> = {
  CRITICO: { label: 'Crítico', emoji: '🔴', order: 0, sla: 'Para mañana, sí o sí' },
  URGENTE: { label: 'Urgente', emoji: '🟠', order: 1, sla: 'En 2-3 días hábiles' },
  NORMAL: { label: 'Normal', emoji: '🟡', order: 2, sla: 'Dentro de la semana' },
  PLANIFICADO: { label: 'Planificado', emoji: '🟢', order: 3, sla: 'Más de una semana, sin apuro' },
  EN_ESPERA: { label: 'En espera', emoji: '⚪', order: 4, sla: 'No corre plazo — depende de resolver algo antes' },
};
