import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Lightbulb } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { friendlyError } from '../../lib/errors';
import { QuoteItemsEditor } from '../Common/QuoteItemsEditor';
import { Section } from '../Common/Section';
import type { QuoteItem } from '../../types';

// Mismo criterio que QuickJobPage (ver CLAUDE.md §25, hallazgo 5) — avisa de
// un cliente casi-duplicado sin bloquear.
function normalizeClientName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function emptyQuoteItem(): QuoteItem {
  return { id: crypto.randomUUID(), label: '', unit: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }], notes: '' };
}

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

/**
 * Alta de presupuesto — un solo tramo, mismo espíritu que Carga rápida, pero
 * con lo mínimo que pide un presupuesto (cliente, nombre, ítems). Sin fecha de
 * entrega, prioridad, instalación ni asignación — eso es de un trabajo
 * confirmado, no de algo que el cliente todavía puede rechazar.
 */
export function QuoteFormPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser)!;
  const clients = useStore((s) => s.clients);
  const createQuote = useStore((s) => s.createQuote);
  const findOrCreateClient = useStore((s) => s.findOrCreateClient);

  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyQuoteItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const clientSuggestion = useMemo(() => {
    const typed = clientName.trim();
    if (!typed) return null;
    return clients.find((c) => c.name !== typed && normalizeClientName(c.name) === normalizeClientName(typed)) ?? null;
  }, [clientName, clients]);

  const canSubmit = clientName.trim().length > 0 && name.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const clientId = await findOrCreateClient(clientName.trim());
      const quote = await createQuote({
        clientId, name: name.trim(),
        items: items
          .map((it) => ({ ...it, sizeItems: it.sizeItems.filter((si) => si.quantity || si.width || si.height) }))
          .filter((it) => it.label.trim() || it.materialIds.length > 0 || it.sizeItems.length > 0 || it.notes.trim()),
        createdByUserId: user.id,
      });
      navigate(`/presupuestos/${quote.id}`);
    } catch (err: any) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-5 max-w-3xl mx-auto pb-28">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 text-brand-600 shrink-0"><Receipt size={15} /></span>
        <h1 className="text-lg font-display font-bold text-ink-900">Nuevo presupuesto</h1>
      </div>
      <p className="text-sm text-ink-700 mb-4">
        Todavía no es un trabajo confirmado — no aparece en Trabajos/Kanban/Dashboard hasta que el cliente lo acepte.
      </p>

      <div className="space-y-4">
        <Section title="Cliente y presupuesto">
          <div>
            <label htmlFor="qt-client" className={labelCls}>Cliente</label>
            <input
              id="qt-client" className={inputCls} list="qt-clientes-existentes" value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente" autoFocus
            />
            <datalist id="qt-clientes-existentes">
              {clients.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
            {clientSuggestion && (
              <p className="flex items-center gap-1.5 text-xs text-review-text bg-review-bg rounded-md px-2.5 py-1.5 mt-1.5">
                <Lightbulb size={13} className="shrink-0" aria-hidden />
                ¿Quisiste decir{' '}
                <button type="button" onClick={() => setClientName(clientSuggestion.name)} className="font-semibold hover:underline">
                  {clientSuggestion.name}
                </button>
                ? Ya existe un cliente con ese nombre.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="qt-name" className={labelCls}>Nombre del trabajo</label>
            <input id="qt-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Cartelería sucursal Palermo" />
          </div>
        </Section>

        <Section title="Detalle del trabajo" hint="Cada ítem con su descripción, unidad, material y medidas — lo mismo que después se usaría para procesarlo.">
          <QuoteItemsEditor items={items} onChange={setItems} />
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/95 backdrop-blur border-t border-ink-100 px-5 py-3 flex items-center justify-between gap-3 z-20">
        <span className="text-xs text-ink-700">
          {!canSubmit ? 'Cargá al menos el cliente y el nombre del trabajo' : 'El valor se carga después, desde el presupuesto ya creado'}
        </span>
        <div className="flex items-center gap-2">
          {submitError && <span className="text-xs text-crit-text">{submitError}</span>}
          <button
            disabled={!canSubmit || submitting} onClick={submit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-5 py-2.5 rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Receipt size={15} /> {submitting ? 'Creando...' : 'Crear presupuesto'}
          </button>
        </div>
      </div>
    </div>
  );
}
