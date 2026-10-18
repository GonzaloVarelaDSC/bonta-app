import { useEffect, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import type { Job } from '../../types';
import { useStore } from '../../store/useStore';
import { shrinkImage } from '../../lib/image';
import { friendlyError } from '../../lib/errors';
import { ConfirmDialog } from '../Common/Modal';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Imagen de "contact sheet" de la OT (18/10) — la misma que se arma para
 * Copérnico, para tener a la vista las partes del trabajo. Se sube arrastrándola,
 * eligiéndola o pegándola con Ctrl+V mientras esta pestaña está abierta; se
 * achica en el navegador antes de subir y sale impresa en la planilla de
 * producción.
 */
export function ContactSheetSection({ job }: { job: Job }) {
  const user = useStore((s) => s.currentUser)!;
  const upload = useStore((s) => s.uploadContactSheet);
  const remove = useStore((s) => s.removeContactSheet);
  const signedUrl = useStore((s) => s.contactSheetUrl);
  // El link firmado se guarda junto a la ruta que lo generó: si la ruta cambia,
  // el link viejo deja de valer solo, sin tener que limpiarlo en el efecto.
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  const url = signed && signed.path === job.contactSheetPath ? signed.url : null;
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const path = job.contactSheetPath;
    if (path) {
      signedUrl(path).then((u) => { if (alive) setSigned({ path, url: u }); }).catch((err) => { if (alive) setError(friendlyError(err)); });
    }
    return () => { alive = false; };
  }, [job.contactSheetPath, signedUrl]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) { setError('Tiene que ser una imagen JPG, PNG o WEBP.'); return; }
    setBusy(true);
    setError('');
    try {
      await upload(job.id, await shrinkImage(file), user.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  // Pegar con Ctrl+V una captura copiada (lo más rápido viniendo de Copérnico).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => ACCEPTED.includes(f.type));
      if (!file) return;
      e.preventDefault();
      void handleFile(file);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white border border-ink-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-50 bg-ink-50/50">
        <span className="flex-1 text-sm font-semibold text-ink-900">Contact sheet</span>
        {job.contactSheetPath && !busy && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:text-ink-900">
              <RefreshCw size={13} aria-hidden /> Reemplazar
            </button>
            <button type="button" onClick={() => setConfirmRemove(true)} className="inline-flex items-center gap-1 text-xs font-medium text-crit-text hover:underline ml-2">
              <Trash2 size={13} aria-hidden /> Quitar
            </button>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden"
        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />

      {job.contactSheetPath ? (
        <div className="p-3">
          {url
            ? <img src={url} alt="Contact sheet del trabajo" className="max-h-80 w-auto mx-auto rounded border border-ink-100" />
            : <div className="h-40 flex items-center justify-center text-sm text-ink-700">{busy ? 'Subiendo...' : 'Cargando imagen...'}</div>}
          <p className="text-[11px] text-ink-700 mt-2 text-center">Sale impresa en la planilla de producción. Para cambiarla podés pegar otra con Ctrl+V.</p>
        </div>
      ) : (
        <button
          type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
          className={`w-full flex flex-col items-center justify-center gap-1.5 py-8 text-sm text-ink-700 border-2 border-dashed m-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-transparent hover:bg-ink-50/60'}`}
        >
          <ImagePlus size={22} aria-hidden className="text-ink-700" />
          <span className="font-medium text-ink-900">{busy ? 'Subiendo...' : 'Subir la imagen del contact sheet'}</span>
          <span className="text-xs">Arrastrala acá, hacé click para elegirla, o copiala y pegala con Ctrl+V.</span>
        </button>
      )}
      {error && <p role="alert" className="text-xs text-crit-text px-3 pb-3">{error}</p>}

      {confirmRemove && (
        <ConfirmDialog
          title="Quitar contact sheet" tone="danger" confirmLabel="Quitar" cancelLabel="Volver"
          message="¿Quitar la imagen del contact sheet de este trabajo? Deja de salir en la planilla."
          onClose={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            setBusy(true);
            try { await remove(job.id, user.id); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
          }}
        />
      )}
    </div>
  );
}
