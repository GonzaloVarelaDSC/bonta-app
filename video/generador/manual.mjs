// Capturas del Manual de uso (public/manual/*.jpg) con marcas numeradas.
// Datos 100% ficticios (demo-setup.js) y nada sale hacia Supabase.
//   node manual.mjs            -> todas
//   node manual.mjs 05         -> solo las que empiezan con "05"
// Necesita el dev server corriendo (por defecto en 5173; otro puerto: BASE=http://localhost:5179).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT = 'C:/Users/gonza/OneDrive/Escritorio/bonta-app';
const require = createRequire(PROJECT + '/package.json');
const { chromium } = require('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const OUT = path.join(PROJECT, 'public/manual');
const BASE = process.env.BASE ?? 'http://localhost:5173';
const ONLY = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const setup = fs.readFileSync(path.join(HERE, 'demo-setup.js'), 'utf8');
const JOB = '00000000-0000-4000-8000-000000000024'; // "Letras corpóreas fachada"

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
await ctx.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
let page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

async function boot() {
  await page.goto(BASE + '/login');
  await page.waitForTimeout(3500);
  await page.evaluate(eval(setup));
  await page.evaluate(async () => {
    const { useStore } = await import('/src/store/useStore.ts');
    window.__S = useStore;
    useStore.setState((s) => ({ jobs: s.jobs.map((j) => ({ ...j, productionConfig: j.productionConfig ?? { items: [] } })), statusFlags: [] }));
  });
}
async function go(p) {
  await page.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, p);
  await page.waitForTimeout(700);
}
// Marcas: un recuadro bronce alrededor de cada elemento + un círculo con el
// número del paso (el mismo número que usa el texto del manual).
async function mark(items) {
  const boxes = [];
  for (const [n, loc] of items) {
    const l = typeof loc === 'string' ? page.locator(loc).first() : loc.first();
    const b = await l.boundingBox().catch(() => null);
    if (!b) { console.log(`  ! marca ${n} no encontrada`); continue; }
    boxes.push({ n, ...b });
  }
  await page.evaluate((bx) => {
    document.getElementById('mk-root')?.remove();
    const root = document.createElement('div'); root.id = 'mk-root';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    for (const b of bx) {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;left:${b.x - 5}px;top:${b.y - 5}px;width:${b.width + 10}px;height:${b.height + 10}px;border:3px solid #c0392b;border-radius:10px`;
      const c = document.createElement('div');
      c.textContent = b.n;
      const cx = Math.max(4, b.x - 22), cy = Math.max(4, b.y - 22);
      c.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:30px;height:30px;border-radius:999px;background:#c0392b;color:#fff;font:700 17px Inter,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
      root.append(r, c);
    }
    document.body.appendChild(root);
  }, boxes);
}
async function shot(name, items = [], clipSel) {
  if (ONLY && !name.startsWith(ONLY)) return;
  await mark(items);
  await page.waitForTimeout(250);
  // clipSel: recorta la captura a ese elemento (con margen), para pantallas donde
  // lo importante es chico (ej. el login) y las marcas se verían diminutas.
  let clip;
  if (clipSel) {
    const b = await page.locator(clipSel).first().boundingBox();
    if (b) { const m = 40; clip = { x: Math.max(0, b.x - m), y: Math.max(0, b.y - m), width: b.width + 2 * m, height: b.height + 2 * m }; }
  }
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82, clip });
  await page.evaluate(() => document.getElementById('mk-root')?.remove());
  console.log('ok', name);
}
const S = (fn, arg) => page.evaluate(fn, arg);
const scrollTo = (loc) => page.locator(loc).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));

// ---- 01 Entrar y conocer la pantalla
await page.goto(BASE + '/login');
await page.waitForTimeout(2500);
await shot('01-login', [[1, '#login-email'], [2, '#login-password'], [3, 'button[type=submit]']], 'form');
await boot();
await go('/');
await shot('01-pantalla', [[1, 'aside, nav'], [2, 'input[aria-label="Buscar"]'], [3, 'button[aria-label^="Notificaciones"]'], [4, page.getByRole('button', { name: /Pendientes/ })], [5, page.getByRole('group', { name: 'Qué trabajos ver' })]]);

// ---- 02 Cargar un trabajo (Carga rápida)
await go('/trabajos/rapido');
await page.fill('#qj-client', 'Café Molinari').catch(() => {});
await page.fill('#qj-name', 'Vinilos para vidriera de otoño');
await page.getByRole('button', { name: '3 días' }).click().catch(() => {});
await page.fill('#qj-description', 'Vinilo de corte blanco para la vidriera principal, según el mail de Laura.');
await shot('02-carga-datos', [[1, '#qj-client'], [2, '#qj-name'], [3, 'select:near(:text("Tipo de trabajo"))'], [4, 'input[type=date]'], [5, '#qj-description'], [6, '#qj-priority']]);
await scrollTo(':text("Productos")');
await page.fill('input[placeholder^="Producto 1"]', 'Vinilo de corte');
await page.locator('[aria-label="Cantidad"]').first().fill('2');
await page.locator('[aria-label="Ancho"]').first().fill('120');
await page.locator('[aria-label="Alto"]').first().fill('80');
await page.getByRole('button', { name: 'Vinilo', exact: true }).first().click().catch(() => {});
await shot('02-carga-productos', [[1, 'input[placeholder^="Producto 1"]'], [2, page.getByRole('button', { name: 'Vinilo', exact: true })], [3, '[aria-label="Cantidad"]'], [4, page.getByRole('button', { name: /Agregar medida/ })]]);
await scrollTo(':text("Asignación")');
await shot('02-carga-asignar', [[1, 'select:near(:text("Responsable"))'], [2, page.getByRole('button', { name: /Crear trabajo/ })]]);

// ---- 03 Encontrar un trabajo
await go('/');
await page.fill('input[aria-label="Buscar"]', 'Café');
await page.waitForTimeout(400);
await shot('03-buscador', [[1, 'input[aria-label="Buscar"]']]);
await page.fill('input[aria-label="Buscar"]', '');
await go('/trabajos');
await shot('03-trabajos', [[1, 'input[placeholder="Buscar..."]'], [2, 'select >> nth=0'], [3, page.locator('table tbody tr').first()]]);

// ---- 04 La ficha de un trabajo
await go(`/trabajos/${JOB}`);
await shot('04-ficha-cabecera', [[1, 'button[aria-label^="Editar cliente"]'], [2, page.locator('select').filter({ hasText: 'Para mañana' })], [3, page.locator('select').filter({ hasText: 'En producción' }).first()], [4, '[role=tablist]']]);
await shot('04-ficha-general', [[1, '#job-responsible'], [2, 'input[type=date]']]);
await page.locator('#tab-Detalle').click(); await page.waitForTimeout(400);
await shot('04-ficha-detalle', [[1, page.getByRole('button', { name: /Editar detalle|Cargar detalle/ })]]);

// ---- 05 Cambiar el estado
await page.locator('#tab-General').click(); await page.waitForTimeout(300);
await go('/kanban');
await shot('05-kanban', [[1, page.locator('[class*="cursor-grab"], [aria-roledescription]').first()], [2, page.getByText('Producción', { exact: true }).first()]]);

// ---- 06 Avisar a alguien
await go(`/trabajos/${JOB}`);
const ta = page.locator('textarea').last();
await ta.click(); await ta.type('Gastón, ¿podés revisar el archivo? @Gas', { delay: 10 });
await page.waitForTimeout(400);
await shot('06-mencion', [[1, ta], [2, page.locator('[role=listbox], [role=option]').first()]]);
await ta.fill('');
await go('/');
await page.click('button[aria-label^="Notificaciones"]'); await page.waitForTimeout(400);
await shot('06-campana', [[1, 'button[aria-label^="Notificaciones"]']]);
await page.click('button[aria-label^="Notificaciones"]');
await S(() => {
  const st = window.__S.getState(); const j = st.jobs[0];
  window.__S.setState({ statusFlags: [{ id: 'f1', kind: 'estado', authorId: '', jobId: j.id, jobName: j.name, from: 'EN_DISENO', to: 'EN_PRODUCCION', userName: 'Gastón', at: new Date().toISOString() }] });
});
await page.waitForTimeout(500);
await shot('06-aviso-estado', [[1, '[aria-label="Cambios de estado de otros usuarios"]']]);
await S(() => window.__S.setState({ statusFlags: [] }));

// ---- 07 Bloquear o cancelar
await go(`/trabajos/${JOB}`);
await shot('07-bloquear', [[1, page.getByRole('button', { name: /Bloquear trabajo/ })], [2, page.getByRole('button', { name: /Cancelar trabajo/ })]]);

// ---- 08 Muestra al cliente y mensaje de listo
await shot('08-muestra', [[1, page.locator('select').filter({ hasText: 'Sin muestra' })]]);
const ready = await S(() => window.__S.getState().jobs.find((j) => j.status === 'LISTO_PARA_ENTREGA' || j.status === 'LISTO_PARA_INSTALACION')?.id);
if (ready) {
  await go(`/trabajos/${ready}`);
  await page.getByRole('button', { name: /Mensaje para el cliente/ }).click(); await page.waitForTimeout(400);
  await shot('08-mensaje-cliente', [[1, page.getByRole('button', { name: /Copiar mensaje/ })], [2, page.getByRole('button', { name: /WhatsApp/ }).or(page.getByRole('link', { name: /WhatsApp/ }))]]);
  await page.locator('[role=dialog] button[aria-label=Cerrar]').first().click().catch(() => {}); await page.waitForTimeout(300);
}

// ---- 09 Planilla de producción y contact sheet
await go(`/trabajos/${JOB}`);
await page.locator('#tab-Producción').click(); await page.waitForTimeout(400);
await page.locator('[role=group][aria-label^="Procesos"] button', { hasText: 'Impresión' }).first().click();
await page.setViewportSize({ width: 1280, height: 1250 });
await page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
await page.waitForTimeout(300);
await shot('09-produccion', [[1, page.getByRole('button', { name: /Subir la imagen del contact sheet/ })], [2, page.locator('[role=group][aria-label^="Procesos"]').first()], [3, page.getByRole('button', { name: /Exportar PDF de producción/ })]]);
await page.setViewportSize({ width: 1280, height: 800 });

// ---- 10 Presupuestos
await go('/presupuestos');
await shot('10-presupuestos', [[1, page.getByRole('link', { name: /Nuevo presupuesto/ }).or(page.getByRole('button', { name: /Nuevo presupuesto/ }))]]);
const qid = await S(() => window.__S.getState().quotes.find((q) => q.status !== 'CONFIRMADO')?.id);
if (qid) {
  await go(`/presupuestos/${qid}`);
  await shot('10-presupuesto-ficha', [[1, page.getByRole('button', { name: /Guardar valor/ })], [2, page.getByText('Exportar presupuesto').first()], [3, page.getByRole('button', { name: /Confirmar presupuesto/ })]]);
}

// ---- 11 Desde el celular
await page.setViewportSize({ width: 390, height: 780 });
await go('/');
await shot('11-celular', [[1, 'button[aria-label="Abrir menú"]']]);



await browser.close();
