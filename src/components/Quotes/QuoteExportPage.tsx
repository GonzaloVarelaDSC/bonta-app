import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtDate } from '../../lib/dates';
import { SizeItemsView } from '../Common/SizeItemsEditor';
import { Section as SharedSection } from '../Common/Section';
import type { Material } from '../../types';

function materialLabels(materialIds: string[], materials: Material[]): string {
  return materialIds.map((m) => materials.find((mm) => mm.id === m)?.label).filter(Boolean).join(', ');
}

function formatPrice(price: number, includesIva: boolean | null): string {
  const formatted = price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  if (includesIva === null) return formatted;
  return `${formatted} ${includesIva ? 'IVA incluido' : '+ IVA'}`;
}

// Mismo wrapper que ya usa la hoja de exportación de un trabajo (variant="plain"
// — sin tarjeta/sombra, no tiene sentido en una hoja pensada para imprimir).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <SharedSection title={title} variant="plain">{children}</SharedSection>;
}

/**
 * Hoja de presupuesto para el cliente — mismo patrón exacto que
 * `JobExportPage.tsx` (ver CLAUDE.md sección 11.3): se "exporta" con el
 * diálogo nativo de impresión del navegador (Ctrl+P → Guardar como PDF), sin
 * sumar ninguna librería de generación de PDF nueva. A propósito NO muestra
 * ningún dato interno del flujo (estado del presupuesto, quién lo cargó): solo
 * lo que el cliente necesita para ver qué se le está cotizando.
 *
 * El encabezado usa exactamente el mismo logo + nombre que ya usa el resto de
 * la app — no se inventa ningún dato institucional (dirección, CUIT, teléfono)
 * porque no existe ninguno cargado en la aplicación todavía.
 */
export function QuoteExportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser);
  const quotes = useStore((s) => s.quotes);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const loadQuotes = useStore((s) => s.loadQuotes);
  const client = useStore((s) => s.clients).find((c) => c.id === quotes.find((q) => q.id === id)?.clientId);
  const materials = useStore((s) => s.materials);

  if (!user) return <Navigate to="/login" replace />;

  const quote = quotes.find((q) => q.id === id);
  if (!quote) {
    if (!quotesLoaded) { loadQuotes().catch(() => {}); return <div className="p-10 text-center text-ink-700">Cargando...</div>; }
    return <Navigate to="/presupuestos" replace />;
  }
  // No se puede llegar a exportar un presupuesto sin precio desde la UI (el
  // botón en la ficha queda deshabilitado) — este chequeo es la segunda capa,
  // por si alguien entra a la URL directo.
  if (quote.price === null) return <Navigate to={`/presupuestos/${quote.id}`} replace />;

  return (
    <div className="min-h-screen bg-ink-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900">
          <ArrowLeft size={15} /> Volver al presupuesto
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800"
        >
          <Printer size={15} /> Imprimir / Guardar como PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto bg-white shadow-card my-8 p-10 print:shadow-none print:my-0 print:p-0 print:max-w-none">
        <header className="flex items-start gap-3 border-b border-ink-200 pb-5 mb-6">
          <img src="/logo-mark.png" alt="Estudio Bonta" className="w-12 h-12 shrink-0" />
          <div>
            <div className="font-brand font-extrabold text-2xl leading-tight text-ink-900">Estudio Bonta</div>
            <div className="text-xs text-ink-700 uppercase tracking-wide mt-0.5">Presupuesto</div>
          </div>
          <div className="ml-auto text-right text-xs text-ink-700 shrink-0">
            <div>N° <strong className="text-ink-900 font-mono">{quote.code}</strong></div>
            <div className="mt-0.5">{fmtDate(new Date().toISOString())}</div>
          </div>
        </header>

        <h1 className="text-xl font-display font-bold text-ink-900 mb-1">{quote.name}</h1>
        <p className="text-sm text-ink-700 mb-6">
          {client?.name}{client?.company && client.company !== client?.name ? ` — ${client.company}` : ''}
        </p>

        {quote.items.map((it, i) => (
          <Section key={it.id} title={it.label || `Ítem ${i + 1}`}>
            <p className="flex flex-wrap gap-x-3 mb-1.5">
              {materialLabels(it.materialIds, materials) && <span>Material: {materialLabels(it.materialIds, materials)}</span>}
              {it.unit && <span>Unidad: {it.unit}</span>}
            </p>
            <SizeItemsView items={it.sizeItems} />
            {it.notes && <p className="mt-1.5 text-ink-700">{it.notes}</p>}
          </Section>
        ))}

        {/* Precio — a propósito el bloque más destacado de la hoja (borde +
            fondo propio), el resto de la información es de apoyo para
            justificar este número. Nunca se recalcula acá — se muestra tal
            cual se cargó desde la ficha. */}
        <div className="mt-8 border-2 border-ink-900 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-ink-700 uppercase tracking-wide">Total presupuestado</span>
          <span className="text-2xl font-display font-bold text-ink-900 whitespace-nowrap">{formatPrice(quote.price, quote.priceIncludesIva)}</span>
        </div>

        <footer className="mt-10 pt-4 border-t border-ink-100 text-[11px] text-ink-700">
          Presupuesto generado por Estudio Bonta el {fmtDate(new Date().toISOString())} — sujeto a confirmación, no es un comprobante fiscal ni una factura.
        </footer>
      </div>
    </div>
  );
}
