// Capturas de la tarjeta "Avisos en este telefono" (pestana Mas), apagada y activada. Requiere el servidor en el puerto 8100.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
fs.mkdirSync(salida, { recursive: true });
const nav = await chromium.launch();
for (const [nombre, w, h] of [['telefono', 390, 844], ['escritorio', 1440, 900]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-CR' });
  const p = await ctx.newPage(); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  await p.route('**/src/datos/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const CONFIG = { modo: 'prueba' };" }));
  await p.goto(URL);
  for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`);
  await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
  await p.click('.pestana:has-text("Más")'); await p.waitForSelector('text=Avisos en este teléfono');
  await p.addStyleTag({ content: '.pestanas{position:static!important} main{padding-bottom:24px!important}' });
  await p.screenshot({ path: `${salida}/avisos apagados ${nombre}.png`, fullPage: true });
  await p.click('[data-accion="avisos-activar"]'); await p.waitForSelector('[data-accion="avisos-probar"]');
  await p.click('[data-accion="aviso-pref"][data-valor="resumen_diario"]'); await p.click('[data-accion="aviso-min"]');
  await p.screenshot({ path: `${salida}/avisos activados ${nombre}.png`, fullPage: true });
  console.log(nombre, 'errores:', errores.length ? errores.join(' | ') : 'ninguno');
  await ctx.close();
}
await nav.close();
