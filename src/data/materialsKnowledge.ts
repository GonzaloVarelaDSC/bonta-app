// Base de conocimiento de materiales, máquinas y reglas de producción (18/10).
// Fuente: el documento "Estudio Bonta — Materiales, formatos y especificaciones de
// producción" que arma Gonzalo. Regla del documento: NO completar medidas por
// suposición — cada dato lleva su estado (confirmado / aproximado / a confirmar)
// y lo que falta queda como "a confirmar". Para corregir o sumar datos se edita
// este archivo (se ve en la página "Materiales y máquinas" y en las ayudas que
// aparecen al cargar productos).

export type DataStatus = 'confirmado' | 'aproximado' | 'pendiente';

export interface MaterialFormat {
  material: string;
  thickness: string;   // 'No aplica' cuando corresponde
  length: string;      // largo de placa
  width: string;       // ancho de placa / de rollo
  status: DataStatus;
  note?: string;
}

export const MATERIAL_FORMATS: MaterialFormat[] = [
  { material: 'Vinilo', thickness: 'No aplica', length: 'No aplica', width: '60, 100, 120 y 150 cm', status: 'aproximado', note: 'Anchos de rollo recordados; puede haber otros.' },
  { material: 'MDF', thickness: '3 mm', length: '', width: '', status: 'pendiente' },
  { material: 'MDF', thickness: '5 mm', length: '', width: '', status: 'pendiente' },
  { material: 'MDF', thickness: '9 mm', length: '', width: '', status: 'pendiente' },
  { material: 'MDF', thickness: '15 mm', length: '', width: '', status: 'pendiente' },
  { material: 'PVC', thickness: '3 mm', length: '', width: '', status: 'pendiente' },
  { material: 'Polyfan', thickness: '20 mm', length: '', width: '', status: 'pendiente' },
  { material: 'Metalex', thickness: '', length: '120 cm', width: '60 cm', status: 'aproximado', note: 'Formato aproximado; confirmar con una placa o el proveedor.' },
  { material: 'PAI', thickness: '1 mm', length: '', width: '', status: 'pendiente' },
];

export interface Machine {
  name: string;
  spec: string;
  status: DataStatus;
  note?: string;
}

export const MACHINES: Machine[] = [
  { name: 'Plotter de corte Roland', spec: 'Ancho máximo de corte: 119 cm', status: 'pendiente', note: 'Valor recordado, falta verificación técnica.' },
  { name: 'Epson SureColor V7000 (cama plana UV)', spec: 'Formato máximo: 250 × 125 cm', status: 'confirmado' },
  { name: 'Epson SureColor S40 (rollo)', spec: 'Ancho máximo de material: 162,6 cm · ancho de impresión: 161,6 cm (aprox.)', status: 'confirmado' },
  { name: 'Láser', spec: 'Área máxima de corte: sin dato', status: 'pendiente' },
];

export interface ProductionRule {
  title: string;
  points: string[];
  status: DataStatus;
}

export const PRODUCTION_RULES: ProductionRule[] = [
  {
    title: 'Impresión montada sobre MDF', status: 'aproximado',
    points: ['Agregar entre 5 y 8 mm de demasía por cada lado.', 'La demasía depende del tamaño total de la visual (el criterio exacto entre 5 y 8 mm está por definir).'],
  },
  {
    title: 'Impresión montada sobre PVC', status: 'confirmado',
    points: ['No agregar demasía.', 'El PVC se refila directamente.'],
  },
  {
    title: 'Metalex', status: 'aproximado',
    points: ['La placa tiene veta: respetar su orientación.', 'La veta es paralela al borde más largo.', 'Formato aproximado 120 × 60 cm (a confirmar).'],
  },
];

export const PENDING_DATA: string[] = [
  'Formatos comerciales (largo y ancho) de MDF de 3, 5, 9 y 15 mm.',
  'Formato comercial de PVC de 3 mm.',
  'Formato comercial de Polyfan de 20 mm.',
  'Formato comercial de PAI de 1 mm.',
  'Confirmar los anchos de vinilo (60, 100, 120 y 150 cm).',
  'Confirmar el límite de 119 cm del plotter Roland.',
  'Confirmar el formato de Metalex y la orientación de la veta.',
  'Área útil máxima de corte del láser.',
  'Criterio exacto de demasía en MDF (5 u 8 mm según el tamaño).',
];

// ---- Ayudas al cargar un producto -------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Datos útiles según los materiales elegidos (se buscan por nombre, así sirve
 *  también para materiales agregados después desde Configuración). */
export function materialHints(materialLabels: string[]): string[] {
  const has = (word: string) => materialLabels.some((l) => norm(l).includes(word));
  const hints: string[] = [];
  if (has('mdf')) hints.push('Si la impresión va montada en MDF: demasía de 5 a 8 mm por lado, según el tamaño de la visual.');
  if (has('pvc')) hints.push('Si la impresión va montada en PVC: sin demasía, se refila directo.');
  if (has('metalex')) hints.push('Metalex: respetá la veta, que va paralela al borde más largo (placa aprox. 120 × 60 cm, a confirmar).');
  if (has('vinilo')) hints.push('Vinilo: rollos de 60, 100, 120 y 150 cm (a confirmar). El plotter Roland corta hasta 119 cm de ancho (a confirmar).');
  return hints;
}

/** Medida en cm a partir del texto libre del casillero ("120", "1200 mm",
 *  "a medida" → null). Sin unidad se toma como cm, igual que el placeholder. */
function toCm(raw: string): number | null {
  const m = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(mm|cm)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2]?.toLowerCase() === 'mm' ? n / 10 : n;
}

/** Avisos cuando una medida no entra en la máquina del tipo de trabajo (solo
 *  con datos confirmados) o en el ancho de corte del Roland para vinilo. */
export function sizeWarnings(jobTypeId: string | undefined, materialLabels: string[], label: string, sizes: { width: string; height: string }[]): string[] {
  const out: string[] = [];
  const vinylCut = materialLabels.some((l) => norm(l).includes('vinilo')) && norm(label).includes('corte');
  for (const s of sizes) {
    const w = toCm(s.width); const h = toCm(s.height);
    if (w === null || h === null) continue;
    const big = Math.max(w, h); const small = Math.min(w, h);
    const tag = `${s.width} × ${s.height}`;
    if (jobTypeId === 'impresion_v7000' && (big > 250 || small > 125)) out.push(`${tag} no entra en la V7000 (máximo 250 × 125 cm): habría que dividirlo en partes.`);
    if (jobTypeId === 'impresion_s40' && small > 161.6) out.push(`${tag} supera el ancho de impresión de la S40 (161,6 cm): habría que dividirlo en paños.`);
    if (vinylCut && small > 119) out.push(`${tag} supera el ancho de corte del plotter Roland (119 cm, a confirmar).`);
  }
  return [...new Set(out)];
}
