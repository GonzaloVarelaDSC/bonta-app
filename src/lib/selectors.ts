import { differenceInCalendarDays } from 'date-fns';
import type { Job } from '../types';
import { effectivePriority } from './priority';
import { minutesRemaining } from './dates';
import { isSilent } from './risk';

// Gonzalo, 16/09: los trabajos Entregados se acumulaban sin límite en el Kanban
// y en Trabajos, ensuciando la vista del día a día. Pasados estos días desde
// `finishedAt`, un trabajo Entregado se considera "archivado" — desaparece de
// la vista por default de esas dos pantallas, cada una con un toggle "Ver
// archivados" para volver a encontrarlo (no se borra ni pierde acceso).
// Subido de 3 a 5 días en la Fase 4 (17/09) a pedido explícito de Gonzalo — sigue
// siendo puramente calculado al vuelo (sin cron ni columna `archived_at`/
// `archived_by`, ver CLAUDE.md sección 39): "archivado" no es una acción que
// alguien ejecuta, es una fecha vencida. Un archivado real y consultable (con
// buscador propio) vive en la sección Histórico, admin-only.
export const ARCHIVE_AFTER_DAYS = 5;

export function isArchivedJob(job: Job): boolean {
  if (job.status !== 'TERMINADO' || !job.finishedAt) return false;
  return differenceInCalendarDays(new Date(), new Date(job.finishedAt)) >= ARCHIVE_AFTER_DAYS;
}

// Borrado lógico (Fase 4) — desaparece de las vistas operativas, consultable/
// restaurable desde Histórico. Independiente de isArchivedJob (un trabajo puede
// estar archivado sin estar eliminado, y viceversa: se puede eliminar un trabajo
// activo, no solo uno ya entregado).
export function isDeletedJob(job: Job): boolean {
  return !!job.deletedAt;
}

export function isOverdue(job: Job): boolean {
  return minutesRemaining(job.committedDate) < 0 && job.status !== 'TERMINADO' && job.status !== 'CANCELADO';
}
export function isBlocked(job: Job): boolean {
  return job.blockRecords.some((b) => !b.closedAt);
}
export function isDueToday(job: Job): boolean {
  const mins = minutesRemaining(job.committedDate);
  return mins >= 0 && mins <= 24 * 60 && job.status !== 'TERMINADO' && job.status !== 'CANCELADO';
}
export function isMissingInfo(job: Job): boolean {
  return job.status === 'FALTA_INFORMACION';
}
export function isActive(job: Job): boolean {
  return job.status !== 'TERMINADO' && job.status !== 'CANCELADO';
}

export interface DashboardCounts {
  pending: number; critical: number; urgent: number; dueToday: number; overdue: number;
  blocked: number; inDesign: number; inProduction: number; readyToDeliver: number; waitingInfo: number; silent: number;
}

export function computeCounts(jobs: Job[]): DashboardCounts {
  return {
    pending: jobs.filter((j) => j.status === 'PENDIENTE').length,
    critical: jobs.filter((j) => isActive(j) && effectivePriority(j) === 'CRITICO').length,
    urgent: jobs.filter((j) => isActive(j) && effectivePriority(j) === 'URGENTE').length,
    dueToday: jobs.filter(isDueToday).length,
    overdue: jobs.filter(isOverdue).length,
    blocked: jobs.filter(isBlocked).length,
    inDesign: jobs.filter((j) => j.status === 'EN_DISENO' || j.status === 'DISENO_LISTO').length,
    inProduction: jobs.filter((j) => j.status === 'EN_PRODUCCION').length,
    readyToDeliver: jobs.filter((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION').length,
    waitingInfo: jobs.filter(isMissingInfo).length,
    silent: jobs.filter((j) => isSilent(j)).length,
  };
}

export function missingFields(job: Job): string[] {
  const missing: string[] = [];
  if (job.products.length === 0) missing.push('Detalle del trabajo (productos, materiales, medidas)');
  if (job.requiresInstallation && !job.installation?.address.trim()) missing.push('Dirección de instalación');
  return missing;
}

export function sortByPriority(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const pa = effectivePriority(a); const pb = effectivePriority(b);
    const order = { CRITICO: 0, URGENTE: 1, NORMAL: 2, PLANIFICADO: 3, EN_ESPERA: 4 };
    if (order[pa] !== order[pb]) return order[pa] - order[pb];
    return minutesRemaining(a.committedDate) - minutesRemaining(b.committedDate);
  });
}
