// Implementacion de datos sobre Supabase (esquema `dixi`). Cumple el contrato de interfaz.js.
// La llave que usa el cliente es la PUBLICABLE: nunca hay secretos aqui. La seguridad la da el RLS de la base.
// Acceso: correo + contrasena (Supabase Auth) y, ademas, un PIN local por aparato para desbloquear sin escribir la clave.
// El PIN solo guarda un hash PBKDF2 con sal en este aparato y solo sirve mientras haya una sesion valida.
import { validarImplementacion } from './interfaz.js';
import { CONFIG } from './config.js';
import { motivoNoDisponible, suscripcionActual, crearSuscripcion, datosDe } from './push-cliente.js';
import { horaLegible, lunesDe, sumarDias } from './fechas.js';
import { resumenDesdeDias, desdeResumen } from './compras-calc.js';
import { SUGERENCIA_MINIMOS } from './minimos-sugeridos.js';

const ZONA = 'America/Costa_Rica';
const ITERACIONES = 150000;
const MAX_FALLOS_PIN = 5;
const num = (x) => (x === null || x === undefined ? null : Number(x));

export function mensajeError(e) {
  if (!e) return 'Ocurrió un error inesperado.';
  const m = String(e.message || e);
  if (e.code === '42501' || /permission denied|row-level security|No autorizado/i.test(m)) return 'No tiene permiso para hacer esto.';
  if (e.code === '23505') return /corrige_a|correccion/i.test(`${e.message} ${e.details || ''}`) ? 'Ese movimiento ya fue corregido.' : 'Ya hay una caja abierta en este negocio.';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m)) return 'Sin conexión con el servidor. Revise el internet e intente de nuevo.';
  if (/Sin acceso al facturador|Solo un administrador puede/i.test(m)) return 'Su cuenta no tiene acceso al inventario del facturador. Pida que la agreguen como administradora del facturador.';
  if (e.code === 'PT401' || /JWT expired|invalid.*token/i.test(m)) return 'La sesión venció. Entre de nuevo con su correo.';
  return m;
}
const fallo = (e) => { const x = new Error(mensajeError(e)); x.codigo = e?.code; return x; };

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function hashPin(pin, sal, cripto) {
  const clave = await cripto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  return cripto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACIONES }, clave, 256);
}
const iguales = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

function almacenPorDefecto() {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* sin almacenamiento */ }
  const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export function crearDatosSupabase({ cliente, almacen = almacenPorDefecto(), ahora = () => new Date(), cripto = globalThis.crypto, modoAcceso = 'correo', urlAcceso = '', llave = '', pedir = (...a) => globalThis.fetch(...a) } = {}) {
  if (!cliente) throw new Error('Falta el cliente de Supabase');
  const db = () => cliente.schema('dixi');
  const ok = ({ data, error }) => { if (error) throw fallo(error); return data; };
  const fechaCR = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: ZONA });
  const horaCR = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }) : null);
  const hoy = () => fechaCR(ahora());
  let desbloqueado = false, usuarioCache = null, negociosPrecargados = null;

  const sesion = async () => { const { data } = await cliente.auth.getSession(); return data?.session || null; };
  const claveLS = (uid) => `dixiapp.pin.${uid}`;
  const leerPin = (uid) => { try { return JSON.parse(almacen.getItem(claveLS(uid)) || 'null'); } catch { return null; } };

  async function cargarUsuario(uid) {
    if (usuarioCache?.id === uid) return usuarioCache;
    // Todo en paralelo: el perfil, sus negocios y la lista de negocios (se guarda para la primera pantalla)
    const [rp, rn, rneg] = await Promise.all([db().from('perfiles').select('id,nombre,rol,activo').eq('id', uid).maybeSingle(), db().from('perfil_negocios').select('negocio_id').eq('perfil_id', uid), db().from('negocios').select('id,nombre').order('nombre', { ascending: false })]);
    const p = ok(rp); if (!p || !p.activo) return null;
    const ns = ok(rn); if (!rneg.error) negociosPrecargados = rneg.data;
    usuarioCache = { id: p.id, nombre: p.nombre, rol: p.rol, negocios: ns.map((n) => n.negocio_id) };
    return usuarioCache;
  }
  async function exigir() {
    if (!desbloqueado) throw new Error('No autorizado');
    const s = await sesion(); if (!s) throw new Error('No autorizado');
    const u = await cargarUsuario(s.user.id); if (!u) throw new Error('No autorizado');
    return u;
  }
  const exigirAdmin = async () => { const u = await exigir(); if (u.rol !== 'administrador') throw new Error('No autorizado'); return u; };
  const esAdmin = (u) => u.rol === 'administrador';
  const filtrarNeg = (q, negocios) => (negocios && negocios.length ? q.in('negocio_id', negocios) : q);

  const mapCaja = (c) => ({
    id: c.id, negocioId: c.negocio_id, fecha: c.fecha, estado: c.estado, fondoInicial: c.fondo_inicial, abiertaA: horaCR(c.abierta_en),
    abiertaPor: c.abierta_por_nombre, cerradaA: horaCR(c.cerrada_en), cerradaPor: c.cerrada_por_nombre || null,
  });
  const mapMov = (m, corregidos) => ({
    id: m.id, cajaId: m.caja_id, negocioId: m.negocio_id, fecha: m.fecha, hora: horaCR(m.creado_en), tipo: m.tipo, monto: m.monto, motivo: m.motivo,
    nota: m.nota || '', registradoPor: m.registrado_por_nombre, corrigeA: m.corrige_a ?? null, corregido: corregidos.has(m.id),
  });
  const mapCompra = (r) => ({
    clave: r.clave, negocioId: r.negocio_id, dia: r.dia, hora: horaCR(r.emitida_en), proveedor: r.proveedor_visible || r.proveedor_nombre, proveedorLegal: r.proveedor_legal || r.proveedor_nombre, proveedorCedula: r.proveedor_cedula,
    tipoProveedor: r.tipo_proveedor, clase: r.clase, moneda: r.moneda, total: num(r.total), neto: num(r.neto), iva: num(r.iva),
    totalCrc: num(r.total_crc), netoCrc: num(r.neto_crc), ivaCrc: num(r.iva_crc), estado: r.estado, grupo: r.grupo, rubro: r.rubro, consecutivo: r.consecutivo,
  });
  const mapFilaAgrupada = (f) => ({ clave: f.clave, etiqueta: f.etiqueta, facturas: Number(f.facturas), neto: Number(f.neto), iva: Number(f.iva), total: Number(f.total) });
  const rpcAgrupada = async ({ negocios, desde, hasta, por, proveedor, rubro }) => {
    await exigirAdmin();
    const r = ok(await db().rpc('compras_agrupadas', { p_negocios: negocios && negocios.length ? negocios : null, p_desde: desde, p_hasta: hasta, p_por: por, p_proveedor: proveedor || null, p_rubro: rubro || null }));
    return (r || []).map(mapFilaAgrupada);
  };
  const cajaAbierta = async (negocioId) => ok(await db().from('cajas').select('id').eq('negocio_id', negocioId).eq('estado', 'abierta').limit(1).maybeSingle());

  let ubicCache = null;
  const fx = async (nombre, args) => ok(await cliente.rpc(nombre, args));
  const idem = () => (cripto.randomUUID ? cripto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const itemFx = (i) => ({ articulo_id: i.articuloId, cantidad: String(i.cantidad) });
  const mapConteo = (r) => ({ id: r.conteo.id, ubicacionId: r.conteo.ubicacion_id, ubicacion: r.conteo.ubicacion, estado: r.conteo.estado, total: Number(r.conteo.lineas), contadas: Number(r.conteo.contadas),
    lineas: (r.lineas || []).map((l) => ({ articuloId: l.articulo_id, articulo: l.articulo, categoria: l.categoria, unidad: l.unidad, contado: num(l.contado), diferencia: num(l.diferencia) })) });

  const api = {
    esPrueba: false,
    acceso: modoAcceso,
    async hoy() { return hoy(); },

    async estadoAcceso() {
      if (modoAcceso === 'pin') return desbloqueado && (await sesion()) ? 'abierta' : 'sin_sesion';
      const s = await sesion(); if (!s) return 'sin_sesion';
      if (!leerPin(s.user.id)) return 'crear_pin';
      return desbloqueado ? 'abierta' : 'bloqueada';
    },
    async iniciarSesion({ correo, clave, pin } = {}) {
      if (modoAcceso === 'pin') {
        if (!/^\d{4}$/.test(String(pin))) return null;
        let r, j;
        try {
          r = await pedir(urlAcceso, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: llave }, body: JSON.stringify({ pin: String(pin) }) });
          j = await r.json().catch(() => ({}));
        } catch { throw new Error('Sin conexión con el servidor. Revise el internet e intente de nuevo.'); }
        if (r.status === 401) return null;
        if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo entrar. Intente de nuevo en unos segundos.');
        const { error } = await cliente.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
        if (error) throw new Error('No se pudo abrir la sesión. Intente de nuevo.');
        usuarioCache = null; desbloqueado = true;
        const { data: ses } = await cliente.auth.getSession();
        const u = await cargarUsuario(ses.session.user.id);
        if (!u) { desbloqueado = false; await cliente.auth.signOut({ scope: 'local' }); throw new Error('Esta cuenta no tiene acceso a Dixiapp.'); }
        return u;
      }
      if (!correo || !clave) throw new Error('Escriba su correo y su contraseña.');
      const { data, error } = await cliente.auth.signInWithPassword({ email: String(correo).trim(), password: clave });
      if (error) throw fallo(error);
      usuarioCache = null; desbloqueado = true;
      const u = await cargarUsuario(data.user.id);
      if (!u) { desbloqueado = false; await cliente.auth.signOut(); throw new Error('Su cuenta no tiene acceso a Dixiapp. Pida a la administración que la active.'); }
      return u;
    },
    async configurarPinLocal(pin) {
      const s = await sesion(); if (!s) throw new Error('No autorizado');
      if (!/^\d{4,6}$/.test(String(pin))) throw new Error('El PIN debe tener de 4 a 6 dígitos.');
      const sal = cripto.getRandomValues(new Uint8Array(16));
      almacen.setItem(claveLS(s.user.id), JSON.stringify({ sal: b64(sal), hash: b64(await hashPin(pin, sal, cripto)), it: ITERACIONES, fallos: 0 }));
      desbloqueado = true; return cargarUsuario(s.user.id);
    },
    async desbloquear(pin) {
      const s = await sesion(); if (!s) throw new Error('Entre con su correo.');
      const g = leerPin(s.user.id); if (!g) throw new Error('Este aparato todavía no tiene PIN.');
      const h = b64(await hashPin(pin, deB64(g.sal), cripto));
      if (iguales(h, g.hash)) { g.fallos = 0; almacen.setItem(claveLS(s.user.id), JSON.stringify(g)); desbloqueado = true; return cargarUsuario(s.user.id); }
      g.fallos = (g.fallos || 0) + 1;
      if (g.fallos >= MAX_FALLOS_PIN) { almacen.removeItem(claveLS(s.user.id)); desbloqueado = false; await cliente.auth.signOut({ scope: 'local' }); throw new Error('Demasiados intentos. Entre de nuevo con su correo.'); }
      almacen.setItem(claveLS(s.user.id), JSON.stringify(g)); return null;
    },
    async bloquear() { desbloqueado = false; if (modoAcceso === 'pin') { usuarioCache = null; try { await cliente.auth.signOut({ scope: 'local' }); } catch { /* sin conexion: la sesion local igual queda cerrada */ } } },
    async sesionActual() { if ((await api.estadoAcceso()) !== 'abierta') return null; const s = await sesion(); return cargarUsuario(s.user.id); },
    async cerrarSesion() { desbloqueado = false; usuarioCache = null; await cliente.auth.signOut(modoAcceso === 'pin' ? { scope: 'local' } : undefined); },

    async negocios() { await exigir(); if (negociosPrecargados) { const n = negociosPrecargados; negociosPrecargados = null; return n; } return ok(await db().from('negocios').select('id,nombre').order('nombre', { ascending: false })); },
    async horarios() {
      await exigir();
      const r = ok(await db().from('horarios').select('negocio_id,servicio,abre,cierra,abierto_24h').order('negocio_id').order('servicio'));
      return r.map((h) => ({ negocioId: h.negocio_id, servicio: h.servicio, texto: h.abierto_24h ? 'Abierto las 24 horas' : `${horaLegible(h.abre.slice(0, 5))} a ${horaLegible(h.cierra.slice(0, 5))}` }));
    },

    async cajaActual(negocioId) {
      const u = await exigir();
      const c = ok(await db().from('cajas').select('*').eq('negocio_id', negocioId).order('abierta_en', { ascending: false }).limit(1).maybeSingle());
      if (!c) return null;
      const base = mapCaja(c);
      if (!esAdmin(u)) return base; // INFORMACION CIEGA: el servidor tampoco entrega estos datos a un no administrador
      const r = ok(await db().rpc('resumen_caja', { p_caja: c.id }));
      return { ...base, entradas: num(r.entradas), salidas: num(r.salidas), esperado: num(r.esperado), ventas: r.ventas, contado: num(r.contado), diferencia: num(r.diferencia) };
    },
    async abrirCaja(negocioId, { fondoInicial }) {
      const u = await exigir(); if (u.rol === 'administrador') throw new Error('El cierre y la apertura de caja los hacen las cajeras en el facturador, no en esta app.');
      if (!Number.isInteger(fondoInicial) || fondoInicial < 0) throw new Error('El fondo inicial debe ser un monto entero en colones (puede ser cero).');
      return mapCaja(ok(await db().from('cajas').insert({ negocio_id: negocioId, fondo_inicial: fondoInicial }).select().single()));
    },
    async actividad(negocioId, fecha) {
      await exigir();
      const cajas = ok(await db().from('cajas').select('*').eq('negocio_id', negocioId).eq('fecha', fecha).order('abierta_en'));
      const movs = ok(await db().from('movimientos').select('*').eq('negocio_id', negocioId).eq('fecha', fecha).order('creado_en').order('id'));
      let corregidos = new Set();
      if (movs.length) corregidos = new Set(ok(await db().from('movimientos').select('corrige_a').in('corrige_a', movs.map((m) => m.id))).map((x) => x.corrige_a));
      return { cajas: cajas.map(mapCaja), movimientos: movs.map((m) => mapMov(m, corregidos)) };
    },
    async registrarMovimiento({ negocioId, tipo, monto, motivo, nota = '' }) {
      await exigir();
      if (!['entrada', 'salida'].includes(tipo)) throw new Error('Tipo de movimiento inválido');
      if (!Number.isInteger(monto) || monto <= 0) throw new Error('El monto debe ser un número entero mayor que cero');
      if (!String(motivo || '').trim()) throw new Error('Falta el motivo');
      const caja = await cajaAbierta(negocioId);
      if (!caja) throw new Error('No hay una caja abierta en este negocio. Ábrala primero.');
      return mapMov(ok(await db().from('movimientos').insert({ caja_id: caja.id, negocio_id: negocioId, tipo, monto, motivo: String(motivo).trim(), nota: String(nota || '').trim() }).select().single()), new Set());
    },
    async corregirMovimiento(id, { nota = '' } = {}) {
      await exigir();
      const o = ok(await db().from('movimientos').select('id,negocio_id,tipo,monto,motivo,corrige_a').eq('id', id).maybeSingle());
      if (!o) throw new Error('El movimiento no existe');
      if (o.corrige_a) throw new Error('Una corrección no se puede corregir');
      const caja = await cajaAbierta(o.negocio_id);
      if (!caja) throw new Error('No hay una caja abierta para registrar la corrección. Ábrala primero.');
      // El servidor fuerza tipo contrario, mismo monto y motivo "Corrección: ..."; aqui solo se manda lo necesario
      return mapMov(ok(await db().from('movimientos').insert({ caja_id: caja.id, negocio_id: o.negocio_id, tipo: o.tipo === 'entrada' ? 'salida' : 'entrada', monto: o.monto, motivo: 'Corrección', nota: String(nota || '').trim(), corrige_a: id }).select().single()), new Set());
    },
    async sugerenciasMotivos(tipo) {
      await exigir();
      return ok(await db().from('motivos').select('texto').eq('tipo', tipo).order('usos', { ascending: false }).order('ultimo_uso', { ascending: false }).limit(8)).map((m) => m.texto);
    },
    async cerrarCaja(negocioId, { contado, confirmarFaltante = false }) {
      const u = await exigir(); if (u.rol === 'administrador') throw new Error('El cierre y la apertura de caja los hacen las cajeras en el facturador, no en esta app.');
      if (!Number.isInteger(contado) || contado < 0) throw new Error('El efectivo contado debe ser un monto entero en colones');
      const caja = await cajaAbierta(negocioId);
      if (!caja) throw new Error('La caja ya está cerrada');
      const r = ok(await db().rpc('cerrar_caja', { p_caja: caja.id, p_contado: contado, p_confirmar: !!confirmarFaltante }));
      if (r.requiere_confirmacion) return { cerrada: false, requiereConfirmacion: true, faltante: r.faltante };
      return r.esperado === undefined ? { cerrada: true } : { cerrada: true, esperado: num(r.esperado), contado: num(r.contado), diferencia: num(r.diferencia) };
    },
    async cierres(negocioId, { limite = 7 } = {}) {
      await exigirAdmin();
      const cajas = ok(await db().from('cajas').select('*').eq('negocio_id', negocioId).eq('estado', 'cerrada').order('abierta_en', { ascending: false }).limit(limite + 1));
      const vis = cajas.slice(0, limite);
      const det = vis.length ? ok(await db().from('cierres_detalle').select('*').in('caja_id', vis.map((c) => c.id))) : [];
      const porCaja = new Map(det.map((d) => [d.caja_id, d]));
      return {
        hayMas: cajas.length > limite,
        items: vis.map((c) => {
          const d = porCaja.get(c.id);
          return { ...mapCaja(c), esperado: num(d?.esperado), contado: num(d?.contado), diferencia: num(d?.diferencia), entradas: num(d?.entradas), salidas: num(d?.salidas),
                   ventas: d ? { efectivo: num(d.ventas_efectivo), tarjeta: num(d.ventas_tarjeta), sinpe: num(d.ventas_sinpe), transferencia: num(d.ventas_transferencia) } : null };
        }),
      };
    },
    async resumenSemana(negocioId) {
      await exigirAdmin();
      const h = hoy(), lun = lunesDe(h);
      const movs = ok(await db().from('movimientos').select('fecha,tipo,monto').eq('negocio_id', negocioId).gte('fecha', lun).lte('fecha', h));
      const dias = []; for (let f = lun; f <= h; f = sumarDias(f, 1)) dias.push(f);
      const out = dias.map((fecha) => {
        const m = movs.filter((x) => x.fecha === fecha);
        const entradas = m.filter((x) => x.tipo === 'entrada').reduce((a, x) => a + x.monto, 0), salidas = m.filter((x) => x.tipo === 'salida').reduce((a, x) => a + x.monto, 0);
        return { fecha, entradas, salidas, neto: entradas - salidas };
      });
      return { dias: out, entradas: out.reduce((a, d) => a + d.entradas, 0), salidas: out.reduce((a, d) => a + d.salidas, 0), neto: out.reduce((a, d) => a + d.neto, 0) };
    },

    async comprasProveedores({ negocios, desde = null, hasta = null, rubro = null } = {}) {
      await exigirAdmin();
      const h = hoy(); const d = desde || `${Number(h.slice(0, 4)) - 1}${h.slice(4)}`;
      const r = ok(await db().rpc('compras_proveedores', { p_negocios: negocios && negocios.length ? negocios : null, p_desde: d, p_hasta: hasta || h, p_rubro: rubro || null }));
      return (r || []).map((f) => ({ cedula: f.cedula, nombre: f.nombre, legal: f.legal, facturas: Number(f.facturas), neto: num(f.neto), iva: num(f.iva), total: num(f.total) }));
    },
    async comprasLineas(clave) {
      await exigirAdmin();
      const r = ok(await db().rpc('compras_lineas', { p_clave: clave }));
      return (r || []).map((l) => ({ linea: l.linea, detalle: l.detalle || '', cantidad: num(l.cantidad), unidad: l.unidad || '', precioUnitario: num(l.precio_unitario), subtotal: num(l.subtotal), impuesto: num(l.impuesto), total: num(l.total) }));
    },
    async comprasUltimas({ negocios, proveedor = null, rubro = null, desde = null, hasta = null, limite = 8 } = {}) {
      await exigirAdmin();
      const r = ok(await db().rpc('compras_lista', { p_negocios: negocios && negocios.length ? negocios : null, p_desde: desde, p_hasta: hasta, p_proveedor: proveedor, p_rubro: rubro, p_limite: limite }));
      return (r || []).map(mapCompra);
    },
    async comprasResumen({ negocios, proveedor = null, rubro = null } = {}) {
      const h = hoy();
      const dias = await rpcAgrupada({ negocios, desde: desdeResumen(h), hasta: h, por: 'dia', proveedor, rubro });
      return resumenDesdeDias(dias, h);
    },
    async comprasAgrupadas(p) { return rpcAgrupada(p); },
    // ---------- Ventas en vivo (solo lectura del facturador por funciones dixi.ventas_*) ----------
    async ventasEnVivo({ negocios } = {}) {
      await exigirAdmin();
      const r = ok(await db().rpc('ventas_en_vivo', { p_negocios: negocios && negocios.length ? negocios : null }));
      const bloque = (b) => (b ? { total: num(b.con_iva), iva: num(b.iva), neto: num(b.con_iva) - num(b.iva), docs: Number(b.docs), desde: b.desde, hasta: b.hasta, estado: b.estado, abiertaPor: b.abierta_por || null, cerradaPor: b.cerrada_por || null, terminal: b.terminal ?? null, participantes: (b.participantes || []).map((p) => ({ usuario: p.usuario, nombre: p.nombre, abrio: !!p.abrio, ventas: Number(p.ventas || 0), notas: Number(p.notas || 0), total: num(p.con_iva) })) } : null);
      return { generado: r.generado, negocios: (r.negocios || []).map((n) => ({ negocioId: n.negocio_id, turno: bloque(n.turno), hoy: bloque(n.hoy), semana: bloque(n.semana), mes: bloque(n.mes) })) };
    },
    async ventasAgrupadas({ negocios, desde, hasta, por }) {
      await exigirAdmin();
      const r = ok(await db().rpc('ventas_agrupadas', { p_negocios: negocios && negocios.length ? negocios : null, p_desde: desde, p_hasta: hasta, p_por: por }));
      return (r || []).map((f) => ({ clave: f.clave, etiqueta: f.clave, facturas: Number(f.documentos), neto: Number(f.sin_iva), iva: Number(f.iva), total: Number(f.con_iva) }));
    },
    // ---------- Avisos en el telefono ----------
    async avisosEstado() {
      await exigirAdmin();
      const motivo = motivoNoDisponible(), sub = await suscripcionActual();
      if (!sub) return { motivo, activo: false, prefs: {} };
      const r = ok(await db().rpc('push_estado', { p_endpoint: sub.endpoint }));
      return { motivo: motivo === 'bloqueado' ? motivo : '', activo: !!r?.activo, prefs: r?.prefs || {} };
    },
    async avisosActivar() {
      await exigirAdmin();
      const sub = await crearSuscripcion(CONFIG.vapid);
      if (!sub) return { motivo: 'bloqueado', activo: false, prefs: {} };
      const d = datosDe(sub);
      ok(await db().rpc('push_guardar', { p_endpoint: d.endpoint, p_p256dh: d.p256dh, p_auth: d.auth, p_agente: navigator.userAgent }));
      return { motivo: '', activo: true, prefs: {} };
    },
    async avisosDesactivar() {
      await exigirAdmin();
      const sub = await suscripcionActual(); if (!sub) return;
      ok(await db().rpc('push_quitar', { p_endpoint: sub.endpoint }));
      await sub.unsubscribe();
    },
    async avisosGuardarPrefs(prefs) {
      await exigirAdmin();
      const sub = await suscripcionActual(); if (!sub) return prefs;
      ok(await db().rpc('push_prefs_guardar', { p_endpoint: sub.endpoint, p_prefs: prefs }));
      return prefs;
    },
    async avisosProbar() { await exigirAdmin(); ok(await db().rpc('push_prueba')); },
    async ventasSuscribir(cb) { await exigirAdmin(); const t = setInterval(() => cb({ tipo: 'pulso' }), 20000); return () => clearInterval(t); },
    // ---------- Inicio de Dixia ----------
    async viajes() {
      await exigir();
      return ok(await db().from('viajes').select('id,destino,fecha,creado_en,creado_por_nombre').order('creado_en', { ascending: false }).limit(20))
        .map((v) => ({ id: v.id, destino: v.destino, fecha: v.fecha, creadoPor: v.creado_por_nombre, creadoEn: v.creado_en }));
    },
    async viajeAgregar({ destino, fecha }) {
      await exigir();
      if (!String(destino || '').trim()) throw new Error('Falta el destino');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) throw new Error('Falta la fecha');
      ok(await db().from('viajes').insert({ destino: String(destino).trim(), fecha }));
      return true;
    },
    async diferenciasPendientes() {
      await exigirAdmin();
      const det = ok(await db().from('cierres_detalle').select('caja_id,negocio_id,diferencia').neq('diferencia', 0).order('caja_id', { ascending: false }).limit(60));
      if (!det.length) return [];
      const ids = det.map((d) => d.caja_id);
      const [res, cajas] = await Promise.all([db().from('diferencias_resueltas').select('caja_id').in('caja_id', ids), db().from('cajas').select('id,fecha').in('id', ids)]);
      const hechas = new Set(ok(res).map((r) => r.caja_id)); const fechas = new Map(ok(cajas).map((c) => [c.id, c.fecha]));
      return det.filter((d) => !hechas.has(d.caja_id)).map((d) => ({ cajaId: d.caja_id, negocioId: d.negocio_id, fecha: fechas.get(d.caja_id), diferencia: num(d.diferencia) }));
    },
    async diferenciaResolver({ cajaId, nota = '' }) {
      await exigirAdmin();
      ok(await db().from('diferencias_resueltas').insert({ caja_id: cajaId, nota: String(nota || '').trim() }));
      return true;
    },
    async movimientosRecientes({ limite = 8 } = {}) {
      await exigir();
      return ok(await db().from('movimientos').select('*').eq('fecha', hoy()).order('creado_en', { ascending: false }).order('id', { ascending: false }).limit(limite)).map((m) => mapMov(m, new Set()));
    },
    async movimientosSuscribir(cb) {
      await exigir();
      const canal = cliente.channel('dixi-movimientos').on('postgres_changes', { event: 'INSERT', schema: 'dixi', table: 'movimientos' }, (c) => cb(mapMov(c.new, new Set()))).subscribe();
      return () => { cliente.removeChannel(canal); };
    },
    async comprasSuscribir(cb) {
      await exigirAdmin();
      const canal = cliente.channel('dixi-compras').on('postgres_changes', { event: '*', schema: 'dixi', table: 'compras' }, (c) => cb({ tipo: c.eventType, clave: c.new?.clave || c.old?.clave })).subscribe();
      return () => { cliente.removeChannel(canal); };
    },
    // ---------- Bodega: usa las funciones del inventario del facturador (public.fx_inv_*), que ya validan, auditan y son idempotentes ----------
    async bodegaUbicaciones() {
      await exigirAdmin();
      if (!ubicCache) ubicCache = (await fx('fx_inv_catalogos', {})).ubicaciones.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre, tipo: u.tipo }));
      return ubicCache;
    },
    async bodegaExistencias({ ubicacion = null, q = '' } = {}) {
      await exigirAdmin();
      const r = await fx('fx_inv_existencias', { p_ubicacion: ubicacion, p_categoria: null, p_q: q || '', p_incluir_ceros: true });
      return r.filas.map((f) => ({ articuloId: f.articulo_id, articulo: f.articulo, categoria: f.categoria, unidad: f.unidad, ubicacionId: f.ubicacion_id, ubicacion: f.ubicacion,
        cantidad: num(f.cantidad), minimo: num(f.minimo), bajoMinimo: !!f.bajo_minimo, vencida: num(f.cantidad_vencida) > 0, proximoVencimiento: f.proximo_vencimiento || null }));
    },
    async bodegaAlertas() {
      await exigirAdmin(); const r = await fx('fx_inv_alertas', {});
      const base = (x) => ({ articuloId: x.articulo_id, articulo: x.articulo, unidad: x.unidad, ubicacionId: x.ubicacion_id, ubicacion: x.ubicacion });
      return {
        bajoMinimo: r.bajo_minimo.map((x) => ({ ...base(x), existencia: num(x.existencia), minimo: num(x.minimo), faltante: num(x.faltante) })),
        vencenPronto: r.vencen_pronto.map((x) => ({ ...base(x), cantidad: num(x.cantidad), venceEn: x.vence_en, dias: x.dias_para_vencer })),
        vencidos: r.vencidos.map((x) => ({ ...base(x), cantidad: num(x.cantidad), venceEn: x.vence_en })),
        porRecibir: Number(r.por_recibir || 0),
      };
    },
    async bodegaPorRecibir() {
      await exigirAdmin(); const r = await fx('fx_inv_pendientes', { p_sociedad: null, p_q: '', p_limite: 50 });
      // Propuesta de la IA (fact.ia_propuestas, la mas reciente de Sonnet u Opus segun fx_ia_propuestas) solo para facturas con lineas sin equivalencia
      const sinEq = (l) => !(l.sugerencia && (l.sugerencia.articulo_id || l.sugerencia.articulo?.id));
      const propuestas = new Map();
      await Promise.all(r.facturas.filter((f) => f.puede_recibir !== false && (f.lineas || []).some(sinEq)).map(async (f) => {
        try { const ps = await fx('fx_ia_propuestas', { p_clave: f.clave }); for (const p of (Array.isArray(ps) ? ps : [])) if (p.articulo_id) propuestas.set(`${f.clave}|${p.linea}`, p); } catch { /* sin propuesta: se asigna a mano */ }
      }));
      return r.facturas.filter((f) => f.puede_recibir !== false).map((f) => ({ clave: f.clave, proveedor: f.proveedor_nombre, fecha: f.fecha, empresa: f.sociedad_nombre, total: num(f.total),
        lineas: (f.lineas || []).map((l) => {
          const s = l.sugerencia && (l.sugerencia.articulo_id || l.sugerencia.articulo?.id) ? l.sugerencia : null;
          const p = propuestas.get(`${f.clave}|${l.linea}`);
          return { linea: l.linea, descripcion: l.descripcion, cantidad: num(l.cantidad), unidad: l.unidad,
            propuesta: !s && p ? { articuloId: p.articulo_id, articulo: p.articulo || 'Artículo', factor: num(p.factor) || 1, unidad: p.articulo_unidad || p.unidad || '', nivel: p.nivel || null, razon: p.razon || '', modelo: p.modelo || '' } : null,
            sugerencia: s ? { articuloId: s.articulo_id || s.articulo.id, articulo: s.articulo_nombre || (typeof s.articulo === 'string' ? s.articulo : s.articulo?.nombre) || 'Artículo', factor: num(s.factor) || 1, unidad: s.unidad_articulo || s.unidad || '' } : null };
        }) }));
    },
    async bodegaRecibir({ lineas }) {
      await exigirAdmin(); if (!lineas?.length) throw new Error('No hay líneas para recibir.');
      const r = await fx('fx_inv_recibir', { p_lineas: lineas.map((l) => ({ clave: l.clave, linea: l.linea, articulo_id: l.articuloId, ...(l.factor ? { factor: l.factor } : {}), ...(l.venceEn ? { vence_en: l.venceEn } : {}) })), p_idem: idem() });
      return { recibidas: lineas.length, detalle: r };
    },
    async bodegaSalida({ tipo, ubicacion, items, motivo }) {
      await exigirAdmin(); await fx('fx_inv_salida', { p_tipo: tipo, p_ubicacion: ubicacion, p_items: items.map(itemFx), p_motivo: motivo, p_idem: idem() }); return { items: items.length };
    },
    async bodegaTrasladar({ origen, destino, items, motivo }) {
      await exigirAdmin(); await fx('fx_inv_trasladar', { p_origen: origen, p_destino: destino, p_items: items.map(itemFx), p_motivo: motivo || null, p_idem: idem() }); return { items: items.length };
    },
    async bodegaConteo(ubicacion) {
      await exigirAdmin(); const r = await fx('fx_inv_conteos', { p_ubicacion: ubicacion, p_estado: 'abierto', p_limite: 1 });
      return r.conteos?.length ? mapConteo(await fx('fx_inv_conteo', { p_conteo: r.conteos[0].id })) : null;
    },
    async bodegaConteoIniciar(ubicacion) { await exigirAdmin(); return mapConteo(await fx('fx_inv_conteo_iniciar', { p_ubicacion: ubicacion, p_nota: null, p_idem: idem() })); },
    async bodegaConteoRegistrar(conteoId, items) {
      await exigirAdmin(); return mapConteo(await fx('fx_inv_conteo_registrar', { p_conteo: conteoId, p_items: items.map((i) => ({ articulo_id: i.articuloId, contado: String(i.contado) })), p_idem: idem() }));
    },
    async bodegaConteoConfirmar(conteoId) {
      await exigirAdmin(); const r = await fx('fx_inv_conteo_confirmar', { p_conteo: conteoId, p_idem: idem() });
      return { ajustes: r.ajustes.map((a) => ({ articulo: a.articulo, unidad: a.unidad, esperado: num(a.esperado), contado: num(a.contado), diferencia: num(a.diferencia) })), sinCambio: r.sin_cambio, noContados: (r.no_contados || []).length };
    },
    async bodegaConteoCancelar(conteoId, motivo = 'Cancelado desde Dixiapp') { await exigirAdmin(); await fx('fx_inv_conteo_cancelar', { p_conteo: conteoId, p_motivo: motivo, p_idem: idem() }); },
    async bodegaAjustar({ ubicacion, items, motivo }) {
      await exigirAdmin(); const r = await fx('fx_inv_ajustar', { p_ubicacion: ubicacion, p_items: items.map((i) => ({ articulo_id: i.articuloId, cantidad_real: String(i.cantidadReal) })), p_motivo: motivo, p_idem: idem() });
      return { ajustes: r.ajustes.map((a) => ({ articulo: a.articulo, antes: num(a.antes), despues: num(a.despues), diferencia: num(a.diferencia) })) };
    },
    async bodegaMovimientos({ ubicacion = null, limite = 10 } = {}) {
      await exigirAdmin(); const h = hoy(), d = new Date(new Date(`${h}T12:00:00`).getTime() - 30 * 86400000).toLocaleDateString('en-CA');
      const r = await fx('fx_inv_movimientos', { p_desde: d, p_hasta: h, p_articulo: null, p_ubicacion: ubicacion, p_tipo: null, p_limite: limite });
      return (Array.isArray(r) ? r : r.movimientos || r.filas || []).slice(0, limite).map((m) => ({ id: m.id, tipo: m.tipo, tipoNombre: m.tipo_nombre, articulo: m.articulo, unidad: m.unidad, cantidad: num(m.cantidad),
        ubicacion: m.ubicacion, motivo: m.motivo, usuario: m.usuario_nombre || m.usuario, fecha: m.fecha, hora: horaCR(m.creado_en), signo: Math.sign(num(m.valor) || 0) || 0 }));
    },
    async bodegaArticulos({ q = '' } = {}) {
      await exigirAdmin(); const r = await fx('fx_inv_articulos', { p_q: q || '', p_categoria: null, p_incluir_inactivos: false });
      return (r.articulos || []).map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria || '', unidad: a.unidad, existencia: num(a.existencia) || 0,
        minimos: Object.fromEntries((a.minimos || []).map((m) => [m.ubicacion_id, num(m.minimo)])) }));
    },
    async bodegaFijarMinimos({ items }) {
      await exigirAdmin(); if (!items?.length) throw new Error('No hay mínimos que guardar.');
      const porArt = new Map();
      for (const i of items) {
        const m = Number(i.minimo); if (!Number.isFinite(m) || m < 0) throw new Error('El mínimo debe ser un número, 0 o más.');
        if (!porArt.has(i.articuloId)) porArt.set(i.articuloId, []); porArt.get(i.articuloId).push({ ubicacion_id: i.ubicacionId, minimo: String(m) });
      }
      for (const [id, minimos] of porArt) await fx('fx_inv_articulo_guardar', { p: { id, minimos }, p_idem: idem() });
      return { guardados: items.length };
    },
    async bodegaSugerenciaMinimos() {
      const ub = (await this.bodegaUbicaciones()).find((u) => u.tipo === 'local' && /soda/i.test(u.nombre));
      return { nota: SUGERENCIA_MINIMOS.nota, items: ub ? SUGERENCIA_MINIMOS.items.map((i) => ({ ...i, unidad: 'unidad', ubicacionId: ub.id, ubicacion: ub.nombre })) : [] };
    },
    async bodegaLotes({ articulo = null, ubicacion = null } = {}) {
      await exigirAdmin(); const r = await fx('fx_inv_lotes', { p_articulo: articulo, p_ubicacion: ubicacion, p_incluir_agotados: false, p_limite: 200 });
      return (Array.isArray(r) ? r : r.lotes || r.filas || []).map((l) => ({ id: l.id, articuloId: l.articulo_id, articulo: l.articulo, unidad: l.unidad, ubicacion: l.ubicacion, cantidad: num(l.cantidad_actual),
        inicial: num(l.cantidad_inicial), venceEn: l.vence_en || null, dias: l.dias_para_vencer ?? null, vencido: !!l.vencido, entrada: l.fecha_entrada, origen: l.origen }));
    },
    async bodegaRecibidas({ limite = 15 } = {}) {
      await exigirAdmin(); const r = await fx('fx_inv_lotes', { p_articulo: null, p_ubicacion: null, p_incluir_agotados: false, p_limite: 200 });
      return (Array.isArray(r) ? r : r.lotes || r.filas || []).filter((l) => l.factura_clave && l.estado !== 'anulado').slice(0, limite).map((l) => ({
        clave: l.factura_clave, linea: l.factura_linea, proveedor: l.proveedor_cedula || '', descripcion: '', articulo: l.articulo, unidad: l.unidad, cantidad: num(l.cantidad_inicial), ubicacion: l.ubicacion,
        fecha: l.fecha_entrada, deshacible: num(l.cantidad_actual) === num(l.cantidad_inicial) && !l.lote_padre_id }));
    },
    async bodegaDeshacerRecepcion({ clave, linea, motivo }) {
      await exigirAdmin(); if (String(motivo || '').trim().length < 3) throw new Error('Escriba el motivo (al menos 3 letras).');
      await fx('fx_inv_recepcion_deshacer', { p_clave: clave, p_linea: Number(linea), p_motivo: motivo.trim(), p_idem: idem() }); return { clave, linea };
    },
    async bodegaNotas({ estado = 'por_revisar' } = {}) {
      await exigirAdmin(); const r = await fx('fx_inv_notas_proveedor', { p_estado: estado, p_limite: 50 });
      return (r.notas || []).map((n) => ({ clave: n.clave, tipo: n.tipo, proveedor: n.proveedor_nombre, fecha: n.fecha, empresa: n.sociedad_nombre, total: num(n.total), estado: n.estado,
        lineas: (n.lineas || []).map((l) => ({ linea: l.linea, descripcion: l.descripcion, cantidad: num(l.cantidad), unidad: l.unidad, articuloId: l.articulo_id || null, articulo: l.articulo || null, factor: num(l.factor) || 1 })) }));
    },
    async bodegaNotaDevolver({ clave, ubicacion, items, motivo }) {
      await exigirAdmin(); if (!items?.length) throw new Error('Indique qué artículos se devuelven.');
      await fx('fx_inv_nota_devolver', { p_clave_nota: clave, p_ubicacion: ubicacion, p_items: items.map(itemFx), p_motivo: motivo || null, p_idem: idem() }); return { items: items.length };
    },
    async bodegaNotaIgnorar({ clave, motivo }) {
      await exigirAdmin(); await fx('fx_inv_nota_ignorar', { p_clave_nota: clave, p_motivo: motivo || 'No afecta el inventario', p_idem: idem() });
    },
    async restablecerPrueba() { throw new Error('Solo existe en el modo de prueba.'); },
  };
  return validarImplementacion(api);
}
