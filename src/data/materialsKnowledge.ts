// Base de conocimiento de materiales, máquinas y reglas de producción.
// Fuente original (18/10): el documento "Estudio Bonta — Materiales, formatos y
// especificaciones de producción" de Gonzalo. Regla del documento: NO completar
// medidas por suposición — cada dato lleva su estado (confirmado / aproximado /
// a confirmar).
//
// Desde el 06/11 se edita desde la pantalla "Materiales y máquinas" y se guarda en
// la base (tabla app_settings, clave 'materials_knowledge', migración 031). Lo de
// este archivo es solo el valor inicial, hasta que alguien guarde la primera vez.

export type DataStatus = 'confirmado' | 'aproximado' | 'pendiente';

export interface KnowledgeMaterial {
  id: string;
  material: string;
  thickness: string;
  /** Largo de placa en cm. Vacío o sin número = rollo / no aplica. */
  length: string;
  /** Ancho en cm. En rollos puede llevar varios anchos ("60, 100, 120, 150"). */
  width: string;
  status: DataStatus;
  note?: string;
  /** Texto que aparece al cargar un producto con este material. */
  hint?: string;
}

export interface KnowledgeMachine {
  id: string;
  name: string;
  /** Largo máximo en cm. Vacío = sin límite (rollo). */
  maxLength: string;
  /** Ancho máximo en cm. */
  maxWidth: string;
  status: DataStatus;
  note?: string;
  /** Avisa si el trabajo es de alguno de estos tipos... */
  jobTypeIds: string[];
  /** ...o si el producto lleva un material que contenga esta palabra... */
  materialWord?: string;
  /** ...y (opcional) su nombre contiene esta palabra. */
  productWord?: string;
}

export interface KnowledgeRule {
  id: string;
  title: string;
  points: string[];
  status: DataStatus;
}

export interface MaterialsKnowledge {
  materials: KnowledgeMaterial[];
  machines: KnowledgeMachine[];
  rules: KnowledgeRule[];
  pending: string[];
}

export const DEFAULT_KNOWLEDGE: MaterialsKnowledge = {
  materials: [
    { id: 'vinilo', material: 'Vinilo', thickness: '', length: '', width: '60, 100, 120, 150', status: 'aproximado', note: 'Rollo. Anchos recordados; puede haber otros.', hint: 'Vinilo: rollos de 60, 100, 120 y 150 cm (a confirmar). El plotter Roland corta hasta 119 cm de ancho (a confirmar).' },
    { id: 'mdf-3', material: 'MDF', thickness: '3 mm', length: '', width: '', status: 'pendiente', hint: 'Si la impresión va montada en MDF: demasía de 5 a 8 mm por lado, según el tamaño de la visual.' },
    { id: 'mdf-5', material: 'MDF', thickness: '5 mm', length: '', width: '', status: 'pendiente' },
    { id: 'mdf-9', material: 'MDF', thickness: '9 mm', length: '', width: '', status: 'pendiente' },
    { id: 'mdf-15', material: 'MDF', thickness: '15 mm', length: '', width: '', status: 'pendiente' },
    { id: 'pvc-3', material: 'PVC', thickness: '3 mm', length: '', width: '', status: 'pendiente', hint: 'Si la impresión va montada en PVC: sin demasía, se refila directo.' },
    { id: 'polyfan-20', material: 'Polyfan', thickness: '20 mm', length: '', width: '', status: 'pendiente' },
    { id: 'metalex', material: 'Metalex', thickness: '', length: '120', width: '60', status: 'aproximado', note: 'Formato aproximado; confirmar con una placa o el proveedor.', hint: 'Metalex: la veta va paralela al lado largo de la placa, no es aleatoria — ubicá las piezas respetando ese sentido.' },
    { id: 'pai-1', material: 'PAI', thickness: '1 mm', length: '', width: '', status: 'pendiente' },
  ],
  machines: [
    { id: 'roland', name: 'Plotter de corte Roland', maxLength: '', maxWidth: '119', status: 'pendiente', note: 'Valor recordado, falta verificación técnica.', jobTypeIds: [], materialWord: 'vinilo', productWord: 'corte' },
    { id: 'v7000', name: 'Epson SureColor V7000 (cama plana UV)', maxLength: '250', maxWidth: '125', status: 'confirmado', jobTypeIds: ['impresion_v7000'] },
    { id: 's40', name: 'Epson SureColor S40 (rollo)', maxLength: '', maxWidth: '161,6', status: 'confirmado', note: 'Ancho máximo de material: 162,6 cm.', jobTypeIds: ['impresion_s40'] },
    { id: 'laser', name: 'Láser', maxLength: '', maxWidth: '', status: 'pendiente', note: 'Área máxima de corte: sin dato.', jobTypeIds: [] },
  ],
  rules: [
    { id: 'mdf', title: 'Impresión montada sobre MDF', status: 'aproximado', points: ['Agregar entre 5 y 8 mm de demasía por cada lado.', 'La demasía depende del tamaño total de la visual (el criterio exacto entre 5 y 8 mm está por definir).'] },
    { id: 'pvc', title: 'Impresión montada sobre PVC', status: 'confirmado', points: ['No agregar demasía.', 'El PVC se refila directamente.'] },
    { id: 'metalex', title: 'Metalex', status: 'confirmado', points: ['La placa tiene veta: la orientación no es aleatoria.', 'La veta va siempre paralela al lado más largo de la placa.', 'Al ubicar las piezas, respetar ese sentido.'] },
  ],
  pending: [
    'Formatos comerciales (largo y ancho) de MDF de 3, 5, 9 y 15 mm.',
    'Formato comercial de PVC de 3 mm.',
    'Formato comercial de Polyfan de 20 mm.',
    'Formato comercial de PAI de 1 mm.',
    'Confirmar los anchos de vinilo (60, 100, 120 y 150 cm).',
    'Confirmar el límite de 119 cm del plotter Roland.',
    'Confirmar el formato de Metalex (120 × 60 cm).',
    'Área útil máxima de corte del láser.',
    'Criterio exacto de demasía en MDF (5 u 8 mm según el tamaño).',
  ],
};

/** Completa lo que falte de un valor guardado (versiones viejas, campos nuevos). */
export function normalizeKnowledge(raw: unknown): MaterialsKnowledge {
  const k = (raw ?? {}) as Partial<MaterialsKnowledge>;
  return {
    materials: Array.isArray(k.materials) ? k.materials.map((m) => ({ ...m, id: m.id || newId() })) : DEFAULT_KNOWLEDGE.materials,
    machines: Array.isArray(k.machines) ? k.machines.map((m) => ({ ...m, id: m.id || newId(), jobTypeIds: Array.isArray(m.jobTypeIds) ? m.jobTypeIds : [] })) : DEFAULT_KNOWLEDGE.machines,
    rules: Array.isArray(k.rules) ? k.rules.map((r) => ({ ...r, id: r.id || newId(), points: Array.isArray(r.points) ? r.points : [] })) : DEFAULT_KNOWLEDGE.rules,
    pending: Array.isArray(k.pending) ? k.pending : DEFAULT_KNOWLEDGE.pending,
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Números a partir del texto libre ---------------------------------------

/** Todos los números de un texto, en cm ("1200 mm" → 120). */
export function numbersIn(raw: string | undefined): number[] {
  if (!raw) return [];
  const mm = /mm/i.test(raw) && !/cm/i.test(raw);
  return (raw.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(',', '.')) / (mm ? 10 : 1)).filter((n) => n > 0);
}

/** Para mostrar: "120" → "120 cm"; texto con letras se deja como está. */
export function withCm(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return /^[\d.,\s]+$/.test(t) ? `${t} cm` : t;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function machineSpec(m: KnowledgeMachine): string {
  const L = numbersIn(m.maxLength)[0];
  const W = numbersIn(m.maxWidth)[0];
  if (L && W) return `Formato máximo: ${fmt(L)} × ${fmt(W)} cm`;
  if (W) return `Ancho máximo: ${fmt(W)} cm`;
  if (L) return `Largo máximo: ${fmt(L)} cm`;
  return 'Sin dato de medida máxima';
}

// ---- Ayudas al cargar un producto -------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const sameMaterial = (knowledgeName: string, labels: string[]) => {
  const k = norm(knowledgeName);
  return !!k && labels.some((l) => { const n = norm(l); return !!n && (n.includes(k) || k.includes(n)); });
};

/** Datos útiles según los materiales elegidos (se buscan por nombre, así sirve
 *  también para materiales agregados después desde Configuración). */
export function materialHints(k: MaterialsKnowledge, materialLabels: string[]): string[] {
  const out = k.materials.filter((m) => m.hint?.trim() && sameMaterial(m.material, materialLabels)).map((m) => m.hint!.trim());
  return [...new Set(out)];
}

/** Medida en cm a partir del texto libre del casillero ("120", "1200 mm",
 *  "a medida" → null). Sin unidad se toma como cm, igual que el placeholder. */
function toCm(raw: string): number | null {
  const m = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(mm|cm)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2]?.toLowerCase() === 'mm' ? n / 10 : n;
}

/** ¿Entra una pieza de big × small en un formato L × W (L vacío = rollo)? */
function fits(big: number, small: number, L: number | undefined, W: number): boolean {
  if (L === undefined) return small <= W;
  const lo = Math.min(L, W), hi = Math.max(L, W);
  return big <= hi && small <= lo;
}

/** Avisos cuando una medida no entra en una máquina o en la placa/rollo del
 *  material. Si el dato no está confirmado, el aviso lo dice. */
export function sizeWarnings(k: MaterialsKnowledge, jobTypeId: string | undefined, materialLabels: string[], label: string, sizes: { width: string; height: string }[]): string[] {
  const out: string[] = [];
  const tbc = (s: DataStatus) => (s === 'confirmado' ? '' : ' — dato a confirmar');
  const machines = k.machines.filter((m) => {
    if (!numbersIn(m.maxWidth).length && !numbersIn(m.maxLength).length) return false;
    if (jobTypeId && m.jobTypeIds.includes(jobTypeId)) return true;
    if (m.materialWord?.trim() && materialLabels.some((l) => norm(l).includes(norm(m.materialWord!)))) {
      return !m.productWord?.trim() || norm(label).includes(norm(m.productWord));
    }
    return false;
  });
  const plates = new Map<string, KnowledgeMaterial[]>();
  for (const m of k.materials) {
    if (!numbersIn(m.width).length || !sameMaterial(m.material, materialLabels)) continue;
    plates.set(norm(m.material), [...(plates.get(norm(m.material)) ?? []), m]);
  }

  for (const s of sizes) {
    const w = toCm(s.width); const h = toCm(s.height);
    if (w === null || h === null) continue;
    const big = Math.max(w, h); const small = Math.min(w, h);
    const tag = `${s.width} × ${s.height}`;
    for (const m of machines) {
      const L = numbersIn(m.maxLength)[0];
      const W = numbersIn(m.maxWidth)[0];
      const ok = W !== undefined ? fits(big, small, L, W) : big <= (L ?? Infinity);
      if (!ok) out.push(`${tag} no entra en ${m.name} (${machineSpec(m).replace(/^[^:]+: /, 'máx. ')}${tbc(m.status)}): habría que dividirlo en partes.`);
    }
    for (const rows of plates.values()) {
      const formats = rows.map((r) => ({ r, L: numbersIn(r.length)[0], W: Math.max(...numbersIn(r.width)) }));
      if (formats.some((f) => fits(big, small, f.L, f.W))) continue;
      const best = formats.reduce((a, b) => (b.W * (b.L ?? 1e6) > a.W * (a.L ?? 1e6) ? b : a));
      const what = best.L === undefined ? `el rollo más ancho de ${best.r.material} (${fmt(best.W)} cm)` : `una placa de ${best.r.material}${best.r.thickness ? ` ${best.r.thickness}` : ''} (${fmt(best.L)} × ${fmt(best.W)} cm)`;
      out.push(`${tag} es más grande que ${what}${tbc(best.r.status)}: va en más de una pieza.`);
    }
  }
  return [...new Set(out)];
}
