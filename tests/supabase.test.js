// Pruebas de la capa Supabase con un cliente FALSO (sin red). Verifican lo que la app manda y como interpreta las respuestas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDatosSupabase, mensajeError } from '../web/src/datos/supabase.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

function falso(responder, { sesion = null } = {}) {
  const llamadas = []; let ses = sesion;
  const builder = (tabla) => {
    const q = { tabla, op: 'select', filtros: [], valores: null, cols: null };
    const p = {
      select(c) { q.cols = c; return p; }, insert(v) { q.op = 'insert'; q.valores = v; return p },
      eq(c, v) { q.filtros.push(['eq', c, v]); return p; }, in(c, v) { q.filtros.push(['in', c, v]); return p; },
      gte(c, v) { q.filtros.push(['gte', c, v]); return p; }, lte(c, v) { q.filtros.push(['lte', c, v]); return p; },
      order() { return p; }, limit() { return p; }, maybeSingle() { return p; }, single() { return p; },
      then(ok, mal) { llamadas.push(q); return Promise.resolve(responder(q)).then(ok, mal); },
    };
    return p;
  };
  const cliente = {
    llamadas,
    schema(s) { assert.equal(s, 'dixi'); return { from: builder, rpc: (n, a) => { const q = { rpc: n, args: a }; llamadas.push(q); return Promise.resolve(responder(q)); } }; },
    auth: {
      getSession: async () => ({ data: { session: ses } }),
      signInWithPassword: async ({ email, password }) => { if (password !== 'buena') return { data: {}, error: { message: 'Invalid login credentials' } }; ses = { user: { id: 'u1', email } }; return { data: { user: ses.user }, error: null }; },
      signOut: async () => { ses = null; llamadas.push({ signOut: true }); return { error: null }; },
    },
    rpc: (n, a) => { const q = { rpc: n, args: a, publico: true }; llamadas.push(q); return Promise.resolve(responder(q)); },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  return cliente;
}
const ADMIN = { id: 'u1', nombre: 'Emil', rol: 'administrador', activo: true };
const CAJERO = { id: 'u1', nombre: 'Cajera', rol: 'empleado', activo: true };
const base = (perfil) => (q) => {
  if (q.tabla === 'perfiles') return { data: perfil, error: null };
  if (q.tabla === 'perfil_negocios') return { data: [{ negocio_id: 'soda' }, { negocio_id: 'pollos' }], error: null };
  return { data: null, error: null };
};
async function entrar(responder, perfil = ADMIN, al = mem()) {
  const cl = falso((q) => responder(q) ?? base(perfil)(q));
  const d = crearDatosSupabase({ cliente: cl, almacen: al, ahora: () => new Date('2026-11-02T18:00:00Z') });
  await d.iniciarSesion({ correo: 'a@b.cr', clave: 'buena' });
  return { d, cl, al };
}

test('cumple el contrato y no hay datos sin sesion', async () => {
  const d = crearDatosSupabase({ cliente: falso(() => ({ data: null, error: null })) });
  assert.equal(d.esPrueba, false); assert.equal(d.acceso, 'correo');
  assert.equal(await d.estadoAcceso(), 'sin_sesion');
  await assert.rejects(() => d.cajaActual('soda'), /No autorizado/);
  await assert.rejects(() => d.iniciarSesion({ correo: 'a@b.cr', clave: 'mala' }), /Correo o contraseña incorrectos/);
});

test('PIN local: se crea, bloquea al recargar, desbloquea y no se guarda en claro', async () => {
  const { d, cl, al } = await entrar(() => undefined);
  assert.equal(await d.estadoAcceso(), 'crear_pin');
  await assert.rejects(() => d.configurarPinLocal('12'), /4 a 6/);
  await d.configurarPinLocal('4827');
  assert.equal(await d.estadoAcceso(), 'abierta');
  const g = JSON.parse(al.getItem('dixiapp.pin.u1'));
  assert.deepEqual(Object.keys(g).sort(), ['fallos', 'hash', 'it', 'sal']);
  assert.notEqual(g.hash, '4827'); assert.ok(g.it >= 100000);
  // "recargar": instancia nueva con la misma sesion y el mismo almacen
  const d2 = crearDatosSupabase({ cliente: falso((q) => base(ADMIN)(q), { sesion: { user: { id: 'u1' } } }), almacen: al });
  assert.equal(await d2.estadoAcceso(), 'bloqueada');
  assert.equal(await d2.sesionActual(), null);
  assert.equal(await d2.desbloquear('0000'), null);
  assert.equal((await d2.desbloquear('4827')).rol, 'administrador');
  assert.equal(JSON.parse(al.getItem('dixiapp.pin.u1')).fallos, 0);
  await d2.bloquear(); assert.equal(await d2.estadoAcceso(), 'bloqueada');
});

test('5 PIN errados borran el PIN y cierran la sesion local', async () => {
  const { d, cl, al } = await entrar(() => undefined);
  await d.configurarPinLocal('4827'); await d.bloquear();
  for (let i = 0; i < 4; i++) assert.equal(await d.desbloquear('1111'), null);
  await assert.rejects(() => d.desbloquear('1111'), /Demasiados intentos/);
  assert.equal(al.getItem('dixiapp.pin.u1'), null);
  assert.equal(await d.estadoAcceso(), 'sin_sesion');
});

test('cuenta sin perfil activo no entra', async () => {
  const cl = falso((q) => (q.tabla === 'perfiles' ? { data: null, error: null } : { data: [], error: null }));
  const d = crearDatosSupabase({ cliente: cl, almacen: mem() });
  await assert.rejects(() => d.iniciarSesion({ correo: 'x@y.cr', clave: 'buena' }), /no tiene acceso/);
  assert.equal(await d.estadoAcceso(), 'sin_sesion');
});

test('el cajero no pide ni recibe esperado: nunca llama a resumen_caja', async () => {
  const { d, cl } = await entrar((q) => (q.tabla === 'cajas' ? { data: { id: 7, negocio_id: 'soda', fecha: '2026-11-02', estado: 'abierta', fondo_inicial: 50000, abierta_en: '2026-11-02T12:30:00Z', abierta_por_nombre: 'Cajera', cerrada_en: null, cerrada_por_nombre: null }, error: null } : undefined), CAJERO);
  await d.configurarPinLocal('4827');
  const c = await d.cajaActual('soda');
  assert.equal(c.abiertaA, '06:30'); assert.equal(c.abiertaPor, 'Cajera'); assert.equal('esperado' in c, false);
  assert.equal(cl.llamadas.some((l) => l.rpc === 'resumen_caja'), false);
  await assert.rejects(() => d.cierres('soda'), /No autorizado/);
  await assert.rejects(() => d.comprasUltimas({}), /No autorizado/);
});

test('el administrador obtiene el resumen por rpc', async () => {
  const { d } = await entrar((q) => {
    if (q.tabla === 'cajas') return { data: { id: 7, negocio_id: 'soda', fecha: '2026-11-02', estado: 'abierta', fondo_inicial: 50000, abierta_en: '2026-11-02T12:30:00Z', abierta_por_nombre: 'Emil' }, error: null };
    if (q.rpc === 'resumen_caja') return { data: { entradas: 100, salidas: 40, esperado: '60060', ventas: { efectivo: 10 }, contado: null, diferencia: null }, error: null };
  });
  await d.configurarPinLocal('4827');
  assert.equal((await d.cajaActual('soda')).esperado, 60060);
});

test('Dixiapp solo consulta el efectivo: no existe registrar ni corregir movimientos y nunca se inserta en movimientos', async () => {
  const { d, cl } = await entrar((q) => {
    if (q.tabla === 'cajas') return { data: [], error: null };
    if (q.tabla === 'movimientos') return { data: [{ id: 5, caja_id: 7, negocio_id: 'soda', fecha: '2026-11-02', creado_en: '2026-11-02T18:00:00Z', tipo: 'salida', monto: 3000, motivo: 'Gas', nota: '', registrado_por_nombre: 'Cajera', corrige_a: null }], error: null };
  });
  await d.configurarPinLocal('4827');
  for (const m of ['registrarMovimiento', 'corregirMovimiento', 'sugerenciasMotivos']) assert.equal(typeof d[m], 'undefined', `${m} no existe`);
  const act = await d.actividad('soda', '2026-11-02');
  assert.equal(act.movimientos.length, 1); assert.equal(act.movimientos[0].monto, 3000);
  assert.equal(cl.llamadas.some((l) => l.op === 'insert' && l.tabla === 'movimientos'), false);
});

test('cierres de caja del facturador: pide cierres_turnos, arma dia y horas en hora de Costa Rica y no da cifras de un turno abierto', async () => {
  const { d, cl } = await entrar((q) => {
    if (q.rpc === 'cierres_turnos') return { data: { generado: '2026-11-03T05:00:00Z', hoy: '2026-11-02', hay_mas: true, turnos: [
      { id: 'a', negocio_id: 'pollos', terminal: 1, estado: 'abierto', abierto_por: 'Ana', abierto_en: '2026-11-03T04:52:35Z' },
      { id: 'b', negocio_id: 'soda', terminal: 1, estado: 'cerrado', numero: 43, abierto_por: 'Ana', abierto_en: '2026-11-02T12:00:00Z', cerrado_por: 'Luis', cerrado_en: '2026-11-03T03:10:00Z',
        fondo: '50000.00', entradas: '15000.00', salidas: '10000.00', devoluciones_efectivo: '34400.00', cobros_nota_debito_efectivo: 0,
        ventas: { efectivo: '54684.96', tarjeta: 0, sinpe: '1000', transferencia: 0, otros: 0 }, total_ventas: '55684.96', ventas_netas: '21284.96',
        esperado: '75284.96', contado: '45000.00', diferencia: '-30284.96', nota: null,
        mov_entradas: [{ motivo: 'Sencillo', monto: '15000.00', en: '2026-11-02T18:24:00Z', por: 'Ana' }], mov_salidas: [{ motivo: 'Hielo', monto: '10000.00', en: '2026-11-02T19:00:00Z', por: 'Ana' }] }] }, error: null };
  });
  await d.configurarPinLocal('4827');
  const r = await d.cierresTurnos({ negocios: ['soda'], desde: '2026-10-04', hasta: '2026-11-02', limite: 300 });
  assert.deepEqual(cl.llamadas.find((l) => l.rpc === 'cierres_turnos').args, { p_negocios: ['soda'], p_desde: '2026-10-04', p_hasta: '2026-11-02', p_limite: 300 });
  assert.equal(r.hayMas, true); assert.equal(r.turnos.length, 2);
  const [ab, ce] = r.turnos;
  assert.deepEqual(Object.keys(ab).sort(), ['abiertoDia', 'abiertoHora', 'abiertoPor', 'dia', 'estado', 'id', 'negocioId', 'terminal']);
  assert.equal(ab.dia, '2026-11-02'); assert.equal(ab.abiertoHora, '22:52'); // 04:52 UTC es 22:52 del dia anterior en Costa Rica
  assert.equal(ce.dia, '2026-11-02'); assert.equal(ce.cerradoHora, '21:10'); assert.equal(ce.abiertoHora, '06:00');
  assert.equal(ce.diferencia, -30284.96); assert.equal(ce.ventasNetas, 21284.96); assert.equal(ce.movSalidas[0].hora, '13:00');
  assert.ok(Math.abs(ce.esperado - (ce.fondo + ce.ventas.efectivo + ce.entradas - ce.salidas - ce.devolucionesEfectivo)) < 0.005);
});

test('cierres de caja del facturador: quien no es administrador no llega al servidor', async () => {
  const { d, cl } = await entrar(() => undefined, CAJERO);
  await d.configurarPinLocal('4827');
  await assert.rejects(() => d.cierresTurnos({}), /No autorizado/);
  assert.equal(cl.llamadas.some((l) => l.rpc === 'cierres_turnos'), false);
});

test('caja duplicada se explica en espanol', async () => {
  const { d } = await entrar((q) => {
    if (q.tabla === 'cajas' && q.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "cajas_una_abierta_por_negocio"', details: '' } };
    if (q.tabla === 'cajas') return { data: { id: 7 }, error: null };
  }, CAJERO);
  await d.configurarPinLocal('4827');
  await assert.rejects(() => d.abrirCaja('soda', { fondoInicial: 0 }), /Ya hay una caja abierta/);
  assert.equal(mensajeError({ code: '42501', message: 'x' }), 'No tiene permiso para hacer esto.');
  assert.match(mensajeError(new TypeError('Failed to fetch')), /Sin conexión/);
});

test('cerrar caja: pide confirmar el faltante y devuelve cierre ciego', async () => {
  const llamadas = [];
  const { d } = await entrar((q) => {
    if (q.tabla === 'cajas') return { data: { id: 7 }, error: null };
    if (q.rpc === 'cerrar_caja') { llamadas.push(q.args); return { data: q.args.p_confirmar ? { cerrada: true } : { cerrada: false, requiere_confirmacion: true, faltante: 2500 }, error: null }; }
  }, CAJERO);
  await d.configurarPinLocal('4827');
  assert.deepEqual(await d.cerrarCaja('soda', { contado: 1000 }), { cerrada: false, requiereConfirmacion: true, faltante: 2500 });
  assert.deepEqual(await d.cerrarCaja('soda', { contado: 1000, confirmarFaltante: true }), { cerrada: true });
  assert.deepEqual(llamadas, [{ p_caja: 7, p_contado: 1000, p_confirmar: false }, { p_caja: 7, p_contado: 1000, p_confirmar: true }]);
  await assert.rejects(() => d.cerrarCaja('soda', { contado: 1.5 }), /entero/);
});

test('compras: resumen con una sola consulta y filtros hacia la base', async () => {
  const args = [];
  const { d, cl } = await entrar((q) => {
    if (q.rpc === 'compras_agrupadas') { args.push(q.args); return { data: [{ clave: '2026-11-02', etiqueta: '2026-11-02', facturas: 2, neto: '1000.00', iva: '130.00', total: '1130.00' }, { clave: '2026-10-28', etiqueta: '', facturas: 1, neto: 100, iva: 0, total: 100 }], error: null }; }
    if (q.rpc === 'compras_lista') return { data: [{ clave: 'k', negocio_id: 'soda', dia: '2026-11-02', emitida_en: '2026-11-02T14:05:00Z', proveedor_nombre: 'P', proveedor_cedula: '3-1', tipo_proveedor: 'otros', clase: 'factura', moneda: 'USD', total: '113.00', neto: '100.00', iva: '13.00', total_crc: '58195.00', neto_crc: '51500.00', iva_crc: '6695.00', estado: 'pendiente', grupo: 'otros', rubro: 'x' }], error: null };
  });
  const r = await d.comprasResumen({ negocios: ['soda'], proveedor: '3-1' });
  assert.equal(args.length, 1); assert.deepEqual(args[0], { p_negocios: ['soda'], p_desde: '2026-11-01', p_hasta: '2026-11-02', p_por: 'dia', p_proveedor: '3-1', p_rubro: null });
  assert.equal(r.hoy.total, 1130); assert.equal(r.semana.total, 1130); assert.equal(r.mes.total, 1130);
  const u = await d.comprasUltimas({ negocios: ['soda'], proveedor: '3-1', limite: 5 });
  assert.equal(u[0].total, 113); assert.equal(u[0].moneda, 'USD'); assert.equal(u[0].hora, '08:05');
  const q = cl.llamadas.find((l) => l.rpc === 'compras_lista');
  assert.deepEqual(q.args, { p_negocios: ['soda'], p_desde: null, p_hasta: null, p_proveedor: '3-1', p_rubro: null, p_limite: 5 });
});

test('tiempo real: se suscribe a dixi.compras y se puede cancelar', async () => {
  let filtro = null, quitado = false;
  const { d, cl } = await entrar(() => undefined);
  cl.channel = (n) => ({ on(t, f) { filtro = f; return this; }, subscribe() { return this; } });
  cl.removeChannel = () => { quitado = true; };
  const cancelar = await d.comprasSuscribir(() => {});
  assert.deepEqual(filtro, { event: '*', schema: 'dixi', table: 'compras' });
  cancelar(); assert.equal(quitado, true);
});

test('bodega: usa las funciones del facturador (public.fx_inv_*) y solo para administradores', async () => {
  const vistos = [];
  const { d, cl } = await entrar((q) => {
    if (!q.rpc) return undefined; vistos.push(q);
    switch (q.rpc) {
      case 'fx_inv_catalogos': return { data: { ubicaciones: [{ id: 'u1', nombre: 'Bodega central', tipo: 'bodega', activo: true }, { id: 'u2', nombre: 'Viejo', tipo: 'local', activo: false }] }, error: null };
      case 'fx_inv_existencias': return { data: { filas: [{ articulo_id: 'a1', articulo: 'Pollo', categoria: 'Carnes', unidad: 'unidad', ubicacion_id: 'u1', ubicacion: 'Bodega central', cantidad: '12.5', cantidad_vencida: '0', minimo: '20', bajo_minimo: true, proximo_vencimiento: null }] }, error: null };
      case 'fx_inv_alertas': return { data: { bajo_minimo: [{ articulo_id: 'a1', articulo: 'Pollo', unidad: 'unidad', ubicacion_id: 'u1', ubicacion: 'Bodega central', existencia: 12.5, minimo: 20, faltante: 7.5 }], vencen_pronto: [], vencidos: [], por_recibir: 4 }, error: null };
      case 'fx_inv_pendientes': return { data: { facturas: [{ clave: 'K', proveedor_nombre: 'Avícola', fecha: '2026-11-02', sociedad_nombre: 'Pollos', total: 1000, puede_recibir: true, lineas: [{ linea: 1, descripcion: 'Pollo', cantidad: 10, unidad: 'unidad', sugerencia: { articulo_id: 'a1', articulo_nombre: 'Pollo entero', factor: 1 } }, { linea: 2, descripcion: 'Raro', cantidad: 1, unidad: 'unidad', sugerencia: null }] }, { clave: 'R', puede_recibir: false, lineas: [] }] }, error: null };
      case 'fx_inv_conteos': return { data: { conteos: [{ id: 'c1' }] }, error: null };
      case 'fx_inv_conteo_registrar':
      case 'fx_inv_conteo': return { data: { conteo: { id: 'c1', ubicacion_id: 'u1', ubicacion: 'Bodega central', estado: 'abierto', lineas: 2, contadas: 1 }, lineas: [{ articulo_id: 'a1', articulo: 'Pollo', categoria: 'Carnes', unidad: 'unidad', contado: '4', diferencia: '-2' }] }, error: null };
      case 'fx_inv_conteo_confirmar': return { data: { ajustes: [{ articulo: 'Pollo', unidad: 'unidad', esperado: 6, contado: 4, diferencia: -2 }], sin_cambio: 1, no_contados: [] }, error: null };
      case 'fx_ia_propuestas': return { data: [{ linea: 2, nivel: 'verde', articulo_id: 'a9', articulo: 'Raro entero', articulo_unidad: 'unidad', factor: '12', razon: 'El 12 es el empaque', modelo: 'claude-sonnet-5-5' }], error: null };
      case 'fx_inv_articulos': return { data: { n: 1, articulos: [{ id: 'a1', nombre: 'Pollo', categoria: 'Carnes', unidad: 'unidad', existencia: '12.5', minimos: [{ ubicacion_id: 'u1', minimo: '20' }] }] }, error: null };
      case 'fx_inv_lotes': return { data: { lotes: [{ id: 'l1', articulo_id: 'a1', articulo: 'Pollo', unidad: 'unidad', ubicacion: 'Bodega central', cantidad_inicial: '10', cantidad_actual: '10', vence_en: '2026-11-05', dias_para_vencer: 3, vencido: false, fecha_entrada: '2026-11-01', origen: 'factura', estado: 'activo', factura_clave: 'K', factura_linea: 1, lote_padre_id: null }] }, error: null };
      case 'fx_inv_notas_proveedor': return { data: { notas: [{ clave: 'N1', tipo: 'NotaCreditoElectronica', proveedor_nombre: 'Avícola', fecha: '2026-11-02', sociedad_nombre: 'Pollos', total: '500', estado: 'por_revisar', lineas: [{ linea: 1, descripcion: 'Pollo', cantidad: '2', unidad: 'unidad', articulo_id: 'a1', articulo: 'Pollo', factor: '1' }] }] }, error: null };
      case 'fx_inv_ajustar': return { data: { ajustes: [{ articulo: 'Pollo', antes: 6, despues: 5, diferencia: -1 }] }, error: null };
      default: return { data: {}, error: null };
    }
  });
  await d.configurarPinLocal('4827');
  assert.deepEqual(await d.bodegaUbicaciones(), [{ id: 'u1', nombre: 'Bodega central', tipo: 'bodega' }]);
  const ex = await d.bodegaExistencias({ ubicacion: 'u1', q: 'pol' });
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_inv_existencias').args, { p_ubicacion: 'u1', p_categoria: null, p_q: 'pol', p_incluir_ceros: true });
  assert.equal(ex[0].cantidad, 12.5); assert.equal(ex[0].bajoMinimo, true);
  assert.equal((await d.bodegaAlertas()).porRecibir, 4);
  const pend = await d.bodegaPorRecibir(); assert.equal(pend.length, 1); assert.equal(pend[0].lineas[0].sugerencia.articuloId, 'a1'); assert.equal(pend[0].lineas[1].sugerencia, null);
  await d.bodegaRecibir({ lineas: [{ clave: 'K', linea: 1, articuloId: 'a1', factor: 1 }] });
  const rec = vistos.find((v) => v.rpc === 'fx_inv_recibir').args; assert.deepEqual(rec.p_lineas, [{ clave: 'K', linea: 1, articulo_id: 'a1', factor: 1 }]); assert.ok(rec.p_idem);
  await d.bodegaSalida({ tipo: 'merma', ubicacion: 'u1', items: [{ articuloId: 'a1', cantidad: 2.5 }], motivo: 'Se dañó' });
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_inv_salida').args.p_items, [{ articulo_id: 'a1', cantidad: '2.5' }]);
  await d.bodegaTrasladar({ origen: 'u1', destino: 'u2', items: [{ articuloId: 'a1', cantidad: 1 }], motivo: '' });
  assert.equal(vistos.find((v) => v.rpc === 'fx_inv_trasladar').args.p_motivo, null);
  const c = await d.bodegaConteo('u1'); assert.equal(c.id, 'c1'); assert.equal(c.lineas[0].diferencia, -2); assert.equal(c.contadas, 1);
  await d.bodegaConteoRegistrar('c1', [{ articuloId: 'a1', contado: 4 }]);
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_inv_conteo_registrar').args.p_items, [{ articulo_id: 'a1', contado: '4' }]);
  assert.equal((await d.bodegaConteoConfirmar('c1')).ajustes[0].diferencia, -2);
  await d.bodegaAjustar({ ubicacion: 'u1', items: [{ articuloId: 'a1', cantidadReal: 5 }], motivo: 'Recuento' });
  assert.equal(vistos.find((v) => v.rpc === 'fx_inv_ajustar').args.p_items[0].cantidad_real, '5');
  // Asignar con propuesta de la IA: solo se pide la propuesta de facturas con lineas sin equivalencia, y se lee la de la funcion (la mas reciente de Sonnet u Opus)
  assert.equal(pend[0].lineas[1].propuesta.articuloId, 'a9'); assert.equal(pend[0].lineas[1].propuesta.factor, 12); assert.equal(pend[0].lineas[0].propuesta, null);
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_ia_propuestas').args, { p_clave: 'K' });
  await d.bodegaRecibir({ lineas: [{ clave: 'K', linea: 2, articuloId: 'a9', factor: 12, venceEn: '2026-12-01' }] });
  assert.deepEqual(vistos.filter((v) => v.rpc === 'fx_inv_recibir').at(-1).args.p_lineas, [{ clave: 'K', linea: 2, articulo_id: 'a9', factor: 12, vence_en: '2026-12-01' }]);
  // Minimos: se guardan con fx_inv_articulo_guardar (un llamado por articulo) y se leen de fx_inv_articulos
  const art = await d.bodegaArticulos({}); assert.deepEqual(art[0].minimos, { u1: 20 });
  await d.bodegaFijarMinimos({ items: [{ articuloId: 'a1', ubicacionId: 'u1', minimo: 30 }, { articuloId: 'a1', ubicacionId: 'u2', minimo: 0 }] });
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_inv_articulo_guardar').args.p, { id: 'a1', minimos: [{ ubicacion_id: 'u1', minimo: '30' }, { ubicacion_id: 'u2', minimo: '0' }] });
  assert.equal((await d.bodegaSugerenciaMinimos()).items.length, 0); // no hay Local Soda en el catalogo falso: no inventa ubicacion
  // Lotes, deshacer recepcion y notas de credito
  const lotes = await d.bodegaLotes({ articulo: 'a1' }); assert.equal(lotes[0].venceEn, '2026-11-05'); assert.equal(lotes[0].dias, 3);
  const recs = await d.bodegaRecibidas({}); assert.equal(recs[0].deshacible, true); assert.equal(recs[0].clave, 'K');
  await assert.rejects(() => d.bodegaDeshacerRecepcion({ clave: 'K', linea: 1, motivo: '' }), /motivo/);
  await d.bodegaDeshacerRecepcion({ clave: 'K', linea: 1, motivo: 'Por error' });
  assert.deepEqual(vistos.find((v) => v.rpc === 'fx_inv_recepcion_deshacer').args, { p_clave: 'K', p_linea: 1, p_motivo: 'Por error', p_idem: vistos.find((v) => v.rpc === 'fx_inv_recepcion_deshacer').args.p_idem });
  const notas = await d.bodegaNotas({}); assert.equal(notas[0].lineas[0].articuloId, 'a1');
  await d.bodegaNotaDevolver({ clave: 'N1', ubicacion: 'u1', items: [{ articuloId: 'a1', cantidad: 2 }], motivo: 'Nota de crédito' });
  const dev = vistos.find((v) => v.rpc === 'fx_inv_nota_devolver').args; assert.equal(dev.p_clave_nota, 'N1'); assert.deepEqual(dev.p_items, [{ articulo_id: 'a1', cantidad: '2' }]);
  await d.bodegaNotaIgnorar({ clave: 'N1' }); assert.equal(vistos.find((v) => v.rpc === 'fx_inv_nota_ignorar').args.p_clave_nota, 'N1');
  // el cliente nunca manda usuario, fecha ni costos: lo decide el servidor
  for (const v of vistos) assert.equal(JSON.stringify(v.args).includes('p_usuario'), false);
  assert.match(mensajeError({ message: 'Sin acceso al facturador' }), /inventario del facturador/);
});

test('bodega: un cajero no llega a las funciones del inventario', async () => {
  const { d, cl } = await entrar(() => undefined, CAJERO); await d.configurarPinLocal('4827');
  for (const f of [() => d.bodegaExistencias({}), () => d.bodegaAlertas(), () => d.bodegaSalida({ tipo: 'consumo', ubicacion: 'u', items: [], motivo: 'x' })]) await assert.rejects(f, /No autorizado/);
  assert.equal(cl.llamadas.some((l) => l.publico), false);
});

test('modo clave: entra por el servicio de acceso (sin validar el largo en el aparato), guarda solo el token del aparato y se bloquea', async () => {
  const cl = falso(base(ADMIN));
  let sesion = null; const pedidas = [];
  cl.auth.setSession = async ({ access_token }) => { sesion = { user: { id: 'u1' } }; cl.llamadas.push({ setSession: access_token }); return { error: null }; };
  cl.auth.getSession = async () => ({ data: { session: sesion } });
  cl.auth.signOut = async (o) => { sesion = null; cl.llamadas.push({ signOut: o }); return { error: null }; };
  const respuestas = [{ status: 401, ok: false, j: { ok: false, error: 'Clave incorrecta.' } }, { status: 401, ok: false, j: { ok: false, error: 'Clave incorrecta.' } }, { status: 429, ok: false, j: { ok: false, error: 'Espere 5 segundos e intente de nuevo.' } }, { status: 200, ok: true, j: { ok: true, access_token: 'a', refresh_token: 'r', aparato_token: 'T'.repeat(43) } }];
  const pedir = async (url, o) => { pedidas.push({ url, cuerpo: JSON.parse(o.body), llave: o.headers.apikey }); const r = respuestas.shift(); return { status: r.status, ok: r.ok, json: async () => r.j }; };
  const al = mem();
  const d = crearDatosSupabase({ cliente: cl, almacen: al, modoAcceso: 'pin', urlAcceso: 'https://x/functions/v1/dixi-acceso', llave: 'pub', pedir });
  assert.equal(d.acceso, 'pin'); assert.equal(await d.estadoAcceso(), 'sin_sesion');
  // El largo NO se valida en el aparato: una clave de 2 digitos va al servidor igual que una de 4 (si no, la respuesta instantanea delataria el largo)
  assert.equal(await d.iniciarSesion({ pin: '12' }), null); assert.equal(pedidas.length, 1);
  assert.equal(await d.iniciarSesion({ pin: '' }), null); assert.equal(pedidas.length, 1);   // vacio: ni se envia
  assert.equal(await d.iniciarSesion({ pin: '1111' }), null);
  await assert.rejects(() => d.iniciarSesion({ pin: '2222' }), /Espere 5 segundos/);
  const u = await d.iniciarSesion({ pin: '3333' });
  assert.equal(u.rol, 'administrador'); assert.equal(await d.estadoAcceso(), 'abierta');
  assert.deepEqual(pedidas.map((p) => p.cuerpo), [{ pin: '12', aparato: '' }, { pin: '1111', aparato: '' }, { pin: '2222', aparato: '' }, { pin: '3333', aparato: '' }]); assert.equal(pedidas[0].llave, 'pub');
  assert.deepEqual([...al.m.keys()], ['dixiapp.aparato']);   // lo unico que se guarda: el token del aparato de confianza (nunca la clave)
  // Sesion permanente: al reabrir la app (instancia nueva, sesion guardada) entra sin pedir la clave otra vez
  const d2 = crearDatosSupabase({ cliente: cl, almacen: al, modoAcceso: 'pin', urlAcceso: 'https://x/functions/v1/dixi-acceso', llave: 'pub', pedir });
  assert.equal(await d2.estadoAcceso(), 'abierta'); assert.equal((await d2.sesionActual()).rol, 'administrador');
  await d.bloquear(); assert.equal(await d.estadoAcceso(), 'sin_sesion');
  assert.ok(cl.llamadas.some((l) => l.signOut && l.signOut.scope === 'local'));
});
