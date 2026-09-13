import type { Job, Client } from '../types';

/**
 * Mensaje sugerido para avisarle al cliente que el trabajo está listo — pensado
 * para copiar/pegar o mandar por WhatsApp desde la ficha. Es un punto de partida
 * editable, nunca se manda solo (ver ClientMessageModal.tsx).
 */
export function buildClientReadyMessage(job: Job, client?: Client): string {
  const name = job.contactName.trim() || client?.name.trim() || '';
  const greeting = name ? `¡Hola ${name}!` : '¡Hola!';
  const ref = job.code ? ` (N° ${job.code})` : '';
  const action = job.requiresInstallation ? 'coordinar la instalación' : 'coordinar el retiro';
  return `${greeting} Te escribimos de Estudio Bonta para avisarte que tu pedido "${job.name}"${ref} ya está listo — nos comunicamos para ${action}. ¡Gracias por tu confianza!`;
}

/** Solo dígitos — wa.me necesita el número completo (con código de país) sin signos. */
export function whatsappLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
