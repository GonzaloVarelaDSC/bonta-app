import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Upload, Undo2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { buildCopernicoImport, readCopernicoFile, CopernicoImportError, type CopernicoImport } from '../../lib/copernicoImport';

/**
 * Zona para soltar el Excel (o XML) que exporta Copérnico desde los ítems de una
 * orden. Llena los productos de Carga rápida; no crea nada solo — el trabajo se
 * crea recién con "Crear trabajo", como siempre.
 */
export function CopernicoImportBox({ onImport, onUndo }: {
  onImport: (result: CopernicoImport) => void;
  onUndo: () => void;
}) {
  const jobTypes = useStore((s) => s.jobTypes);
  const materials = useStore((s) => s.materials);
  const jobs = useStore((s) => s.jobs);
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CopernicoImport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const items = await readCopernicoFile(file);
      const r = buildCopernicoImport(items, jobTypes, materials);
      setResult(r);
      onImport(r);
    } catch (err) {
      setError(err instanceof CopernicoImportError ? err.message : 'No pude leer el archivo. Probá exportarlo de nuevo desde Copérnico.');
      console.warn('[Copérnico] error al importar', err);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function undo() {
    setResult(null);
    setError('');
    onUndo();
  }

  const existing = result?.otCode ? jobs.find((j) => j.code === result.otCode && !j.deletedAt) : undefined;

  if (result) {
    const sizes = result.products.reduce((n, p) => n + p.sizeItems.length, 0);
    return (
      <div className="rounded-xl border border-plan/40 bg-plan-bg p-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-plan-text shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0 text-sm text-ink-900">
            <p className="font-semibold">
              {result.otCode ? `OT ${fmtCode(result.otCode)} importada` : 'Ítems de Copérnico importados'}
            </p>
            <p className="text-ink-700 text-[13px] mt-0.5">
              {result.items.length} ítem{result.items.length === 1 ? '' : 's'} → {result.products.length} producto{result.products.length === 1 ? '' : 's'} con {sizes} medida{sizes === 1 ? '' : 's'}
              {result.jobTypeLabel && <> · Tipo: <strong>{result.jobTypeLabel}</strong></>}
              {result.otCode && <> · El N° {fmtCode(result.otCode)} se carga al crear el trabajo</>}
            </p>
            <p className="text-ink-700 text-[13px] mt-1">Cliente, nombre y fecha de entrega no vienen en la exportación: completalos abajo.</p>
          </div>
          <button type="button" onClick={undo}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-ink-900 px-2 py-1 rounded-md hover:bg-white/60 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Undo2 size={13} aria-hidden /> Deshacer
          </button>
        </div>
        {existing && (
          <p className="flex items-start gap-1.5 text-[13px] text-crit-text bg-crit-bg rounded-md px-2.5 py-1.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
            <span>
              Ya hay una ficha con el N° {fmtCode(existing.code!)}:{' '}
              <Link to={`/trabajos/${existing.id}`} className="font-semibold underline">{existing.name}</Link>. Si es la misma orden, no la cargues dos veces.
            </span>
          </p>
        )}
        {result.warnings.length > 0 && (
          <ul className="text-[13px] text-norm-text bg-norm-bg rounded-md px-2.5 py-1.5 space-y-0.5">
            {result.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden />{w}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        className={`rounded-xl border-2 border-dashed px-4 py-3 flex items-center gap-3 flex-wrap transition-colors ${dragOver ? 'border-brand-500 bg-brand-100/60' : 'border-ink-200 bg-white'}`}
      >
        <FileSpreadsheet size={20} className="text-brand-600 shrink-0" aria-hidden />
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-ink-900">¿Ya está la OT en Copérnico?</p>
          <p className="text-xs text-ink-700">Soltá acá el Excel de los ítems (botón Exportar → ícono de Excel) y se cargan solos los productos y medidas.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-semibold border border-ink-200 rounded-lg px-3 py-2 text-ink-900 hover:bg-ink-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Upload size={14} aria-hidden /> {busy ? 'Leyendo...' : 'Elegir archivo'}
        </button>
        <input ref={inputRef} type="file" accept=".xls,.xlsx,.xml" className="hidden"
          aria-label="Archivo exportado de Copérnico" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] text-crit-text bg-crit-bg rounded-md px-2.5 py-1.5 mt-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />{error}
        </p>
      )}
    </div>
  );
}

// 20392 → "20.392", como lo muestra Copérnico.
function fmtCode(code: string): string {
  return /^\d+$/.test(code) ? Number(code).toLocaleString('es-AR') : code;
}
