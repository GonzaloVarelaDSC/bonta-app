// Graba el recorrido de la app con datos ficticios.
//   node record.mjs check   -> recorre rápido y saca capturas en ./shots (para revisar)
//   node record.mjs video   -> graba frames con CDP screencast en ./frames y arma demo.mp4
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROJECT = 'C:/Users/gonza/OneDrive/Escritorio/bonta-app';
const require = createRequire(PROJECT + '/package.json');
const { chromium } = require('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const FFMPEG = path.join(HERE, '../tools/node_modules/ffmpeg-static/ffmpeg.exe');
const MODE = process.argv[2] ?? 'check';
const VIDEO = MODE === 'video';
const BASE = 'http://localhost:5173';
const W = 1600, H = 767, DPR = 1.2; // app 1920x920 + franja de subtítulos de 160px = 1080

const speed = VIDEO ? 1 : 0.15;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * speed));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('dialog', (d) => d.dismiss());
// Nada sale hacia Supabase: toda request a la base responde vacío.
await context.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

// ---------- helpers ----------
let mx = W / 2, my = H / 2;
async function moveTo(x, y, ms = 650) {
  const steps = Math.max(8, Math.round((ms * speed) / 16));
  const sx = mx, sy = my;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    if (VIDEO) await new Promise((r) => setTimeout(r, 16));
  }
  mx = x; my = y;
}
async function center(loc) {
  await loc.scrollIntoViewIfNeeded();
  let b = await loc.boundingBox();
  for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 50)); const n = await loc.boundingBox(); if (n && b && n.x === b.x && n.y === b.y) break; b = n; }
  if (!b) throw new Error('sin bbox');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
async function hover(loc, ms) { const c = await center(loc); await moveTo(c.x, c.y, ms); return c; }
async function click(loc, { pauseAfter = 500 } = {}) {
  await hover(loc); await wait(180);
  await page.mouse.down(); await wait(70); await page.mouse.up();
  await wait(pauseAfter);
}
async function type(loc, text, { delay = 55 } = {}) {
  await click(loc, { pauseAfter: 200 });
  await page.keyboard.type(text, { delay: delay * speed });
  await wait(300);
}
async function select(loc, value) { await click(loc, { pauseAfter: 250 }); await loc.selectOption(value); await wait(600); }
const caps = [];
let openCap = null;
const nowS = () => Date.now() / 1000;
async function cap(k, t, d) { if (openCap) openCap.end = nowS(); openCap = { k, t, d, start: nowS() }; caps.push(openCap); }
async function hideCap() { if (openCap) { openCap.end = nowS(); openCap = null; } }
async function ring(loc) { const { b } = await center(loc); await page.evaluate((r) => window.__ov.ring(r), b); }
async function ringUnion(...locs) {
  const bs = []; for (const l of locs) { const b = await l.boundingBox(); if (b) bs.push(b); }
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const r = Math.max(...bs.map((b) => b.x + b.width)), btm = Math.max(...bs.map((b) => b.y + b.height));
  await page.evaluate((r) => window.__ov.ring(r), { x, y, width: r - x, height: btm - y });
}
const hideRing = () => page.evaluate(() => window.__ov.hideRing());
async function card(h, s, n, ms) { await page.evaluate(([h, s, n]) => window.__ov.card(h, s, n), [h, s, n]); await wait(ms); }
const hideCard = () => page.evaluate(() => window.__ov.hideCard());
async function go(p) { await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, p); await wait(500); }
const demo = (fn, ...args) => page.evaluate(([fn, args]) => window.__demo[fn](...args), [fn, args]);
const ids = () => page.evaluate(() => window.__demo.ids);
const side = (name) => page.locator('aside').getByRole('link', { name, exact: true });
async function drag(from, to) {
  const a = await hover(from);
  await wait(200); await page.mouse.down(); await wait(150);
  await moveTo(a.x + 10, a.y + 10, 150);
  const b = await center(to);
  await moveTo(b.x, b.y, 1100); await wait(300);
  await page.mouse.up(); await wait(700);
}
let shotN = 0;
async function shot(name) { if (VIDEO) return; fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true }); await page.screenshot({ path: path.join(HERE, 'shots', `${String(++shotN).padStart(2, '0')}-${name}.png`) }); }

// ---------- grabación (CDP screencast) ----------
const frames = [];
let cdp;
async function startRec() {
  if (!VIDEO) return;
  fs.rmSync(path.join(HERE, 'frames'), { recursive: true, force: true });
  fs.mkdirSync(path.join(HERE, 'frames'), { recursive: true });
  cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(HERE, 'frames', `${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(W * DPR), maxHeight: Math.round(H * DPR), everyNthFrame: 1 });
}
async function stopRec() {
  if (!VIDEO) return;
  const end = Date.now() / 1000;
  await hideCap();
  writeAss(path.join(HERE, 'captions.ass'), frames[0].t);
  await cdp.send('Page.stopScreencast');
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const dur = Math.max(0.001, (i + 1 < frames.length ? frames[i + 1].t : end) - frames[i].t);
    lines.push(`file '${frames[i].file.replace(/\\/g, '/')}'`, `duration ${dur.toFixed(4)}`);
  }
  lines.push(`file '${frames.at(-1).file.replace(/\\/g, '/')}'`);
  const list = path.join(HERE, 'frames.txt');
  fs.writeFileSync(list, lines.join('\n'));
  const out = path.join(HERE, 'demo.mp4');
  process.chdir(HERE);
  execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', "fps=30,scale=1920:-2:flags=lanczos,pad=1920:1080:0:0:0x1d1b1b,drawbox=x=0:y=ih-160:w=iw:h=3:color=0xc08a3a:t=fill,subtitles=captions.ass:fontsdir=fonts,format=yuv420p", '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('OK ->', out, frames.length, 'frames');
}

function writeAss(file, t0) {
  const ts = (x) => { x = Math.max(0, x - t0); const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, sec = (x % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${sec}`; };
  const esc = (t) => (t || '').replace(/[{}]/g, '');
  const ev = caps.map((c) => `Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,{\\an4\\pos(90,1000)\\fad(200,200)}{\\fs21\\b1\\c&H6DB5E2&}${esc(c.k).toUpperCase()}\\N{\\fs35\\b1\\c&HFFFFFF&}${esc(c.t)}\\N{\\fs25\\b0\\c&HE4E4E9&}${esc(c.d)}`);
  fs.writeFileSync(file, `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Segoe UI,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,4,90,90,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join(String.fromCharCode(10))}
`);
}

// ---------- guion ----------
await page.goto(BASE + '/login');
await page.waitForLoadState('networkidle');
await page.evaluate(eval(fs.readFileSync(path.join(HERE, 'overlay.js'), 'utf8')));
await card('Sistema de producción', 'Cómo se mueve un trabajo dentro del estudio: de la carga a la entrega, con todos sus avisos.', 'Recorrido con datos de ejemplo', 0);
await page.mouse.move(mx, my);
await startRec();
await wait(4500);
await hideCard(); await wait(700);

// 1. Login
await cap('Ingreso', 'Cada persona entra con su propia cuenta', 'Lo que ve y lo que puede hacer depende de su rol: dirección, coordinación o diseño/producción.');
await hover(page.getByRole('button', { name: /ingresar/i }).first(), 1200);
await shot('login'); await wait(3800);
await hideCap(); await wait(300);
await page.evaluate(eval(fs.readFileSync(path.join(HERE, 'demo-setup.js'), 'utf8')));
const I = await ids();
await go('/'); await wait(800);

// 2. Dashboard
await cap('Dashboard', 'El resumen del día, apenas entrás', 'Tarjetas con lo que está listo, en producción, en diseño, pendiente y lo crítico. Un click filtra la lista.');
await ring(page.getByText('Listos para entregar').locator('xpath=ancestor::div[contains(@class,"grid")][1]')); await shot('dashboard'); await wait(4200); await hideRing();
await cap('Dashboard', 'A mí · Por mí · Todos', 'Cada uno elige qué ver: lo que le asignaron, lo que asignó él, o todo el estudio.');
const scope = page.getByRole('group', { name: 'Qué trabajos ver' });
await click(scope.getByRole('button', { name: 'A mí' }), { pauseAfter: 1400 });
await click(scope.getByRole('button', { name: 'Todos' }), { pauseAfter: 1200 });
await cap('Dashboard', 'Carga de cada diseñador', 'Antes de asignar un trabajo nuevo se ve quién tiene menos carga.');
await ring(page.getByText('Carga de diseño').locator('xpath=ancestor::div[contains(@class,"rounded")][1]')); await shot('carga'); await wait(3600); await hideRing();
await cap('Dashboard', 'Cada ficha, de un vistazo', 'Prioridad, estado, N° de Copernico, cliente, fechas, cuenta regresiva y quién asignó a quién. Se puede cambiar el estado o la prioridad desde acá.');
const firstCard = page.locator('main').getByRole('button', { name: /Ver ficha/ }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
await ring(firstCard); await shot('card'); await wait(5000); await hideRing();
await hideCap(); await wait(300);

// 3. Carga rápida
await click(side('Carga rápida'), { pauseAfter: 900 });
await cap('Nuevo trabajo', 'Carga rápida: un solo formulario', 'Cliente, nombre, tipo, fecha de entrega y prioridad. Solo la medida es obligatoria; lo demás se completa después.');
await type(page.locator('#qj-client'), 'Café Molinari');
await type(page.locator('#qj-name'), 'Carteles de mesa');
await select(page.locator('#qj-type'), 'acrilico');
await cap('Nuevo trabajo', 'La fecha sugiere la prioridad', 'Elegís la entrega con un click y la prioridad se propone sola. Se puede cambiar a mano en cualquier momento.');
await click(page.getByRole('button', { name: '3 días', exact: true }), { pauseAfter: 1200 });
await ring(page.locator('#qj-priority')); await shot('fecha'); await wait(2200); await hideRing();
await type(page.locator('#qj-description'), '20 carteles de mesa con el menú del día.', { delay: 30 });
await cap('Nuevo trabajo', 'Productos, materiales y medidas', 'Un trabajo puede tener varios productos, cada uno con su material, cantidades y medidas. Se marca si es tercerizado.');
const prodName = page.getByPlaceholder(/Producto 1/);
await type(prodName, 'Cartel de mesa');
const chip = page.getByText('Material', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Acrílico', exact: true });
await click(chip, { pauseAfter: 400 });
console.log('chip pressed:', await chip.getAttribute('aria-pressed'));
await type(page.getByLabel('Cantidad').first(), '20');
await type(page.getByLabel('Ancho').first(), '15');
await type(page.getByLabel('Alto').first(), '21');
await type(page.getByPlaceholder(/Acrílico 5mm cristal/).first(), 'Acrílico 3mm cristal con base', { delay: 30 });
await shot('producto');
await cap('Nuevo trabajo', 'Asignación', 'Quien carga queda como "Asigna". Se elige el responsable y, si hace falta, gente del taller.');
const resp = page.locator('#qj-responsible');
await resp.scrollIntoViewIfNeeded();
await select(resp, { label: 'Gastón Benítez' });
await click(page.getByRole('button', { name: 'Rolli', exact: true }), { pauseAfter: 600 });
await ring(resp.locator('xpath=ancestor::div[contains(@class,"rounded")][1]')); await shot('asignacion'); await wait(2600); await hideRing();
await click(page.getByRole('button', { name: /Crear trabajo/ }), { pauseAfter: 900 });
const crearIgual = page.getByRole('button', { name: 'Crear igual' });
if (await crearIgual.isVisible().catch(() => false)) await click(crearIgual, { pauseAfter: 1000 });
await cap('Nuevo trabajo', 'Listo: la ficha ya existe', 'El responsable recibe el aviso "Te asignaron el trabajo" en su campana.');
await shot('creado'); await wait(3200);
await hideCap();

// 4. Ficha completa
await click(page.getByPlaceholder('Buscar trabajo, cliente, material...'), { pauseAfter: 200 });
await page.keyboard.type('vidriera', { delay: 70 * speed }); await wait(900);
await cap('Buscador', 'Encontrá cualquier trabajo desde arriba', 'Por nombre, cliente, N° o material.');
await shot('buscador'); await wait(1500);
await click(page.locator('header').getByText('Vidriera de primavera').first(), { pauseAfter: 1000 });
await cap('Ficha del trabajo', 'Toda la información en un lugar', 'Quién asignó y a quién, prioridad, estado, muestra al cliente y la cuenta regresiva hasta la entrega.');
await ringUnion(page.getByText('Volver', { exact: true }), page.getByText(/Exportar para cliente/), page.getByText('Muestra: falta OK').first()); await shot('ficha'); await wait(4800); await hideRing();
await cap('Ficha del trabajo', 'Muestra al cliente', 'Si el cliente pide una prueba antes de producir: en producción (OT emitida) → enviada, falta OK → aprobada. Se ve en el Dashboard y en el Kanban.');
await ring(page.getByLabel('Muestra al cliente').or(page.locator('select').filter({ hasText: 'Sin muestra' })).first()); await wait(4200); await hideRing();
const tab = (n) => page.getByRole('tab', { name: n, exact: true });
await click(tab('Detalle'), { pauseAfter: 600 });
await cap('Ficha · Detalle', 'Cada producto se tilda cuando está procesado', 'Es solo para llevar el pulso: nunca frena el cambio de estado del trabajo.');
await click(page.getByRole('tabpanel').getByRole('checkbox').nth(1), { pauseAfter: 900 });
await shot('detalle'); await wait(2400);
await click(tab('Control de calidad'), { pauseAfter: 600 });
await cap('Ficha · Control de calidad', 'Checklist antes de entregar', 'Medidas, material, color, imagen espejada en bajo acrílico... Si falta algo, la app lo recuerda al pasar a Listo.');
const qcBoxes = page.getByRole('tabpanel').getByRole('checkbox');
await click(qcBoxes.nth(3), { pauseAfter: 500 });
await click(qcBoxes.nth(4), { pauseAfter: 900 });
await shot('qc'); await wait(2400);
await click(tab('Archivos'), { pauseAfter: 600 });
await cap('Ficha · Archivos', 'Versiones de cada archivo', 'Se ve qué versión está aprobada para producir.');
await shot('archivos'); await wait(3400);
await cap('Ficha · Comentarios', 'Conversación del equipo con @menciones', 'Escribís @ y elegís a la persona: le llega un aviso. También se puede avisar a todo un sector.');
const box = page.getByLabel('Escribir un comentario');
await type(box, 'Revisá el cartel colgante antes de mandar a imprimir @Gas', { delay: 40 });
await wait(900); await shot('mencion');
await click(page.getByRole('listbox', { name: 'Usuarios para mencionar' }).getByRole('option').first(), { pauseAfter: 300 });
await page.keyboard.type('🙏', { delay: 40 }); await wait(500);
await click(page.getByRole('button', { name: 'Enviar comentario' }), { pauseAfter: 1200 });
await wait(1600);
await click(tab('Historial'), { pauseAfter: 600 });
await cap('Ficha · Historial', 'Todo queda registrado', 'Quién hizo cada cambio y cuándo.');
await shot('historial'); await wait(3200);

// 5. Bloqueo
await cap('Alertas', 'Bloquear un trabajo', 'Si algo frena el trabajo (falta material, aprobación, un archivo), se bloquea con el motivo. Queda en rojo en todas las pantallas.');
await click(page.getByRole('button', { name: /Bloquear trabajo/ }), { pauseAfter: 700 });
const dlg = page.getByRole('dialog');
await select(dlg.locator('select').first(), 'falta_aprobacion');
await type(dlg.locator('textarea').first(), 'Esperando OK de la muestra por parte de Laura', { delay: 30 });
await click(dlg.getByRole('button', { name: /Bloquear/ }).last(), { pauseAfter: 900 });
await shot('bloqueado'); await wait(3400);
await hideCap();

// 6. Kanban
await click(side('Kanban'), { pauseAfter: 900 });
await cap('Kanban', 'El tablero de producción', 'Siete columnas, en el orden real: Pendiente → Diseño → Producción → Control de calidad → Listo → Instalación → Entregado.');
await shot('kanban'); await wait(4200);
await cap('Kanban', 'Las señales se ven en la tarjeta', 'Borde rojo = bloqueado. Etiqueta "muestra" = esperando la prueba. Arriba, la cuenta regresiva.');
await ring(page.getByRole('button', { name: /Hotel Palermo Soho/ })); await wait(3200);
await ring(page.getByRole('button', { name: /Café Molinari, Vidriera/ })); await wait(2800); await hideRing();
await cap('Kanban', 'Arrastrar para avanzar', 'Mover una tarjeta de columna cambia el estado del trabajo para todos.');
const col = (label) => page.locator('main').getByText(label, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
await drag(page.getByRole('button', { name: /Librería Atlas, Exhibidores/ }), col('Diseño'));
await drag(page.getByRole('button', { name: /Farmacias del Norte, Cartel luminoso/ }), col('Listo para entregar'));
await shot('kanban-drag'); await wait(2200);
await hideCap();

// 7. Avisos
await cap('Avisos', 'La campana y los avisos en vivo', 'Cuando te asignan un trabajo o te mencionan, te llega a la campana sin recargar la página.');
await demo('notify', 'catalogo', 'Te asignaron el trabajo "Exhibidores de mostrador".');
await wait(1500);
await click(page.getByRole('button', { name: /Notificaciones/ }), { pauseAfter: 900 });
await shot('campana'); await wait(3000);
await click(page.getByRole('button', { name: /Notificaciones/ }), { pauseAfter: 400 });
await demo('clear');
await cap('Avisos', 'Cuando otro cambia un estado, te enterás', 'Aparece una tarjeta abajo a la derecha: qué trabajo, de qué estado a cuál, quién y a qué hora. Se cierra con la ×.');
await demo('flag', 'lona', 'LISTO_PARA_ENTREGA', 'TERMINADO', 'Martín'); await wait(1300);
await demo('flag', 'corporeo', 'EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 'Gastón'); await wait(1200);
await shot('flags'); await wait(3600);
await click(page.getByRole('button', { name: /Cerrar aviso/ }).first(), { pauseAfter: 900 });
await demo('clear'); await wait(400);
await hideCap();

// 8. Listo para entregar -> mensaje al cliente
await go(`/trabajos/${I.jobs.lona}`); await wait(900);
await cap('Entrega', 'Listo para entregar: avisarle al cliente', 'Un botón arma el mensaje con el nombre y N° del pedido. Se copia o se abre directo en WhatsApp.');
await click(page.getByRole('button', { name: /Mensaje para el cliente/ }), { pauseAfter: 900 });
await shot('mensaje'); await wait(4500);
await click(page.getByRole('dialog').getByRole('button', { name: /Cerrar/ }).first(), { pauseAfter: 500 });
await hideCap();

// 9. Trabajos
await click(side('Trabajos'), { pauseAfter: 900 });
await cap('Trabajos', 'La lista completa, con filtros', 'Por prioridad, estado, cliente o responsable. Los entregados hace más de 5 días se archivan solos.');
await shot('trabajos'); await wait(3800);
await click(page.getByText(/Solo bloqueados/), { pauseAfter: 1200 });
await shot('bloqueados'); await wait(2200);
await click(page.getByText(/Solo bloqueados/), { pauseAfter: 600 });
await hideCap();

// 10. Presupuestos
await click(side('Presupuestos'), { pauseAfter: 900 });
await cap('Presupuestos', 'Antes del trabajo, el presupuesto', 'Viven aparte: no aparecen en Trabajos ni en el Kanban hasta que el cliente confirma.');
await shot('presupuestos'); await wait(3800);
await click(page.locator('main').getByText('Stand para feria de turismo').first(), { pauseAfter: 900 });
await cap('Presupuestos', 'Detalle, valor y PDF', 'Ítems con material, unidad y medidas. El importe lo carga dirección o administración, con o sin IVA, y se exporta en PDF.');
await shot('presupuesto'); await wait(2500);
await hover(page.getByText('Valor del presupuesto'), 900); await ring(page.getByText('Valor del presupuesto').locator('xpath=ancestor::div[contains(@class,"rounded")][1]')); await wait(3000); await hideRing();
await page.mouse.wheel(0, -2000); await wait(500);
await cap('Presupuestos', 'El cliente confirmó → se convierte en trabajo', 'Se elige tipo, fecha y responsable. Todo lo cargado pasa a una ficha nueva, sin volver a tipear.');
await click(page.getByRole('button', { name: /Confirmar presupuesto/ }), { pauseAfter: 800 });
const qd = page.getByRole('dialog');
await select(qd.locator('select').first(), 'vidrieras_stands');
await shot('confirmar'); await wait(1500);
await click(qd.getByRole('button', { name: /Confirmar/ }).last(), { pauseAfter: 1200 });
await wait(600);
await cap('Presupuestos', 'La ficha nueva ya entra al flujo de producción', 'Nace en Pendiente, con un link de vuelta al presupuesto de origen.');
await shot('job-from-quote'); await wait(3800);
await hideCap();

// 11. Histórico
await click(side('Histórico'), { pauseAfter: 900 });
await cap('Histórico', 'Nada se pierde', 'Trabajos archivados y eliminados quedan consultables. Un eliminado por error se restaura con un click (solo administradores).');
await shot('historico'); await wait(4500);
await hideCap(); await wait(400);

// cierre
await card('Todo en un solo lugar', 'Carga · seguimiento · avisos · entrega · presupuestos', 'bonta-app.vercel.app', 4500);
await stopRec();
await browser.close();
