import { useState } from 'react';
import { X, Copy, Check, MessageCircle } from 'lucide-react';
import { buildClientReadyMessage, whatsappLink } from '../../lib/clientMessage';
import type { Job, Client } from '../../types';

/** Mismo lenguaje visual que BlockModal/Modal.tsx (backdrop, Escape, dialog). */
export function ClientMessageModal({ job, client, onClose }: { job: Job; client?: Client; onClose: () => void }) {
  const [text, setText] = useState(() => buildClientReadyMessage(job, client));
  const [copied, setCopied] = useState(false);
  const waHref = whatsappLink(job.contactPhone, text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('No se pudo copiar automáticamente — seleccioná el texto a mano.');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 p-4" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="client-msg-title"
        className="bg-white rounded-2xl shadow-pop w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="client-msg-title" className="font-display font-bold text-ink-900">Mensaje para el cliente</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
        </div>
        <label htmlFor="client-msg-text" className="block text-xs font-medium text-ink-700 mb-1.5">
          Editalo si hace falta antes de copiarlo o mandarlo — no se envía solo.
        </label>
        <textarea
          id="client-msg-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5}
          className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {!job.contactPhone.trim() && (
          <p className="text-xs text-wait-text bg-wait-bg rounded-md px-2.5 py-1.5 mb-4">
            Este trabajo no tiene teléfono de contacto cargado — solo podés copiar el texto. Cargalo en la pestaña General para poder abrirlo directo en WhatsApp.
          </p>
        )}
        <div className="flex gap-2 justify-end flex-wrap">
          {waHref && (
            <a
              href={waHref} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-plan-text text-white hover:brightness-110"
            >
              <MessageCircle size={15} /> Abrir en WhatsApp
            </a>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar mensaje'}
          </button>
        </div>
      </div>
    </div>
  );
}
