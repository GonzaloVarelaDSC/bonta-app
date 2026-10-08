import { useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_LABELS } from '../../data/catalog';
import { StatusAccent, StatusBadge } from '../Common/Badges';
import { format } from 'date-fns';

// Cuántos avisos se ven a la vez — el resto queda guardado y va apareciendo a
// medida que se cierran los de arriba (no se pierde ninguno).
const MAX_VISIBLE = 4;

/**
 * Avisos flotantes de "otra persona cambió el estado de un trabajo" (07/10).
 * Mecanismo aparte de la campana (`notifications`) y del `Toast` de AppLayout:
 * no se persiste, NO se cierra solo (quien está lejos de la PC tiene que
 * encontrarlo al volver) y se apila con el más reciente arriba. Sale de
 * `statusFlags` del store, que solo se llena con cambios de OTROS usuarios.
 */
export function StatusFlags() {
  const flags = useStore((s) => s.statusFlags);
  const dismiss = useStore((s) => s.dismissStatusFlag);
  const dismissAll = useStore((s) => s.dismissAllStatusFlags);
  const navigate = useNavigate();

  if (flags.length === 0) return null;
  const visible = flags.slice(0, MAX_VISIBLE);
  const hidden = flags.length - visible.length;

  return (
    // top-[4.75rem] = alto del Header (h-16) + aire; z-20 queda por debajo de los
    // menús del Header (z-30) y del drawer mobile (z-30/40).
    <div
      role="region" aria-label="Cambios de estado de otros usuarios"
      className="fixed top-[4.75rem] right-4 z-20 w-[calc(100vw-2rem)] max-w-xs space-y-2 pointer-events-none"
    >
      {visible.map((f) => (
        <div
          key={f.id}
          className="pointer-events-auto relative flex gap-2.5 bg-white border border-ink-100 rounded-xl shadow-pop pl-3 pr-9 py-2.5 motion-safe:animate-flag-in"
        >
          <StatusAccent status={f.to} className="shrink-0" />
          <button
            type="button" onClick={() => navigate(`/trabajos/${f.jobId}`)}
            aria-label={`Cambio de estado en ${f.jobName}: de ${STATUS_LABELS[f.from]} a ${STATUS_LABELS[f.to]}, por ${f.userName}, ${format(new Date(f.at), 'HH:mm')}. Abrir ficha.`}
            className="min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-ink-700">Cambio de estado</span>
            <span className="block text-sm font-display font-bold text-ink-900 leading-snug truncate mt-0.5">{f.jobName}</span>
            <span className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-xs text-ink-700">{STATUS_LABELS[f.from]}</span>
              <ArrowRight size={12} className="text-ink-700 shrink-0" aria-hidden />
              <StatusBadge status={f.to} />
            </span>
            <span className="block text-xs text-ink-700 mt-1.5">{f.userName} · {format(new Date(f.at), 'HH:mm')}</span>
          </button>
          <button
            type="button" onClick={() => dismiss(f.id)} aria-label={`Cerrar aviso de ${f.jobName}`}
            className="absolute top-2 right-2 p-1 rounded text-ink-700 hover:text-ink-900 hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      {hidden > 0 && (
        <div className="pointer-events-auto flex items-center justify-between bg-white border border-ink-100 rounded-lg shadow-card px-3 py-1.5 text-xs text-ink-700">
          <span>+{hidden} {hidden === 1 ? 'aviso más' : 'avisos más'}</span>
          <button type="button" onClick={dismissAll} className="font-semibold text-ink-900 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Cerrar todos
          </button>
        </div>
      )}
    </div>
  );
}
