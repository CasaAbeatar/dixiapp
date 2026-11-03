// Capturas de Cierres de caja del facturador y de Caja (solo consulta), escala 2, telefono y escritorio. Requiere el servidor en el puerto 8100.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const tamanos = [['escritorio', 1440, 900], ['telefono', 390, 844]];
fs.mkdirSync(salida, { recursive: true });
const nav = await chromium.launch();
const entrar = async (p) => { // si la sesion de prueba sigue abierta no pide la clave
  await p.waitForSelector('.pestanas, .tecla');
  if (await p.locator('.tecla').count()) { for (const c of '1234') await p.click(`.tecla[data-valor="${c}"]`); await p.click('text=Entrar'); }
  await p.waitForSelector('.pestanas');
};
for (const [nombre, w, h] of tamanos) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'es-CR', serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errores = []; p.on('pageerror', (e) => errores.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.route('**/src/datos/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const CONFIG = { modo: 'prueba' };" }));
  await p.goto(URL); await entrar(p);
  // Para que "Hoy" tenga un turno cerrado y uno abierto: la caja de hoy de Soda se cierra con un faltante y Pollos abre la suya
  await p.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('dixiapp.prueba.v2')); const hoy = e.hoy;
    const soda = e.cajas.find((c) => c.negocioId === 'soda' && c.fecha === hoy);
    const movs = e.movimientos.filter((m) => m.cajaId === soda.id);
    const esp = soda.fondoInicial + soda.ventas.efectivo + movs.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0) - movs.filter((m) => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
    Object.assign(soda, { estado: 'cerrada', cerradaA: '14:10', cerradaPor: 'Yarixa (cajera)', esperado: esp, contado: esp - 2500 });
    e.cajas.push({ id: `caja-${e.siguiente++}`, negocioId: 'pollos', fecha: hoy, abiertaA: '10:00', abiertaPor: 'Gisela (cajera)', fondoInicial: 40000, estado: 'abierta', ventas: { efectivo: 0, tarjeta: 0, sinpe: 0, transferencia: 0 } });
    localStorage.setItem('dixiapp.prueba.v2', JSON.stringify(e));
  });
  await p.reload(); await entrar(p);
  const plano = () => p.addStyleTag({ content: '.pestanas{position:static!important} main{padding-bottom:24px!important}' });
  await p.click('.pestana:has-text("Cierres")'); await p.waitForSelector('[data-id="cierres-hoy"]');
  await p.screenshot({ path: `${salida}/cierres turnos ${nombre} barra.png` });
  await p.locator('.tn-fila').first().click(); await p.locator('.tn-fila').nth(1).click(); // abierto y cerrado de hoy
  await plano(); await p.screenshot({ path: `${salida}/cierres turnos ${nombre} detalle.png`, fullPage: true, clip: { x: 0, y: 0, width: w, height: nombre === 'telefono' ? 2100 : 1500 } });
  console.log(nombre, 'cierres errores:', errores.length ? errores.join(' | ') : 'ninguno');
  await p.reload(); await entrar(p);
  await p.click('.pestana:has-text("Caja")'); await p.waitForSelector('.titulo-seccion'); await plano();
  await p.screenshot({ path: `${salida}/caja solo consulta ${nombre}.png`, fullPage: true });
  console.log(nombre, 'botones de registrar:', await p.locator('[data-accion="abrir-form"], [data-accion="corregir"], #formulario').count(), 'errores:', errores.length ? errores.join(' | ') : 'ninguno');
  await ctx.close();
}
await nav.close();
