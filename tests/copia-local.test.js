import test from 'node:test';
import assert from 'node:assert/strict';
import { conCopiaLocal, MSG_SIN_CONEXION } from '../web/src/datos/copia-local.js';

const almacenFalso = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const hacer = () => {
  let linea = true, llamadas = 0; const avisos = [];
  const real = { negocios: async () => { llamadas++; if (!linea) throw new TypeError('Failed to fetch'); return [{ id: 1, nombre: 'Soda' }]; }, ventasEnVivo: async (a) => ({ a }), abrirCaja: async () => ({ ok: true }), sesionActual: async () => ({ id: 'u', rol: 'administrador' }), estadoAcceso: async () => 'abierta', cerrarSesion: async () => {}, bloquear: async () => {} };
  const almacen = almacenFalso();
  const d = conCopiaLocal(real, { almacen, enLinea: () => linea, ahora: () => 1000, avisar: (e) => avisos.push(e) });
  return { d, almacen, avisos, ponerLinea: (v) => { linea = v; }, llamadas: () => llamadas };
};

test('con internet guarda la copia y sin internet la devuelve con aviso', async () => {
  const { d, ponerLinea, avisos, llamadas } = hacer();
  assert.deepEqual(await d.negocios(), [{ id: 1, nombre: 'Soda' }]);
  ponerLinea(false);
  const antes = llamadas();
  assert.deepEqual(await d.negocios(), [{ id: 1, nombre: 'Soda' }]);
  assert.equal(llamadas(), antes, 'sin internet no llama a la red');
  assert.deepEqual(avisos.at(-1), { sinConexion: true, ultima: 1000 });
  ponerLinea(true); await d.negocios();
  assert.equal(avisos.at(-1).sinConexion, false);
});
test('una pantalla nunca vista sin internet dice que falta la copia', async () => {
  const { d, ponerLinea } = hacer(); ponerLinea(false);
  await assert.rejects(() => d.ventasEnVivo({ negocios: [1] }), /todavía no hay una copia/);
});
test('la copia distingue los filtros', async () => {
  const { d, ponerLinea } = hacer();
  await d.ventasEnVivo({ negocios: [1] }); ponerLinea(false);
  assert.deepEqual(await d.ventasEnVivo({ negocios: [1] }), { a: { negocios: [1] } });
  await assert.rejects(() => d.ventasEnVivo({ negocios: [2] }));
});
test('las escrituras sin internet no se hacen ni se guardan', async () => {
  const { d, ponerLinea, almacen } = hacer(); ponerLinea(false);
  await assert.rejects(() => d.abrirCaja(1, { fondoInicial: 1 }), (e) => e.message === MSG_SIN_CONEXION);
  assert.equal(almacen._m.size, 0);
});
test('fallo de red con internet "aparente" tambien usa la copia', async () => {
  const { d, ponerLinea } = hacer(); await d.negocios();
  ponerLinea(false); // la red cae: el real lanza TypeError pero enLinea ya es false
  assert.equal((await d.negocios()).length, 1);
});
test('usuario guardado abre sin internet y cerrar sesion borra todo', async () => {
  const { d, ponerLinea, almacen } = hacer();
  await d.sesionActual(); await d.negocios(); ponerLinea(false);
  assert.equal(await d.estadoAcceso(), 'abierta');
  assert.equal((await d.sesionActual()).rol, 'administrador');
  await d.cerrarSesion();
  assert.equal(almacen._m.size, 0);
  assert.equal(await d.estadoAcceso(), 'sin_sesion');
});

import { precargarTodo } from '../web/src/datos/precarga.js';
test('sin internet, "hoy" es el dia de la ultima conexion', async () => {
  let linea = true; const almacen = almacenFalso();
  const real = { hoy: async () => '2026-11-03', negocios: async () => [] };
  const d = conCopiaLocal(real, { almacen, enLinea: () => linea });
  assert.equal(await d.hoy(), '2026-11-03'); linea = false;
  real.hoy = async () => '2026-11-05';
  assert.equal(await d.hoy(), '2026-11-03');
});
test('la precarga baja todas las variantes y todo el historial de cierres', async () => {
  const llamadas = []; let pag = 0;
  const reg = (n) => async (a) => { llamadas.push(n); return n === 'cierresTurnos' ? { turnos: [], hayMas: ++pag % 4 !== 0 } : []; };
  const nombres = ['ventasEnVivo', 'ventasAgrupadas', 'ventasTop', 'ventasPorHora', 'comprasProveedores', 'comprasResumen', 'comprasUltimas', 'comprasAgrupadas', 'cierresTurnos', 'diferenciasPendientes', 'viajes', 'movimientosRecientes', 'bodegaUbicaciones', 'bodegaAlertas', 'bodegaPorRecibir', 'bodegaNotas', 'bodegaRecibidas', 'bodegaArticulos', 'bodegaSugerenciaMinimos', 'bodegaMovimientos', 'bodegaExistencias'];
  const datos = Object.fromEntries(nombres.map((n) => [n, reg(n)]));
  datos.negocios = async () => [{ id: 'a' }, { id: 'b' }];
  datos.bodegaUbicaciones = async () => [{ id: 'u1' }];
  const r = await precargarTodo(datos, { hoy: '2026-11-03', almacen: almacenFalso(), forzar: true });
  assert.equal(r.hecho, true); assert.equal(r.fallos, 0);
  assert.equal(llamadas.filter((x) => x === 'ventasAgrupadas').length, 3 * 4);
  assert.equal(llamadas.filter((x) => x === 'cierresTurnos').length, 3 * 4, 'pagina de 30 en 30 hasta que no hay mas');
  const otra = await precargarTodo(datos, { hoy: '2026-11-03', almacen: almacenFalso(), enLinea: () => false });
  assert.equal(otra.motivo, 'sin_internet');
});
