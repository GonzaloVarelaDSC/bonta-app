import type { JobType, Material, Product } from '../types';

/**
 * Importar los ítems de una OT de Copérnico a Carga rápida.
 *
 * Copérnico no tiene API: lo único que sale es el botón "Exportar" de la grilla
 * de ítems de la orden ("Items Orden Grafica"). Trae SOLO los ítems — cliente,
 * trabajo y fecha de entrega no vienen y se siguen cargando a mano.
 *
 * Se aceptan los dos formatos que exporta:
 * - Excel (ícono de la X verde). Aunque Copérnico lo guarda como .xls, por
 *   dentro es un .xlsx normal (zip). Se lee sin librerías: zip + XML.
 * - XML (último ícono). Viene "roto" (las columnas sin título salen como
 *   etiquetas vacías `<>Epson V7000</>`), así que no se puede leer como XML de
 *   verdad: se lee cada <Row> por posición.
 *
 * En los dos, 4 columnas no tienen título (código y nombre de máquina, código y
 * nombre de material). Por eso la máquina se toma como el último texto antes de
 * "Cantidad" y el material como el texto entre "Cantidad" y "Ancho".
 */

// ---------- Equivalencias (editar acá si cambian máquinas o materiales) ----------

// Palabra en la máquina de Copérnico → palabra que tiene que aparecer en el
// nombre del "Tipo de trabajo" de la app (Configuración). Se prueba en orden.
const MACHINE_TO_JOB_TYPE: { machine: RegExp; jobType: string[] }[] = [
  { machine: /v\s*7000/, jobType: ['v7000'] },
  { machine: /s\s*40/, jobType: ['s40'] },
  { machine: /p\s*9000/, jobType: ['p9000'] },
  { machine: /plotter|roland|vinilo de corte/, jobType: ['vinilo de corte', 'plotter', 'vinilo'] },
  { machine: /laser/, jobType: ['laser'] },
  { machine: /cnc|router|aoke/, jobType: ['cnc'] },
  { machine: /3d|impresora 3d|kobra|bambu|maigao/, jobType: ['corporeo', '3d'] },
];

// Palabra en el material de Copérnico → palabra del material de la app.
// Si el material existe con el mismo nombre en Configuración, se usa ese directo.
const MATERIAL_KEYWORDS: { copernico: RegExp; material: string[] }[] = [
  { copernico: /vinilo/, material: ['vinilo'] },
  { copernico: /canvas|lona|tela|banner|backlight/, material: ['tela', 'lona'] },
  { copernico: /acril/, material: ['acrilico'] },
  { copernico: /pvc|polyfan|foam/, material: ['pvc'] },
  { copernico: /mdf|fibrofacil/, material: ['mdf'] },
  { copernico: /madera|terciado|fenolico/, material: ['madera'] },
  { copernico: /metal|chapa|alumin|metalex|dibond/, material: ['metal'] },
  { copernico: /papel|ilustracion|obra|opalina|autoadhesivo/, material: ['papel'] },
  { copernico: /vidrio|espejo/, material: ['vidrio'] },
];

// ---------- Tipos ----------

export interface CopernicoItem {
  machine: string;
  material: string;
  quantity: number | null;
  widthM: number | null;
  heightM: number | null;
  notes: string;
  printRef: string;
}

export interface CopernicoImport {
  items: CopernicoItem[];
  products: Product[];
  jobTypeId: string | null;
  jobTypeLabel: string | null;
  machines: string[];
  otCode: string | null;
  warnings: string[];
}

export class CopernicoImportError extends Error {}

// ---------- Lectura del archivo ----------

export async function readCopernicoFile(file: File | ArrayBuffer, fileName = ''): Promise<CopernicoItem[]> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const name = file instanceof ArrayBuffer ? fileName : file.name;
  const bytes = new Uint8Array(buf);
  let rows: string[][];
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    rows = await readXlsxRows(bytes);
  } else {
    const text = new TextDecoder('utf-8').decode(bytes);
    if (/<dataroot|<Row>/i.test(text)) rows = readCopernicoXmlRows(text);
    else if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
      throw new CopernicoImportError('Ese Excel es del formato viejo (.xls 97-2003). Exportalo de nuevo desde Copérnico con el ícono de Excel, o usá el de XML.');
    } else {
      throw new CopernicoImportError(`No reconozco el archivo${name ? ` "${name}"` : ''}. Tiene que ser el Excel o el XML que exporta Copérnico desde los ítems de la orden.`);
    }
  }
  return rowsToItems(rows);
}

function rowsToItems(rows: string[][]): CopernicoItem[] {
  const norm = (s: string) => normalize(s);
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === 'cantidad') && r.some((c) => norm(c) === 'ancho'));
  if (headerIdx < 0) throw new CopernicoImportError('El archivo no tiene las columnas Cantidad / Ancho / Alto. ¿Es la exportación de los ítems de una orden de Copérnico?');
  const header = rows[headerIdx].map(norm);
  const col = (name: string) => header.indexOf(name);
  const cQty = col('cantidad'), cW = col('ancho'), cH = col('alto');
  const cNotes = col('notas impresion'), cRef = col('print referencia');

  const items: CopernicoItem[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (!r.some((c) => c.trim())) continue;
    const textIn = (from: number, to: number) => {
      for (let i = to - 1; i >= from; i--) {
        const v = (r[i] ?? '').trim();
        if (v && !isNumeric(v)) return v;
      }
      return '';
    };
    const item: CopernicoItem = {
      machine: textIn(0, cQty),
      material: textIn(cQty + 1, cW),
      quantity: toNumber(r[cQty]),
      widthM: toNumber(r[cW]),
      heightM: toNumber(r[cH]),
      notes: cNotes >= 0 ? cleanNotes(r[cNotes] ?? '') : '',
      printRef: cRef >= 0 ? (r[cRef] ?? '').trim() : '',
    };
    if (!item.machine && !item.material && item.widthM == null && item.heightM == null) continue;
    items.push(item);
  }
  if (!items.length) throw new CopernicoImportError('El archivo no tiene ítems cargados.');
  return items;
}

// XML de Copérnico: <Row> con hijos en orden, algunos con etiqueta vacía `<>`.
function readCopernicoXmlRows(text: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<Row>([\s\S]*?)<\/Row>/gi;
  let header: string[] | null = null;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text))) {
    const cells: { tag: string; value: string }[] = [];
    const cellRe = /<([^<>/]*)>([^<]*)<\/[^<>]*>/g;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(m[1]))) cells.push({ tag: c[1], value: decodeXml(c[2]) });
    if (!header) {
      header = cells.map((x) => x.tag.replace(/_/g, ' '));
      rows.push(header);
    }
    rows.push(cells.map((x) => x.value.trim()));
  }
  return rows;
}

// ---------- xlsx mínimo (zip + XML), sin dependencias ----------

async function readXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheetName = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
  if (!sheetName) throw new CopernicoImportError('El Excel no tiene hojas.');
  const shared: string[] = [];
  const sst = files['xl/sharedStrings.xml'];
  if (sst) {
    for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      shared.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => decodeXml(t.replace(/<[^>]+>/g, ''))).join(''));
    }
  }
  const rows: string[][] = [];
  for (const row of files[sheetName].match(/<row[\s\S]*?<\/row>|<row[^>]*\/>/g) ?? []) {
    const cells: string[] = [];
    for (const c of row.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c)?.[1];
      const type = /\bt="([^"]+)"/.exec(c)?.[1];
      const idx = ref ? colIndex(ref) : cells.length;
      let value = '';
      if (type === 's') value = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(c)?.[1])] ?? '';
      else if (type === 'inlineStr') value = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => decodeXml(t.replace(/<[^>]+>/g, ''))).join('');
      else value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(c)?.[1] ?? '');
      while (cells.length < idx) cells.push('');
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function unzip(bytes: Uint8Array, want: (name: string) => boolean): Promise<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new CopernicoImportError('El Excel está dañado (no se puede abrir).');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder('utf-8');
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(start, start + compSize);
    if (method === 0) out[name] = dec.decode(data);
    else if (method === 8) out[name] = dec.decode(await inflateRaw(data));
    else throw new CopernicoImportError('El Excel usa una compresión que no puedo leer.');
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------- Armado de productos ----------

export function buildCopernicoImport(items: CopernicoItem[], jobTypes: JobType[], materials: Material[]): CopernicoImport {
  const warnings: string[] = [];

  // Un producto por cada combinación máquina + material + notas: así la OT de
  // 8 ítems de una vidriera queda en 2 productos (uno por sucursal) con sus
  // medidas adentro, en vez de 8 tarjetas sueltas.
  const groups = new Map<string, CopernicoItem[]>();
  for (const it of items) {
    const key = [normalize(it.machine), normalize(it.material), normalize(it.notes)].join('|');
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  const products: Product[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const materialId = matchMaterial(first.material, materials);
    if (first.material && !materialId) warnings.push(`El material "${first.material}" no tiene equivalente en la app: quedó escrito en las notas.`);
    const header = [first.machine && `Máquina: ${first.machine}`, first.material && `Material: ${first.material}`].filter(Boolean).join(' · ');
    products.push({
      id: crypto.randomUUID(),
      label: first.material || first.machine || 'Ítem de Copérnico',
      materialIds: materialId ? [materialId] : [],
      sizeItems: group.map((it) => ({
        quantity: fmtNumber(it.quantity),
        width: it.widthM != null ? fmtNumber(it.widthM * 100) : '',
        height: it.heightM != null ? fmtNumber(it.heightM * 100) : '',
      })),
      notes: [header, first.notes].filter(Boolean).join('\n'),
      checked: false,
    });
  }

  // Tipo de trabajo: el de la máquina que más se usa en la orden.
  const byMachine = new Map<string, number>();
  for (const it of items) if (it.machine) byMachine.set(it.machine, (byMachine.get(it.machine) ?? 0) + 1);
  const machines = [...byMachine.keys()];
  const main = [...byMachine.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const jobType = main ? matchJobType(main, jobTypes) : null;
  if (main && !jobType) warnings.push(`La máquina "${main}" no tiene un tipo de trabajo equivalente: elegilo a mano.`);
  if (machines.length > 1) warnings.push(`La orden usa varias máquinas (${machines.join(', ')}): el tipo de trabajo quedó por la que más se repite.`);

  // N° de OT: Copérnico nombra la imagen de vista previa con el número de orden
  // (\\servercop\imagenes\20408.jpg).
  const codes = [...new Set(items.map((it) => /(\d{3,})\.[a-z]{3,4}\s*$/i.exec(it.printRef)?.[1]).filter(Boolean) as string[])];
  const otCode = codes.length === 1 ? codes[0] : null;
  if (codes.length > 1) warnings.push(`Los ítems apuntan a órdenes distintas (${codes.join(', ')}): el N° de OT no se cargó.`);

  const missingSize = items.filter((it) => !it.widthM || !it.heightM).length;
  if (missingSize) warnings.push(`${missingSize} ítem${missingSize > 1 ? 's' : ''} sin ancho o alto en Copérnico.`);

  return { items, products, jobTypeId: jobType?.id ?? null, jobTypeLabel: jobType?.label ?? null, machines, otCode, warnings };
}

function matchJobType(machine: string, jobTypes: JobType[]): JobType | null {
  const m = normalize(machine);
  const exact = jobTypes.find((t) => normalize(t.label) === m);
  if (exact) return exact;
  for (const rule of MACHINE_TO_JOB_TYPE) {
    if (!rule.machine.test(m)) continue;
    for (const word of rule.jobType) {
      const t = jobTypes.find((jt) => normalize(jt.label).includes(word));
      if (t) return t;
    }
  }
  return null;
}

function matchMaterial(material: string, materials: Material[]): string | null {
  const m = normalize(material);
  if (!m) return null;
  const exact = materials.find((x) => normalize(x.label) === m);
  if (exact) return exact.id;
  for (const rule of MATERIAL_KEYWORDS) {
    if (!rule.copernico.test(m)) continue;
    for (const word of rule.material) {
      const found = materials.find((x) => normalize(x.label).includes(word) || x.id === word);
      if (found) return found.id;
    }
  }
  return null;
}

// ---------- Utilidades ----------

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function isNumeric(s: string): boolean {
  return /^-?[\d.,\s]+$/.test(s.trim());
}

// Copérnico usa punto decimal ("1.600") y, en el XML, coma de miles ("58,374").
function toNumber(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// 160 → "160", 77.5 → "77,5" (coma, como se escribe acá).
function fmtNumber(n: number | null): string {
  if (n == null) return '';
  const r = Math.round(n * 10) / 10;
  return String(r).replace('.', ',');
}

// "- IMPRESION Y CORTE ROLAND - PARA SAN MIGUEL -" → "IMPRESION Y CORTE ROLAND - PARA SAN MIGUEL"
function cleanNotes(s: string): string {
  return s.replace(/^[\s-]+|[\s-]+$/g, '').replace(/\s+/g, ' ');
}

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
