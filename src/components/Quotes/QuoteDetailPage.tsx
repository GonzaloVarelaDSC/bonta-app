import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, DollarSign, FileOutput, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canSetQuoteValue, canManageQuotes } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { QuoteStatusBadge, QuoteStatusSelect } from '../Common/Badges';
import { QuoteItemsEditor, QuoteItemsView } from '../Common/QuoteItemsEditor';
import { ConfirmQuoteModal } from './ConfirmQuoteModal';
import { fmtShort } from '../../lib/dates';
import type { Quote, QuoteItem, QuoteStatus, User } from '../../types';

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

function emptyQuoteItem(): QuoteItem {
  return { id: crypto.randomUUID(), label: '', unit: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }], notes: '' };
}

function formatPrice(price: number | null, includesIva: boolean | null): string {
  if (price === null) return 'Todavía sin cargar';
  const formatted = price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  if (includesIva === null) return formatted;
  return `${formatted} — ${includesIva ? 'IVA incluido' : '+ IVA'}`;
}

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser) as User;
  const quotes = useStore((s) => s.quotes);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const loadQuotes = useStore((s) => s.loadQuotes);
  const clients = useStore((s) => s.clients);
  const jobs = useStore((s) => s.jobs);
  const setQuoteStatus = useStore((s) => s.setQuoteStatus);
  const confirmQuote = useStore((s) => s.confirmQuote);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!quotesLoaded) loadQuotes().catch(() => {});
  }, [quotesLoaded, loadQuotes]);

  const quote = quotes.find((q) => q.id === id);
  const client = clients.find((c) => c.id === quote?.clientId);
  const linkedJob = quote?.convertedJobId ? jobs.find((j) => j.id === quote.convertedJobId) : undefined;

  if (quotesLoaded && !quote) return <Navigate to="/presupuestos" replace />;
  if (!quote) return <div className="p-10 text-center text-ink-700">Cargando...</div>;

  async function changeStatus(status: QuoteStatus) {
    try {
      await setQuoteStatus(quote!.id, status);
    } catch (err) {
      alert(friendlyError(err));
    }
  }

  // Presupuesto confirmado → trabajo real. Reusa el mecanismo existente de
  // creación de trabajo entero (número de Copernico/TRB, notificaciones,
  // historial) — ver `confirmQuote` en useStore.ts.
  async function handleConfirm(jobTypeId: string, committedDate: string, responsibleUserId: string) {
    setConfirming(true);
    try {
      const job = await confirmQuote(quote!.id, { jobTypeId, committedDate, responsibleUserId }, user.id);
      setShowConfirmModal(false);
      navigate(`/trabajos/${job.id}`);
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/presupuestos" className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:text-brand-600 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
        <ArrowLeft size={13} aria-hidden /> Volver a Presupuestos
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <div className="font-mono text-xs text-ink-700 mb-1">{quote.code}</div>
          <h1 className="text-lg font-display font-bold text-ink-900 leading-snug">{quote.name}</h1>
          <div className="text-sm text-ink-700 mt-0.5">{client?.name}</div>
        </div>
        <div className="flex items-center gap-2">
          {quote.price !== null ? (
            <a
              href={`/presupuestos/${quote.id}/exportar`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 bg-ink-100 rounded-md px-2.5 py-1.5 hover:bg-ink-200"
            >
              <FileOutput size={13} /> Exportar presupuesto
            </a>
          ) : (
            <span
              title="Cargá el importe en «Valor del presupuesto» antes de poder exportarlo"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 bg-ink-100 rounded-md px-2.5 py-1.5 cursor-not-allowed"
            >
              <FileOutput size={13} /> Exportar presupuesto
            </span>
          )}
          {quote.status === 'CONFIRMADO' ? (
            <QuoteStatusBadge status={quote.status} />
          ) : (
            <QuoteStatusSelect status={quote.status} onChange={changeStatus} />
          )}
          {quote.status !== 'CONFIRMADO' && canManageQuotes(user.role) && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-plan-text rounded-md px-2.5 py-1.5 hover:brightness-110"
            >
              <CheckCircle2 size={13} /> Confirmar presupuesto
            </button>
          )}
        </div>
      </div>
      <div className="mb-5 space-y-2">
        {quote.price === null && quote.status !== 'CONFIRMADO' && (
          <p className="text-xs text-urg-text bg-urg-bg rounded-md px-2.5 py-1.5 w-fit">
            Para poder exportarlo como presupuesto final, primero cargá el importe más abajo, en «Valor del presupuesto».
          </p>
        )}
        {quote.status === 'CONFIRMADO' && (
          <p className="text-xs text-plan-text bg-plan-bg rounded-md px-2.5 py-1.5 w-fit">
            ✓ Confirmado — se generó el trabajo{linkedJob?.code ? ` ${linkedJob.code}` : ''}.{' '}
            {linkedJob ? (
              <Link to={`/trabajos/${linkedJob.id}`} className="font-semibold underline">Ver trabajo generado →</Link>
            ) : (
              <Link to={`/trabajos/${quote.convertedJobId}`} className="font-semibold underline">Ver trabajo generado →</Link>
            )}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <QuoteDetailSection quote={quote} locked={quote.status === 'CONFIRMADO'} />
        <QuoteValueSection key={quote.id} quote={quote} />
        <p className="text-[11px] text-ink-700">Actualizado {fmtShort(quote.lastActivityAt)}</p>
      </div>

      {showConfirmModal && (
        <ConfirmQuoteModal
          confirming={confirming}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function QuoteDetailSection({ quote, locked }: { quote: Quote; locked: boolean }) {
  const clients = useStore((s) => s.clients);
  const updateQuote = useStore((s) => s.updateQuote);
  const findOrCreateClient = useStore((s) => s.findOrCreateClient);
  const client = clients.find((c) => c.id === quote.clientId);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [saving, setSaving] = useState(false);

  const clientSuggestion = useMemo(() => {
    const typed = clientName.trim();
    if (!typed) return null;
    return clients.find((c) => c.id !== quote.clientId && c.name.toLowerCase() === typed.toLowerCase()) ?? null;
  }, [clientName, clients, quote.clientId]);

  function startEdit() {
    setClientName(client?.name ?? '');
    setName(quote.name);
    setItems(quote.items.length ? quote.items : [emptyQuoteItem()]);
    setMode('edit');
  }

  async function save() {
    setSaving(true);
    try {
      const clientId = clientSuggestion ? clientSuggestion.id : await findOrCreateClient(clientName.trim());
      await updateQuote(quote.id, {
        name: name.trim(), clientId,
        items: items
          .map((it) => ({ ...it, sizeItems: it.sizeItems.filter((si) => si.quantity || si.width || si.height) }))
          .filter((it) => it.label.trim() || it.materialIds.length > 0 || it.sizeItems.length > 0 || it.notes.trim()),
      });
      setMode('view');
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Detalle del trabajo</h2>
        {mode === 'view' && !locked && (
          <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 border border-brand-300 rounded-lg px-3 py-1.5 hover:bg-brand-50">
            <Pencil size={12} /> Editar
          </button>
        )}
      </div>
      {locked && (
        <p className="text-xs text-ink-700 -mt-1">Este presupuesto ya se confirmó — el detalle quedó fijo tal como se usó para generar el trabajo.</p>
      )}

      {mode === 'view' ? (
        <QuoteItemsView items={quote.items} />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="qd-client" className={labelCls}>Cliente</label>
              <input id="qd-client" className={inputCls} list="qd-clientes-existentes" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <datalist id="qd-clientes-existentes">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="qd-name" className={labelCls}>Nombre del trabajo</label>
              <input id="qd-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <QuoteItemsEditor items={items} onChange={setItems} />
          <div className="flex items-center gap-3">
            <button
              onClick={save} disabled={saving || !clientName.trim() || !name.trim()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setMode('view')} disabled={saving} className="text-sm text-ink-700 hover:text-ink-900 disabled:opacity-40">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Con `key={quote.id}` en el padre, este componente se vuelve a montar entero
// si cambia de presupuesto — el estado local arranca siempre desde los valores
// reales de ESE presupuesto sin necesitar un efecto que lo resincronice.
function QuoteValueSection({ quote }: { quote: Quote }) {
  const user = useStore((s) => s.currentUser) as User;
  const setQuoteValue = useStore((s) => s.setQuoteValue);
  const canSetValue = canSetQuoteValue(user);

  const [priceInput, setPriceInput] = useState(quote.price !== null ? String(quote.price) : '');
  const [ivaChoice, setIvaChoice] = useState<'incluido' | 'mas_iva' | ''>(
    quote.priceIncludesIva === null ? '' : quote.priceIncludesIva ? 'incluido' : 'mas_iva'
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const price = priceInput.trim() ? Number(priceInput.replace(',', '.')) : null;
    if (priceInput.trim() && Number.isNaN(price)) { alert('El importe no es un número válido.'); return; }
    setSaving(true);
    try {
      await setQuoteValue(quote.id, price, ivaChoice === '' ? null : ivaChoice === 'incluido');
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign size={15} className="text-ink-700" aria-hidden />
        <h2 className="text-sm font-semibold text-ink-900">Valor del presupuesto</h2>
      </div>
      {!canSetValue ? (
        <p className="text-sm text-ink-800">
          <span className="font-semibold">{formatPrice(quote.price, quote.priceIncludesIva)}</span>
          <span className="block text-xs text-ink-700 mt-1">Solo dueños y administración pueden cargar o cambiar este valor.</span>
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="qd-price" className={labelCls}>Importe</label>
            <input
              id="qd-price" className={`${inputCls} w-40`} inputMode="decimal" value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)} placeholder="$"
            />
          </div>
          <div role="group" aria-label="¿El importe incluye IVA?" className="inline-flex rounded-full border border-ink-200 overflow-hidden text-xs font-semibold">
            <button type="button" onClick={() => setIvaChoice('incluido')} aria-pressed={ivaChoice === 'incluido'}
              className={`px-3 py-2 ${ivaChoice === 'incluido' ? 'bg-ink-950 text-white' : 'text-ink-700 hover:bg-ink-50'}`}>
              IVA incluido
            </button>
            <button type="button" onClick={() => setIvaChoice('mas_iva')} aria-pressed={ivaChoice === 'mas_iva'}
              className={`px-3 py-2 ${ivaChoice === 'mas_iva' ? 'bg-ink-950 text-white' : 'text-ink-700 hover:bg-ink-50'}`}>
              + IVA
            </button>
          </div>
          <button
            onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar valor'}
          </button>
        </div>
      )}
    </div>
  );
}
