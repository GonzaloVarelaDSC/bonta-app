import type { Job } from '../types';
import { effectivePriority } from './priority';
import { minutesRemaining } from './dates';
import { isSilent } from './risk';

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
  critical: number; urgent: number; dueToday: number; overdue: number;
  blocked: number; inProduction: number; readyToDeliver: number; waitingInfo: number; silent: number;
}

export function computeCounts(jobs: Job[]): DashboardCounts {
  return {
    critical: jobs.filter((j) => isActive(j) && effectivePriority(j) === 'CRITICO').length,
    urgent: jobs.filter((j) => isActive(j) && effectivePriority(j) === 'URGENTE').length,
    dueToday: jobs.filter(isDueToday).length,
    overdue: jobs.filter(isOverdue).length,
    blocked: jobs.filter(isBlocked).length,
    inProduction: jobs.filter((j) => j.status === 'EN_PRODUCCION').length,
    readyToDeliver: jobs.filter((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION').length,
    waitingInfo: jobs.filter(isMissingInfo).length,
    silent: jobs.filter((j) => isSilent(j)).length,
  };
}

export function missingFields(job: Job): string[] {
  const missing: string[] = [];
  if (job.sizeItems.length === 0) missing.push('Medidas');
  if (job.materialIds.length === 0) missing.push('Material');
  if (job.files.length === 0) missing.push('Archivo');
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
