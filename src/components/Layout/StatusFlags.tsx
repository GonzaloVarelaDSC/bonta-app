import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AtSign, PencilLine, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../store/useStore';
import { STATUS_LABELS } from '../../data/catalog';
import { StatusBadge, statusSurfaceClasses } from '../Common/Badges';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import type { StatusFlag } from '../../types';

// Cuántos avisos se ven a la vez — el resto queda guardado y va apareciendo a
// medida que se cierran los que están a la vista (no se pierde ninguno).
const MAX_VISIBLE = 4;
// En el celular cada aviso ocupa casi un cuarto de pantalla: con 4 apilados se
// tapaba todo. Se muestra uno y el resto queda en "+N avisos más".
const MAX_VISIBLE_PHONE = 1;
const PHONE_QUERY = '(max-width: 639px)';

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return isPhone;
}

/** Vuelve a dibujar cada 30 s para que el "hace N min" no quede viejo. */
function useTick() {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((t) => t + 1), 30000); return () => clearInterval(id); }, []);
}

function when(at: string) {
  const d = new Date(at);
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 1) return 'recién';
  // Los que llegaron con la app cerrada pueden ser de otro día: ahí va la fecha.
  if (d.toDateString() !== new Date().toDateString()) return format(d, 'dd/MM HH:mm');
  return `hace ${formatDistanceToNowStrict(d, { locale: es })}`;
}

// Cada tipo de aviso con su color y título: estado = color del estado nuevo,
// modificación = bronce de la marca, mención = violeta (no se confunde con "en diseño").
const KIND = {
  estado: { title: 'Cambio de estado', Icon: RefreshCw, verb: 'Por' },
  cambio: { title: 'Ficha modificada', Icon: PencilLine, verb: 'Modificado por' },
  mencion: { title: 'Te mencionaron', Icon: AtSign, verb: 'Comentario de' },
} as const;

function headerClasses(f: StatusFlag) {
  if (f.kind === 'estado' && f.to) return statusSurfaceClasses(f.to);
  if (f.kind === 'mencion') return 'bg-review-bg text-review-text border-review/30';
  return 'bg-brand-100 text-brand-700 border-brand-300/60';
}

function ariaText(f: StatusFlag, time: string) {
  if (f.kind === 'estado' && f.from && f.to) return `Cambio de estado en ${f.jobName}: de ${STATUS_LABELS[f.from]} a ${STATUS_LABELS[f.to]}, por ${f.userName}, ${time}. Abrir ficha.`;
  if (f.kind === 'mencion') return `${f.userName} te mencionó en ${f.jobName}, ${time}: ${f.lines?.[0]?.value ?? ''}. Abrir ficha.`;
  const what = (f.lines ?? []).map((l) => `${l.label}: ${l.value}`).join('; ');
  return `${f.jobName} modificada por ${f.userName}, ${time}. ${what}. Abrir ficha.`;
}

/**
 * Avisos flotantes de lo que hacen los demás (07/10, ampliado 28/10): cambios de
 * estado, otras modificaciones de la ficha y menciones en comentarios. Aparte de
 * la campana (`notifications`) y del `Toast`: no se cierran solos (quien está
 * lejos de la PC tiene que encontrarlos al volver). Abajo a la derecha, el más
 * reciente arriba; si hay un Toast abierto (mismo rincón), la pila sube.
 */
export function StatusFlags() {
  const flags = useStore((s) => s.statusFlags);
  const toastOpen = useStore((s) => !!s.toast);
  const dismiss = useStore((s) => s.dismissStatusFlag);
  const dismissAll = useStore((s) => s.dismissAllStatusFlags);
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  useTick();

  if (flags.length === 0) return null;
  const visible = flags.slice(0, isPhone ? MAX_VISIBLE_PHONE : MAX_VISIBLE);
  const hidden = flags.length - visible.length;

  return (
    // z-20 queda por debajo de los menús del Header (z-30) y del drawer mobile (z-30/40).
    <div
      role="region" aria-label="Avisos de lo que hicieron otros usuarios"
      className={clsx(
        'fixed right-4 z-20 w-[calc(100vw-2rem)] max-w-sm space-y-2.5 pointer-events-none transition-[bottom] duration-200',
        toastOpen ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
      )}
    >
      {hidden > 0 && (
        <div className="pointer-events-auto flex items-center justify-between bg-white border border-ink-200 rounded-lg shadow-card px-3 py-1.5 text-xs text-ink-700">
          <span>+{hidden} {hidden === 1 ? 'aviso más' : 'avisos más'}</span>
          <button type="button" onClick={dismissAll} className="font-semibold text-ink-900 hover:underline rounded py-1.5 -my-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Cerrar todos
          </button>
        </div>
      )}
      {visible.map((f) => {
        const time = when(f.at);
        const meta = KIND[f.kind];
        // Una mención abre la ficha directo en la conversación.
        const open = () => navigate(`/trabajos/${f.jobId}`, f.kind === 'mencion' ? { state: { tab: 'Comentarios' } } : undefined);
        return (
          <div
            key={f.id}
            className="pointer-events-auto overflow-hidden bg-white border border-ink-200 rounded-xl shadow-pop ring-1 ring-ink-900/5 motion-safe:animate-flag-in"
          >
            <div className={clsx('flex items-center gap-2 border-b px-3.5 py-2', headerClasses(f))}>
              <meta.Icon size={13} aria-hidden className="shrink-0" />
              <span className="flex-1 text-[11px] uppercase tracking-wider font-bold">{meta.title}</span>
              <span className="text-[11px] font-semibold opacity-80">{time}</span>
              <button
                type="button" onClick={() => dismiss(f.id)} aria-label={`Cerrar aviso de ${f.jobName}`}
                className="-mr-2 -my-1.5 p-2.5 sm:-mr-1 sm:my-0 sm:p-1 rounded hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <button
              type="button" onClick={open} aria-label={ariaText(f, time)}
              className="block w-full text-left px-3.5 pt-3 pb-3 hover:bg-ink-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            >
              <span className="block text-base font-display font-bold text-ink-900 leading-snug line-clamp-2 break-words">{f.jobName}</span>
              {f.kind === 'estado' && f.from && f.to && (
                <span className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-xs text-ink-700">{STATUS_LABELS[f.from]}</span>
                  <ArrowRight size={14} className="text-ink-700 shrink-0" aria-hidden />
                  <StatusBadge status={f.to} />
                </span>
              )}
              {f.kind === 'cambio' && (
                <span className="block mt-2 space-y-1">
                  {(f.lines ?? []).slice(0, 4).map((l) => (
                    <span key={l.label} className="block text-xs leading-snug text-ink-800 break-words line-clamp-2">
                      <span className="font-semibold text-ink-900">{l.label}:</span> {l.value}
                    </span>
                  ))}
                  {(f.lines?.length ?? 0) > 4 && <span className="block text-[11px] text-ink-700">y {f.lines!.length - 4} cambios más</span>}
                </span>
              )}
              {f.kind === 'mencion' && f.lines?.[0] && (
                <span className="block mt-2 text-xs text-ink-800 leading-snug line-clamp-3 break-words">“{f.lines[0].value}”</span>
              )}
              <span className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-ink-100 text-xs">
                <span className="text-ink-700 truncate">{meta.verb} <span className="font-semibold text-ink-900">{f.userName}</span></span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700 shrink-0">
                  {f.kind === 'mencion' ? 'Ver comentario' : 'Ver ficha'} <ArrowRight size={12} aria-hidden />
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
