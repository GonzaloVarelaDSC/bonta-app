import { useState } from 'react';
import { X } from 'lucide-react';
import { BLOCK_REASON_LABELS } from '../../data/catalog';
import type { BlockReason } from '../../types';

export function BlockModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: BlockReason, description: string) => void }) {
  const [reason, setReason] = useState<BlockReason>('falta_informacion');
  const [description, setDescription] = useState('');

  return (
    <div
      className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 p-4" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="block-modal-title"
        className="bg-white rounded-2xl shadow-pop w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="block-modal-title" className="font-display font-bold text-ink-900">Bloquear trabajo</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
        </div>
        <label htmlFor="block-reason" className="block text-xs font-medium text-ink-700 mb-1.5">Motivo</label>
        <select id="block-reason" value={reason} onChange={(e) => setReason(e.target.value as BlockReason)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-crit/30">
          {Object.entries(BLOCK_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label htmlFor="block-description" className="block text-xs font-medium text-ink-700 mb-1.5">Descripción (obligatoria)</label>
        <textarea id="block-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
          placeholder="Explicá qué falta o qué pasó, con el detalle que necesita quien lo lea después."
          className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-crit/30" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-50">Cancelar</button>
          <button
            disabled={!description.trim()}
            onClick={() => description.trim() && onConfirm(reason, description.trim())}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-crit text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Bloquear trabajo
          </button>
        </div>
      </div>
    </div>
  );
}
