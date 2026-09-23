import { Plus, X } from 'lucide-react';
import { SizeItemsEditor, SizeItemsView } from './SizeItemsEditor';
import { useStore } from '../../store/useStore';
import { QUOTE_UNIT_SUGGESTIONS } from '../../data/catalog';
import type { MaterialId, QuoteItem } from '../../types';

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

/**
 * Ítems de un presupuesto — mismo lenguaje visual que `ProductsEditor` (medidas
 * y materiales de un trabajo), pero más liviano: sin "procesado"/"tercerizado"
 * (no tiene sentido todavía no siendo un trabajo en curso), y con un campo
 * "Unidad" nuevo, propio de presupuestar (m², ml, unidad, etc.).
 */
export function QuoteItemsEditor({ items, onChange }: { items: QuoteItem[]; onChange: (items: QuoteItem[]) => void }) {
  const materials = useStore((s) => s.materials);

  function update(i: number, patch: Partial<QuoteItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { id: crypto.randomUUID(), label: '', unit: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }], notes: '' }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function toggleMaterial(i: number, id: MaterialId) {
    const it = items[i];
    update(i, { materialIds: it.materialIds.includes(id) ? it.materialIds.filter((m) => m !== id) : [...it.materialIds, id] });
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-ink-700 italic">Todavía no hay ítems cargados.</p>}
      {items.map((item, i) => (
        <div key={item.id} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-ink-50 bg-ink-50/50">
            <input
              value={item.label} onChange={(e) => update(i, { label: e.target.value })}
              placeholder={`Ítem ${i + 1} — ej. "Cartel luminoso frente local"`}
              className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
            />
            <input
              value={item.unit} onChange={(e) => update(i, { unit: e.target.value })}
              list="quote-unit-suggestions" placeholder="Unidad (m², ml, unidad...)"
              className="w-40 shrink-0 border border-ink-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="button" onClick={() => remove(i)} aria-label={`Quitar ítem ${i + 1}`} className="text-ink-700 hover:text-crit-text shrink-0">
              <X size={15} />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <span className={labelCls}>Material</span>
              <div className="flex flex-wrap gap-1.5">
                {materials.map((m) => (
                  <button type="button" key={m.id} onClick={() => toggleMaterial(i, m.id)} aria-pressed={item.materialIds.includes(m.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${item.materialIds.includes(m.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={labelCls}>Cantidad y medidas</span>
              <SizeItemsEditor items={item.sizeItems} onChange={(sizeItems) => update(i, { sizeItems })} />
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea
                value={item.notes} onChange={(e) => update(i, { notes: e.target.value })} rows={2}
                placeholder='Ej: "Con base, montado en PVC", "Acrílico 5mm cristal"'
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}
      <datalist id="quote-unit-suggestions">
        {QUOTE_UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
      </datalist>
      <button
        type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-3 py-2 hover:bg-brand-50"
      >
        <Plus size={14} /> Agregar ítem
      </button>
    </div>
  );
}

/** Vista de solo lectura — misma lógica que `ProductsView`, sin checkbox de procesado (no aplica todavía a un presupuesto). */
export function QuoteItemsView({ items }: { items: QuoteItem[] }) {
  const materials = useStore((s) => s.materials);
  if (items.length === 0) return <p className="text-sm text-ink-700 italic">Todavía no hay ítems cargados.</p>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="bg-white border border-ink-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink-900">{it.label || 'Ítem sin nombre'}</span>
            {it.unit && <span className="text-[11px] bg-ink-100 text-ink-700 rounded-full px-2 py-0.5">{it.unit}</span>}
          </div>
          {it.materialIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {it.materialIds.map((id) => (
                <span key={id} className="text-[11px] bg-ink-100 text-ink-700 rounded-full px-2 py-0.5">{materials.find((m) => m.id === id)?.label}</span>
              ))}
            </div>
          )}
          <div className="mt-1.5">
            <SizeItemsView items={it.sizeItems} />
          </div>
          {it.notes && <p className="text-xs text-ink-700 mt-1.5">{it.notes}</p>}
        </div>
      ))}
    </div>
  );
}
