import { Plus, X } from 'lucide-react';
import type { SizeItem } from '../../types';

const cellCls = 'w-full border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const cellLabelCls = 'block text-[10px] font-medium text-ink-700 mb-1';

/** Un renglón editable de cantidad/ancho/alto, con botón para agregar y quitar renglones. */
export function SizeItemsEditor({ items, onChange }: { items: SizeItem[]; onChange: (items: SizeItem[]) => void }) {
  function update(i: number, patch: Partial<SizeItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { quantity: '', width: '', height: '' }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="w-20 shrink-0">
            {i === 0 && <label className={cellLabelCls}>Cantidad</label>}
            <input value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={cellCls} />
          </div>
          <div className="flex-1">
            {i === 0 && <label className={cellLabelCls}>Ancho</label>}
            <input value={item.width} onChange={(e) => update(i, { width: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
          </div>
          <div className="flex-1">
            {i === 0 && <label className={cellLabelCls}>Alto</label>}
            <input value={item.height} onChange={(e) => update(i, { height: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
          </div>
          <button type="button" onClick={() => remove(i)} aria-label="Quitar este renglón de medida" className="text-ink-700 hover:text-crit-text p-1.5 shrink-0">
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-3 py-1.5 hover:bg-brand-50"
      >
        <Plus size={13} /> Agregar medida
      </button>
    </div>
  );
}

/** Vista de solo lectura de los mismos renglones — para la ficha antes de tocar "Editar". */
export function SizeItemsView({ items }: { items: SizeItem[] }) {
  const withData = items.filter((it) => it.quantity || it.width || it.height);
  if (withData.length === 0) return <p className="text-sm text-ink-700 italic">Sin medidas cargadas.</p>;
  return (
    <table className="w-full text-sm border border-ink-100 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-700">
          <th className="px-3 py-1.5 font-medium">Cantidad</th>
          <th className="px-3 py-1.5 font-medium">Ancho</th>
          <th className="px-3 py-1.5 font-medium">Alto</th>
        </tr>
      </thead>
      <tbody>
        {withData.map((it, i) => (
          <tr key={i} className="border-t border-ink-50">
            <td className="px-3 py-1.5 text-ink-800">{it.quantity || '—'}</td>
            <td className="px-3 py-1.5 text-ink-800">{it.width || '—'}</td>
            <td className="px-3 py-1.5 text-ink-800">{it.height || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
