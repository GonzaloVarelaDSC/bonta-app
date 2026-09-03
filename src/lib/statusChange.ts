import type { Job, JobStatus } from '../types';
import { STATUS_LABELS } from '../data/catalog';

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
 * Punto único de cambio de estado — vale para Kanban y para la tabla. El
 * control de calidad NO bloquea más el pase a "listo" (Gonzalo, 02/09: ningún
 * checklist debe prohibir cambiar el estado, solo recordar) — si quedan
 * ítems obligatorios sin marcar se avisa con un recordatorio puntual, pero el
 * cambio se aplica igual. Devuelve `true` siempre que el cambio se disparó
 * (hoy siempre, se mantiene el valor de retorno por si el Kanban necesita
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
    if (requiredPending.length > 0) {
      alert(`Recordatorio: quedan ${requiredPending.length} ítems obligatorios del control de calidad sin marcar. Podés completarlos desde la ficha del trabajo cuando quieras — esto no impide pasar a "${STATUS_LABELS[targetStatus]}".`);
    }
  }
  setStatus(job.id, targetStatus, byUserId);
  return true;
}
