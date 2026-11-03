// Capturas de Bodega > Contar y Sacar sin comida preparada. Requiere el servidor en el puerto 8100.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const nav = await chromium.launch();
for (const [n, w, h] of [['telefono', 390, 844], ['escritorio', 1280, 800]]) {
  const p = await (await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-CR', serviceWorkers: 'block' })).newPage();
  await p.route('**/src/datos/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const CONFIG = { modo: 'prueba' };" }));
  await p.goto('http://127.0.0.1:8100/');
  await p.waitForSelector('.pestanas, .tecla', { timeout: 15000 });
  if (await p.locator('.tecla').count()) { for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`); await p.click('text=Entrar'); }
  await p.waitForSelector('.pestanas');
  await p.click('.pestana:has-text("Bodega")'); await p.waitForSelector('.secciones-bodega');
  const sec = (k) => p.click(`[data-accion="b-sec"][data-valor="${k}"]`);
  await sec('contar'); await p.click('text=Empezar conteo'); await p.waitForSelector('.b-cont');
  const colones = await p.locator('.b-cont .paso:has-text("₡")').count();
  await p.screenshot({ path: `${salida}/conteo sin comida preparada ${n}.png`, fullPage: true });
  await p.click('text=Cancelar').catch(() => {});
  console.log(n, 'filas con ₡ en conteo:', colones);
}
await nav.close();
