// Revision de legibilidad y de botones tactiles en las pantallas de la app (modo de prueba local, sin tocar la base).
// Mide, por tamano de pantalla y pestana: controles de menos de 44 px, letra de menos de 14 px, desborde horizontal de la pagina.
// Requiere el servidor local en el puerto 8100:  NODE_PATH=/opt/npm-tools/node_modules node scripts/revision-legibilidad.js
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const TAMANOS = [['tableta 8,7" horizontal 1340x800', 1340, 800], ['tableta 8,7" vertical 800x1340', 800, 1340], ['tableta 8,7" en dp 1005x600', 1005, 600], ['tableta 8,7" en dp 600x1005', 600, 1005], ['tableta 11" horizontal 1280x800', 1280, 800], ['tableta 11" vertical 800x1280', 800, 1280], ['telefono 390x844', 390, 844]];
const nav = await chromium.launch(); let problemas = 0;
for (const [nombre, w, h] of TAMANOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, locale: 'es-CR' }); const p = await ctx.newPage(); await p.goto(URL);
  for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`); await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
  const medir = async (etq) => {
    const r = await p.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
      const chicos = [...document.querySelectorAll('button, input:not([type=hidden]), select, a[href]')].filter(vis).map((e) => ({ e, b: e.getBoundingClientRect() })).filter((x) => x.b.height < 43.5 || x.b.width < 43.5)
        .map((x) => `${x.e.tagName.toLowerCase()}${x.e.dataset.accion ? '[' + x.e.dataset.accion + ']' : ''} ${Math.round(x.b.width)}x${Math.round(x.b.height)} "${(x.e.textContent || x.e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
      const letra = new Set(); document.querySelectorAll('main *, .cabecera *').forEach((e) => { if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !vis(e)) return; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 14) letra.add(`${f}px "${e.textContent.trim().slice(0, 20)}"`); });
      return { chicos, letra: [...letra].slice(0, 6), desborde: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (r.chicos.length || r.letra.length || r.desborde) { problemas++; console.log(`[${nombre}] ${etq}: ${r.desborde ? 'DESBORDE HORIZONTAL; ' : ''}${r.chicos.length ? 'controles chicos: ' + r.chicos.join(' | ') + '; ' : ''}${r.letra.length ? 'letra chica: ' + r.letra.join(' | ') : ''}`); }
  };
  for (const t of ['Caja', 'Compras', 'Cierres', 'Más']) { await p.click(`.pestana:has-text("${t}")`); await p.waitForTimeout(250); await medir(t); }
  await p.click('.pestana:has-text("Bodega")'); await p.waitForSelector('.secciones-bodega');
  for (const k of ['existencias', 'recibir', 'sacar', 'contar', 'alertas', 'minimos']) { await p.click(`[data-accion="b-sec"][data-valor="${k}"]`); await p.waitForTimeout(150); await medir(`Bodega ${k}`); }
  await p.click('[data-accion="b-sec"][data-valor="existencias"]'); await p.click('[data-accion="b-todos"]'); await medir('Bodega todos los lugares');
  await ctx.close();
}
await nav.close(); console.log(problemas ? `\n${problemas} pantallas con observaciones` : '\nSin observaciones: controles de 44 px o mas, letra de 14 px o mas, sin desborde horizontal.');
