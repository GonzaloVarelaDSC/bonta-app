import type { Job, JobStatus } from '../types';
import { STATUS_LABELS } from '../data/catalog';

// Estados que se pueden elegir a mano desde la tarjeta/tabla — bloqueado y cancelado
// quedan afuera porque tienen su propio flujo (motivo de bloqueo, etc.) y no son un
// simple cambio de estado.
export const SELECTABLE_STATUSES: JobStatus[] = [
  'NUEVO', 'FALTA_INFORMACION', 'APROBADO', 'EN_DISENO', 'DISENO_LISTO',
  'EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 'LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION',
  'EN_INSTALACION', 'TERMINADO',
];

/** Bloquea el pase a "listo" si faltan ítems obligatorios del control de calidad — vale para Kanban y para la tabla. */
export function tryChangeJobStatus(
  job: Job,
  targetStatus: JobStatus,
  setStatus: (jobId: string, status: JobStatus, byUserId: string) => Promise<void>,
  byUserId: string
) {
  if (targetStatus === 'LISTO_PARA_ENTREGA' || targetStatus === 'LISTO_PARA_INSTALACION') {
    const requiredPending = job.qualityChecks.filter((q) => q.required && !q.checked);
    if (requiredPending.length > 0) {
      alert(`No se puede pasar a "${STATUS_LABELS[targetStatus]}": faltan ${requiredPending.length} ítems obligatorios del control de calidad. Completalos desde la ficha del trabajo.`);
      return;
    }
  }
  setStatus(job.id, targetStatus, byUserId);
}
