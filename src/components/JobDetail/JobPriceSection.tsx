import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { DollarSign, Lock } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { friendlyError } from '../../lib/errors';
import { fmtDateTime } from '../../lib/dates';
import type { Job } from '../../types';

const money = (x: number) => x.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

// Importe final del trabajo (19/10, CLAUDE.md §74). A propósito NO está en Carga
// rápida (al crear la ficha casi nunca hay precio): se carga acá cuando se sabe.
// Solo se renderiza para canSetQuoteValue (admin / administración); la tabla
// job_prices tiene la misma regla en la base (029), así que un diseñador ni
// siquiera puede leer el importe por fuera de la app.
export function JobPriceSection({ job }: { job: Job }) {
  const price = useStore((s) => s.jobPrices[job.id]);
  const loaded = useStore((s) => s.jobPricesLoaded);
  const loadJobPrices = useStore((s) => s.loadJobPrices);
  const setJobPrice = useStore((s) => s.setJobPrice);
  const clearJobPrice = useStore((s) => s.clearJobPrice);
  const quotes = useStore((s) => s.quotes);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const loadQuotes = useStore((s) => s.loadQuotes);
  const users = useStore((s) => s.users);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [withIva, setWithIva] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) loadJobPrices().catch((e) => setLoadErr(friendlyError(e)));
    if (job.sourceQuoteId && !quotesLoaded) loadQuotes().catch(() => { /* sin sugerencia del presupuesto */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quote = job.sourceQuoteId ? quotes.find((q) => q.id === job.sourceQuoteId) : undefined;
  const parsed = Number(amount.replace(/\./g, '').replace(',', '.'));
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  function startEdit() {
    setAmount(price ? String(price.enteredAmount).replace('.', ',') : '');
    setWithIva(price?.enteredWithIva ?? false);
    setNote(price?.note ?? '');
    setEditing(true);
  }
  async function save() {
    if (!valid) return;
    setSaving(true);
    try { await setJobPrice(job.id, { enteredAmount: parsed, withIva, note: note.trim() }); setEditing(false); }
    catch (e) { alert(friendlyError(e)); } finally { setSaving(false); }
  }
  async function remove() {
    if (!confirm('¿Quitar el importe final de este trabajo?')) return;
    try { await clearJobPrice(job.id); setEditing(false); } catch (e) { alert(friendlyError(e)); }
  }

  return (
    <div className="max-w-3xl mt-6 pt-5 border-t border-ink-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wide text-ink-700 font-semibold inline-flex items-center gap-1"><DollarSign size={13} aria-hidden="true" /> Importe final</span>
        <span className="text-[11px] text-ink-600 inline-flex items-center gap-1"><Lock size={11} aria-hidden="true" /> Solo lo ven dueños y administración</span>
      </div>
      {loadErr ? (
        <p className="text-sm text-crit-text">No se pudo leer el importe: {loadErr} Puede que falte correr la migración 029 en Supabase.</p>
      ) : !loaded ? (
        <p className="text-sm text-ink-700">Cargando…</p>
      ) : !editing ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {price ? (
            <>
              <span className="text-lg font-bold text-ink-900">{money(price.amountNet)} <span className="text-xs font-normal text-ink-700">sin IVA</span></span>
              {price.enteredWithIva && <span className="text-xs text-ink-700">(cargado como {money(price.enteredAmount)} con IVA {Math.round(price.ivaRate * 100)}%)</span>}
              <span className="text-[11px] text-ink-600">{users.find((u) => u.id === price.updatedBy)?.name ?? '—'} · {fmtDateTime(price.updatedAt)}</span>
              {price.note && <span className="basis-full text-xs text-ink-800">{price.note}</span>}
            </>
          ) : <span className="text-sm text-ink-700">Todavía sin cargar. Se carga cuando se sabe el precio final, no hace falta al crear la ficha.</span>}
          <button type="button" onClick={startEdit} className="text-xs font-medium text-brand-600 hover:underline">{price ? 'Editar' : 'Cargar importe'}</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`price-${job.id}`}>Importe</label>
            <span className="text-sm text-ink-700">$</span>
            <input id={`price-${job.id}`} inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej.: 350000"
              className="w-40 text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <div role="group" aria-label="El importe tipeado" className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5 text-xs">
              {[false, true].map((v) => (
                <button key={String(v)} type="button" aria-pressed={withIva === v} onClick={() => setWithIva(v)}
                  className={clsx('px-2.5 py-1 rounded-md font-medium', withIva === v ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50')}>
                  {v ? 'Incluye IVA (21%)' : 'Sin IVA'}
                </button>
              ))}
            </div>
            {valid && withIva && <span className="text-xs text-ink-700">= {money(Math.round((parsed / 1.21) * 100) / 100)} sin IVA</span>}
          </div>
          {quote?.price != null && (
            <button type="button" onClick={() => { setAmount(String(quote.price).replace('.', ',')); setWithIva(quote.priceIncludesIva === true); }}
              className="text-xs text-brand-600 hover:underline">
              Usar el del presupuesto {quote.code}: {money(quote.price)}{quote.priceIncludesIva === true ? ' con IVA' : quote.priceIncludesIva === false ? ' + IVA' : ' (IVA sin aclarar)'}
            </button>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional (ej.: incluye flete, se cobró en dos pagos)" aria-label="Nota del importe"
            className="w-full max-w-md text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <div className="flex gap-2">
            <button type="button" disabled={!valid || saving} onClick={save} className="text-sm px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-lg border border-ink-200 hover:bg-ink-50">Cancelar</button>
            {price && <button type="button" onClick={remove} className="ml-auto text-xs text-crit-text hover:underline">Quitar importe</button>}
          </div>
        </div>
      )}
    </div>
  );
}
