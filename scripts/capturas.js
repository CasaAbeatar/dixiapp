// Capturas de las pantallas en tres tamanos. Requiere el servidor en el puerto 8100.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const tamanos = [['telefono', 390, 844], ['tableta', 800, 1280], ['escritorio', 1280, 800]];
const nav = await chromium.launch();
for (const [nombre, w, h] of tamanos) for (const tema of ['light', 'dark']) {
  if (tema === 'dark' && nombre !== 'tableta') continue;
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await p.goto(URL);
  const suf = tema === 'dark' ? '-oscuro' : '';
  // En capturas de pagina completa la barra inferior fija se vuelve estatica para que no aparezca a mitad de pagina
  const foto = async (n, full = true) => {
    if (full) await p.addStyleTag({ content: '.pestanas{position:static!important} main{padding-bottom:24px!important}' });
    await p.screenshot({ path: `${salida}/${nombre}-${n}${suf}.png`, fullPage: full });
    if (full) await p.evaluate(() => document.querySelectorAll('style:last-of-type')[0]?.remove());
  };
  await foto('acceso', false);
  for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`);
  await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
  await foto('hoy'); await foto('hoy-pantalla', false);
  await p.click('.pestana:has-text("Cierres")'); await foto('cierres');
  await p.click('.pestana:has-text("Efectivo")'); await p.click('text=Registrar salida de efectivo'); await p.click('.ficha:has-text("Gas")'); await p.fill('#f-monto', '12500'); await foto('efectivo-formulario');
  await p.click('#formulario .primario'); await p.waitForSelector('.aviso'); await foto('efectivo');
  await p.click('.pestana:has-text("Más")'); await foto('mas');
  await ctx.close();
}
await nav.close(); console.log('Capturas en', salida);
