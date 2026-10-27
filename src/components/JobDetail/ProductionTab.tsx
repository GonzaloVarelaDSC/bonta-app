import { useMemo, useState } from 'react';
import { FileOutput, Plus, Trash2 } from 'lucide-react';
import type { Assembly, Job, ProductionItem } from '../../types';
import { useStore } from '../../store/useStore';
import { PRODUCTION_PROCESSES } from '../../data/catalog';
import { productionRows, configFromRows } from '../../lib/production';
import { friendlyError } from '../../lib/errors';
import { ContactSheetSection } from './ContactSheetSection';
import { AssemblySection } from './AssemblySection';
import { piecesFromRows } from '../../lib/assembly';

const inputCls = 'w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Pestaña "Producción" de la ficha (12/10): se eligen los procesos de taller de
 * cada componente y se exporta la planilla para imprimir y completar a mano.
 * Trabaja sobre una copia en borrador de `job.productionConfig` — los
 * componentes de la OT se muestran de solo lectura (se editan en "Detalle"),
 * así acá nunca se puede tocar la carga original sin querer.
 */
export function ProductionTab({ job }: { job: Job }) {
  const user = useStore((s) => s.currentUser)!;
  const materials = useStore((s) => s.materials);
  const saveProductionConfig = useStore((s) => s.saveProductionConfig);
  const [items, setItems] = useState<ProductionItem[]>(job.productionConfig.items);
  const [assemblies, setAssemblies] = useState<Assembly[]>(job.productionConfig.assemblies ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => productionRows(job, { items }, materials), [job, items, materials]);
  const pieces = useMemo(() => piecesFromRows(rows, new Set(job.products.filter((p) => p.checked).map((p) => p.id))), [rows, job.products]);

  // Upsert por id: un componente de la OT que todavía no tenía configuración
  // entra al borrador recién cuando se le cambia algo.
  // Los cambios se calculan sobre el valor vigente dentro del setState (no
  // sobre el de este render), así dos clicks seguidos no se pisan.
  function patch(row: ProductionItem, changes: Partial<ProductionItem> | ((cur: ProductionItem) => Partial<ProductionItem>)) {
    setItems((prev) => {
      const cur = prev.find((i) => i.id === row.id) ?? row;
      const next = { ...cur, ...(typeof changes === 'function' ? changes(cur) : changes) };
      return prev.some((i) => i.id === row.id) ? prev.map((i) => i.id === row.id ? next : i) : [...prev, next];
    });
    setDirty(true);
  }
  function toggleProcess(row: ProductionItem, processId: string) {
    patch(row, (cur) => ({ processes: cur.processes.includes(processId) ? cur.processes.filter((p) => p !== processId) : [...cur.processes, processId] }));
  }
  function addExtra() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), source: 'extra', processes: [], note: '', label: '', quantity: '', size: '' }]);
    setDirty(true);
  }
  function removeExtra(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDirty(true);
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      // El avance de armado se guarda aparte ("Guardar avance"): acá se toman los
      // contadores vigentes, no los del borrador, para no volver a un conteo viejo.
      const current = job.productionConfig.assemblies ?? [];
      const merged = assemblies.map((a) => {
        const s = current.find((x) => x.id === a.id);
        if (!s) return a;
        return { ...a, assembled: s.assembled, components: a.components.map((c) => ({ ...c, ready: s.components.find((x) => x.pieceKey === c.pieceKey)?.ready ?? 0 })) };
      });
      await saveProductionConfig(job.id, { ...configFromRows(rows), assemblies: merged }, user.id);
      setAssemblies(merged);
      setDirty(false);
      return true;
    } catch (err) {
      alert(friendlyError(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    // La pestaña se abre ANTES de guardar (si no, el navegador la bloquea por no
    // venir directo del click) y recién después se le carga la planilla, así la
    // exportación usa siempre la configuración recién guardada.
    const win = window.open('about:blank', '_blank');
    if (dirty && !(await save())) { win?.close(); return; }
    const url = `/trabajos/${job.id}/produccion/exportar`;
    if (win) win.location.href = url; else window.location.href = url;
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-ink-700 max-w-xl">
          Marcá qué procesos lleva cada componente y exportá la planilla para imprimir y completar a mano en el taller.
          Los componentes de la OT salen de la pestaña Detalle; acá podés sumar otros solo para producción.
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {dirty && (
            <button onClick={save} disabled={saving}
              className="min-h-[44px] sm:min-h-0 text-sm font-semibold text-ink-800 bg-white border border-ink-200 rounded-lg px-3 py-2 hover:bg-ink-50 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
          <button onClick={exportPdf} disabled={saving}
            className="flex-1 sm:flex-none justify-center min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800 disabled:opacity-60">
            <FileOutput size={15} aria-hidden /> Exportar PDF de producción
          </button>
        </div>
      </div>

      <ContactSheetSection job={job} />

      {rows.length === 0 && (
        <p className="text-sm text-ink-700 italic">La OT todavía no tiene componentes cargados. Podés cargarlos en Detalle o agregar uno solo para producción.</p>
      )}

      {rows.map(({ item, label, quantities, sizes, material, notes }, idx) => {
        const extra = item.source === 'extra';
        return (
          <div key={item.id} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-50 bg-ink-50/50">
              {extra ? (
                <input value={item.label ?? ''} onChange={(e) => patch(item, { label: e.target.value })}
                  placeholder="Nombre del componente" aria-label={`Nombre del componente ${idx + 1}`}
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none" />
              ) : (
                <span className="flex-1 min-w-0 text-sm font-semibold text-ink-900 truncate">{label || 'Producto sin nombre'}</span>
              )}
              {extra && <span className="text-[11px] font-semibold text-review-text bg-review-bg rounded-full px-2 py-0.5 shrink-0">Agregado para producción</span>}
              {extra && (
                <button type="button" onClick={() => removeExtra(item.id)} aria-label={`Quitar ${item.label || 'componente'}`} className="text-ink-700 hover:text-crit-text shrink-0 p-2 -m-2 lg:p-0 lg:m-0">
                  <Trash2 size={15} aria-hidden />
                </button>
              )}
            </div>
            <div className="p-3 space-y-3">
              {extra ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs text-ink-700">Cantidad
                    <input className={inputCls + ' mt-1'} value={item.quantity ?? ''} onChange={(e) => patch(item, { quantity: e.target.value })} /></label>
                  <label className="text-xs text-ink-700">Medida
                    <input className={inputCls + ' mt-1'} value={item.size ?? ''} placeholder="ej. 100 × 50 cm" onChange={(e) => patch(item, { size: e.target.value })} /></label>
                </div>
              ) : (
                <div className="text-xs text-ink-700 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="basis-full">
                    <span className="font-medium text-ink-800">Medidas{sizes.length > 1 ? ` (${sizes.length} — en la planilla sale un renglón por cada una)` : ''}:</span>{' '}
                    {sizes.length ? sizes.map((s, i) => `${quantities[i] ? quantities[i] + ' u. de ' : ''}${s || '—'}`).join(' · ') : '—'}
                  </span>
                  {material && <span><span className="font-medium text-ink-800">Material:</span> {material}</span>}
                  {notes && <span className="basis-full"><span className="font-medium text-ink-800">Notas:</span> {notes}</span>}
                </div>
              )}
              <div>
                <span className="block text-xs font-medium text-ink-700 mb-1.5">Procesos</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Procesos de ${label || item.label || 'componente'}`}>
                  {PRODUCTION_PROCESSES.map((p) => {
                    const on = item.processes.includes(p.id);
                    return (
                      <button type="button" key={p.id} onClick={() => toggleProcess(item, p.id)} aria-pressed={on}
                        className={`text-sm lg:text-xs px-3 py-2.5 lg:px-2.5 lg:py-1.5 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${on ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700 hover:border-ink-300'}`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block text-xs text-ink-700">Indicaciones para el taller <span className="text-ink-700/80">(opcional — ej. “montar sobre PVC 3 mm”)</span>
                <input className={inputCls + ' mt-1'} value={item.note} onChange={(e) => patch(item, { note: e.target.value })} />
              </label>
            </div>
          </div>
        );
      })}

      <button type="button" onClick={addExtra}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-3 py-2 hover:bg-brand-50">
        <Plus size={15} aria-hidden /> Agregar componente para producción
      </button>

      <AssemblySection job={job} pieces={pieces} assemblies={assemblies} onChange={(next) => { setAssemblies(next); setDirty(true); }} />
    </div>
  );
}
