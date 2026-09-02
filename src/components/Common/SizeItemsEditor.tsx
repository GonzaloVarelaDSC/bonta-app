import { Plus, X } from 'lucide-react';
import type { SizeItem } from '../../types';

const cellCls = 'w-full border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const GRID_COLS = 'grid grid-cols-[56px_1fr_1fr_28px] gap-2';

/**
 * Un renglón editable de cantidad/ancho/alto por fila, con botón para agregar
 * y quitar renglones. Todo dentro de una tarjeta con líneas divisorias (mismo
 * lenguaje que el checklist de control de calidad) para que se lea como una
 * lista prolija en vez de inputs sueltos flotando.
 */
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
    <div className="bg-white border border-ink-100 rounded-lg overflow-hidden">
      <div className={`${GRID_COLS} px-3 py-1.5 bg-ink-50 text-[10px] uppercase tracking-wide text-ink-700 font-medium`}>
        <span>Cant.</span><span>Ancho</span><span>Alto</span><span />
      </div>
      <div className="divide-y divide-ink-50">
        {items.length === 0 && <div className="px-3 py-4 text-sm text-ink-700 italic text-center">Sin renglones todavía — agregá uno abajo.</div>}
        {items.map((item, i) => (
          <div key={i} className={`${GRID_COLS} items-center px-3 py-2`}>
            <input value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={cellCls} />
            <input value={item.width} onChange={(e) => update(i, { width: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
            <input value={item.height} onChange={(e) => update(i, { height: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
            <button type="button" onClick={() => remove(i)} aria-label="Quitar este renglón de medida" className="text-ink-700 hover:text-crit-text p-1 justify-self-center">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button" onClick={add}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-brand-600 border-t border-ink-100 py-2 hover:bg-brand-50"
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
