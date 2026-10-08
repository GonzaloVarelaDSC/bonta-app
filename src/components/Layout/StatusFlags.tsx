import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../store/useStore';
import { STATUS_LABELS } from '../../data/catalog';
import { StatusBadge, statusSurfaceClasses } from '../Common/Badges';
import { format } from 'date-fns';

// Cuántos avisos se ven a la vez — el resto queda guardado y va apareciendo a
// medida que se cierran los que están a la vista (no se pierde ninguno).
const MAX_VISIBLE = 4;

/**
 * Avisos flotantes de "otra persona cambió el estado de un trabajo" (07/10).
 * Mecanismo aparte de la campana (`notifications`) y del `Toast` de AppLayout:
 * no se persiste, NO se cierra solo (quien está lejos de la PC tiene que
 * encontrarlo al volver). Abajo a la derecha (pedido de Gonzalo, 07/10), con el
 * más reciente arriba de la pila; si hay un Toast abierto (mismo rincón), la
 * pila sube para no quedar tapada.
 */
export function StatusFlags() {
  const flags = useStore((s) => s.statusFlags);
  const toastOpen = useStore((s) => !!s.toast);
  const dismiss = useStore((s) => s.dismissStatusFlag);
  const dismissAll = useStore((s) => s.dismissAllStatusFlags);
  const navigate = useNavigate();

  if (flags.length === 0) return null;
  const visible = flags.slice(0, MAX_VISIBLE);
  const hidden = flags.length - visible.length;

  return (
    // z-20 queda por debajo de los menús del Header (z-30) y del drawer mobile (z-30/40).
    <div
      role="region" aria-label="Cambios de estado de otros usuarios"
      className={clsx(
        'fixed right-4 z-20 w-[calc(100vw-2rem)] max-w-sm space-y-2.5 pointer-events-none transition-[bottom] duration-200',
        toastOpen ? 'bottom-24' : 'bottom-4'
      )}
    >
      {hidden > 0 && (
        <div className="pointer-events-auto flex items-center justify-between bg-white border border-ink-200 rounded-lg shadow-card px-3 py-1.5 text-xs text-ink-700">
          <span>+{hidden} {hidden === 1 ? 'aviso más' : 'avisos más'}</span>
          <button type="button" onClick={dismissAll} className="font-semibold text-ink-900 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Cerrar todos
          </button>
        </div>
      )}
      {visible.map((f) => {
        const time = format(new Date(f.at), 'HH:mm');
        const open = () => navigate(`/trabajos/${f.jobId}`);
        return (
          <div
            key={f.id}
            className="pointer-events-auto overflow-hidden bg-white border border-ink-200 rounded-xl shadow-pop ring-1 ring-ink-900/5 motion-safe:animate-flag-in"
          >
            {/* Cabecera teñida con el color del estado nuevo: es lo que da entidad al aviso. */}
            <div className={clsx('flex items-center gap-2 border-b px-3.5 py-2', statusSurfaceClasses(f.to))}>
              <RefreshCw size={13} aria-hidden className="shrink-0" />
              <span className="flex-1 text-[11px] uppercase tracking-wider font-bold">Cambio de estado</span>
              <span className="text-[11px] font-semibold opacity-80">{time}</span>
              <button
                type="button" onClick={() => dismiss(f.id)} aria-label={`Cerrar aviso de ${f.jobName}`}
                className="-mr-1 p-1 rounded hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <button
              type="button" onClick={open}
              aria-label={`Cambio de estado en ${f.jobName}: de ${STATUS_LABELS[f.from]} a ${STATUS_LABELS[f.to]}, por ${f.userName}, ${time}. Abrir ficha.`}
              className="block w-full text-left px-3.5 pt-3 pb-3 hover:bg-ink-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            >
              <span className="block text-base font-display font-bold text-ink-900 leading-snug line-clamp-2 break-words">{f.jobName}</span>
              <span className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-xs text-ink-700">{STATUS_LABELS[f.from]}</span>
                <ArrowRight size={14} className="text-ink-700 shrink-0" aria-hidden />
                <StatusBadge status={f.to} />
              </span>
              <span className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-ink-100 text-xs">
                <span className="text-ink-700 truncate">Por <span className="font-semibold text-ink-900">{f.userName}</span></span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700 shrink-0">
                  Ver ficha <ArrowRight size={12} aria-hidden />
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
