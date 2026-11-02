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
  const a = await admin();
  assert.equal(await a.cajaActual('pollos').then((c) => c.estado), 'cerrada');
  await assert.rejects(() => a.abrirCaja('pollos', { fondoInicial: -1 }), /fondo/);
  const c = await a.abrirCaja('pollos', { fondoInicial: 0 });
  assert.equal(c.fondoInicial, 0); assert.equal(c.abiertaPor, 'Administrador de prueba');
  await assert.rejects(() => a.abrirCaja('pollos', { fondoInicial: 1000 }), /Ya hay una caja abierta/);
  const esp = (await a.cajaActual('pollos')).esperado;
  const r = await a.cerrarCaja('pollos', { contado: esp });
  assert.equal(r.diferencia, 0);
  const act = await a.actividad('pollos', '2026-11-02');
  assert.equal(act.cajas[0].cerradaPor, 'Administrador de prueba');
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

test('cierre de administrador: diferencia, cierres y semana', async () => {
  const d = await admin();
  const esperado = (await d.cajaActual('soda')).esperado;
  const r = await d.cerrarCaja('soda', { contado: esperado + 1500 });
  assert.equal(r.diferencia, 1500);
  await assert.rejects(() => d.cerrarCaja('soda', { contado: 1 }), /cerrada/);
  const { items, hayMas } = await d.cierres('soda', { limite: 3 });
  assert.equal(items.length, 3); assert.equal(hayMas, true); assert.equal(items[0].fecha, '2026-11-02');
  const sem = await d.resumenSemana('soda');
  assert.deepEqual(sem.dias.map((x) => x.fecha), ['2026-11-02']); assert.equal(sem.neto, sem.entradas - sem.salidas);
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
  assert.ok(al.bajoMinimo.length >= 2); assert.ok(al.vencenPronto.length >= 1); assert.ok(al.vencidos.length >= 1); assert.equal(al.porRecibir, 6);
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
