import type { RoleId, Job, User } from '../types';

export function canCreateJobs(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canEditAnyJob(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canChangePriority(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canAssign(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canManageUsers(role: RoleId) { return role === 'admin'; }
// Espejo de las policies job_types_write/materials_write (002_policies.sql) — solo admin.
export function canManageCatalog(role: RoleId) { return role === 'admin'; }
export function canApproveFiles(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canUploadFiles(role: RoleId) { return role !== 'instalacion'; }
export function canSeeStats(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
export function canBlock() { return true; } // cualquier rol puede informar un bloqueo
export function canCompleteInstallation(role: RoleId) { return role === 'admin' || role === 'coordinador' || role === 'instalacion'; }
export function canDeleteJob(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
// Histórico (Fase 4, 17/09): a diferencia del resto, Gonzalo pidió explícitamente
// que sea SOLO admin (Pancho/Martín/Gonzalo hoy) — ni coordinador. Deliberadamente
// distinto de canManageUsers aunque hoy coincidan en el mismo rol: si el día de
// mañana alguien no-admin necesita ver Usuarios pero no Histórico (o viceversa),
// no hace falta desenredar nada.
export function canViewHistorico(role: RoleId) { return role === 'admin'; }

/** ¿Puede este usuario ver este trabajo? Admin/coordinador ven todo; el resto solo lo suyo. */
export function canViewJob(user: User, job: Job): boolean {
  if (user.role === 'admin' || user.role === 'coordinador') return true;
  return job.responsibleUserId === user.id || job.assignedUserIds.includes(user.id);
}

export function visibleJobs(user: User, jobs: Job[]): Job[] {
  return jobs.filter((j) => canViewJob(user, j));
}
