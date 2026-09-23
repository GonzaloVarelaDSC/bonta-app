import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canManageQuotes } from '../../lib/permissions';
import { QUOTE_STATUS_LABELS } from '../../data/catalog';
import { QuoteStatusBadge } from '../Common/Badges';
import { fmtShort } from '../../lib/dates';
import type { QuoteStatus } from '../../types';

function formatPrice(price: number | null, includesIva: boolean | null): string {
  if (price === null) return '—';
  const formatted = price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  if (includesIva === null) return formatted;
  return `${formatted} ${includesIva ? '— IVA incluido' : '+ IVA'}`;
}

/**
 * Sección separada de Trabajos a propósito — un presupuesto es un posible
 * trabajo que el cliente todavía no confirmó (ver types/index.ts, Quote).
 * Mismo lenguaje visual que JobsPage (filtros arriba, tabla abajo).
 */
export function QuotesPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser)!;
  const quotes = useStore((s) => s.quotes);
  const quotesLoaded = useStore((s) => s.quotesLoaded);
  const clients = useStore((s) => s.clients);
  const loadQuotes = useStore((s) => s.loadQuotes);

  useEffect(() => {
    if (!quotesLoaded) loadQuotes().catch(() => {});
  }, [quotesLoaded, loadQuotes]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState('all');

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (clientFilter !== 'all' && q.clientId !== clientFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const client = clients.find((c) => c.id === q.clientId);
        if (!(q.code.toLowerCase().includes(s) || q.name.toLowerCase().includes(s) || client?.name.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [quotes, statusFilter, clientFilter, search, clients]);

  const selectCls = 'text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 bg-white text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-display font-bold text-ink-900">Presupuestos</h1>
        {canManageQuotes(user.role) && (
          <button onClick={() => navigate('/presupuestos/nuevo')} className="inline-flex items-center gap-1.5 bg-ink-950 text-white text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-ink-800 transition-colors">
            <Plus size={16} /> Nuevo presupuesto
          </button>
        )}
      </div>
      <p className="text-sm text-ink-700 mb-4">Posibles trabajos que el cliente todavía no confirmó — no aparecen en Trabajos hasta que se acepten.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar"
          className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 w-56 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select aria-label="Estado" className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">Todo estado</option>
          {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Cliente" className={selectCls} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="all">Todo cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-700 self-center">{filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-700">
            {quotesLoaded ? 'No hay presupuestos que coincidan con este filtro.' : 'Cargando...'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-700 border-b border-ink-100">
                <th className="px-4 py-2.5 font-medium">N°</th>
                <th className="px-2 py-2.5 font-medium">Cliente</th>
                <th className="px-2 py-2.5 font-medium">Trabajo</th>
                <th className="px-2 py-2.5 font-medium">Estado</th>
                <th className="px-2 py-2.5 font-medium">Valor</th>
                <th className="px-2 py-2.5 font-medium">Actualizado</th>
                <th className="px-2 py-2.5 font-medium sticky right-0 bg-white"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const client = clients.find((c) => c.id === q.clientId);
                return (
                  <tr
                    key={q.id}
                    onClick={() => navigate(`/presupuestos/${q.id}`)}
                    className="group border-b border-ink-50 last:border-0 hover:bg-ink-50/70 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-700">{q.code}</td>
                    <td className="px-2 py-2.5 text-ink-700 whitespace-nowrap">{client?.name}</td>
                    <td className="px-2 py-2.5 text-ink-900 font-medium max-w-[280px] truncate">{q.name}</td>
                    <td className="px-2 py-2.5"><QuoteStatusBadge status={q.status} /></td>
                    <td className="px-2 py-2.5 text-xs text-ink-700 whitespace-nowrap">{formatPrice(q.price, q.priceIncludesIva)}</td>
                    <td className="px-2 py-2.5 text-xs text-ink-700 whitespace-nowrap">{fmtShort(q.lastActivityAt)}</td>
                    <td className="px-2 py-2.5 sticky right-0 bg-white group-hover:bg-ink-50/70 transition-colors">
                      <ArrowRight size={15} className="text-ink-700" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
