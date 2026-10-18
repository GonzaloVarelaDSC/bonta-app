import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtDateTime } from '../../lib/dates';
import { productionRows, usedProcesses } from '../../lib/production';

// Planilla de control de producción (pestaña "Producción" de la ficha, 12/10):
// se imprime y se completa a mano en el taller. Mismo mecanismo que las otras
// hojas (JobExportPage/QuoteExportPage): diálogo de impresión del navegador →
// "Guardar como PDF", sin librerías nuevas. A4 apaisado por `@page`.
//
// Paginación: todo es UNA tabla — el encabezado de la OT y los títulos de
// columna van en el <thead>, que el navegador repite solo en cada página nueva;
// cada fila tiene `break-inside: avoid` para no partirse. El bloque de
// responsables es una segunda tabla con el MISMO <colgroup> (así cada línea
// queda alineada bajo su columna de proceso) y aparece una sola vez, al final.
// Se calcula en cada apertura: siempre con los datos actuales de la OT.
// Ancho útil de la hoja: 297 mm − 2 × 8 mm de margen. Las columnas de proceso
// son angostas y fijas (lo justo para el casillero y el título); lo que queda se
// reparte entre las generales, con "Material / indicaciones" absorbiendo el
// resto — así con 1 proceso o con los 7 la tabla siempre ocupa el ancho entero
// sin aplastar ninguna columna de texto.
const PAGE_MM = 281;
export function ProductionExportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser);
  const job = useStore((s) => s.jobs).find((j) => j.id === id);
  const client = useStore((s) => s.clients).find((c) => c.id === job?.clientId);
  const materials = useStore((s) => s.materials);

  const contactSheetUrl = useStore((s) => s.contactSheetUrl);
  // Contact sheet (18/10): link firmado temporal; 'none' = el trabajo no tiene,
  // 'error' = no se pudo traer (la planilla sale igual, sin imagen).
  const [fetched, setSheet] = useState<'loading' | 'error' | { url: string; loaded: boolean }>('loading');
  const sheet = job && !job.contactSheetPath ? 'none' : fetched;
  useEffect(() => {
    if (!job?.contactSheetPath) return;
    contactSheetUrl(job.contactSheetPath).then((url) => setSheet({ url, loaded: false })).catch(() => setSheet('error'));
  }, [job?.contactSheetPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abre el diálogo de impresión solo, para que "Exportar PDF" sea un solo paso
  // — recién cuando la imagen del contact sheet terminó de cargar (si hay).
  const readyToPrint = sheet === 'none' || sheet === 'error' || (typeof sheet === 'object' && sheet.loaded);
  useEffect(() => {
    if (!job || !readyToPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [job?.id, readyToPrint]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <Navigate to="/login" replace />;
  if (!job) return <Navigate to="/trabajos" replace />;

  const rows = productionRows(job, job.productionConfig, materials);
  const processes = usedProcesses(rows);
  const exportedAt = fmtDateTime(new Date().toISOString());
  const address = job.requiresInstallation ? (job.installation?.address.trim() || '—') : 'No lleva instalación';
  const totalCols = 4 + processes.length;

  const procMm = processes.length > 5 ? 17 : 19;
  const restMm = PAGE_MM - procMm * processes.length;
  const colgroup = (
    <colgroup>
      <col style={{ width: `${Math.round(restMm * 0.3)}mm` }} />
      <col style={{ width: `${Math.round(restMm * 0.07)}mm` }} />
      <col style={{ width: `${Math.round(restMm * 0.16)}mm` }} />
      <col />
      {processes.map((p) => <col key={p.id} style={{ width: `${procMm}mm` }} />)}
    </colgroup>
  );

  const th = 'border border-ink-400 bg-ink-100 px-2 py-1.5 text-left text-[9pt] font-semibold text-ink-900 align-bottom';
  const td = 'border border-ink-400 px-2 py-2 align-top text-[10pt] text-ink-900';

  return (
    <div className="min-h-screen bg-ink-100 print:bg-white">
      <style>{'@page { size: A4 landscape; margin: 8mm; } @media print { html, body { background: white !important; } } .prod-row { break-inside: avoid; page-break-inside: avoid; } .prod-clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }'}</style>

      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(`/trabajos/${job.id}`)} className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900">
          <ArrowLeft size={15} aria-hidden /> Volver a la ficha
        </button>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800">
          <Printer size={15} aria-hidden /> Imprimir / Guardar como PDF
        </button>
      </div>

      {/* En pantalla se ve como una hoja A4 apaisada (297 mm − 2 × 8 mm de margen). */}
      <div className="mx-auto my-6 bg-white shadow-card p-[8mm] w-[297mm] max-w-full print:w-auto print:shadow-none print:my-0 print:p-0">
        <table className="w-full table-fixed border-collapse">
          {colgroup}
          <thead>
            <tr>
              <th colSpan={totalCols} className="pb-3 text-left font-normal">
                <div className="flex items-start gap-3 border-b-2 border-ink-900 pb-2">
                  <img src="/logo-mark.png" alt="Estudio Bonta" className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-brand font-extrabold text-xl leading-tight text-ink-900">Estudio Bonta</div>
                    <div className="text-[9pt] text-ink-700 uppercase tracking-wide">Planilla de control de producción</div>
                  </div>
                  <div className="min-w-0 flex-1 px-4">
                    <div className="text-[13pt] font-bold text-ink-900 leading-tight line-clamp-2">{job.name}</div>
                    <div className="text-[10pt] text-ink-800 mt-0.5">Cliente: {client?.name || '—'}</div>
                  </div>
                  <div className="text-[9pt] text-ink-800 text-right shrink-0 leading-snug max-w-[40%]">
                    <div>N° Copérnico: <strong className="font-mono text-ink-900">{job.code || '—'}</strong></div>
                    <div className="truncate">Instalación: {address}</div>
                    <div>Exportado: {exportedAt}</div>
                  </div>
                </div>
              </th>
            </tr>
            <tr>
              <th className={th}>Componente</th>
              <th className={th}>Cant.</th>
              <th className={th}>Medida</th>
              <th className={th}>Material / indicaciones</th>
              {processes.map((p) => <th key={p.id} className={`${th} !px-1 text-center break-words`}>{p.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* Contact sheet: primera fila, a lo ancho, sin partirse entre hojas. Se
                limita en alto para que en la primera hoja todavía entren renglones. */}
            {typeof sheet === 'object' && (
              <tr className="prod-row">
                <td colSpan={totalCols} className="border border-ink-400 p-2 text-center">
                  <div className="text-[8pt] uppercase tracking-wide text-ink-700 text-left mb-1">Contact sheet</div>
                  <img
                    src={sheet.url} alt="Contact sheet del trabajo"
                    onLoad={() => setSheet((s) => (typeof s === 'object' ? { ...s, loaded: true } : s))}
                    onError={() => setSheet('error')}
                    className="inline-block max-h-[75mm] max-w-full w-auto object-contain"
                  />
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr><td colSpan={totalCols} className={`${td} text-center text-ink-700`}>La OT no tiene componentes cargados.</td></tr>
            )}
            {/* Una fila por cada medida cargada (Gonzalo, 12/10): un producto con
                "1 de 50×35" y "2 de 85×40" son piezas distintas en el taller y
                cada una necesita sus propios casilleros. Los procesos son los del
                producto, iguales en todas sus filas. */}
            {rows.flatMap((row) => {
              const n = Math.max(1, row.sizes.length);
              return Array.from({ length: n }, (_, k) => ({ row, k, n }));
            }).map(({ row: { item, label, quantities, sizes, material, notes }, k, n }) => {
              const indications = [material, notes, item.note].map((t) => t.trim()).filter(Boolean).join(' · ');
              return (
                <tr key={`${item.id}-${k}`} className="prod-row">
                  <td className={td}>
                    <div className="font-semibold prod-clamp break-words">{label || (item.source === 'job' ? 'Producto sin nombre' : '—')}</div>
                    {n > 1 && <div className="text-[8pt] text-ink-700 mt-0.5">Medida {k + 1} de {n}</div>}
                    {item.source === 'extra' && <div className="text-[8pt] text-ink-700 mt-0.5">Agregado para producción</div>}
                  </td>
                  <td className={td}>{quantities[k] || '—'}</td>
                  <td className={`${td} break-words`}>{sizes[k] || '—'}</td>
                  <td className={td}><div className="prod-clamp break-words">{indications || '—'}</div></td>
                  {processes.map((p) => (
                    <td key={p.id} className={`${td} text-center align-middle`}>
                      {item.processes.includes(p.id)
                        ? <span aria-label="Casillero a completar" className="inline-block w-[6mm] h-[6mm] border-2 border-ink-900 rounded-[1px] align-middle" />
                        : <span aria-label="No corresponde" className="text-ink-400">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {processes.length > 0 ? (
          <table className="w-full table-fixed border-collapse mt-5 prod-row">
            {colgroup}
            <tbody>
              <tr>
                <td colSpan={4} className="text-right pr-3 align-bottom text-[9pt] text-ink-800 pb-1">
                  Responsable de cada etapa (nombre):<br />
                  <span className="text-[8pt] text-ink-700">Marcado en papel: no cambia el estado de la OT en el sistema.</span>
                </td>
                {processes.map((p) => (
                  <td key={p.id} className="px-1 align-bottom text-center">
                    <div className="h-[11mm] border-b border-ink-900" />
                    <div className="text-[8pt] text-ink-700 mt-0.5 truncate">{p.short}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-[9pt] text-ink-700">Todavía no se eligieron procesos para ningún componente de esta OT (pestaña Producción de la ficha).</p>
        )}
      </div>
    </div>
  );
}
