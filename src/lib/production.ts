import type { Job, Material, ProductionConfig, ProductionItem } from '../types';
import { PRODUCTION_PROCESSES } from '../data/catalog';

// Una fila de la planilla de producción, ya resuelta: los componentes de la OT
// leen nombre/medidas/material EN VIVO de `job.products` (así una nueva
// exportación siempre refleja la OT actual), y de la configuración de
// producción solo toman lo propio (procesos + indicación). Los agregados para
// producción traen todo desde la configuración.
export interface ProductionRow {
  item: ProductionItem;
  label: string;
  quantities: string[]; // una línea por medida cargada
  sizes: string[];
  material: string;
  notes: string; // notas del producto en la OT (solo lectura acá)
}

function materialLabels(ids: string[], materials: Material[]): string {
  return ids.map((id) => materials.find((m) => m.id === id)?.label).filter(Boolean).join(', ');
}

function sizeText(width: string, height: string): string {
  const w = width.trim(); const h = height.trim();
  return w && h ? `${w} × ${h}` : w || h;
}

/**
 * Une los productos actuales de la OT con la configuración guardada. Nunca
 * duplica: cada producto de la OT aparece una sola vez, con su configuración
 * si ya la tenía o vacía si es nuevo. La configuración de un producto que ya no
 * existe en la OT se descarta (no hay nada que mostrar de él).
 */
export function productionRows(job: Job, config: ProductionConfig, materials: Material[]): ProductionRow[] {
  const fromJob = job.products.map((p): ProductionRow => {
    const item = config.items.find((i) => i.source === 'job' && i.productId === p.id)
      ?? { id: `job-${p.id}`, source: 'job', productId: p.id, processes: [], note: '' };
    const sizes = p.sizeItems.filter((s) => s.quantity.trim() || s.width.trim() || s.height.trim());
    return {
      item, label: p.label,
      quantities: sizes.map((s) => s.quantity.trim()),
      sizes: sizes.map((s) => sizeText(s.width, s.height)),
      material: materialLabels(p.materialIds, materials),
      notes: p.notes,
    };
  });
  const extras = config.items.filter((i) => i.source === 'extra').map((item): ProductionRow => ({
    item, label: item.label ?? '',
    quantities: item.quantity?.trim() ? [item.quantity.trim()] : [],
    sizes: item.size?.trim() ? [item.size.trim()] : [],
    material: '', notes: '',
  }));
  return [...fromJob, ...extras];
}

/** Lo que se guarda: solo los ítems con algo propio de producción (más los agregados). */
export function configFromRows(rows: ProductionRow[]): ProductionConfig {
  return {
    items: rows
      .map((r) => r.item)
      .filter((i) => i.source === 'extra' || i.processes.length > 0 || i.note.trim()),
  };
}

/** Procesos usados por al menos un componente, en el orden del catálogo (= columnas del PDF). */
export function usedProcesses(rows: ProductionRow[]) {
  return PRODUCTION_PROCESSES.filter((p) => rows.some((r) => r.item.processes.includes(p.id)));
}
