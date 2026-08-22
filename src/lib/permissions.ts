import type { RoleId, Job, User } from '../types';

export function canCreateJobs(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canEditAnyJob(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canChangePriority(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canAssign(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canManageUsers(role: RoleId) { return role === 'admin'; }
export function canApproveFiles(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canUploadFiles(role: RoleId) { return role !== 'instalacion'; }
export function canSeeStats(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canBlock() { return true; } // cualquier rol puede informar un bloqueo
export function canCompleteInstallation(role: RoleId) { return role === 'admin' || role === 'coordinador' || role === 'instalacion'; }

/** ¿Puede este usuario ver este trabajo? Admin/coordinador ven todo; el resto solo lo suyo. */
export function canViewJob(user: User, job: Job): boolean {
  if (user.role === 'admin' || user.role === 'coordinador') return true;
  return job.responsibleUserId === user.id || job.assignedUserIds.includes(user.id);
}

export function visibleJobs(user: User, jobs: Job[]): Job[] {
  return jobs.filter((j) => canViewJob(user, j));
}
