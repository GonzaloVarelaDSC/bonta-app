import type { Job, Priority } from '../types';

// La prioridad ya NO se calcula sola por fecha/bloqueo/cliente importante — Gonzalo
// pidió (25/08, segunda ronda) que la urgencia sea siempre una decisión manual suya,
// elegida al crear el trabajo y editable después desde la ficha. `priorityAuto` sigue
// existiendo en el esquema como respaldo (default 'NORMAL' en la base) solo para los
// pocos trabajos viejos que quedaran sin `priorityManual` cargado.
export function effectivePriority(job: Job): Priority {
  return job.priorityManual ?? job.priorityAuto;
}

export const PRIORITY_META: Record<Priority, { label: string; emoji: string; order: number }> = {
  CRITICO: { label: 'Crítico', emoji: '🔴', order: 0 },
  URGENTE: { label: 'Urgente', emoji: '🟠', order: 1 },
  NORMAL: { label: 'Normal', emoji: '🟡', order: 2 },
  PLANIFICADO: { label: 'Planificado', emoji: '🟢', order: 3 },
  EN_ESPERA: { label: 'En espera', emoji: '⚪', order: 4 },
};
