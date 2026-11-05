import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';

export type ContactSheetImage =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; src: string }
  | { status: 'error'; message: string };

/**
 * Trae la imagen del contact sheet para las hojas de imprimir (producción y
 * cliente). Se baja entera y se muestra desde memoria (`blob:`), no desde el
 * link firmado: así la imagen ya está cargada cuando se abre el diálogo de
 * imprimir y el PDF no depende de una segunda descarga. Si falla, la hoja sale
 * igual sin imagen y se avisa en pantalla.
 */
export function useContactSheetImage(path: string | null | undefined): ContactSheetImage {
  const signedUrl = useStore((s) => s.contactSheetUrl);
  const [state, setState] = useState<{ path: string; image: ContactSheetImage } | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    let objectUrl = '';
    (async () => {
      try {
        const res = await fetch(await signedUrl(path));
        if (!res.ok) throw new Error(`La imagen no se pudo descargar (${res.status}).`);
        objectUrl = URL.createObjectURL(await res.blob());
        if (alive) setState({ path, image: { status: 'ready', src: objectUrl } });
        else URL.revokeObjectURL(objectUrl);
      } catch (err) {
        if (alive) setState({ path, image: { status: 'error', message: err instanceof Error ? err.message : 'No se pudo cargar la imagen.' } });
      }
    })();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, signedUrl]);

  if (!path) return { status: 'none' };
  return state && state.path === path ? state.image : { status: 'loading' };
}

/**
 * Abre el diálogo de imprimir solo, una vez, apenas la hoja está lista (así
 * "Exportar" es un solo paso). Si algo tarda de más (por ej. la imagen), lo abre
 * igual a los 8 s: nunca queda la hoja esperando sin poder exportarse.
 */
export function usePrintWhenReady(enabled: boolean, ready: boolean) {
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    if (!enabled || printed) return;
    const t = setTimeout(() => { setPrinted(true); window.print(); }, ready ? 400 : 8000);
    return () => clearTimeout(t);
  }, [enabled, ready, printed]);
}
