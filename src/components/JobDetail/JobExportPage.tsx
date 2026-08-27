import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MATERIALS } from '../../data/catalog';
import { fmtDate } from '../../lib/dates';
import { SizeItemsView } from '../Common/SizeItemsEditor';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 break-inside-avoid">
      <div className="text-[11px] uppercase tracking-wide text-ink-700 font-semibold mb-1.5">{title}</div>
      <div className="text-sm text-ink-900 leading-relaxed">{children}</div>
    </div>
  );
}

// Hoja de referencia para el cliente — a propósito NO muestra nada interno del
// flujo de trabajo (prioridad, estado, responsable, control de calidad): solo
// lo que el cliente necesita para confirmar que todos entendieron lo mismo.
// Se "exporta" con el diálogo nativo de impresión del navegador (Ctrl+P →
// Guardar como PDF) en vez de generar el PDF en el cliente — sin librerías
// nuevas, y el usuario elige tamaño de papel/destino con lo que ya conoce.
export function JobExportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser);
  const job = useStore((s) => s.jobs).find((j) => j.id === id);
  const client = useStore((s) => s.clients).find((c) => c.id === job?.clientId);

  if (!user) return <Navigate to="/login" replace />;
  if (!job) return <Navigate to="/trabajos" replace />;

  const materialLabels = job.materialIds.map((m) => MATERIALS.find((mm) => mm.id === m)?.label).filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-ink-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900">
          <ArrowLeft size={15} /> Volver a la ficha
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
            <div className="text-xs text-ink-700 uppercase tracking-wide mt-0.5">Resumen de trabajo — referencia para el cliente</div>
          </div>
          <div className="ml-auto text-right text-xs text-ink-700 shrink-0">
            {job.code && <div>Orden N° <strong className="text-ink-900 font-mono">{job.code}</strong></div>}
            <div className="mt-0.5">{fmtDate(new Date().toISOString())}</div>
          </div>
        </header>

        <h1 className="text-xl font-display font-bold text-ink-900 mb-1">{job.name}</h1>
        <p className="text-sm text-ink-700 mb-6">
          {client?.name}{client?.company && client.company !== client?.name ? ` — ${client.company}` : ''}
        </p>

        <Section title="Descripción">{job.description || '—'}</Section>

        {job.sizeItems.length > 0 && (
          <Section title="Cantidad y medidas">
            <SizeItemsView items={job.sizeItems} />
          </Section>
        )}

        {materialLabels && <Section title="Material">{materialLabels}</Section>}
        {job.specialRequirements && <Section title="Requisitos especiales">{job.specialRequirements}</Section>}
        {job.observations && <Section title="Observaciones">{job.observations}</Section>}

        <Section title="Fecha de entrega comprometida">{fmtDate(job.committedDate)}</Section>

        {job.requiresInstallation && job.installation && (
          <Section title="Instalación">
            {job.installation.address || 'Dirección a confirmar'}
            {job.installation.date && <><br />Fecha estimada: {fmtDate(job.installation.date)}</>}
          </Section>
        )}

        {(job.contactName || job.contactPhone) && (
          <Section title="Contacto">
            {job.contactName}{job.contactName && job.contactPhone ? ' · ' : ''}{job.contactPhone}
          </Section>
        )}

        <footer className="mt-10 pt-4 border-t border-ink-100 text-[11px] text-ink-700">
          Documento de referencia generado por Estudio Bonta el {fmtDate(new Date().toISOString())} — no es un comprobante fiscal ni una factura.
        </footer>
      </div>
    </div>
  );
}
