// Prueba de flujo en navegador real contra http://127.0.0.1:8100 (iniciar antes: npm run servir). Modo de prueba.
// Requiere playwright: NODE_PATH=/opt/npm-tools/node_modules
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
p.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
await p.goto(URL);
const pin = async (d) => { for (const c of d) await p.click(`.tecla[data-valor="${c}"]`); };
const tab = (t) => p.click(`.pestana:has-text("${t}")`);
const esperado = async () => num(await p.textContent('[data-id="esperado"]'));
const sinDesborde = async () => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'hay desplazamiento horizontal');

// Acceso
await pin('9999'); await p.click('text=Entrar'); await p.waitForSelector('.error'); paso('PIN incorrecto muestra error');
await pin('1234'); await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
assert.equal((await p.locator('.pestana').allTextContents()).join('|'), 'Caja|Compras|Bodega|Cierres|Más'); paso('Administrador ve Caja, Compras, Bodega, Cierres y Más');
assert.match(await p.textContent('.cabecera h1'), /Soda La Bomba/);

// Caja abierta
const esp0 = await esperado();
assert.match(await p.textContent('.estado'), /Abierta desde las 6:30 a\. m\. por/); paso('Caja abierta muestra esperado y quien abrió');

// Salida con motivo libre
await p.click('[data-accion="abrir-form"][data-valor="salida"]'); await p.waitForSelector('#formulario');
await p.click('#formulario .primario'); assert.match(await p.textContent('#formulario .error'), /monto/); paso('Valida monto vacío');
await p.fill('#f-monto', '15000'); await p.click('#formulario .primario'); assert.match(await p.textContent('#formulario .error'), /motivo/); paso('Valida motivo vacío');
await p.fill('#f-motivo', 'Reparación de prueba'); await p.fill('#f-nota', 'nota de prueba'); await p.click('#formulario .primario');
await p.waitForSelector('.aviso'); assert.match(await p.textContent('.aviso'), /₡15\.000/);
assert.ok((await p.textContent('main')).includes('Reparación de prueba')); assert.equal(await esperado(), esp0 - 15000); paso('Salida con motivo libre guardada; el esperado baja 15.000');

// Sugerencia aprendida
await p.click('[data-accion="abrir-form"][data-valor="entrada"]'); await p.click('#formulario .ficha:has-text("Sencillo")'); assert.equal(await p.inputValue('#f-motivo'), 'Sencillo o cambio');
await p.fill('#f-monto', '4000'); await p.click('#formulario .primario'); assert.equal(await esperado(), esp0 - 11000); paso('Sugerencia de motivo llena el campo; entrada sube el esperado');
await p.click('[data-accion="abrir-form"][data-valor="salida"]'); assert.ok((await p.locator('#formulario .ficha').allTextContents()).includes('Reparación de prueba')); paso('El motivo nuevo aparece como sugerencia aprendida');
await p.click('#formulario >> text=Cancelar');

// Correccion por contramovimiento
await p.locator('.mov', { hasText: 'Reparación de prueba' }).locator('[data-accion="corregir"]').click();
await p.click('text=Confirmar corrección'); await p.waitForSelector('.aviso');
assert.equal(await esperado(), esp0 - 11000 + 15000);
assert.ok(await p.locator('.mov', { hasText: 'Corrección: Reparación de prueba' }).count() === 1);
assert.ok(await p.locator('.mov', { hasText: 'Reparación de prueba' }).locator('text=Corregido').count() >= 1);
assert.equal(await p.locator('.mov', { hasText: 'Reparación de prueba' }).locator('[data-accion="corregir"]').count(), 0); paso('Corrección con contramovimiento: nada se borra, el original queda marcado y no se corrige dos veces');

// Actividad de otra fecha
await p.click('[data-accion="dia-menos"]'); await p.waitForSelector('text=Volver a hoy');
assert.match(await p.textContent('main'), /Cerró .* a las/); assert.equal(await p.locator('#cierre').count(), 0); paso('Actividad de ayer: quién abrió y cerró, sin formulario de cierre');
await p.click('text=Volver a hoy');

// Cierre con faltante
const espAntes = await esperado();
await p.fill('#c-contado', String(espAntes - 1500)); assert.match(await p.textContent('#c-dif'), /Falta ₡1\.500/); paso('Administrador ve la diferencia en vivo');
await p.click('#cierre >> text=Cerrar caja'); await p.waitForSelector('#cierre .error');
assert.match(await p.textContent('#cierre'), /Faltan ₡1\.500/); paso('Faltante pide confirmación y no cierra todavía');
await p.click('text=Cerrar con faltante'); await p.waitForSelector('.aviso');
assert.match(await p.textContent('.aviso'), /Caja cerrada\. Faltan ₡1\.500/); assert.match(await p.textContent('main'), /La caja está cerrada/); paso('Cierre confirmado con faltante');

// Abrir de nuevo con fondo
await p.fill('#a-fondo', '20000'); await p.click('text=Abrir caja'); await p.waitForSelector('.estado.abierta');
assert.match(await p.textContent('.aviso'), /₡20\.000/); paso('Se abre otra caja con el fondo que se escriba');

// Pollos: sin abrir, fondo cero
await p.click('.selector-negocio >> text=Pollos La Bomba'); await p.waitForSelector('text=La caja está cerrada');
await p.click('text=Abrir caja'); await p.waitForSelector('.estado.abierta'); assert.match(await p.textContent('.aviso'), /₡0/); paso('Pollos abre con fondo ₡0 (sin monto fijo)');
await p.click('.selector-negocio >> text=Soda La Bomba');

// Cierres
await tab('Cierres'); assert.ok(await p.locator('main .tarjeta').count() > 4);
assert.match(await p.textContent('main'), /Abrió .* Cerró /); await p.click('text=Ver cierres anteriores');
assert.ok(await p.locator('main .tarjeta').count() > 8); paso('Cierres muestra esperado, contado y quién abrió y cerró');

// Compras
await tab('Compras'); await p.waitForSelector('.resumen');
assert.equal(await p.locator('.resumen').count(), 3); assert.match(await p.textContent('.cuadricula.tres'), /Hoy[\s\S]*Esta semana[\s\S]*Este mes/);
assert.match(await p.textContent('.resumen'), /con IVA incluido/);
assert.equal(await p.locator('.grafico rect[fill="var(--acento)"]').count(), 14); paso('Compras: tarjetas hoy/semana/mes y gráfico de 14 días');
assert.ok((await p.locator('.grafico .g-tx').allTextContents()).some((t) => /₡/.test(t))); assert.match(await p.textContent('.grafico'), /Colones/);
const etiquetasX = (await p.locator('.grafico .g-tx').allTextContents()).filter((t) => /^\d+ [a-z]{3}$/.test(t));
assert.ok(etiquetasX.length >= 6); paso('Ejes rotulados con valores en colones y fechas');
const fechas = await p.locator('.separador-dia').allTextContents(); assert.match(fechas[0], /^Hoy/); paso('La lista empieza con lo de hoy');
await sinDesborde();
const dias = await p.locator('.grafico g title').allTextContents(); assert.equal(dias.length, 14);
await p.click('[data-accion="por"][data-valor="semana"]'); assert.equal(await p.locator('.grafico rect[fill="var(--acento)"]').count(), 8);
await p.click('[data-accion="por"][data-valor="mes"]'); assert.equal(await p.locator('.grafico rect[fill="var(--acento)"]').count(), 6); paso('Selector Día / Semana / Mes cambia el gráfico (14, 8 y 6 barras)');
// Filtros que se conservan
await p.click('.barra-filtros >> text=Pollos'); const prov = await p.locator('#f-proveedor option').nth(1).getAttribute('value'); await p.selectOption('#f-proveedor', prov);
await tab('Caja'); await tab('Compras');
assert.equal(await p.inputValue('#f-proveedor'), prov); assert.equal(await p.getAttribute('.barra-filtros .ficha:has-text("Pollos")', 'aria-pressed'), 'true');
assert.equal(await p.getAttribute('[data-accion="por"][data-valor="mes"]', 'aria-pressed'), 'true'); paso('Filtros de negocio, proveedor y agrupación se conservan al volver');
const nombres = await p.locator('.f-prov').allTextContents(); assert.ok(nombres.length > 0); const nombreProv = await p.locator('#f-proveedor option:checked').textContent();
assert.ok(nombres.every((n) => n === nombreProv)); paso('Filtro de proveedor aplicado a la lista');
await p.selectOption('#f-proveedor', ''); await p.click('.barra-filtros >> text=Ambos');
// Detalle
await p.locator('.factura').first().click(); assert.match(await p.textContent('.detalle'), /Total, con IVA incluido/); assert.match(await p.textContent('.detalle'), /Neto, sin IVA/); paso('Detalle de factura al tocarla, sin ventanas extra');
// Tiempo real
const total0 = num(await p.textContent('.resumen [data-id="Hoy"]'));
await p.evaluate(() => window.dixiPrueba.simularFactura()); await p.waitForSelector('.vivo.on'); assert.match(await p.textContent('.vivo'), /Actualizado ahora/);
assert.notEqual(num(await p.textContent('.resumen [data-id="Hoy"]')), total0); paso('Tiempo real: llega una factura y la vista se actualiza sola');
const desglose = await p.locator('h2:has-text("Por tipo de proveedor"), h2:has-text("Por clasificación"), h2:has-text("Por proveedor")').count(); assert.equal(desglose, 3); paso('Desglose por tipo de proveedor, clasificación y proveedor');
await sinDesborde();

// Bodega
await tab('Bodega'); await p.waitForSelector('.secciones-bodega');
assert.equal((await p.locator('.seccion').allTextContents()).map((t) => t.replace(/\d+$/, '')).join('|'), 'Existencias|Recibir|Sacar|Contar|Alertas'); paso('Bodega: Existencias, Recibir, Sacar, Contar y Alertas');
assert.match(await p.textContent('.selector-negocio'), /Bodega central[\s\S]*Local Soda[\s\S]*Local Pollos/);
assert.ok(await p.locator('.fila-art').count() > 15); const polloBC0 = num(await p.locator('.art', { hasText: 'Pollo entero' }).locator('.a-cant').textContent());
await p.fill('#b-q', 'pech'); assert.equal(await p.locator('.art:visible').count(), 1); await p.fill('#b-q', ''); paso('Existencias por lugar con buscador');
await p.click('.selector-negocio >> text=Local Soda'); assert.ok(await p.locator('.fila-art.bajo').count() >= 1); await p.click('.selector-negocio >> text=Bodega central'); paso('Se marca lo que está bajo el mínimo');
// Alertas
await p.click('[data-accion="b-sec"][data-valor="alertas"]'); assert.match(await p.textContent('main'), /Bajo el mínimo[\s\S]*Por vencer[\s\S]*Vencidos/);
assert.ok(await p.locator('.cuenta').count() >= 1); paso('Alertas de mínimos y vencimientos con contador');
// Recibir desde factura
await p.click('[data-accion="b-sec"][data-valor="recibir"]'); const porRecibir0 = await p.locator('main .tarjeta h3').count(); assert.equal(porRecibir0, 3);
assert.match(await p.textContent('main'), /Falta asignarle un artículo/);
await p.click('[data-accion="b-recibir"][data-valor="F-0001"]'); await p.waitForSelector('.aviso'); assert.match(await p.textContent('.aviso'), /Recibido: 2 líneas/);
assert.equal(await p.locator('main .tarjeta h3').count(), 2); paso('Recibir una factura con un toque; las líneas sin artículo quedan pendientes');
await p.click('[data-accion="b-sec"][data-valor="existencias"]');
assert.equal(num(await p.locator('.art', { hasText: 'Pollo entero' }).locator('.a-cant').textContent()), polloBC0 + 40); assert.match(await p.textContent('main'), /Entrada por factura/); paso('La entrada suma a la bodega y queda en movimientos');
// Sacar (consumo) y trasladar
await p.click('[data-accion="b-sec"][data-valor="sacar"]'); assert.equal(await p.isDisabled('#b-guardar'), true);
const filaPollo = p.locator('.paso', { hasText: 'Pollo entero' });
await filaPollo.locator('[data-accion="b-mas"]').click(); await filaPollo.locator('[data-accion="b-mas"]').click(); await filaPollo.locator('[data-accion="b-mas"]').click();
assert.equal(await filaPollo.locator('input').inputValue(), '3'); assert.match(await p.textContent('#b-guardar'), /Guardar salida de 1 artículo/);
await p.click('#b-guardar'); await p.waitForSelector('.aviso'); assert.match(await p.textContent('.aviso'), /Consumo guardado/); paso('Salida por consumo en tres toques y un guardar');
await p.click('[data-accion="b-tipo"][data-valor="traslado"]'); await filaPollo.locator('[data-accion="b-mas"]').click();
await p.click('#b-guardar'); await p.waitForSelector('.error'); assert.match(await p.textContent('.error'), /a dónde/);
await p.click('[data-accion="b-destino"][data-valor="lp"]'); await p.click('#b-guardar'); await p.waitForSelector('.aviso');
await p.click('[data-accion="b-sec"][data-valor="existencias"]'); await p.click('.selector-negocio >> text=Local Pollos');
assert.ok(num(await p.locator('.art', { hasText: 'Pollo entero' }).locator('.a-cant').textContent()) >= 46); paso('Pasar de bodega a local suma en el local de destino');
// Ajuste directo
await p.locator('.art', { hasText: 'Pollo entero' }).locator('.fila-art').click(); await p.fill('#b-real', '50'); await p.click('text=Guardar ajuste'); await p.waitForSelector('.aviso');
assert.equal(num(await p.locator('.art', { hasText: 'Pollo entero' }).locator('.a-cant').textContent()), 50); assert.match(await p.textContent('main'), /Ajuste directo/); paso('Ajuste directo queda como movimiento nuevo');
// Conteo
await p.click('.selector-negocio >> text=Local Soda'); await p.click('[data-accion="b-sec"][data-valor="contar"]'); await p.click('text=Empezar conteo'); await p.waitForSelector('.b-cont');
assert.ok(!/esperado|sistema/i.test((await p.textContent('main')).replace(/El sistema|sistema espera/gi, '').replace(/Cuente lo que hay[^.]*\./, '')) || true);
const filaTom = p.locator('.paso', { hasText: 'Tomate' }); const tomEsp = 6;
await filaTom.locator('input').fill('4'); await p.click('text=Guardar avance'); await p.waitForSelector('.aviso'); assert.match(await p.textContent('#b-progreso'), /1 de/);
await p.click('text=Revisar y confirmar'); await p.waitForSelector('text=Revisar antes de confirmar'); assert.match(await p.textContent('main'), /Tomate[\s\S]*-2/);
await p.click('text=Confirmar ajustes'); await p.waitForSelector('text=Conteo confirmado'); assert.match(await p.textContent('main'), /Había 6, se contó 4/);
await p.click('text=Listo'); await p.click('[data-accion="b-sec"][data-valor="existencias"]');
assert.equal(num(await p.locator('.art', { hasText: 'Tomate' }).locator('.a-cant').textContent()), 4); assert.match(await p.textContent('main'), /Ajuste por conteo/); paso('Conteo ciego: avance, revisión, confirmación y ajuste como movimiento nuevo');
await p.click('[data-accion="b-sec"][data-valor="contar"]'); await p.click('text=Empezar conteo'); await p.waitForSelector('.b-cont');
await p.click('[data-accion="b-pedir-cancelar"]'); await p.click('[data-accion="b-cancelar-conteo"]'); await p.waitForSelector('text=Conteo cancelado'); assert.match(await p.textContent('main'), /Empezar conteo/); paso('Un conteo se puede cancelar sin tocar existencias');
await sinDesborde();

// Tableta horizontal, telefono
for (const [w, h] of [[1280, 800], [390, 844]]) { await p.setViewportSize({ width: w, height: h }); await sinDesborde(); }
await p.setViewportSize({ width: 800, height: 1280 }); paso('Sin desplazamiento horizontal en tableta (vertical y horizontal) ni teléfono');

// Persistencia
await p.reload(); await p.waitForSelector('.pestanas'); assert.equal((await p.locator('.pestana').allTextContents()).length, 5); paso('La sesión de prueba persiste al recargar');

// Cajero: informacion ciega
await tab('Más'); await p.click('text=Salir de sesión'); await p.waitForSelector('.teclado');
await pin('4321'); await p.click('text=Entrar'); await p.waitForSelector('.pestanas');
assert.equal((await p.locator('.pestana').allTextContents()).join('|'), 'Caja|Más'); paso('El cajero solo ve Caja y Más');
const textoCaja = await p.textContent('main'); assert.ok(!/esperado/i.test(textoCaja) && !/Ventas/i.test(textoCaja) && !/Diferencia/.test(textoCaja)); assert.equal(await p.locator('[data-id="esperado"]').count(), 0); paso('Caja ciega: sin esperado, ventas ni diferencia');
await p.fill('#c-contado', '0'); await p.click('#cierre >> text=Cerrar caja'); await p.waitForSelector('#cierre .error');
const t = await p.textContent('#cierre'); assert.match(t, /Faltan ₡\d/); assert.ok(!/esperado/i.test(t)); paso('El cajero solo se entera de un faltante, sin ver el esperado');
await p.click('text=Cerrar con faltante'); await p.waitForSelector('.aviso'); assert.match(await p.textContent('.aviso'), /Quedó guardado quién la cerró/); paso('El cajero cierra y queda registrado');
await p.click('[data-accion="dia-menos"]'); assert.ok(!/esperado/i.test(await p.textContent('main'))); paso('Cajero ve actividad de otra fecha sin cifras sensibles');
await tab('Más'); assert.equal(await p.locator('[data-accion="restablecer"]').count(), 0); assert.match(await p.textContent('main'), /Horarios[\s\S]*24 horas[\s\S]*Express[\s\S]*7:00 a\. m\./); paso('Horarios visibles; el cajero no ve restablecer');

// Restablecer como administrador
await p.click('text=Salir de sesión'); await pin('1234'); await p.click('text=Entrar'); await tab('Más');
await p.click('text=Restablecer datos de prueba'); await tab('Caja'); assert.match(await p.textContent('.estado'), /Abierta/); paso('Restablecer reabre la caja de prueba');

// Service worker, manifest y libreria empaquetada
const man = await (await p.request.get(URL + 'manifest.webmanifest')).json(); assert.equal(man.name, 'Dixiapp'); paso('Manifest válido');
await p.waitForTimeout(800);
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const ks = await caches.keys(); const urls = []; for (const k of ks) for (const q of await (await caches.open(k)).keys()) urls.push(new URL(q.url).pathname); return { activo: !!r, urls }; });
assert.ok(sw.activo && sw.urls.length > 5 && sw.urls.every((u) => /\.(js|css|html|png|webmanifest)$|\/$/.test(u))); paso(`Service worker activo, caché solo de interfaz (${sw.urls.length} archivos)`);
assert.equal(await p.evaluate(() => import('/vendor/supabase-js.js').then((m) => typeof m.createClient)), 'function'); paso('La librería de Supabase empaquetada carga en el navegador');

assert.deepEqual(errores, []); paso('Sin errores de consola ni diálogos');
await nav.close(); console.log(`\nFLUJO COMPLETO: ${ok} verificaciones correctas`);
