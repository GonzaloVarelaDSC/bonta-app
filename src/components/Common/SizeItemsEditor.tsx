import { useEffect, useRef } from 'react';
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
  const boxRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  function focusCell(key: string) {
    boxRef.current?.querySelector<HTMLInputElement>(`[data-cell="${key}"]`)?.focus();
  }
  // Un renglón recién agregado con Enter recién existe en el próximo render.
  useEffect(() => {
    if (pendingFocus.current) { focusCell(pendingFocus.current); pendingFocus.current = null; }
  }, [items.length]);

  // Enter pasa al casillero siguiente (Cant. → Ancho → Alto → próximo renglón),
  // como en una planilla (Gonzalo, 18/10). En el Alto del último renglón, si ya
  // tiene algo cargado, agrega un renglón nuevo; nunca envía el formulario.
  function onEnter(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (col < 2) return focusCell(`${row}-${col + 1}`);
    if (row < items.length - 1) return focusCell(`${row + 1}-0`);
    const it = items[row];
    if (it.quantity.trim() || it.width.trim() || it.height.trim()) {
      pendingFocus.current = `${row + 1}-0`;
      add();
    }
  }

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
    <div ref={boxRef} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
      <div className={`${GRID_COLS} px-3 py-1.5 bg-ink-50 text-[10px] uppercase tracking-wide text-ink-700 font-medium`}>
        <span>Cant.</span><span>Ancho</span><span>Alto</span><span />
      </div>
      <div className="divide-y divide-ink-50">
        {items.length === 0 && <div className="px-3 py-4 text-sm text-ink-700 italic text-center">Sin renglones todavía — agregá uno abajo.</div>}
        {items.map((item, i) => (
          <div key={i} className={`${GRID_COLS} items-center px-3 py-2`}>
            <input aria-label="Cantidad" inputMode="numeric" enterKeyHint="next" autoComplete="off" data-cell={`${i}-0`} onKeyDown={(e) => onEnter(e, i, 0)} value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={cellCls} />
            <input aria-label="Ancho" enterKeyHint="next" autoComplete="off" data-cell={`${i}-1`} onKeyDown={(e) => onEnter(e, i, 1)} value={item.width} onChange={(e) => update(i, { width: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
            <input aria-label="Alto" enterKeyHint="next" autoComplete="off" data-cell={`${i}-2`} onKeyDown={(e) => onEnter(e, i, 2)} value={item.height} onChange={(e) => update(i, { height: e.target.value })} placeholder="cm o «a medida»" className={cellCls} />
            <button type="button" onClick={() => remove(i)} aria-label="Quitar este renglón de medida" className="text-ink-700 hover:text-crit-text p-2.5 -m-1.5 sm:p-1 sm:m-0 justify-self-center">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button" onClick={add}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-brand-600 border-t border-ink-100 py-3 sm:py-2 hover:bg-brand-50"
      >
        <Plus size={13} /> Agregar medida
      </button>
    </div>
  );
}

const VIEW_GRID_COLS = 'grid grid-cols-[56px_1fr_1fr] gap-2';

/**
 * Vista de solo lectura de los mismos renglones — para la ficha antes de
 * tocar "Editar". Divs con grid, igual que el editor — nada de `<table>`:
 * con el `border`/`overflow-hidden` de Tailwind una tabla HTML no pintaba
 * bien el contorno ni el fondo del header en algunos navegadores.
 */
export function SizeItemsView({ items }: { items: SizeItem[] }) {
  const withData = items.filter((it) => it.quantity || it.width || it.height);
  if (withData.length === 0) {
    return <p className="text-sm text-ink-700 italic">Sin medidas cargadas.</p>;
  }
  return (
    <div className="border border-ink-100 rounded-lg overflow-hidden">
      <div className={`${VIEW_GRID_COLS} px-3 py-1.5 bg-ink-50 text-[10px] uppercase tracking-wide text-ink-700 font-medium`}>
        <span>Cantidad</span><span>Ancho</span><span>Alto</span>
      </div>
      <div className="divide-y divide-ink-50 bg-white">
        {withData.map((it, i) => (
          <div key={i} className={`${VIEW_GRID_COLS} px-3 py-2 text-ink-800`}>
            <span>{it.quantity || '—'}</span><span>{it.width || '—'}</span><span>{it.height || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
