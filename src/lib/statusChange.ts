import type { Job, JobStatus } from '../types';
import { STATUS_LABELS } from '../data/catalog';

// Estados que se pueden elegir a mano desde el selector de Dashboard/Trabajos/
// ficha — Gonzalo pidió (26/08) dejar solo las 4 decisiones que de verdad se
// toman a mano día a día; el resto (Pendiente, Diseño listo, Control de
// calidad, Instalación, Terminado, Bloqueado, Cancelado) se alcanza por su
// propio flujo (recién creado, drag en el Kanban, motivo de bloqueo,
// instalación completada) y no hace falta que compita en este select.
export const SELECTABLE_STATUSES: JobStatus[] = [
  'FALTA_INFORMACION', 'EN_DISENO', 'EN_PRODUCCION', 'LISTO_PARA_ENTREGA',
];

/**
 * Opciones a mostrar en el select de estado de un trabajo puntual: las 4
 * elegibles, más el estado actual si no es una de esas 4 (por ej. un trabajo
 * recién creado en "Pendiente", o uno que ya está en Instalación) — así el
 * select siempre puede mostrar el valor real en vez de quedar en blanco.
 */
export function statusOptionsFor(job: Job): JobStatus[] {
  return SELECTABLE_STATUSES.includes(job.status) ? SELECTABLE_STATUSES : [job.status, ...SELECTABLE_STATUSES];
}

/**
 * Bloquea el pase a "listo" si faltan ítems obligatorios del control de
 * calidad — vale para Kanban y para la tabla. Devuelve `true` si el cambio se
 * llegó a disparar (para que el Kanban sepa si ofrecer "Deshacer" o no —
 * si el gate lo rechazó, no cambió nada, no hay nada que deshacer).
 */
export function tryChangeJobStatus(
  job: Job,
  targetStatus: JobStatus,
  setStatus: (jobId: string, status: JobStatus, byUserId: string) => Promise<void>,
  byUserId: string
): boolean {
  if (targetStatus === 'LISTO_PARA_ENTREGA' || targetStatus === 'LISTO_PARA_INSTALACION') {
    const requiredPending = job.qualityChecks.filter((q) => q.required && !q.checked);
    if (requiredPending.length > 0) {
      alert(`No se puede pasar a "${STATUS_LABELS[targetStatus]}": faltan ${requiredPending.length} ítems obligatorios del control de calidad. Completalos desde la ficha del trabajo.`);
      return false;
    }
  }
  setStatus(job.id, targetStatus, byUserId);
  return true;
}
