import { differenceInCalendarDays } from 'date-fns';
import type { Job, JobStatus, Priority } from '../types';

// La prioridad la elige una persona al crear el trabajo (25/08) y es editable
// desde la ficha. Desde el 04/11 además **sube sola** a medida que se acerca la
// fecha de entrega: un trabajo cargado como "Planificado" que se entrega hoy
// tiene que verse Crítico. Solo sube, nunca baja lo que eligió una persona, y no
// se guarda en la base: se calcula al mostrar, así siempre está al día.
// `priorityAuto` sigue en el esquema solo como respaldo de trabajos viejos sin
// `priorityManual` cargado.

// Ya salió de producción (o se cerró): el plazo deja de apurar.
const NO_ESCALATION: JobStatus[] = ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION', 'TERMINADO', 'CANCELADO'];

/** Prioridad que corresponde solo por la fecha (misma escala que sugiere Carga rápida). */
export function datePriority(date: string, now: Date = new Date()): Priority {
  if (!date) return 'NORMAL';
  // "2026-11-04" (input de fecha) se lee como día local, no UTC.
  const d = date.length === 10 ? new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) : new Date(date);
  const days = differenceInCalendarDays(d, now);
  if (days <= 1) return 'CRITICO';
  if (days <= 3) return 'URGENTE';
  if (days <= 7) return 'NORMAL';
  return 'PLANIFICADO';
}

/** La que eligió una persona (o el respaldo viejo), sin el ajuste por fecha. */
export function chosenPriority(job: Job): Priority {
  return job.priorityManual ?? job.priorityAuto;
}

/** La que se muestra y se usa para ordenar/filtrar: la elegida, subida por la fecha si hace falta. */
export function effectivePriority(job: Job, now: Date = new Date()): Priority {
  const chosen = chosenPriority(job);
  // "En espera" es una pausa a propósito (depende de resolver algo antes): no corre plazo.
  if (chosen === 'EN_ESPERA' || NO_ESCALATION.includes(job.status) || !job.committedDate) return chosen;
  const byDate = datePriority(job.committedDate, now);
  return PRIORITY_META[byDate].order < PRIORITY_META[chosen].order ? byDate : chosen;
}

/** true si la prioridad que se ve subió sola por la fecha (para explicarlo en pantalla). */
export function isEscalatedByDate(job: Job, now: Date = new Date()): boolean {
  return effectivePriority(job, now) !== chosenPriority(job);
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
