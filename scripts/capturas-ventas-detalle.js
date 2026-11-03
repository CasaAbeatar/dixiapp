// Capturas de los bloques nuevos de la pestana Ventas (lo mas y lo menos vendido, horas fuertes) (telefono, tabletas y escritorio). Requiere el servidor en el puerto 8100. No borra las demas capturas.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const tamanos = [['telefono', 390, 844], ['escritorio', 1440, 900]];
fs.mkdirSync(salida, { recursive: true });
const nav = await chromium.launch();
for (const [nombre, w, h] of tamanos) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-CR' });
  const p = await ctx.newPage(); const errores = []; p.on('pageerror', (e) => errores.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.route('**/src/datos/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const CONFIG = { modo: 'prueba' };" })); // datos ficticios, sin tocar la base
  await p.goto(URL);
  for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`);
  await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
  await p.click('.pestana:has-text("Ventas")'); await p.waitForSelector('[data-id="ventas-top"]'); await p.waitForSelector('[data-id="ventas-horas"]');
  await p.addStyleTag({ content: '.pestanas{position:static!important} main{padding-bottom:24px!important}' });
  await p.screenshot({ path: `${salida}/ventas detalle ${nombre}.png`, fullPage: true });
  console.log(nombre, 'turnos:', await p.locator('.turno').count(), 'errores:', errores.length ? errores.join(' | ') : 'ninguno');
  await ctx.close();
}
await nav.close();
