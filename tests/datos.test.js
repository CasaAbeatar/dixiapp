import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDatosPrueba } from '../web/src/datos/prueba.js';
import { crearDatosSupabase } from '../web/src/datos/supabase.js';
import { colones, colonesConSigno } from '../web/src/datos/formato.js';
import { fechaLarga, horaLegible, diasDeLaSemana } from '../web/src/datos/fechas.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const nuevo = () => crearDatosPrueba({ almacen: mem(), ahora: () => new Date(2026, 10, 2, 10, 30) }); // lunes 2 nov 2026

test('formato de colones y fechas de Costa Rica', () => {
  assert.equal(colones(184500), '₡184.500');
  assert.equal(colones(0), '₡0');
  assert.equal(colones(-1500), '-₡1.500');
  assert.equal(colonesConSigno(1500), '+₡1.500');
  assert.equal(fechaLarga('2026-11-02'), 'lunes 2 nov');
  assert.equal(horaLegible('14:05'), '2:05 p. m.');
  assert.equal(horaLegible('06:30'), '6:30 a. m.');
  assert.deepEqual(diasDeLaSemana('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04']);
});

test('login con PIN y roles', async () => {
  const d = nuevo();
  assert.equal(await d.iniciarSesion('0000'), null);
  assert.equal(await d.iniciarSesion('12'), null);
  const g = await d.iniciarSesion('1234');
  assert.equal(g.rol, 'gerente'); assert.equal(g.pin, undefined);
  assert.equal((await d.negocios()).length, 2);
  await d.cerrarSesion();
  const e = await d.iniciarSesion('4321');
  assert.equal(e.rol, 'empleada'); assert.equal((await d.negocios()).length, 1);
  await assert.rejects(() => d.cierres('soda'), /No autorizado/);
  await assert.rejects(() => d.cajaDeHoy('pollos'), /No autorizado/);
  await assert.rejects(() => d.movimientos('soda', '2026-11-01'), /No autorizado/);
});

test('sin sesion no hay acceso', async () => {
  const d = nuevo();
  await assert.rejects(() => d.cajaDeHoy('soda'), /No autorizado/);
});

test('registrar salida baja el efectivo esperado y entrada lo sube', async () => {
  const d = nuevo(); await d.iniciarSesion('1234');
  const antes = (await d.cajaDeHoy('soda')).esperado;
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 12500, motivo: 'Gas' });
  assert.equal((await d.cajaDeHoy('soda')).esperado, antes - 12500);
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'entrada', monto: 5000, motivo: 'Sencillo o cambio' });
  assert.equal((await d.cajaDeHoy('soda')).esperado, antes - 7500);
  assert.equal((await d.cajaDeHoy('pollos')).esperado > 0, true);
});

test('validaciones de movimiento', async () => {
  const d = nuevo(); await d.iniciarSesion('4321');
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 0, motivo: 'Gas' }), /monto/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 100.5, motivo: 'Gas' }), /monto/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 100, motivo: ' ' }), /motivo/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'otro', monto: 100, motivo: 'x' }), /Tipo/);
});

test('cierre de caja: diferencia, estado y bloqueo posterior', async () => {
  const d = nuevo(); await d.iniciarSesion('1234');
  const esperado = (await d.cajaDeHoy('soda')).esperado;
  const c = await d.cerrarCaja('soda', { contado: esperado - 1500, tarjeta: 100000, sinpe: 40000 });
  assert.equal(c.diferencia, -1500); assert.equal(c.esperado, esperado); assert.equal(c.cerradoPor, 'Gerente de prueba');
  const caja = await d.cajaDeHoy('soda');
  assert.equal(caja.estado, 'cerrada');
  const { items } = await d.cierres('soda', { limite: 3 });
  assert.equal(items[0].fecha, '2026-11-02'); assert.equal(items.length, 3);
  await assert.rejects(() => d.cerrarCaja('soda', { contado: 1, tarjeta: 0, sinpe: 0 }), /cerrada/);
  await assert.rejects(() => d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 1000, motivo: 'Gas' }), /cerrada/);
});

test('resumen de la semana en orden cronologico y neto correcto', async () => {
  const d = nuevo(); await d.iniciarSesion('1234');
  await d.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 3000, motivo: 'Gas' });
  const r = await d.resumenSemana('soda');
  assert.deepEqual(r.dias.map((x) => x.fecha), ['2026-11-02']);
  assert.equal(r.neto, r.entradas - r.salidas);
});

test('la implementacion de Supabase cumple el contrato pero esta vacia', async () => {
  const s = crearDatosSupabase();
  await assert.rejects(() => s.cajaDeHoy('soda'), /Supabase aun no esta conectado/);
});

test('los datos persisten en el almacen', async () => {
  const al = mem(); const ahora = () => new Date(2026, 10, 2, 10, 30);
  const a = crearDatosPrueba({ almacen: al, ahora }); await a.iniciarSesion('1234');
  await a.registrarMovimiento({ negocioId: 'soda', tipo: 'salida', monto: 2000, motivo: 'Gas' });
  const b = crearDatosPrueba({ almacen: al, ahora });
  assert.equal((await b.sesionActual()).rol, 'gerente');
  assert.equal((await b.movimientos('soda', '2026-11-02')).some((m) => m.monto === 2000), true);
});
