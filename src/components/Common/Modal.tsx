import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Reemplaza confirm()/prompt() nativos del navegador — rompían el lenguaje
 * visual de la app y no daban ninguna señal clara de qué había pasado tras
 * confirmar/cancelar (ver CLAUDE.md §25, hallazgo 2). Mismo patrón visual que
 * BlockModal.tsx (backdrop, Escape para cerrar, dialog con aria-modal).
 */
function ModalShell({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 p-4" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-pop w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Reemplaza `confirm()` — mensaje + Confirmar/Cancelar. */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default', onConfirm, onClose,
}: {
  title: string; message: React.ReactNode; confirmLabel?: string; cancelLabel?: string;
  tone?: 'default' | 'danger'; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <ModalShell titleId="confirm-modal-title" onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 id="confirm-modal-title" className="font-display font-bold text-ink-900">{title}</h3>
        <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
      </div>
      <div className="text-sm text-ink-800 leading-relaxed mb-5">{message}</div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-50">{cancelLabel}</button>
        <button
          onClick={onConfirm}
          className={`px-3.5 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-95 ${tone === 'danger' ? 'bg-crit' : 'bg-brand-500'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

/** Reemplaza `prompt()` — mensaje + un textarea opcional + Confirmar/Cancelar. */
export function PromptDialog({
  title, label, placeholder, confirmLabel = 'Confirmar', onConfirm, onClose,
}: {
  title: string; label?: string; placeholder?: string; confirmLabel?: string;
  onConfirm: (value: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <ModalShell titleId="prompt-modal-title" onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 id="prompt-modal-title" className="font-display font-bold text-ink-900">{title}</h3>
        <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
      </div>
      {label && <label htmlFor="prompt-modal-input" className="block text-xs font-medium text-ink-700 mb-1.5">{label}</label>}
      <textarea
        id="prompt-modal-input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} rows={3}
        placeholder={placeholder}
        className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-50">Cancelar</button>
        <button
          onClick={() => onConfirm(value.trim())}
          className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:brightness-95"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
