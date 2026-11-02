// Prueba de flujo en navegador real contra http://127.0.0.1:8100 (iniciar antes: npm run servir)
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL_APP || 'http://127.0.0.1:8100/';
const num = (t) => parseInt(t.replace(/[^\d]/g, ''), 10) * (t.includes('-') ? -1 : 1);
let ok = 0; const paso = (n) => { ok++; console.log(`  ok ${ok}. ${n}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 800, height: 1280 }, locale: 'es-CR' });
const p = await ctx.newPage(); const errores = [];
p.on('pageerror', (e) => errores.push(e.message)); p.on('dialog', (d) => { errores.push('dialogo: ' + d.message()); d.dismiss(); });
await p.goto(URL);
const pin = async (d) => { for (const c of d) await p.click(`.tecla[data-valor="${c}"]`); };

// Login
await pin('9999'); await p.click('text=Entrar'); await p.waitForSelector('.error'); paso('PIN incorrecto muestra error');
await pin('1234'); await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
assert.equal(await p.locator('.pestana').allTextContents().then((x) => x.join('|')), 'Hoy|Cierres|Efectivo|Más'); paso('Gerente entra y ve 4 pestañas con palabras');
assert.match(await p.textContent('.cabecera h1'), /Soda La Bomba/);

// Hoy
const esp0 = num(await p.textContent('[data-id="esperado"]')); assert.ok(esp0 > 0);
assert.match(await p.textContent('.estado'), /Caja abierta desde las 6:30 a\. m\./); paso('Hoy muestra esperado y caja abierta');

// Registrar salida
await p.click('.pestana:has-text("Efectivo")');
await p.click('text=Registrar salida de efectivo'); await p.waitForSelector('#formulario');
await p.click('#formulario .acciones .primario'); assert.match(await p.textContent('#formulario .error'), /monto/); paso('Formulario valida monto vacío');
await p.fill('#f-monto', '15000'); await p.click('#formulario .primario'); assert.match(await p.textContent('#formulario .error'), /motivo/);
await p.click('.ficha:has-text("Otro")'); await p.fill('#f-monto', '15000'); await p.fill('#f-otro', 'Reparación de prueba');
await p.fill('#f-nota', 'nota de prueba'); await p.click('#formulario .primario');
await p.waitForSelector('.aviso'); assert.match(await p.textContent('.aviso'), /₡15\.000/);
assert.ok((await p.textContent('main')).includes('Reparación de prueba')); paso('Salida con motivo Otro guardada y visible');
await p.click('.pestana:has-text("Hoy")');
const esp1 = num(await p.textContent('[data-id="esperado"]')); assert.equal(esp1, esp0 - 15000); paso(`Efectivo esperado bajó 15.000 (${esp0} a ${esp1})`);

// Entrada
await p.click('.pestana:has-text("Efectivo")'); await p.click('text=Registrar entrada de efectivo');
await p.fill('#f-monto', '4000'); await p.click('.ficha:has-text("Sencillo")'); await p.click('#formulario .primario');
await p.click('.pestana:has-text("Hoy")');
assert.equal(num(await p.textContent('[data-id="esperado"]')), esp1 + 4000); paso('Entrada sube el esperado');

// Persistencia al recargar
await p.reload(); await p.waitForSelector('.pestanas');
assert.equal(num(await p.textContent('[data-id="esperado"]')), esp1 + 4000); paso('Datos y sesión persisten al recargar');

// Cierre con faltante
await p.click('.pestana:has-text("Cierres")');
await p.fill('#c-contado', String(esp1 + 4000 - 1500));
assert.match(await p.textContent('#c-dif'), /Falta ₡1\.500/); paso('Diferencia en vivo: falta 1.500');
await p.click('text=Cerrar caja de hoy'); await p.waitForSelector('.insignia.falta');
assert.match(await p.textContent('main'), /Cerró Gerente de prueba/); paso('Cierre guardado con faltante en rojo');
await p.click('.pestana:has-text("Hoy")'); assert.match(await p.textContent('.estado'), /Caja cerrada a las/); paso('Hoy refleja caja cerrada');
await p.click('.pestana:has-text("Cierres")'); await p.click('text=Ver cierres anteriores');
assert.ok(await p.locator('main .tarjeta').count() > 8); paso('Ver cierres anteriores carga más');

// Cambiar negocio y salir
await p.click('.pestana:has-text("Más")'); await p.click('text=Pollos La Bomba');
assert.match(await p.textContent('.cabecera h1'), /Pollos La Bomba/); paso('Cambio de negocio');
await p.click('text=Salir de sesión'); await p.waitForSelector('.teclado'); paso('Salir de sesión');

// Empleada
await pin('4321'); await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
assert.equal(await p.locator('.pestana').allTextContents().then((x) => x.join('|')), 'Hoy|Efectivo|Más'); paso('Empleada solo ve Hoy, Efectivo, Más');
await p.click('.pestana:has-text("Efectivo")');
assert.equal(await p.locator('text=Neto de la semana').count(), 0); paso('Empleada no ve agregados de la semana');
await p.click('.pestana:has-text("Más")'); assert.equal(await p.locator('[data-accion="restablecer"]').count(), 0); paso('Empleada no ve restablecer datos');

// Restablecer como gerente
await p.click('text=Salir de sesión'); await pin('1234'); await p.click('text=Entrar'); await p.click('.pestana:has-text("Más")');
await p.click('text=Restablecer datos de prueba'); await p.click('.pestana:has-text("Hoy")');
assert.match(await p.textContent('.estado'), /Caja abierta/); paso('Restablecer reabre la caja de prueba');

// Service worker y manifest
const man = await (await p.request.get(URL + 'manifest.webmanifest')).json(); assert.equal(man.name, 'Dixiapp'); assert.equal(man.display, 'standalone'); paso('Manifest válido');
await p.waitForTimeout(800);
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const ks = await caches.keys(); const urls = []; for (const k of ks) for (const q of await (await caches.open(k)).keys()) urls.push(new URL(q.url).pathname); return { activo: !!r, urls }; });
assert.ok(sw.activo); assert.ok(sw.urls.length > 5); assert.ok(sw.urls.every((u) => /\.(js|css|html|png|webmanifest)$|\/$/.test(u))); paso(`Service worker activo, caché solo de interfaz (${sw.urls.length} archivos)`);

assert.deepEqual(errores, []); paso('Sin errores de consola ni diálogos');
await nav.close(); console.log(`\nFLUJO COMPLETO: ${ok} verificaciones correctas`);
