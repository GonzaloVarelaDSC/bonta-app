import type { Job, JobStatus } from '../types';
import { STATUS_LABELS, KANBAN_COLUMNS } from '../data/catalog';
import { friendlyError } from './errors';
// Excepción puntual a "lib/ no toca el store" — el toast global (AppLayout)
// vive en el store y ya se usa como canal de avisos no bloqueantes en toda la
// app (ver §18.9); reusarlo acá evita duplicar el callback en los 4 lugares
// que llaman a tryChangeJobStatus (Kanban, JobsTable, DashboardJobCard, ficha).
// No hay ciclo de imports: useStore.ts no importa este archivo.
import { useStore } from '../store/useStore';

// Gonzalo, 17/09: el select de estado (Dashboard/Trabajos/ficha) mostraba hasta
// 11 valores para admin/coordinador (PENDIENTE, FALTA_INFORMACION, EN_DISENO,
// DISENO_LISTO, ...) mientras el Kanban solo tiene 7 columnas — "muchísimas
// opciones" que no se correspondían una a una con lo que se ve en el tablero.
// Se saca la distinción por rol (Kanban tampoco restringe quién puede arrastrar
// una tarjeta a qué columna — cualquiera que vea el trabajo puede) y las
// opciones pasan a ser **exactamente** el primer estado de cada columna del
// Kanban (`KANBAN_COLUMNS[].statuses[0]`) — derivado de la misma fuente, así que
// nunca puede desalinearse del tablero. Si Kanban cambia sus columnas, este
// select cambia solo.
//
// Dos estados quedan deliberadamente fuera de esta lista, con su propio camino:
// - `FALTA_INFORMACION` — se sigue alcanzando solo (creación con instalación sin
//   dirección) y, si ya está puesto, aparece como opción extra del select vía el
//   fallback de abajo (para poder sacarlo), pero ya no se ofrece para ponerlo a
//   mano — es el mismo criterio que ya se aplicaba a Kanban, que tampoco tiene
//   columna propia para este estado (se agrupaba dentro de "Pendiente").
// - `CANCELADO` — pasa a tener su propio botón "Cancelar trabajo" en la ficha
//   (mismo patrón que "Bloquear trabajo") en vez de compartir el select con los
//    7 estados de flujo normal — cancelar es una decisión administrativa, no un
//   paso más de la cadena de producción. Revertir un cancelado sigue andando
//   igual: aparece como opción extra mientras el trabajo esté en ese estado.
const PRIMARY_STATUS_OPTIONS: JobStatus[] = KANBAN_COLUMNS.map((c) => c.statuses[0]);

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
 * Opciones a mostrar en el select de estado de un trabajo puntual — las mismas
 * para todos los roles (ver comentario arriba). Se agrega el estado actual como
 * opción extra si no está entre las 7 (ej. un trabajo en "Falta información",
 * "Procesado", "Listo para instalación" o "Cancelado") para que el select nunca
 * quede en blanco y siempre se pueda sacar de ahí.
 */
export function statusOptionsFor(job: Job): JobStatus[] {
  return PRIMARY_STATUS_OPTIONS.includes(job.status) ? PRIMARY_STATUS_OPTIONS : [job.status, ...PRIMARY_STATUS_OPTIONS];
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
  // El select de estado ofrece un solo "Listo para entregar" (ver
  // PRIMARY_STATUS_OPTIONS) — si el trabajo requiere instalación, el destino
  // real es LISTO_PARA_INSTALACION, mismo criterio que ya aplica el drag&drop
  // del Kanban al soltar en esa columna.
  if (targetStatus === 'LISTO_PARA_ENTREGA' && job.requiresInstallation) {
    targetStatus = 'LISTO_PARA_INSTALACION';
  }
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
