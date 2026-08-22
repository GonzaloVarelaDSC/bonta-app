import type { Job, Priority } from '../types';
import { minutesRemaining } from './dates';

/**
 * Cascada de reglas — la primera que aplica gana. Deliberadamente NO es un
 * score ponderado: cada resultado tiene que poder explicarse en una frase,
 * porque un cálculo que nadie entiende es un cálculo que el equipo ignora.
 * Ver "Sistema de prioridad" en la especificación.
 */
export function calculateAutoPriority(job: Job, now: Date = new Date()): Priority {
  const isBlocked = job.blockRecords.some((b) => !b.closedAt);
  const missingInfo =
    !job.measurements.trim() ||
    job.materialIds.length === 0 ||
    !job.technique.trim() ||
    (job.requiresInstallation && !job.installation?.address);

  const mins = minutesRemaining(job.committedDate, now);
  const hours = mins / 60;

  // Regla 5 pisa a las demás: si no puede avanzar, no importa la fecha.
  if (missingInfo || job.status === 'FALTA_INFORMACION') return 'EN_ESPERA';

  if (hours <= 24 || (isBlocked && hours <= 24)) return 'CRITICO';
  if (hours <= 48 || (isBlocked && hours <= 72) || job.clientImportant) return 'URGENTE';
  if (hours <= 72) return 'NORMAL';
  return 'PLANIFICADO';
}

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
