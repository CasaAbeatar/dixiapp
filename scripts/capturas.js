// Capturas de las pantallas en telefono, tableta (vertical y horizontal) y escritorio. Requiere el servidor en el puerto 8100.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
// Tableta de 8,7" (1340x800 y 800x1340, mas el equivalente en dp 1005x600 y 600x1005) y de 11" (1280x800 y 800x1280)
const tamanos = [['telefono', 390, 844], ['tableta87-horizontal', 1340, 800], ['tableta87-vertical', 800, 1340], ['tableta87-dp-horizontal', 1005, 600], ['tableta11-horizontal', 1280, 800], ['tableta11-vertical', 800, 1280], ['escritorio', 1440, 900]];
fs.mkdirSync(salida, { recursive: true });
for (const f of fs.readdirSync(salida)) if (f.endsWith('.png')) fs.unlinkSync(path.join(salida, f));
const nav = await chromium.launch();
for (const [nombre, w, h] of tamanos) for (const tema of ['light', 'dark']) {
  if (tema === 'dark' && nombre !== 'tableta11-horizontal') continue;
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-CR' });
  const p = await ctx.newPage(); await p.goto(URL);
  const suf = tema === 'dark' ? '-oscuro' : '';
  // Pagina completa: la barra inferior fija se vuelve estatica para que no quede a mitad de la imagen
  const foto = async (n, full = true) => {
    if (full) await p.addStyleTag({ content: '.pestanas{position:static!important} .barra-accion{position:static!important} main{padding-bottom:24px!important}' }).then((h) => h.evaluate((e) => e.id = 'tmp-cap'));
    await p.screenshot({ path: `${salida}/${nombre}-${n}${suf}.png`, fullPage: full });
    if (full) await p.evaluate(() => document.getElementById('tmp-cap')?.remove());
  };
  const tab = (t) => p.click(`.pestana:has-text("${t}")`);
  const sec = (k) => p.click(`[data-accion="b-sec"][data-valor="${k}"]`);
  await foto('acceso', false);
  for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`);
  await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
  await foto('caja'); if (nombre !== 'telefono' && tema === 'light') await foto('caja-pantalla', false);
  await p.click('[data-accion="abrir-form"][data-valor="salida"]'); await p.click('#formulario .ficha:has-text("Gas")'); await p.fill('#f-monto', '12500'); await foto('caja-salida');
  await p.click('#formulario >> text=Cancelar');
  await tab('Compras'); await p.waitForSelector('.resumen'); await foto('compras'); await foto('compras-pantalla', false);
  await p.locator('.factura').first().click(); await foto('compras-detalle', false);
  await p.click('[data-accion="por"][data-valor="semana"]'); if (tema === 'light') await foto('compras-semana');
  await tab('Bodega'); await p.waitForSelector('.secciones-bodega'); await foto('bodega-existencias');
  await foto('bodega-existencias-pantalla', false);
  await p.click('[data-accion="b-todos"]'); await foto('bodega-existencias-todos'); await p.click('[data-accion="b-todos"]');
  await sec('recibir'); await foto('bodega-recibir'); await p.click('[data-accion="b-usar-propuesta"]'); await foto('bodega-recibir-asignada');
  await p.click('[data-accion="b-sub"][data-valor="notas"]'); await p.click('[data-accion="b-nota-abrir"]'); await foto('bodega-notas'); await p.click('[data-accion="b-sub"][data-valor="pendientes"]');
  await sec('sacar'); const fp = p.locator('.paso', { hasText: 'Pollo entero' }); await fp.locator('[data-accion="b-mas"]').click({ clickCount: 1 }); await fp.locator('[data-accion="b-mas"]').click(); await foto('bodega-sacar');
  await sec('contar'); await p.click('text=Empezar conteo'); await p.waitForSelector('.b-cont'); await p.locator('.paso', { hasText: 'Tomate' }).locator('input').fill('4'); await foto('bodega-contar');
  await p.click('text=Revisar y confirmar'); await p.waitForSelector('text=Revisar antes de confirmar'); await foto('bodega-contar-revision');
  await p.click('[data-accion="b-volver-contar"]'); await p.click('[data-accion="b-pedir-cancelar"]'); await p.click('[data-accion="b-cancelar-conteo"]');
  await sec('alertas'); await foto('bodega-alertas');
  await sec('minimos'); await foto('bodega-minimos'); await foto('bodega-minimos-pantalla', false);
  await tab('Cierres'); await foto('cierres');
  await tab('Más'); await foto('mas');
  await ctx.close();
}
await nav.close(); console.log('Capturas en', salida);
