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

// Presupuestos (22/09) — mismo criterio que canCreateJobs: quien puede dar de
// alta un trabajo puede preparar un presupuesto (Gonzalo/Gastón incluidos,
// para cargar el detalle técnico aunque no puedan poner el precio — ver abajo).
export function canManageQuotes(role: RoleId) { return role === 'admin' || role === 'coordinador'; }
// Quién puede cargar/modificar el importe final (29/09, ver CLAUDE.md §55 —
// ajusta la regla original de §52): dueños (Pancho/Martín), administración
// (Richard/Nancy/Alejandra) y CUALQUIER admin, sea o no productor — Gonzalo
// pidió poder cargarlo él también sin dejar de ser productor (sigue apareciendo
// como Responsable / en "Carga de diseño"). Coordinador sigue necesitando
// `!isProducer` (así Gastón, coordinador+productor, sigue afuera) — mismo
// criterio de siempre, "admin = acceso total" ya vale para el resto de la app
// (§18.5/§31.1), esto solo lo extiende acá. No se hardcodea ningún nombre/email.
export function canSetQuoteValue(user: User) {
  return user.role === 'admin' || (user.role === 'coordinador' && !user.isProducer);
}

/** ¿Puede este usuario ver este trabajo? Admin/coordinador ven todo; el resto solo lo suyo. */
export function canViewJob(user: User, job: Job): boolean {
  if (user.role === 'admin' || user.role === 'coordinador') return true;
  return job.responsibleUserId === user.id || job.assignedUserIds.includes(user.id);
}

export function visibleJobs(user: User, jobs: Job[]): Job[] {
  return jobs.filter((j) => canViewJob(user, j));
}
