// Revision de textos cortados o fuera de pantalla: en cada pestana, con todos los detalles abiertos y en 4 anchos de celular,
// busca elementos cuyo borde derecho pasa de la pantalla o cuyo contenido es mas ancho que su caja (texto cortado por overflow).
// Requiere el servidor local (npm run servir). Modo de prueba forzado.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const ANCHOS = [320, 360, 390, 430, 768];
const nav = await chromium.launch(); let total = 0; const vistos = new Set();
const medir = async (p, w, etq) => {
  const r = await p.evaluate((w) => {
    const sel = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.dataset.accion ? `[${e.dataset.accion}]` : ''));
    const out = [];
    for (const e of document.querySelectorAll('main *, .cabecera *, .pestanas *')) {
      const cs = getComputedStyle(e); if (e.closest('.ini-k') && e.matches('.ini-k')) continue; if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
      if (e.closest('[hidden], .tabla-scroll, .tabla, [data-scroll-x]') && cs.position !== 'fixed') { const sc = e.closest('.tabla-scroll, [data-scroll-x], .tabla-desliza'); if (sc) continue; }
      const txt = (e.textContent || '').trim().slice(0, 40);
      if (b.right > w + 1 && !e.closest('svg')) out.push(`fuera de pantalla (${Math.round(b.right)} > ${w}): ${sel(e)} "${txt}"`);
      else if (e.scrollWidth > e.clientWidth + 2 && ['hidden', 'clip'].includes(cs.overflowX) && e.clientWidth > 0) out.push(`contenido cortado (${e.scrollWidth} > ${e.clientWidth}): ${sel(e)} "${txt}"`);
      else if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`texto con «...»: ${sel(e)} "${txt}"`);
    }
    for (const e of document.querySelectorAll('.pestana')) if (e.scrollWidth > e.clientWidth + 1) out.push(`etiqueta de pestana pisa a la vecina (${e.scrollWidth} > ${e.clientWidth}): "${e.textContent.trim()}"`);
    if (document.documentElement.scrollWidth > w + 1) out.push(`la pagina se desplaza horizontalmente (${document.documentElement.scrollWidth} > ${w})`);
    return [...new Set(out)].slice(0, 12);
  }, w);
  for (const l of r) { const k = `${w}|${etq}|${l}`; if (!vistos.has(k)) { vistos.add(k); total++; console.log(`[${w}px] ${etq}: ${l}`); } }
};
const abrirTodo = async (p) => { // abre cualquier detalle plegable visible
  for (const s of ['[data-accion="turno-ver"][aria-expanded="false"]', '[data-accion="venta-ver"]', '[data-accion="factura-ver"]', '[data-accion="b-todos"]']) {
    const n = await p.locator(s).count(); for (let i = 0; i < Math.min(n, 4); i++) { await p.locator(s).nth(i).click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(80); }
  }
};
for (const w of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: 800 }, locale: 'es-CR', serviceWorkers: 'block', hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/src/datos/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const CONFIG = { modo: 'prueba' };" }));
  await p.goto(URL); await p.waitForSelector('.pestanas, .tecla', { timeout: 15000 });
  if (await p.locator('.tecla').count()) { for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`); await p.click('text=Entrar'); }
  await p.waitForSelector('.pestanas');
  for (const t of ['Inicio', 'Caja', 'Ventas', 'Compras', 'Cierres', 'Más']) {
    await p.click(`.pestana:has-text("${t}")`).catch(() => {}); await p.waitForTimeout(300); await medir(p, w, t); await abrirTodo(p); await p.waitForTimeout(150); await medir(p, w, `${t} (detalles abiertos)`);
    for (const f of await p.locator('.chip, [data-accion="por"]').all().then((a) => a.slice(0, 4))) { await f.click({ timeout: 1000 }).catch(() => {}); await p.waitForTimeout(150); await medir(p, w, `${t} (filtro)`); }
  }
  await p.click('.pestana:has-text("Bodega")'); await p.waitForSelector('.secciones-bodega');
  for (const k of ['existencias', 'recibir', 'sacar', 'contar', 'alertas', 'minimos']) {
    await p.click(`[data-accion="b-sec"][data-valor="${k}"]`).catch(() => {}); await p.waitForTimeout(200);
    if (k === 'contar') { await p.click('text=Empezar conteo').catch(() => {}); await p.waitForTimeout(250); }
    if (k === 'recibir') { await p.click('[data-accion="b-sub"][data-valor="notas"]').catch(() => {}); await p.waitForTimeout(150); await medir(p, w, 'Bodega recibir notas'); await p.click('[data-accion="b-sub"][data-valor="pendientes"]').catch(() => {}); }
    await medir(p, w, `Bodega ${k}`);
  }
  if (errs.length) console.log(`[${w}px] ERRORES DE PAGINA: ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await nav.close(); console.log(total ? `\n${total} observaciones` : '\nSin textos cortados ni fuera de pantalla en ningun ancho.');
