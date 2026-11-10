import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canViewJob } from '../../lib/permissions';
import { buildInstallationOrder, type InstallationOrder } from '../../lib/installations';
import { useContactSheetImage } from '../Common/useContactSheetImage';
import { fmtDate } from '../../lib/dates';

/**
 * Orden de instalación para quien instala (externo, sin acceso a la app). Se
 * manda por WhatsApp como PDF ("Guardar como PDF" del diálogo de imprimir).
 *
 * Seguridad: la hoja solo recibe `InstallationOrder` (lista blanca armada en
 * lib/installations.ts). Nunca el trabajo entero: así no hay forma de que se
 * cuele un precio, un comentario o el historial. Sin links a la app.
 * Antes de imprimir se ve en pantalla exactamente lo que sale.
 */
export function InstallationExportPage() {
  const [params] = useSearchParams();
  const user = useStore((s) => s.currentUser);
  const jobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const dataLoading = useStore((s) => s.dataLoading);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Orden de instalación — Estudio Bonta';
    return () => { document.title = prev; };
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const orders: InstallationOrder[] = ids
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is NonNullable<typeof j> => !!j && !j.deletedAt && canViewJob(user, j))
    .map((j) => buildInstallationOrder(j, clients.find((c) => c.id === j.clientId)))
    .filter((o): o is InstallationOrder => !!o);

  return (
    <div className="min-h-screen bg-ink-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-ink-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="text-sm text-ink-800">
          {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'} de instalación · revisá lo que sale antes de imprimir
        </div>
        <button
          onClick={() => window.print()} disabled={orders.length === 0}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-ctl hover:bg-ink-800 disabled:opacity-60"
        >
          <Printer size={15} aria-hidden /> Imprimir / Guardar PDF
        </button>
      </div>

      {orders.length === 0 && (
        <p className="max-w-xl mx-auto mt-10 text-sm text-ink-700 text-center">
          {dataLoading ? 'Cargando...' : 'No hay instalaciones para mostrar.'}
        </p>
      )}

      {orders.map((o) => <OrderSheet key={o.key} order={o} />)}
    </div>
  );
}

function OrderSheet({ order: o }: { order: InstallationOrder }) {
  const sheet = useContactSheetImage(o.contactSheetPath);
  return (
    <article className="max-w-2xl mx-auto bg-white shadow-card my-6 sm:my-8 p-5 sm:p-10 print:shadow-none print:my-0 print:p-0 print:max-w-none break-after-page">
      <header className="flex items-start gap-3 border-b-2 border-ink-900 pb-4 mb-5">
        <img src="/logo-mark.png" alt="" className="w-10 h-10 shrink-0" />
        <div className="min-w-0">
          <div className="font-brand font-extrabold text-xl leading-tight text-ink-900">Estudio Bonta</div>
          <div className="text-xs text-ink-700 uppercase tracking-wide mt-0.5">Orden de instalación</div>
        </div>
        <div className="ml-auto text-right shrink-0">
          <div className="text-xs text-ink-700">N°</div>
          <div className="text-lg font-bold tabular-nums text-ink-900">{o.code}</div>
        </div>
      </header>

      <h1 className="text-2xl font-display font-bold text-ink-900 leading-tight">{o.clientName}</h1>
      <p className="text-sm text-ink-800 mb-5">{o.jobName}</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <Box label={o.multiDay ? 'Período' : 'Fecha'}>{o.period}</Box>
        <Box label="Hora de inicio">{o.time || 'A coordinar'}{o.multiDay && o.time ? ' (todos los días)' : ''}</Box>
      </div>

      <Block title="Dirección">
        <div className="text-base font-semibold text-ink-900">{o.address || 'A confirmar'}</div>
        {o.locality && <div className="text-sm text-ink-800">{o.locality}</div>}
      </Block>
      {o.indications && <Block title="Indicaciones"><div className="whitespace-pre-wrap">{o.indications}</div></Block>}
      {(o.contactName || o.contactPhone) && (
        <Block title="Contacto en el lugar">{[o.contactName, o.contactPhone].filter(Boolean).join(' · ')}</Block>
      )}
      {o.installers.length > 0 && <Block title="Instala">{o.installers.join(', ')}</Block>}

      <Block title="Trabajo">
        {o.description && <div className="whitespace-pre-wrap mb-2">{o.description}</div>}
        {o.products.length > 0 && (
          <ul className="space-y-1.5">
            {o.products.map((p, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold">{p.label}</span>
                {p.sizes.length > 0 && <span> — {p.sizes.join(' · ')}</span>}
                {p.notes && <div className="text-ink-700">{p.notes}</div>}
              </li>
            ))}
          </ul>
        )}
        {!o.description && o.products.length === 0 && '—'}
      </Block>

      {sheet.status === 'ready' && (
        <Block title="Imagen de referencia">
          <img src={sheet.src} alt="Contact sheet del trabajo" className="w-full max-h-[110mm] object-contain border border-ink-200 break-inside-avoid" />
        </Block>
      )}
      {sheet.status === 'error' && (
        <p role="alert" className="print:hidden text-sm text-crit-text bg-crit-bg border border-crit/30 rounded-ctl px-3 py-2 mb-4">
          No se pudo cargar la imagen de referencia. La orden sale igual, sin la imagen.
        </p>
      )}

      <footer className="mt-6 pt-3 border-t border-ink-200 text-2xs text-ink-700">
        Estudio Bonta · Emitida el {fmtDate(new Date().toISOString())}
      </footer>
    </article>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-ink-300 rounded-ctl px-3 py-2 break-inside-avoid">
      <div className="text-2xs uppercase tracking-wide text-ink-700 font-semibold">{label}</div>
      <div className="text-base font-semibold text-ink-900">{children}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h2 className="text-2xs uppercase tracking-wide text-ink-700 font-semibold mb-1">{title}</h2>
      <div className="text-sm text-ink-900">{children}</div>
    </section>
  );
}
