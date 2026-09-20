import { useState } from 'react';
import { Lightbulb, Plus, X, Truck, Check } from 'lucide-react';
import { SizeItemsEditor, SizeItemsView } from './SizeItemsEditor';
import { useStore } from '../../store/useStore';
import type { JobTypeId, MaterialId, Product } from '../../types';

function newProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: crypto.randomUUID(), label: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }],
    notes: '', checked: false, ...overrides,
  };
}

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

/**
 * Un trabajo real casi nunca es "un material, una medida" — son productos
 * distintos para el mismo cliente en el mismo trabajo (ej. "Corpóreo 3D" +
 * "Corpóreo en acrílico"), cada uno con su propio material y sus propias
 * medidas. Se usa tanto en Carga rápida (alta) como en la ficha (edición).
 */
export function ProductsEditor({ products, onChange, jobTypeId }: { products: Product[]; onChange: (products: Product[]) => void; jobTypeId?: JobTypeId }) {
  const materials = useStore((s) => s.materials);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  function update(i: number, patch: Partial<Product>) {
    onChange(products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add(overrides: Partial<Product> = {}) {
    onChange([...products, newProduct(overrides)]);
  }
  function remove(i: number) {
    onChange(products.filter((_, idx) => idx !== i));
  }
  function toggleMaterial(i: number, id: MaterialId) {
    const p = products[i];
    update(i, { materialIds: p.materialIds.includes(id) ? p.materialIds.filter((m) => m !== id) : [...p.materialIds, id] });
  }

  // Corpóreo casi siempre (Gonzalo: "95% de las veces") necesita también su
  // plantilla de vinilo de corte para la instalación — sugerencia, no
  // automático: si no aplica en ese trabajo puntual, se ignora con un click.
  const showTemplateSuggestion = jobTypeId === 'corporeo' && !suggestionDismissed
    && !products.some((p) => p.label.toLowerCase().includes('plantilla'));

  return (
    <div className="space-y-3">
      {products.length === 0 && (
        <p className="text-sm text-ink-700 italic">Todavía no hay productos cargados.</p>
      )}
      {products.map((product, i) => (
        <div key={product.id} className={`bg-white border rounded-lg overflow-hidden ${product.outsourced ? 'border-site/40' : 'border-ink-100'}`}>
          <div className={`flex items-center gap-2 flex-wrap px-3 py-2 border-b ${product.outsourced ? 'border-site/20 bg-site-bg' : 'border-ink-50 bg-ink-50/50'}`}>
            <input
              value={product.label} onChange={(e) => update(i, { label: e.target.value })}
              placeholder={`Producto ${i + 1} — ej. "Corpóreo 3D"`}
              className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
            />
            {/* Antes era un solo pill "Tercerizada" que solo cambiaba de color al
                activarse — sin texto propio para el estado "no", se confundía con
                una etiqueta de categoría ("esta pantalla es para tercerizados")
                en vez de una característica de ESTE producto puntual (punto 4,
                20/09). Segmentado con las dos opciones siempre visibles — el
                estado activo nunca depende solo del color. */}
            <div
              role="group" aria-label={`¿"${product.label || `Producto ${i + 1}`}" es tercerizado?`}
              className="inline-flex rounded-full border border-ink-200 overflow-hidden shrink-0 text-[11px] font-semibold"
            >
              <button
                type="button" onClick={() => update(i, { outsourced: false })}
                aria-pressed={!product.outsourced}
                className={`px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  !product.outsourced ? 'bg-ink-950 text-white' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                Hecho acá
              </button>
              <button
                type="button" onClick={() => update(i, { outsourced: true })}
                aria-pressed={!!product.outsourced}
                className={`inline-flex items-center gap-1 px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  product.outsourced ? 'bg-site-text text-white' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                <Truck size={11} aria-hidden /> Tercerizado
              </button>
            </div>
            <button type="button" onClick={() => remove(i)} aria-label={`Quitar producto ${i + 1}`} className="text-ink-700 hover:text-crit-text shrink-0">
              <X size={15} />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <span className={labelCls}>Material</span>
              <div className="flex flex-wrap gap-1.5">
                {materials.map((m) => (
                  <button type="button" key={m.id} onClick={() => toggleMaterial(i, m.id)} aria-pressed={product.materialIds.includes(m.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${product.materialIds.includes(m.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={labelCls}>Cantidad y medidas</span>
              <SizeItemsEditor items={product.sizeItems} onChange={(sizeItems) => update(i, { sizeItems })} />
            </div>
            <div>
              <label className={labelCls}>
                Notas (espesor, color, mate/brillo/satin, con o sin base, montado o no, etc.)
              </label>
              <textarea
                value={product.notes} onChange={(e) => update(i, { notes: e.target.value })} rows={2}
                placeholder='Ej: "Acrílico 5mm cristal", "Vinilo con base, montado en PVC (sin demasía)"'
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}

      {showTemplateSuggestion && (
        <div className="flex items-start gap-2.5 bg-review-bg text-review-text rounded-lg px-3 py-2.5 text-xs">
          <Lightbulb size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            Los trabajos de Corpóreo suelen necesitar también una plantilla de vinilo de corte para la instalación.
            <div className="flex gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  // Hereda la medida del primer producto que ya tenga alguna cargada — sin
                  // esto era fácil terminar creando el trabajo con la plantilla sin su
                  // propia medida, porque el gate de creación solo exige que ALGÚN
                  // producto tenga medida (ver CLAUDE.md §25, hallazgo 4).
                  const withSize = products.find((p) => p.sizeItems.some((it) => it.quantity.trim() || it.width.trim() || it.height.trim()));
                  add({
                    label: 'Plantilla de vinilo de corte', materialIds: ['vinilo'],
                    ...(withSize ? { sizeItems: withSize.sizeItems.map((it) => ({ ...it })) } : {}),
                  });
                  setSuggestionDismissed(true);
                }}
                className="font-semibold hover:underline"
              >
                + Agregar
              </button>
              <button type="button" onClick={() => setSuggestionDismissed(true)} className="hover:underline">No hace falta</button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button" onClick={() => add()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-3 py-2 hover:bg-brand-50"
      >
        <Plus size={14} /> Agregar producto
      </button>
    </div>
  );
}

/** Vista de solo lectura — con checkbox siempre clickeable (ver ProductsChecklist) para no tener que entrar en modo edición solo para tildar. */
export function ProductsView({ products, onToggle }: { products: Product[]; onToggle?: (productId: string) => void }) {
  const materials = useStore((s) => s.materials);
  if (products.length === 0) return <p className="text-sm text-ink-700 italic">Todavía no hay productos cargados.</p>;
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className={`bg-white border rounded-lg px-3 py-2.5 ${p.outsourced ? 'border-site/40' : 'border-ink-100'}`}>
          <label className={`flex items-start gap-2.5 ${onToggle ? 'cursor-pointer' : ''}`}>
            {onToggle ? (
              <input
                type="checkbox" checked={p.checked} onChange={() => onToggle(p.id)}
                className="rounded mt-0.5"
              />
            ) : (
              // Sin `onToggle` este es un preview de solo lectura (ej. la "minuta"
              // de la pestaña General) — un checkbox real deshabilitado se ve casi
              // igual a uno clickeable y puede parecer roto; acá un ícono estático
              // deja claro que tildar "procesado" se hace desde la pestaña Detalle.
              // `role="img"` + `aria-label` explícito porque, a diferencia del
              // checkbox que reemplaza, un <span> decorativo no anuncia ningún
              // estado solo — sin esto un lector de pantalla lo saltea en silencio.
              <span
                role="img" aria-label={p.checked ? 'Procesado' : 'Sin procesar'}
                className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${p.checked ? 'bg-plan border-plan' : 'border-ink-300'}`}
              >
                {p.checked && <Check size={10} className="text-white" strokeWidth={3} aria-hidden />}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${p.checked ? 'text-ink-700 line-through decoration-ink-300' : 'text-ink-900'}`}>
                  {p.label || 'Producto sin nombre'}
                </span>
                {p.outsourced && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-site-bg text-site-text rounded-full px-2 py-0.5">
                    <Truck size={11} aria-hidden /> Tercerizada
                  </span>
                )}
              </div>
              {p.materialIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.materialIds.map((id) => (
                    <span key={id} className="text-[11px] bg-ink-100 text-ink-700 rounded-full px-2 py-0.5">{materials.find((m) => m.id === id)?.label}</span>
                  ))}
                </div>
              )}
              <div className="mt-1.5">
                <SizeItemsView items={p.sizeItems} />
              </div>
              {p.notes && <p className="text-xs text-ink-700 mt-1.5">{p.notes}</p>}
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}
