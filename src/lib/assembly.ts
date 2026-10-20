import type { Assembly, ProductionConfig } from '../types';
import type { ProductionRow } from './production';

// Composición y armado (19/10, CLAUDE.md §75). Lógica pura: no guarda nada.
// Mismo criterio que una lista de materiales (BOM) de un ERP: "cantidad por
// unidad" × unidades = requerimiento total, y las unidades que se pueden armar
// son el mínimo, entre las piezas, de (piezas hechas ÷ cantidad por unidad).

/** Una pieza = un renglón de la planilla de producción (ítem + medida). */
export interface Piece {
  key: string;
  ref: string; // A, B, C… en el orden de la planilla — mismo código en pantalla y en papel
  label: string;
  size: string;
  loadedQty: string; // cantidad tal como está cargada en la OT (texto libre)
  material: string;
  notes: string;
  processes: string[];
  processedInOt: boolean; // tilde "procesado" del producto en la pestaña Detalle
  sizeIndex: number;
  sizeCount: number;
}

export const pieceKeyOf = (itemId: string, sizeIndex: number) => `${itemId}#${sizeIndex}`;

function refOf(i: number): string {
  // A..Z, después AA, AB… (una OT real no llega, pero no se rompe)
  return i < 26 ? String.fromCharCode(65 + i) : refOf(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

/** Mismo orden y mismos renglones que la planilla (un renglón por medida cargada). */
export function piecesFromRows(rows: ProductionRow[], checkedProducts: Set<string> = new Set()): Piece[] {
  const out: Piece[] = [];
  for (const row of rows) {
    const n = Math.max(1, row.sizes.length);
    for (let k = 0; k < n; k++) {
      out.push({
        key: pieceKeyOf(row.item.id, k), ref: refOf(out.length),
        label: row.label || (row.item.source === 'job' ? 'Producto sin nombre' : 'Componente sin nombre'),
        size: row.sizes[k] ?? '', loadedQty: row.quantities[k] ?? '',
        material: row.material, notes: row.notes, processes: row.item.processes,
        processedInOt: row.item.source === 'job' && !!row.item.productId && checkedProducts.has(row.item.productId),
        sizeIndex: k, sizeCount: n,
      });
    }
  }
  return out;
}

export interface ComponentStatus {
  pieceKey: string;
  piece: Piece | null; // null = la pieza ya no existe en la OT
  perUnit: number;
  total: number; // por unidad × unidades
  ready: number;
  missing: number; // lo que falta hacer para completar TODAS las unidades
  canBuild: number; // unidades que alcanzan con esta pieza
}

export interface AssemblyStatus {
  components: ComponentStatus[];
  /** La composición no permite controlar nada (sin piezas, piezas borradas o cantidad 0). */
  invalidReason: string | null;
  buildable: number; // unidades que se pueden completar con lo hecho (tope: unidades pedidas)
  assembled: number; // armadas, nunca más que buildable
  limitingRefs: string[]; // piezas que frenan la próxima unidad
  done: boolean;
}

export function assemblyStatus(a: Assembly, pieces: Piece[]): AssemblyStatus {
  const units = Math.max(0, Math.floor(a.units || 0));
  const components = a.components.map((c): ComponentStatus => {
    const piece = pieces.find((p) => p.key === c.pieceKey) ?? null;
    const perUnit = Math.max(0, Math.floor(c.perUnit || 0));
    const ready = Math.max(0, Math.floor(c.ready || 0));
    const total = perUnit * units;
    return { pieceKey: c.pieceKey, piece, perUnit, total, ready, missing: Math.max(0, total - ready), canBuild: perUnit > 0 ? Math.floor(ready / perUnit) : 0 };
  });
  let invalidReason: string | null = null;
  if (units === 0) invalidReason = 'Falta indicar cuántas unidades pide la OT.';
  else if (components.length === 0) invalidReason = 'Todavía no se cargaron las piezas de una unidad.';
  else if (components.some((c) => !c.piece)) invalidReason = 'Una pieza de la composición ya no está en la OT: revisá la composición.';
  else if (components.some((c) => c.perUnit === 0)) invalidReason = 'Hay una pieza con cantidad por unidad en 0.';
  const buildable = invalidReason ? 0 : Math.min(units, ...components.map((c) => c.canBuild));
  const assembled = Math.min(Math.max(0, Math.floor(a.assembled || 0)), buildable);
  const next = assembled + 1;
  const limitingRefs = invalidReason || assembled >= units ? [] : components.filter((c) => c.ready < c.perUnit * next).map((c) => c.piece?.ref ?? '?');
  return { components, invalidReason, buildable, assembled, limitingRefs, done: !invalidReason && assembled >= units && units > 0 };
}

/**
 * Compara lo que piden las composiciones con la cantidad cargada en la OT para
 * cada pieza. Solo avisa (nunca corrige): si la OT dice "3" y la composición
 * necesita 6, alguno de los dos está mal y lo tiene que decidir una persona.
 * Solo compara cuando lo cargado es un número entero; "a medida" no se compara.
 */
export function quantityMismatches(assemblies: Assembly[], pieces: Piece[]): { piece: Piece; loaded: number; required: number }[] {
  const req = new Map<string, number>();
  for (const a of assemblies) {
    const units = Math.max(0, Math.floor(a.units || 0));
    for (const c of a.components) req.set(c.pieceKey, (req.get(c.pieceKey) ?? 0) + Math.max(0, Math.floor(c.perUnit || 0)) * units);
  }
  const out: { piece: Piece; loaded: number; required: number }[] = [];
  for (const [key, required] of req) {
    const piece = pieces.find((p) => p.key === key);
    if (!piece || !/^\d+$/.test(piece.loadedQty.trim())) continue;
    const loaded = Number(piece.loadedQty.trim());
    if (loaded !== required) out.push({ piece, loaded, required });
  }
  return out;
}

export const assembliesOf = (config: ProductionConfig): Assembly[] => config.assemblies ?? [];
