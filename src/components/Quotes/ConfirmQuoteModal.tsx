import { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobTypes } from '../../data/catalog';

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

function addDaysLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pide, antes de convertir un presupuesto en trabajo, los 3 datos que un
 * trabajo exige sí o sí (tipo de trabajo, fecha de entrega comprometida,
 * responsable — las 3 columnas `not null` de `jobs` que un presupuesto nunca
 * carga, ver `ConfirmQuoteExtra` en useStore.ts) en vez de inventarlos. Todo
 * lo demás (cliente, nombre, ítems/medidas/materiales) ya está en el
 * presupuesto y se copia solo, sin volver a pedirse acá.
 */
export function ConfirmQuoteModal({
  onClose, onConfirm, confirming,
}: {
  onClose: () => void;
  onConfirm: (jobTypeId: string, committedDate: string, responsibleUserId: string) => void;
  confirming: boolean;
}) {
  const jobTypes = visibleJobTypes(useStore((s) => s.jobTypes));
  const producers = useStore((s) => s.users).filter((u) => u.active && u.isProducer);

  const [jobTypeId, setJobTypeId] = useState('');
  const [committedDate, setCommittedDate] = useState(addDaysLocal(7));
  const [responsibleUserId, setResponsibleUserId] = useState(producers[0]?.id ?? '');

  const canSubmit = jobTypeId && committedDate && responsibleUserId;

  return (
    <div
      className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 p-4" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="confirm-quote-title"
        className="bg-white rounded-2xl shadow-pop w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 id="confirm-quote-title" className="font-display font-bold text-ink-900">Confirmar presupuesto</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
        </div>
        <p className="text-sm text-ink-800 mb-4">
          Se va a generar un trabajo nuevo con el cliente, nombre y detalle ya cargados en este presupuesto — solo
          falta esto, que un presupuesto todavía no pide:
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="cq-jobtype" className={labelCls}>Tipo de trabajo</label>
            <select id="cq-jobtype" className={inputCls} value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value)}>
              <option value="">Elegir...</option>
              {jobTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cq-date" className={labelCls}>Fecha de entrega comprometida</label>
            <input id="cq-date" type="date" className={inputCls} value={committedDate} onChange={(e) => setCommittedDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cq-responsible" className={labelCls}>Responsable inicial</label>
            <select id="cq-responsible" className={inputCls} value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
              <option value="">Elegir...</option>
              {producers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <p className="text-[11px] text-ink-700 mt-1">
              El trabajo entra a Pendientes igual — esto es solo quién queda como responsable para arrancar a procesarlo.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={confirming} className="px-3.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40">Cancelar</button>
          <button
            disabled={!canSubmit || confirming}
            onClick={() => canSubmit && onConfirm(jobTypeId, committedDate, responsibleUserId)}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? 'Generando trabajo...' : 'Confirmar y generar trabajo'}
          </button>
        </div>
      </div>
    </div>
  );
}
