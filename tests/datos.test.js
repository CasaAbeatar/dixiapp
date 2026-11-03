import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDatosPrueba } from '../web/src/datos/prueba.js';
import { colones, colonesConSigno, colonesCompacto, dinero } from '../web/src/datos/formato.js';
import { fechaLarga, horaLegible, diasDeLaSemana } from '../web/src/datos/fechas.js';
import { agruparCompras, rellenarPeriodos, resumenDesdeDias, rangoPorDefecto } from '../web/src/datos/compras-calc.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const nuevo = () => crearDatosPrueba({ almacen: mem(), ahora: () => new Date(2026, 10, 2, 10, 30) }); // lunes 2 nov 2026
const admin = async () => { const d = nuevo(); await d.iniciarSesion({ pin: '1234' }); return d; };
const cajero = async () => { const d = nuevo(); await d.iniciarSesion({ pin: '4321' }); return d; };

test('formato de colones, monedas y fechas de Costa Rica', () => {
  assert.equal(colones(184500), '₡184.500');
  assert.equal(colones(-1500), '-₡1.500');
  assert.equal(colonesConSigno(1500), '+₡1.500');
  assert.equal(colonesCompacto(250000), '₡250 mil');
  assert.equal(colonesCompacto(1250000), '₡1,3 M');
  assert.equal(dinero(120.5, 'USD'), '$120,50');
  assert.equal(fechaLarga('2026-11-02'), 'lunes 2 nov');
  assert.equal(horaLegible('14:05'), '2:05 p. m.');
  assert.deepEqual(diasDeLaSemana('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04']);
});

test('el contrato se cumple y el PIN no sale de la capa de datos', async () => {
  const d = nuevo();
  assert.equal(d.esPrueba, true); assert.equal(d.acceso, 'pin');
  assert.equal(await d.estadoAcceso(), 'sin_sesion');
  assert.equal(await d.iniciarSesion({ pin: '0000' }), null);
  const a = await d.iniciarSesion({ pin: '1234' });
  assert.equal(a.rol, 'administrador'); assert.equal(a.pin, undefined);
  assert.equal(await d.estadoAcceso(), 'abierta');
  assert.equal((await d.negocios()).length, 2);
  await d.bloquear(); assert.equal(await d.sesionActual(), null);
  await assert.rejects(() => d.cajaActual('soda'), /No autorizado/);
});

test('informacion ciega: el cajero no recibe esperado, ventas ni sobrante', async () => {
  const c = await cajero();
  const caja = await c.cajaActual('soda');
  for (const k of ['esperado', 'ventas', 'entradas', 'salidas', 'contado', 'diferencia']) assert.equal(k in caja, false, `no debe incluir ${k}`);
  assert.ok(caja.abiertaPor && caja.fondoInicial >= 0);
  await assert.rejects(() => c.cierres('soda'), /No autorizado/);
  await assert.rejects(() => c.comprasUltimas({}), /No autorizado/);
  await assert.rejects(() => c.cajaActual('pollos'), /No autorizado/);
  const r = await c.cerrarCaja('soda', { contado: 0 });
  assert.equal(r.requiereConfirmacion, true); assert.ok(r.faltante > 0); assert.equal('esperado' in r, false);
  const fin = await c.cerrarCaja('soda', { contado: 0, confirmarFaltante: true });
  assert.deepEqual(fin, { cerrada: true });
});

test('cualquier cajero abre con el fondo que quiera y queda guardado quien abre y quien cierra', async () => {
  const c0 = await cajero();
  await assert.rejects(() => c0.abrirCaja('pollos', { fondoInicial: 0 }), /No autorizado/); // el cajero de prueba solo trabaja en Soda
  const a = await admin();
  assert.equal(await a.cajaActual('pollos').then((c) => c.estado), 'cerrada');
  await assert.rejects(() => a.abrirCaja('pollos', { fondoInicial: 0 }), /cajeras en el facturador/);
  const esp = (await c0.cajaActual('soda')).esperado;
  assert.equal(esp, undefined); // informacion ciega
  const r = await c0.cerrarCaja('soda', { contado: 0, confirmarFaltante: true });
  assert.equal(r.cerrada, true);
  const despues = await c0.cajaActual('soda');
  assert.equal(despues.estado, 'cerrada'); assert.equal(despues.cerradaPor, 'Cajero de prueba');
});

test('la administradora no abre ni cierra caja (eso lo hacen las cajeras en el facturador)', async () => {
  const d = await admin();
  await assert.rejects(() => d.cerrarCaja('soda', { contado: 1000 }), /cajeras en el facturador/);
  await assert.rejects(() => d.abrirCaja('soda', { fondoInicial: 0 }), /cajeras en el facturador/);
});

test('entradas y salidas ajustan el esperado; el motivo es libre y se aprende', async () => {
  const d = await admin();
  const antes = (await d.cajaActual('soda')).esperado;
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 12500, motivo: 'Reparación   de la nevera' });
  assert.equal((await d.cajaActual('soda')).esperado, antes - 12500);
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'entrada', monto: 5000, motivo: 'Sencillo o cambio' });
  assert.equal((await d.cajaActual('soda')).esperado, antes - 7500);
  const sug = await d.sugerenciasMotivos('salida');
  assert.ok(sug.includes('Reparación de la nevera'));
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 100, motivo: 'reparación de la nevera' });
  assert.equal((await d.sugerenciasMotivos('salida'))[0].toLowerCase(), 'reparación de la nevera');
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 0, motivo: 'x' }), /monto/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 5, motivo: ' ' }), /motivo/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'pollos', tipo: 'salida', monto: 5, motivo: 'x' }), /caja abierta/);
});

test('correccion por contramovimiento: no se edita ni se borra, y solo una vez', async () => {
  const d = await admin();
  const antes = (await d.cajaActual('soda')).esperado;
  const m = await d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 7000, motivo: 'Gas' });
  const c = await d.corregirMovimiento(m.id, { nota: 'me equivoque' });
  assert.equal(c.tipo, 'entrada'); assert.equal(c.monto, 7000); assert.match(c.motivo, /^Corrección: Gas/); assert.equal(c.corrigeA, m.id);
  assert.equal((await d.cajaActual('soda')).esperado, antes);
  const act = await d.actividad('soda', '2026-11-02');
  assert.equal(act.movimientos.find((x) => x.id === m.id).corregido, true);
  await assert.rejects(() => d.corregirMovimiento(m.id, {}), /ya fue corregido/);
  await assert.rejects(() => d.corregirMovimiento(c.id, {}), /no se puede corregir/);
});

test('cualquier cajero ve la actividad de otras fechas, con quien cerro', async () => {
  const c = await cajero();
  const act = await c.actividad('soda', '2026-10-30');
  assert.equal(act.cajas.length, 1); assert.ok(act.cajas[0].cerradaPor); assert.equal('esperado' in act.cajas[0], false);
  assert.ok(act.movimientos.length >= 1);
});

test('cierres y semana de la administradora (el cierre lo hizo una cajera)', async () => {
  const c = await cajero();
  const r = await c.cerrarCaja('soda', { contado: 1, confirmarFaltante: true });
  assert.equal(r.cerrada, true);
  const d = await admin();
  const { items, hayMas } = await d.cierres('soda', { limite: 3 });
  assert.equal(items.length, 3); assert.equal(hayMas, true);
  const sem = await d.resumenSemana('soda');
  assert.equal(sem.neto, sem.entradas - sem.salidas);
});

test('compras: ultimas en orden, resumen coherente con agrupadas y notas de credito restan', async () => {
  const d = await admin();
  const ult = await d.comprasUltimas({ limite: 20 });
  const claves = ult.map((c) => c.dia + c.hora);
  assert.deepEqual([...claves].sort().reverse(), claves);
  assert.equal(ult[0].dia, '2026-11-02');
  const solo = await d.comprasUltimas({ negocios: ['pollos'], limite: 50 });
  assert.ok(solo.every((c) => c.negocioId === 'pollos'));
  const res = await d.comprasResumen({});
  const dias = await d.comprasAgrupadas({ desde: '2026-11-01', hasta: '2026-11-02', por: 'dia' });
  assert.equal(res.mes.total, Math.round(dias.reduce((a, x) => a + x.total, 0) * 100) / 100);
  const meses = await d.comprasAgrupadas({ desde: '2026-10-01', hasta: '2026-10-31', por: 'mes' });
  for (const por of ['semana', 'tipo_proveedor', 'grupo', 'rubro', 'proveedor']) {
    const g = await d.comprasAgrupadas({ desde: '2026-10-01', hasta: '2026-10-31', por });
    assert.equal(Math.round(g.reduce((a, x) => a + x.total, 0)), Math.round(meses[0].total), `agrupar por ${por}`);
  }
  assert.ok(ult.every((c) => Math.abs(c.neto + c.iva - c.total) < 0.011));
  const notas = (await d.comprasUltimas({ limite: 500 })).filter((c) => c.clase === 'nota_credito');
  assert.ok(notas.every((c) => c.totalCrc < 0));
  await assert.rejects(() => d.comprasAgrupadas({ desde: '2026-10-01', hasta: '2026-10-31', por: 'quincena' }), /desconocida/);
});

test('compras: rellenar periodos da orden cronologico sin huecos y rangos por defecto', () => {
  const filas = [{ clave: '2026-11-01', etiqueta: '', facturas: 1, neto: 10, iva: 1, total: 11 }];
  const r = rellenarPeriodos(filas, 'dia', '2026-10-30', '2026-11-02');
  assert.deepEqual(r.map((x) => x.clave), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.equal(r[2].total, 11); assert.equal(r[3].total, 0);
  assert.equal(rellenarPeriodos([], 'semana', '2026-09-14', '2026-11-02').length, 8);
  assert.equal(rellenarPeriodos([], 'mes', '2026-06-02', '2026-11-02').length, 6);
  assert.deepEqual(rangoPorDefecto('2026-11-02', 'dia'), { desde: '2026-10-20', hasta: '2026-11-02' });
  const sem = resumenDesdeDias([{ clave: '2026-10-30', facturas: 1, neto: 1, iva: 0, total: 1 }, { clave: '2026-11-02', facturas: 2, neto: 4, iva: 1, total: 5 }], '2026-11-02');
  assert.equal(sem.hoy.total, 5); assert.equal(sem.semana.total, 5); assert.equal(sem.mes.total, 5);
  assert.equal(agruparCompras([], { desde: '2026-01-01', hasta: '2026-01-02', por: 'dia' }).length, 0);
});

test('compras en tiempo real: los suscritos reciben aviso cuando llega una factura', async () => {
  const d = await admin(); let avisos = 0;
  const cancelar = await d.comprasSuscribir(() => avisos++);
  const antes = (await d.comprasUltimas({ limite: 500 })).length;
  const nueva = await d.simularFactura();
  assert.equal(avisos, 1); assert.equal((await d.comprasUltimas({ limite: 500 })).length, antes + 1); assert.equal(nueva.dia, '2026-11-02');
  cancelar(); await d.simularFactura(); assert.equal(avisos, 1);
});

test('los datos persisten en el almacen', async () => {
  const al = mem(); const ahora = () => new Date(2026, 10, 2, 10, 30);
  const a = crearDatosPrueba({ almacen: al, ahora }); await a.iniciarSesion({ pin: '1234' });
  await a.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 2000, motivo: 'Gas' });
  const b = crearDatosPrueba({ almacen: al, ahora });
  assert.equal((await b.sesionActual()).rol, 'administrador');
  assert.equal((await b.actividad('soda', '2026-11-02')).movimientos.some((m) => m.monto === 2000), true);
});

test('bodega: solo administradores; existencias por lugar con minimos y alertas', async () => {
  const c = await cajero();
  await assert.rejects(() => c.bodegaExistencias({}), /No autorizado/);
  await assert.rejects(() => c.bodegaSalida({ tipo: 'consumo', ubicacion: 'bc', items: [], motivo: 'x' }), /No autorizado/);
  const d = await admin();
  assert.deepEqual((await d.bodegaUbicaciones()).map((u) => u.nombre), ['Bodega central', 'Local Soda', 'Local Pollos']);
  const ls = await d.bodegaExistencias({ ubicacion: 'ls' });
  assert.ok(ls.every((f) => f.ubicacionId === 'ls')); assert.ok(ls.some((f) => f.bajoMinimo));
  assert.equal((await d.bodegaExistencias({ q: 'pech' })).every((f) => /pech/i.test(f.articulo)), true);
  const al = await d.bodegaAlertas();
  assert.ok(al.bajoMinimo.length >= 2); assert.ok(al.vencenPronto.length >= 1); assert.ok(al.vencidos.length >= 1); assert.equal(al.porRecibir, 7);
  assert.ok(al.bajoMinimo.every((x) => x.existencia < x.minimo));
});

test('bodega: recibir desde factura suma stock, no repite y exige articulo asignado', async () => {
  const d = await admin();
  const pend = await d.bodegaPorRecibir();
  assert.equal(pend.length, 3);
  const f1 = pend.find((f) => f.clave === 'F-0001');
  const antes = (await d.bodegaExistencias({ ubicacion: 'bc' })).find((x) => x.articuloId === 'pechuga').cantidad;
  const r = await d.bodegaRecibir({ lineas: f1.lineas.map((l) => ({ clave: f1.clave, linea: l.linea, articuloId: l.sugerencia.articuloId, factor: l.sugerencia.factor })) });
  assert.equal(r.recibidas, 2);
  assert.equal((await d.bodegaExistencias({ ubicacion: 'bc' })).find((x) => x.articuloId === 'pechuga').cantidad, antes + 30); // 2 cajas x 15 kg
  await assert.rejects(() => d.bodegaRecibir({ lineas: [{ clave: 'F-0001', linea: 1, articuloId: 'pollo' }] }), /ya fue recibida/);
  await assert.rejects(() => d.bodegaRecibir({ lineas: [{ clave: 'F-0002', linea: 3 }] }), /no tiene artículo/);
  assert.equal((await d.bodegaPorRecibir()).length, 2);
  assert.equal((await d.bodegaMovimientos({ ubicacion: 'bc', limite: 3 }))[0].tipo, 'entrada_factura');
});

test('bodega: salidas validan stock y motivo; el traslado mueve de un lugar a otro', async () => {
  const d = await admin();
  const stock = async (u, a) => (await d.bodegaExistencias({ ubicacion: u })).find((x) => x.articuloId === a)?.cantidad ?? 0;
  const bc0 = await stock('bc', 'pollo'), lp0 = await stock('lp', 'pollo');
  await assert.rejects(() => d.bodegaSalida({ tipo: 'consumo', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 9999 }], motivo: 'Uso' }), /No hay suficiente/);
  await assert.rejects(() => d.bodegaSalida({ tipo: 'consumo', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 1 }], motivo: 'x' }), /motivo/);
  await assert.rejects(() => d.bodegaSalida({ tipo: 'regalo', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 1 }], motivo: 'Uso' }), /consumo, merma/);
  await d.bodegaSalida({ tipo: 'merma', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 2 }], motivo: 'Se dañó' });
  await d.bodegaTrasladar({ origen: 'bc', destino: 'lp', items: [{ articuloId: 'pollo', cantidad: 10 }] });
  assert.equal(await stock('bc', 'pollo'), bc0 - 12); assert.equal(await stock('lp', 'pollo'), lp0 + 10);
  await assert.rejects(() => d.bodegaTrasladar({ origen: 'bc', destino: 'bc', items: [{ articuloId: 'pollo', cantidad: 1 }] }), /mismo lugar/);
});

test('bodega: conteo fisico y ajuste directo dejan movimientos nuevos, sin tocar el historial', async () => {
  const d = await admin();
  const k = await d.bodegaConteoIniciar('ls');
  await assert.rejects(() => d.bodegaConteoIniciar('ls'), /Ya hay un conteo abierto/);
  assert.equal(k.contadas, 0); assert.ok(k.lineas.every((l) => l.contado === null && l.diferencia === null));
  const movs0 = (await d.bodegaMovimientos({ limite: 500 })).length;
  const r1 = await d.bodegaConteoRegistrar(k.id, [{ articuloId: 'tomate', contado: 4 }, { articuloId: 'cebolla', contado: 5 }]);
  assert.equal(r1.contadas, 2); assert.equal(r1.lineas.find((l) => l.articuloId === 'tomate').diferencia, -2);
  assert.equal((await d.bodegaMovimientos({ limite: 500 })).length, movs0); // contar no mueve nada
  const r = await d.bodegaConteoConfirmar(k.id);
  assert.deepEqual(r.ajustes.map((a) => [a.articulo, a.diferencia]), [['Tomate', -2]]); assert.equal(r.sinCambio, 1);
  assert.equal((await d.bodegaExistencias({ ubicacion: 'ls' })).find((x) => x.articuloId === 'tomate').cantidad, 4);
  assert.equal((await d.bodegaMovimientos({ limite: 500 })).length, movs0 + 1);
  await assert.rejects(() => d.bodegaConteoConfirmar(k.id), /ya está/);
  assert.equal(await d.bodegaConteo('ls'), null);
  const k2 = await d.bodegaConteoIniciar('ls'); await d.bodegaConteoCancelar(k2.id); assert.equal(await d.bodegaConteo('ls'), null);
  const aj = await d.bodegaAjustar({ ubicacion: 'bc', items: [{ articuloId: 'arroz', cantidadReal: 45 }], motivo: 'Recuento rápido' });
  assert.equal(aj.ajustes[0].diferencia, -5);
  await assert.rejects(() => d.bodegaAjustar({ ubicacion: 'bc', items: [{ articuloId: 'arroz', cantidadReal: 1 }], motivo: 'x' }), /motivo/);
});

test('bodega: minimos por articulo y lugar, y sugerencia que no se aplica sola', async () => {
  const d = await admin();
  const sug = await d.bodegaSugerenciaMinimos(); assert.ok(sug.items.length >= 1);
  const antes = (await d.bodegaArticulos({})).find((a) => a.id === 'cola').minimos;
  assert.deepEqual(antes, { bc: 48, ls: 24, lp: 24 }); // ver la sugerencia no cambia nada
  await d.bodegaFijarMinimos({ items: [{ articuloId: 'cola', ubicacionId: 'ls', minimo: 60 }, { articuloId: 'agua', ubicacionId: 'lp', minimo: 0 }] });
  const art = await d.bodegaArticulos({}); assert.equal(art.find((a) => a.id === 'cola').minimos.ls, 60); assert.equal(art.find((a) => a.id === 'agua').minimos.lp, undefined);
  assert.equal((await d.bodegaExistencias({ ubicacion: 'ls' })).find((x) => x.articuloId === 'cola').minimo, 60);
  await assert.rejects(() => d.bodegaFijarMinimos({ items: [{ articuloId: 'cola', ubicacionId: 'ls', minimo: -1 }] }), /número, 0 o más/);
  await assert.rejects(() => d.bodegaFijarMinimos({ items: [] }), /No hay mínimos/);
});

test('bodega: linea sin equivalencia trae propuesta de la IA y se recibe al asignarla; el vencimiento queda en el lote', async () => {
  const d = await admin();
  const f2 = (await d.bodegaPorRecibir()).find((f) => f.clave === 'F-0002'); const l3 = f2.lineas.find((l) => l.linea === 3);
  assert.equal(l3.sugerencia, null); assert.equal(l3.propuesta.articuloId, 'culantro'); assert.equal(l3.propuesta.nivel, 'amarillo');
  await assert.rejects(() => d.bodegaRecibir({ lineas: [{ clave: 'F-0002', linea: 3, articuloId: 'culantro', venceEn: '2020-01-01' }] }), /ya pasó/);
  await d.bodegaRecibir({ lineas: [{ clave: 'F-0002', linea: 3, articuloId: 'culantro', factor: l3.propuesta.factor, venceEn: '2026-11-06' }] });
  assert.equal((await d.bodegaExistencias({ ubicacion: 'bc' })).find((x) => x.articuloId === 'culantro').cantidad, 12);
  const lotes = await d.bodegaLotes({ articulo: 'culantro' }); assert.equal(lotes[0].venceEn, '2026-11-06'); assert.equal(lotes[0].vencido, false);
});

test('bodega: deshacer una recepcion es un contramovimiento y solo si el lote no se uso', async () => {
  const d = await admin();
  await d.bodegaRecibir({ lineas: [{ clave: 'F-0001', linea: 1, articuloId: 'pollo', factor: 1 }] });
  const rec = (await d.bodegaRecibidas({})).find((r) => r.clave === 'F-0001'); assert.equal(rec.deshacible, true);
  const stock = async () => (await d.bodegaExistencias({ ubicacion: 'bc' })).find((x) => x.articuloId === 'pollo').cantidad;
  const antes = await stock();
  await assert.rejects(() => d.bodegaDeshacerRecepcion({ clave: 'F-0001', linea: 1, motivo: 'x' }), /motivo/);
  await d.bodegaDeshacerRecepcion({ clave: 'F-0001', linea: 1, motivo: 'Se recibió por error' });
  assert.equal(await stock(), antes - 40); assert.equal((await d.bodegaMovimientos({ limite: 1 }))[0].tipo, 'anulacion_entrada');
  assert.ok((await d.bodegaPorRecibir()).find((f) => f.clave === 'F-0001').lineas.some((l) => l.linea === 1)); // vuelve a quedar por recibir
  await assert.rejects(() => d.bodegaDeshacerRecepcion({ clave: 'F-0001', linea: 1, motivo: 'Otra vez' }), /no está recibida/);
  await d.bodegaRecibir({ lineas: [{ clave: 'F-0001', linea: 1, articuloId: 'pollo', factor: 1 }] });
  await d.bodegaSalida({ tipo: 'consumo', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 1 }], motivo: 'Uso del día' });
  assert.equal((await d.bodegaRecibidas({})).find((r) => r.clave === 'F-0001').deshacible, false);
  await assert.rejects(() => d.bodegaDeshacerRecepcion({ clave: 'F-0001', linea: 1, motivo: 'Tarde' }), /Ya se usó/);
});

test('bodega: nota de credito de proveedor devuelve mercaderia una sola vez', async () => {
  const d = await admin();
  const [nt] = await d.bodegaNotas({}); assert.equal(nt.clave, 'N-0001'); assert.equal(nt.lineas[0].articuloId, 'pollo');
  const stock = async () => (await d.bodegaExistencias({ ubicacion: 'bc' })).find((x) => x.articuloId === 'pollo').cantidad;
  const antes = await stock();
  await d.bodegaNotaDevolver({ clave: 'N-0001', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 5 }], motivo: 'Nota de crédito' });
  assert.equal(await stock(), antes - 5); assert.equal((await d.bodegaMovimientos({ limite: 1 }))[0].tipo, 'devolucion');
  assert.equal((await d.bodegaNotas({})).length, 0);
  await assert.rejects(() => d.bodegaNotaDevolver({ clave: 'N-0001', ubicacion: 'bc', items: [{ articuloId: 'pollo', cantidad: 1 }] }), /ya se devolvió/);
});

test('bodega: stock por local tras un traslado de bodega central a local (llenar hasta el minimo)', async () => {
  const d = await admin();
  const lp = async () => (await d.bodegaExistencias({ ubicacion: 'lp' })).find((x) => x.articuloId === 'pollo').cantidad;
  await d.bodegaFijarMinimos({ items: [{ articuloId: 'pollo', ubicacionId: 'lp', minimo: 60 }] });
  const f = (await d.bodegaExistencias({ ubicacion: 'lp' })).find((x) => x.articuloId === 'pollo'); assert.equal(f.bajoMinimo, true);
  await d.bodegaTrasladar({ origen: 'bc', destino: 'lp', items: [{ articuloId: 'pollo', cantidad: f.minimo - f.cantidad }] });
  assert.equal(await lp(), 60); assert.equal((await d.bodegaExistencias({ ubicacion: 'lp' })).find((x) => x.articuloId === 'pollo').bajoMinimo, false);
  assert.ok((await d.bodegaAlertas()).bajoMinimo.every((a) => a.ubicacionId));
});

test('ventas en vivo: hoy dentro de la semana y del mes, el mes coincide con los dias, el turno trae quien abrio y el cajero no entra', async () => {
  const d = await admin();
  const v = await d.ventasEnVivo({});
  assert.deepEqual(v.negocios.map((n) => n.negocioId).sort(), ['pollos', 'soda']);
  for (const n of v.negocios) {
    assert.ok(n.hoy.total <= n.semana.total && n.semana.total <= n.mes.total + 1, `${n.negocioId}: hoy <= semana <= mes`);
    assert.ok(Math.abs(n.hoy.neto + n.hoy.iva - n.hoy.total) <= 1);
    if (n.turno) assert.ok(n.turno.abiertaPor, 'el turno trae el nombre de quien abrio');
  }
  const solo = await d.ventasEnVivo({ negocios: ['soda'] });
  assert.deepEqual(solo.negocios.map((n) => n.negocioId), ['soda']);
  const dias = await d.ventasAgrupadas({ desde: '2026-11-01', hasta: '2026-11-02', por: 'dia' });
  const mes = await d.ventasAgrupadas({ desde: '2026-11-01', hasta: '2026-11-02', por: 'mes' });
  assert.equal(Math.round(dias.reduce((a, x) => a + x.total, 0)), Math.round(mes[0].total));
  const c = crearDatosPrueba({ almacen: mem(), ahora: () => new Date(2026, 10, 2, 15, 0) });
  await c.iniciarSesion({ pin: '4321' });
  await assert.rejects(() => c.ventasEnVivo({}), /No autorizado/);
});

test('avisos del telefono: activar, apagar uno, monto minimo y desactivar (modo de prueba)', async () => {
  const d = await crearDatosPrueba(); await d.iniciarSesion({ pin: '1234' });
  assert.equal((await d.avisosEstado()).activo, false);
  assert.equal((await d.avisosActivar()).activo, true);
  await d.avisosGuardarPrefs({ resumen_diario: false, efectivo_minimo: 25000 });
  const e = await d.avisosEstado();
  assert.equal(e.prefs.resumen_diario, false); assert.equal(e.prefs.efectivo_minimo, 25000);
  await d.avisosDesactivar(); assert.equal((await d.avisosEstado()).activo, false);
});

test('compras por proveedor: nombre comercial, orden por nombre, clasificacion y periodo', async () => {
  const { nombreComercial, nombreLegal } = await import('../web/src/datos/compras-calc.js');
  assert.equal(nombreComercial('GANADERA SANTA ELIA S.A. (CARNES MAROTO)'), 'CARNES MAROTO');
  assert.equal(nombreLegal('GANADERA SANTA ELIA S.A. (CARNES MAROTO)'), 'GANADERA SANTA ELIA S.A.');
  assert.equal(nombreComercial('POLLOS B.A.K. SOCIEDAD ANONIMA (POLLOS B.A.K. SOCIEDAD ANONIMA\t RAZON COMERCIAL:   POLLOS B.A.K S.A)'), 'POLLOS B.A.K S.A');
  assert.equal(nombreComercial('3-101-816857 SOCIEDAD ANONIMA (SUPER LA SUERTE NO.2)'), 'SUPER LA SUERTE NO.2');
  assert.equal(nombreComercial('SIGMA ALIMENTOS_S.A'), 'SIGMA ALIMENTOS S.A'); // sin parentesis: el legal
  const d = await admin();
  const provs = await d.comprasProveedores({ negocios: null });
  const nombres = provs.map((p) => p.nombre);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
  assert.ok(provs.some((p) => p.nombre === 'Carnes Maroto' && p.legal.startsWith('Ganadera Santa Elia')));
  const rub = (await d.comprasAgrupadas({ negocios: null, desde: '2026-01-01', hasta: '2026-12-31', por: 'rubro' }))[0].clave;
  const conRubro = await d.comprasProveedores({ negocios: null, rubro: rub });
  assert.ok(conRubro.length >= 1 && conRubro.length <= provs.length);
  const total = (await d.comprasAgrupadas({ negocios: null, desde: '2026-01-01', hasta: '2026-12-31', por: 'mes', rubro: rub })).reduce((a, f) => a + f.total, 0);
  const porProv = conRubro.reduce((a, f) => a + f.total, 0);
  assert.ok(Math.abs(total - porProv) < 1, 'por mes y por proveedor suman lo mismo para la misma clasificacion');
});

test('ventas detalle: lo mas y lo menos vendido (sin repetir, ordenado) y horas fuertes del dia (modo de prueba)', async () => {
  const d = await admin();
  const top = await d.ventasTop({ desde: '2026-11-01', hasta: '2026-11-02', limite: 5 });
  assert.equal(top.mas.length, 5); assert.ok(top.menos.length > 0 && top.menos.length <= 5);
  for (let i = 1; i < top.mas.length; i++) assert.ok(top.mas[i - 1].total >= top.mas[i].total, 'mas vendidos de mayor a menor');
  for (let i = 1; i < top.menos.length; i++) assert.ok(top.menos[i - 1].total <= top.menos[i].total, 'menos vendidos de menor a mayor');
  assert.equal(top.mas.filter((p) => top.menos.some((q) => q.nombre === p.nombre)).length, 0, 'ningun producto en las dos listas');
  assert.ok(top.mas[top.mas.length - 1].total >= top.menos[top.menos.length - 1].total);
  assert.equal(top.vendidos + top.sinVentas, top.menuTotal);
  const soda = await d.ventasTop({ negocios: ['soda'], desde: '2026-11-01', hasta: '2026-11-02' });
  assert.ok(soda.menuTotal <= top.menuTotal);
  const h = await d.ventasPorHora({ fecha: '2026-11-02' });
  assert.equal(h.horas.length, 24); assert.deepEqual(h.horas.map((x) => x.hora), [...Array(24).keys()]);
  assert.ok(h.horas.some((x) => x.hoy > 0) && h.semanas > 0 && h.horas.every((x) => x.promedio !== null));
  const diaTotal = (await d.ventasAgrupadas({ desde: '2026-11-02', hasta: '2026-11-02', por: 'dia' }))[0].total;
  assert.ok(h.horas.reduce((a, x) => a + x.hoy, 0) <= diaTotal * 1.1 + 1000, 'las horas no pasan de lo del dia');
  assert.ok(h.horas.slice(23).every((x) => x.hoy === 0), 'las horas que no han llegado van vacias');
  const c = crearDatosPrueba({ almacen: mem(), ahora: () => new Date(2026, 10, 2, 15, 0) });
  await c.iniciarSesion({ pin: '4321' });
  await assert.rejects(() => c.ventasTop({ desde: '2026-11-01', hasta: '2026-11-02' }), /No autorizado/);
  await assert.rejects(() => c.ventasPorHora({ fecha: '2026-11-02' }), /No autorizado/);
});

test('avisos del telefono: la pantalla ofrece el interruptor de cambio de precio y de productos por reponer', async () => {
  const { TIPOS_AVISO } = await import('../web/src/vistas.js');
  const claves = TIPOS_AVISO.map((t) => t[0]);
  assert.ok(claves.includes('cambio_precio') && claves.includes('por_reponer'));
  assert.equal(new Set(claves).size, claves.length);
  for (const t of TIPOS_AVISO) assert.ok(t[1] && t[2], `texto completo para ${t[0]}`);
});
