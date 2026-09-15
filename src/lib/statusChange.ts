import type { Job, JobStatus, RoleId } from '../types';
import { STATUS_LABELS } from '../data/catalog';
import { friendlyError } from './errors';
// Excepción puntual a "lib/ no toca el store" — el toast global (AppLayout)
// vive en el store y ya se usa como canal de avisos no bloqueantes en toda la
// app (ver §18.9); reusarlo acá evita duplicar el callback en los 4 lugares
// que llaman a tryChangeJobStatus (Kanban, JobsTable, DashboardJobCard, ficha).
// No hay ciclo de imports: useStore.ts no importa este archivo.
import { useStore } from '../store/useStore';

// Estados que se pueden elegir a mano desde el selector de Dashboard/Trabajos/
// ficha. El 26/08 se habían dejado solo 4 (Falta información, En diseño, En
// producción, Listo para entrega) porque el resto se alcanza por su propio
// flujo — pero Gonzalo (02/09) pidió poder volver un trabajo a "Pendiente" a
// mano (por ej. si lo pasó de estado por error), así que se vuelve a sumar acá.
// Diseño listo/Control de calidad/Instalación/Terminado/Bloqueado/Cancelado
// se siguen alcanzando solo por su propio flujo (Kanban, motivo de bloqueo,
// instalación completada) y no compiten en este select.
export const SELECTABLE_STATUSES: JobStatus[] = [
  'PENDIENTE', 'FALTA_INFORMACION', 'EN_DISENO', 'EN_PRODUCCION', 'LISTO_PARA_ENTREGA',
];

// Lista completa para admin/coordinador (Gonzalo, 07/09: "poder hacer y deshacer
// todo lo posible") — incluye estados que normalmente se alcanzan por su propio
// flujo, para poder corregir a mano un trabajo mal cargado o revertir un
// "Terminado"/"Cancelado" puesto por error. BLOQUEADO no está: se llega por el
// botón "Bloquear trabajo" para que quede el motivo registrado. NUEVO y APROBADO
// tampoco: son estados viejos que ningún flujo produce (ver CLAUDE.md §7.4).
export const ADMIN_STATUSES: JobStatus[] = [
  'PENDIENTE', 'FALTA_INFORMACION', 'EN_DISENO', 'DISENO_LISTO', 'EN_PRODUCCION',
  'EN_CONTROL_CALIDAD', 'LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION',
  'TERMINADO', 'CANCELADO',
];

// Estados en los que el trabajo ya salió del estudio o se cerró — el contador de
// días hasta la entrega deja de correr acá (no tiene sentido mostrar "atrasado
// 3 días" en algo que ya se entregó). Ver CountdownBadge.
export const CLOSED_STATUSES: JobStatus[] = [
  'LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION', 'TERMINADO', 'CANCELADO',
];

export function isClosedStatus(status: JobStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/**
 * Opciones a mostrar en el select de estado de un trabajo puntual. Admin y
 * coordinador ven la lista completa (`ADMIN_STATUSES`) para poder corregir o
 * revertir cualquier cosa; el resto de los roles ve solo las 5 elegibles del
 * flujo normal. En ambos casos se agrega el estado actual si no está en la lista
 * (por ej. un trabajo recién bloqueado) para que el select nunca quede en blanco.
 */
export function statusOptionsFor(job: Job, role?: RoleId): JobStatus[] {
  const base = role === 'admin' || role === 'coordinador' ? ADMIN_STATUSES : SELECTABLE_STATUSES;
  return base.includes(job.status) ? base : [job.status, ...base];
}

/**
 * Punto único de cambio de estado — vale para Kanban y para la tabla. El
 * control de calidad NO bloquea más el pase a "listo" (Gonzalo, 02/09: ningún
 * checklist debe prohibir cambiar el estado, solo recordar) — si quedan
 * ítems obligatorios sin marcar se avisa con un recordatorio puntual (el
 * toast global, no un `alert()` — ver §25 hallazgo 2), pero el cambio se
 * aplica igual. Devuelve `true` siempre que el cambio se disparó (hoy
 * siempre, se mantiene el valor de retorno por si el Kanban necesita
 * distinguir "se aplicó" de "no se aplicó" en el futuro).
 */
export function tryChangeJobStatus(
  job: Job,
  targetStatus: JobStatus,
  setStatus: (jobId: string, status: JobStatus, byUserId: string) => Promise<void>,
  byUserId: string
): boolean {
  if (targetStatus === 'LISTO_PARA_ENTREGA' || targetStatus === 'LISTO_PARA_INSTALACION') {
    const requiredPending = job.qualityChecks.filter((q) => q.required && !q.checked);
    const lines: string[] = [];
    if (requiredPending.length > 0) {
      lines.push(`Recordatorio: quedan ${requiredPending.length} ítems obligatorios del control de calidad sin marcar. Podés completarlos desde la ficha cuando quieras — esto no impide pasar a "${STATUS_LABELS[targetStatus]}".`);
    }
    // "Texto automático para el cliente" (tintero §19) — se sugiere acá mismo,
    // no se manda solo: el mensaje se genera y se puede copiar/abrir en WhatsApp
    // desde la ficha (botón "Mensaje para el cliente", ver ClientMessageModal.tsx).
    lines.push('No te olvides de avisarle al cliente — desde la ficha podés generar el mensaje listo para copiar o mandar por WhatsApp.');
    useStore.setState({ toast: lines.join(' ') });
  }
  // AUDITORIA_UXUI_2026-09-15.md, ítem crítico #1: antes fire-and-forget — si
  // Supabase rechazaba el cambio, el rollback optimista del store pasaba en
  // silencio total, sin que la persona supiera por qué "volvió solo".
  setStatus(job.id, targetStatus, byUserId).catch((err) => alert(friendlyError(err)));
  return true;
}
