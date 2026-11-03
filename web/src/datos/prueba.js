// Implementacion de PRUEBA: datos ficticios guardados en localStorage. No toca ninguna base de datos real.
// Cumple el mismo contrato que supabase.js (ver interfaz.js), incluida la regla de informacion ciega.
import { validarImplementacion } from './interfaz.js';
import { efectivoEsperado, totalesMovimientos } from './calculos.js';
import { aTexto, horaTexto, sumarDias, diasDeLaSemana, deTexto, lunesDe } from './fechas.js';
import { crearBodegaPrueba } from './prueba-bodega.js';
import { agruparCompras, resumenDesdeDias, desdeResumen, inicioMes, inicioPeriodo } from './compras-calc.js';

const CLAVE = 'dixiapp.prueba.v2';
const CLAVE_SESION = 'dixiapp.sesion.v2';

export const NEGOCIOS = [
  { id: 'soda', nombre: 'Soda La Bomba' },
  { id: 'pollos', nombre: 'Pollos La Bomba' },
];
export const USUARIOS = [
  { id: 'u-admin', nombre: 'Administrador de prueba', rol: 'administrador', pin: '1234', negocios: ['soda', 'pollos'] },
  { id: 'u-cajero', nombre: 'Cajero de prueba', rol: 'empleado', pin: '4321', negocios: ['soda'] },
];
const HORARIOS = [
  { negocioId: 'soda', servicio: 'Soda', texto: 'Abierto las 24 horas' },
  { negocioId: 'soda', servicio: 'Express', texto: '7:00 a. m. a 10:00 p. m.' },
  { negocioId: 'pollos', servicio: 'Pollos', texto: '10:00 a. m. a 10:00 p. m.' },
  { negocioId: 'pollos', servicio: 'Papea', texto: '10:00 a. m. a 10:00 p. m.' },
];
const SEMILLA_MOTIVOS = {
  salida: ['Proveedor', 'Gas', 'Hielo e insumos', 'Pago a personal', 'Transporte'],
  entrada: ['Sencillo o cambio', 'Aporte de la gerencia', 'Devolución de proveedor'],
};
// Proveedores ficticios (nombres inventados)
export const PROVEEDORES = [
  { cedula: '3-101-900001', nombre: 'Avícola Central (ficticio)', tipo: 'comida_preparada', iva: 0.01, rubros: [['Pollo', 'comida_preparada', 1]] },
  { cedula: '3-101-900002', nombre: 'Carnes del Valle (ficticio)', tipo: 'comida_preparada', iva: 0.01, rubros: [['Carnes', 'comida_preparada', 1]] },
  { cedula: '3-101-900003', nombre: 'Verduras Don Beto (ficticio)', tipo: 'comida_preparada', iva: 0, rubros: [['Verduras', 'comida_preparada', 1]] },
  { cedula: '3-101-900004', nombre: 'Bebidas del Norte (ficticio)', tipo: 'unitario', iva: 0.13, rubros: [['Bebidas', 'unitario', 0.8], ['Snacks', 'unitario', 0.2]] },
  { cedula: '3-101-900005', nombre: 'Empaques y Desechables (ficticio)', tipo: 'suministro', iva: 0.13, rubros: [['Empaques', 'suministro', 0.7], ['Limpieza', 'suministro', 0.3]] },
  { cedula: '3-101-900006', nombre: 'Gas Nacional (ficticio)', tipo: 'suministro', iva: 0.13, rubros: [['Gas', 'suministro', 1]] },
  { cedula: '3-101-900007', nombre: 'Ferretería La Esquina (ficticio)', tipo: 'otros', iva: 0.13, rubros: [['Sin clasificar', 'otros', 1]] },
];

function azar(semilla) { // generador determinista
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const redondear = (n, paso = 500) => Math.round(n / paso) * paso;
const r2 = (n) => Math.round(n * 100) / 100;
const dos = (n) => String(n).padStart(2, '0');
const SALIDAS_EJ = [['Proveedor', 18000, 45000], ['Gas', 12000, 20000], ['Hielo e insumos', 3000, 9000], ['Pago a personal', 15000, 30000], ['Transporte', 2000, 6000]];
const ENTRADAS_EJ = [['Sencillo o cambio', 10000, 30000], ['Aporte de la gerencia', 20000, 50000]];
const PERSONAS = ['Administrador de prueba', 'Cajero de prueba', 'Hermana de prueba'];

export function crearCompra(est, { negocioId, dia, hora, prov, neto, moneda = 'CRC', clase = 'factura', estado = 'pendiente', tc = 1 }) {
  const iva = r2(neto * prov.iva), total = r2(neto + iva), signo = clase === 'nota_credito' ? -1 : 1;
  const rubros = prov.rubros.map(([rubro, grupo, peso]) => ({ rubro, grupo, neto: r2(neto * peso * tc * signo), iva: r2(iva * peso * tc * signo) }));
  const dom = [...rubros].sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto))[0];
  const n = est.siguiente++;
  return {
    clave: `5060000000000000000000000000000000000000${String(n).padStart(10, '0')}`, negocioId, dia, hora, clase, moneda,
    proveedor: prov.nombre, proveedorCedula: prov.cedula, tipoProveedor: prov.tipo,
    neto, iva, total, netoCrc: r2(neto * tc * signo), ivaCrc: r2(iva * tc * signo), totalCrc: r2(total * tc * signo),
    estado, grupo: dom.grupo, rubro: dom.rubro, rubros, consecutivo: `00100001010000${String(n).padStart(6, '0')}`,
  };
}

export function generarSemilla(hoy) {
  const est = { version: 2, hoy, cajas: [], movimientos: [], compras: [], motivos: {}, siguiente: 1 };
  const id = (p) => `${p}-${est.siguiente++}`;
  NEGOCIOS.forEach((neg, ni) => {
    const rnd = azar(7919 * (ni + 3));
    const escala = ni === 0 ? 1 : 0.8;
    for (let k = 30; k >= 0; k--) {
      const fecha = sumarDias(hoy, -k);
      const esHoy = k === 0;
      if (esHoy && neg.id === 'pollos') continue; // Pollos: todavia sin abrir hoy (para probar "abrir caja")
      const abre = ['Administrador de prueba', 'Cajero de prueba', 'Hermana de prueba'][Math.floor(rnd() * 3)];
      const caja = {
        id: id('caja'), negocioId: neg.id, fecha, abiertaA: ni ? '10:00' : '06:30', abiertaPor: abre, fondoInicial: redondear(30000 + rnd() * 40000),
        estado: esHoy ? 'abierta' : 'cerrada',
        ventas: { efectivo: redondear((90000 + rnd() * 140000) * escala * (esHoy ? 0.55 : 1)), tarjeta: redondear((120000 + rnd() * 180000) * escala * (esHoy ? 0.5 : 1)),
                  sinpe: redondear((40000 + rnd() * 90000) * escala * (esHoy ? 0.5 : 1)), transferencia: redondear(rnd() * 20000) },
      };
      est.cajas.push(caja);
      const nS = esHoy ? 2 : 1 + Math.floor(rnd() * 3), nE = esHoy ? 1 : Math.floor(rnd() * 2.2);
      const movs = [];
      for (let i = 0; i < nS; i++) { const [motivo, lo, hi] = SALIDAS_EJ[Math.floor(rnd() * SALIDAS_EJ.length)]; movs.push({ tipo: 'salida', monto: redondear(lo + rnd() * (hi - lo)), motivo }); }
      for (let i = 0; i < nE; i++) { const [motivo, lo, hi] = ENTRADAS_EJ[Math.floor(rnd() * ENTRADAS_EJ.length)]; movs.push({ tipo: 'entrada', monto: redondear(lo + rnd() * (hi - lo)), motivo }); }
      movs.forEach((m, i) => {
        const hh = 7 + Math.floor(((i + 1) * 9) / (movs.length + 1));
        est.movimientos.push({ id: id('mov'), cajaId: caja.id, negocioId: neg.id, fecha, hora: `${dos(hh)}:${i % 2 ? '40' : '15'}`, ...m, nota: '', registradoPor: PERSONAS[i % 3], corrigeA: null });
      });
      if (!esHoy) {
        const cm = est.movimientos.filter((m) => m.cajaId === caja.id);
        const esperado = efectivoEsperado({ fondoInicial: caja.fondoInicial, ventasEfectivo: caja.ventas.efectivo }, cm);
        const r = rnd();
        const dif = r < 0.7 ? 0 : r < 0.85 ? -redondear(500 + rnd() * 4500) : redondear(500 + rnd() * 2500);
        Object.assign(caja, { cerradaA: rnd() < 0.5 ? '21:10' : '21:45', cerradaPor: PERSONAS[Math.floor(rnd() * 3)], esperado, contado: esperado + dif });
      }
    }
  });
  // Compras ficticias: unas 3 por semana de cada proveedor en cada negocio, ultimos 100 dias
  const rc = azar(424242);
  for (let k = 100; k >= 0; k--) {
    const dia = sumarDias(hoy, -k);
    NEGOCIOS.forEach((neg) => {
      PROVEEDORES.forEach((prov, pi) => {
        if (rc() > 0.42 - pi * 0.03) return;
        const usd = pi === 3 && rc() < 0.15;
        const esNota = rc() < 0.05;
        const neto = usd ? r2(40 + rc() * 120) : redondear(15000 + rc() * 140000, 50);
        const hh = 7 + Math.floor(rc() * 12), mm = Math.floor(rc() * 60);
        const e = rc();
        est.compras.push(crearCompra(est, {
          negocioId: neg.id, dia, hora: `${dos(hh)}:${dos(mm)}`, prov, neto, moneda: usd ? 'USD' : 'CRC', tc: usd ? 515 : 1,
          clase: esNota ? 'nota_credito' : 'factura', estado: e < 0.75 ? 'pendiente' : e < 0.9 ? 'aceptada' : e < 0.96 ? 'sin_respuesta' : 'aceptada_parcial',
        }));
      });
    });
  }
  // Garantiza compras hoy para que el panorama del dia no quede vacio
  PROVEEDORES.slice(0, 3).forEach((prov, i) => est.compras.push(crearCompra(est, { negocioId: i === 2 ? 'pollos' : 'soda', dia: hoy, hora: `0${8 + i}:${i ? '30' : '05'}`, prov, neto: 52000 + i * 18500 })));
  return est;
}

function almacenMemoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function almacenPorDefecto() {
  try { if (typeof localStorage !== 'undefined') { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } } catch { /* sin localStorage */ }
  return almacenMemoria();
}

// Ventas ficticias por dia y negocio: estables (salen de la fecha), con el dia de hoy a medias segun la hora.
function ventasDelDia(negocio, fecha, hoyTexto, ahoraFecha) {
  let x = 0; for (const ch of negocio + fecha) x = (x * 31 + ch.charCodeAt(0)) % 100003;
  const base = negocio === 'pollos' ? 410000 : 320000, dia = deTexto(fecha).getDay();
  let total = Math.round((base * (0.7 + (x % 60) / 100) * (dia === 0 || dia === 6 ? 1.25 : 1)) / 100) * 100;
  if (fecha > hoyTexto) return 0;
  if (fecha === hoyTexto) total = Math.round(total * Math.min(1, Math.max(0.08, (ahoraFecha.getHours() - 8) / 12)));
  return total;
}
function bloqueVentas(total, estado, desde) {
  const iva = Math.round((total * 13) / 113);
  return { total, iva, neto: total - iva, docs: Math.round(total / 3800), estado, desde };
}
function ventasDeRango(negocio, desde, hasta, hoyTexto, ahoraFecha) {
  let total = 0; for (let d = desde; d <= hasta; d = sumarDias(d, 1)) total += ventasDelDia(negocio, d, hoyTexto, ahoraFecha);
  return bloqueVentas(total);
}

export function crearDatosPrueba({ almacen = almacenPorDefecto(), ahora = () => new Date(), simular = false } = {}) {
  const hoy = () => aTexto(ahora());
  const guardar = (e) => almacen.setItem(CLAVE, JSON.stringify(e));
  const leer = () => {
    try { const t = almacen.getItem(CLAVE); if (t) { const e = JSON.parse(t); if (e.version === 2 && e.hoy === hoy()) return e; } } catch { /* corrupto: se regenera */ }
    const e = generarSemilla(hoy()); guardar(e); return e;
  };
  const usuario = () => { try { const id = almacen.getItem(CLAVE_SESION); return USUARIOS.find((u) => u.id === id) || null; } catch { return null; } };
  const publico = ({ pin, ...resto }) => resto; // el PIN nunca sale de esta capa
  const exigir = () => { const u = usuario(); if (!u) throw new Error('No autorizado'); return u; };
  const esAdmin = (u) => u.rol === 'administrador';
  const exigirAdmin = () => { const u = exigir(); if (!esAdmin(u)) throw new Error('No autorizado'); return u; };
  const exigirNegocio = (u, negocioId) => { if (!u.negocios.includes(negocioId)) throw new Error('No autorizado'); };
  let fallos = 0, bloqueoHasta = 0;
  const oyentes = new Set();
  const oyentesMov = new Set();
  const avisar = (c) => oyentes.forEach((f) => { try { f(c); } catch { /* un oyente roto no frena a los demas */ } });

  const movsDeCaja = (e, cajaId) => e.movimientos.filter((m) => m.cajaId === cajaId);
  const corregidos = (e) => new Set(e.movimientos.filter((m) => m.corrigeA).map((m) => m.corrigeA));
  const vistaCaja = (e, c, admin) => {
    const movs = movsDeCaja(e, c.id);
    const base = { id: c.id, negocioId: c.negocioId, fecha: c.fecha, estado: c.estado, fondoInicial: c.fondoInicial, abiertaA: c.abiertaA, abiertaPor: c.abiertaPor, cerradaA: c.cerradaA || null, cerradaPor: c.cerradaPor || null };
    if (!admin) return base; // INFORMACION CIEGA: ni esperado, ni ventas, ni sobrante
    const t = totalesMovimientos(movs);
    const esperado = c.estado === 'cerrada' ? c.esperado : efectivoEsperado({ fondoInicial: c.fondoInicial, ventasEfectivo: c.ventas.efectivo }, movs);
    return { ...base, ...t, esperado, ventas: c.ventas, contado: c.contado ?? null, diferencia: c.estado === 'cerrada' ? c.contado - c.esperado : null };
  };
  const vistaMov = (e, m, cor) => ({ ...m, corregido: cor.has(m.id) });
  const orden = (c) => c.fecha + String(parseInt(c.id.split('-')[1], 10)).padStart(8, '0');
  const cajaAbierta = (e, negocioId) => e.cajas.find((c) => c.negocioId === negocioId && c.estado === 'abierta');
  const aprender = (e, tipo, motivo) => {
    const k = motivo.toLowerCase(); e.motivos[tipo] = e.motivos[tipo] || {};
    const x = e.motivos[tipo][k] || { texto: motivo, usos: 0 }; x.usos++; e.motivos[tipo][k] = x;
  };
  const comprasVisibles = (e, u, negocios) => {
    const ids = (negocios && negocios.length ? negocios : u.negocios).filter((n) => u.negocios.includes(n));
    return e.compras.filter((c) => ids.includes(c.negocioId));
  };
  const publicaCompra = ({ rubros, ...c }) => c;

  const { reiniciarBodega, ...metodosBodega } = crearBodegaPrueba({ almacen, hoy, ahora, exigirAdmin, nombreUsuario: () => usuario()?.nombre || 'Sistema' });

  const api = {
    ...metodosBodega,
    esPrueba: true,
    acceso: 'pin',
    async hoy() { return hoy(); },
    async estadoAcceso() { return usuario() ? 'abierta' : 'sin_sesion'; },
    async iniciarSesion({ pin } = {}) {
      if (Date.now() < bloqueoHasta) throw new Error('Demasiados intentos. Espere unos segundos e intente de nuevo.');
      if (!/^\d{4,6}$/.test(String(pin))) return null;
      const u = USUARIOS.find((x) => x.pin === String(pin));
      if (!u) { fallos++; if (fallos >= 5) { bloqueoHasta = Date.now() + 30000; fallos = 0; } return null; }
      fallos = 0; almacen.setItem(CLAVE_SESION, u.id); return publico(u);
    },
    async configurarPinLocal() { throw new Error('En modo de prueba el PIN ya está definido.'); },
    async desbloquear(pin) { return api.iniciarSesion({ pin }); },
    async bloquear() { almacen.removeItem(CLAVE_SESION); },
    async sesionActual() { const u = usuario(); return u ? publico(u) : null; },
    async cerrarSesion() { almacen.removeItem(CLAVE_SESION); },
    async negocios() { const u = exigir(); return NEGOCIOS.filter((n) => u.negocios.includes(n.id)); },
    async horarios() { const u = exigir(); return HORARIOS.filter((h) => u.negocios.includes(h.negocioId)); },
    async cajaActual(negocioId) {
      const u = exigir(); exigirNegocio(u, negocioId); const e = leer();
      const c = cajaAbierta(e, negocioId) || [...e.cajas].filter((x) => x.negocioId === negocioId).sort((a, b) => orden(a).localeCompare(orden(b))).pop();
      return c ? vistaCaja(e, c, esAdmin(u)) : null;
    },
    async abrirCaja(negocioId, { fondoInicial }) {
      const u = exigir(); exigirNegocio(u, negocioId); const e = leer();
      if (!Number.isInteger(fondoInicial) || fondoInicial < 0) throw new Error('El fondo inicial debe ser un monto entero en colones (puede ser cero).');
      if (cajaAbierta(e, negocioId)) throw new Error('Ya hay una caja abierta en este negocio.');
      const c = { id: `caja-${e.siguiente++}`, negocioId, fecha: hoy(), abiertaA: horaTexto(ahora()), abiertaPor: u.nombre, fondoInicial, estado: 'abierta', ventas: { efectivo: 0, tarjeta: 0, sinpe: 0, transferencia: 0 } };
      e.cajas.push(c); guardar(e); return vistaCaja(e, c, esAdmin(u));
    },
    async actividad(negocioId, fecha) {
      const u = exigir(); exigirNegocio(u, negocioId); const e = leer(); const cor = corregidos(e);
      return {
        cajas: e.cajas.filter((c) => c.negocioId === negocioId && c.fecha === fecha).map((c) => vistaCaja(e, c, esAdmin(u))),
        movimientos: e.movimientos.filter((m) => m.negocioId === negocioId && m.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora)).map((m) => vistaMov(e, m, cor)),
      };
    },
    async registrarMovimiento({ negocioId, tipo, monto, motivo, nota = '' }) {
      const u = exigir(); exigirNegocio(u, negocioId);
      if (!['entrada', 'salida'].includes(tipo)) throw new Error('Tipo de movimiento inválido');
      if (!Number.isInteger(monto) || monto <= 0) throw new Error('El monto debe ser un número entero mayor que cero');
      const mot = String(motivo || '').trim().replace(/\s+/g, ' ');
      if (!mot) throw new Error('Falta el motivo');
      const e = leer(); const caja = cajaAbierta(e, negocioId);
      if (!caja) throw new Error('No hay una caja abierta en este negocio. Ábrala primero.');
      const mov = { id: `mov-${e.siguiente++}`, cajaId: caja.id, negocioId, fecha: hoy(), hora: horaTexto(ahora()), tipo, monto, motivo: mot, nota: String(nota || '').trim(), registradoPor: u.nombre, corrigeA: null };
      e.movimientos.push(mov); aprender(e, tipo, mot); guardar(e); oyentesMov.forEach((f) => { try { f({ ...mov, corregido: false }); } catch { /* oyente roto */ } }); return { ...mov, corregido: false };
    },
    async corregirMovimiento(id, { nota = '' } = {}) {
      const u = exigir(); const e = leer();
      const o = e.movimientos.find((m) => m.id === id);
      if (!o) throw new Error('El movimiento no existe');
      exigirNegocio(u, o.negocioId);
      if (o.corrigeA) throw new Error('Una corrección no se puede corregir');
      if (corregidos(e).has(id)) throw new Error('Ese movimiento ya fue corregido.');
      const caja = cajaAbierta(e, o.negocioId);
      if (!caja) throw new Error('No hay una caja abierta para registrar la corrección. Ábrala primero.');
      const mov = { id: `mov-${e.siguiente++}`, cajaId: caja.id, negocioId: o.negocioId, fecha: hoy(), hora: horaTexto(ahora()), tipo: o.tipo === 'entrada' ? 'salida' : 'entrada', monto: o.monto, motivo: `Corrección: ${o.motivo}`.slice(0, 120), nota: String(nota || '').trim(), registradoPor: u.nombre, corrigeA: id };
      e.movimientos.push(mov); guardar(e); return { ...mov, corregido: false };
    },
    async sugerenciasMotivos(tipo) {
      exigir(); const e = leer(); const apr = e.motivos[tipo] || {};
      const lista = new Map(SEMILLA_MOTIVOS[tipo].map((t) => [t.toLowerCase(), { texto: t, usos: 0 }]));
      for (const [k, v] of Object.entries(apr)) lista.set(k, v);
      return [...lista.values()].sort((a, b) => b.usos - a.usos || a.texto.localeCompare(b.texto)).slice(0, 8).map((x) => x.texto);
    },
    async cerrarCaja(negocioId, { contado, confirmarFaltante = false }) {
      const u = exigir(); exigirNegocio(u, negocioId);
      if (!Number.isInteger(contado) || contado < 0) throw new Error('El efectivo contado debe ser un monto entero en colones');
      const e = leer(); const caja = cajaAbierta(e, negocioId);
      if (!caja) throw new Error('La caja ya está cerrada');
      const esperado = efectivoEsperado({ fondoInicial: caja.fondoInicial, ventasEfectivo: caja.ventas.efectivo }, movsDeCaja(e, caja.id));
      const faltante = Math.max(Math.round(esperado) - contado, 0);
      if (faltante > 0 && !confirmarFaltante) return { cerrada: false, requiereConfirmacion: true, faltante };
      Object.assign(caja, { estado: 'cerrada', cerradaA: horaTexto(ahora()), cerradaPor: u.nombre, esperado, contado });
      guardar(e);
      return esAdmin(u) ? { cerrada: true, esperado, contado, diferencia: contado - esperado } : { cerrada: true };
    },
    async cierres(negocioId, { limite = 7 } = {}) {
      const u = exigirAdmin(); exigirNegocio(u, negocioId); const e = leer();
      const todos = e.cajas.filter((c) => c.negocioId === negocioId && c.estado === 'cerrada').sort((a, b) => orden(b).localeCompare(orden(a)));
      return { items: todos.slice(0, limite).map((c) => ({ ...vistaCaja(e, c, true) })), hayMas: todos.length > limite };
    },
    async resumenSemana(negocioId) {
      const u = exigirAdmin(); exigirNegocio(u, negocioId); const e = leer();
      const dias = diasDeLaSemana(hoy()).map((fecha) => ({ fecha, ...totalesMovimientos(e.movimientos.filter((m) => m.negocioId === negocioId && m.fecha === fecha)) }));
      return { dias, entradas: dias.reduce((a, d) => a + d.entradas, 0), salidas: dias.reduce((a, d) => a + d.salidas, 0), neto: dias.reduce((a, d) => a + d.neto, 0) };
    },
    async comprasProveedores({ negocios } = {}) {
      const u = exigirAdmin(); const m = new Map();
      for (const c of comprasVisibles(leer(), u, negocios)) m.set(c.proveedorCedula, c.proveedor);
      return [...m].map(([cedula, nombre]) => ({ cedula, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async comprasLineas(clave) {
      return [{ linea: 1, detalle: 'Pechuga de pollo sin hueso', cantidad: 20, unidad: 'kg', precioUnitario: 3900, subtotal: 78000, impuesto: 0, total: 78000 },
        { linea: 2, detalle: 'Aceite vegetal 18 L', cantidad: 2, unidad: 'unidad', precioUnitario: 21500, subtotal: 43000, impuesto: 5590, total: 48590 }];
    },
    async comprasUltimas({ negocios, proveedor = null, limite = 8 } = {}) {
      const u = exigirAdmin();
      return comprasVisibles(leer(), u, negocios).filter((c) => !proveedor || c.proveedorCedula === proveedor)
        .sort((a, b) => (b.dia + b.hora + b.clave).localeCompare(a.dia + a.hora + a.clave)).slice(0, limite).map(publicaCompra);
    },
    async comprasResumen({ negocios, proveedor = null } = {}) {
      const u = exigirAdmin(); const h = hoy();
      const dias = agruparCompras(comprasVisibles(leer(), u, negocios), { desde: desdeResumen(h), hasta: h, por: 'dia', proveedor });
      return resumenDesdeDias(dias, h);
    },
    async comprasAgrupadas({ negocios, desde, hasta, por, proveedor = null }) {
      const u = exigirAdmin();
      return agruparCompras(comprasVisibles(leer(), u, negocios), { desde, hasta, por, proveedor });
    },
    // ---------- Ventas en vivo (datos ficticios y estables: el mismo dia da la misma cifra) ----------
    async ventasEnVivo({ negocios } = {}) {
      const u = exigirAdmin(); const h = hoy(); const e = leer();
      const ids = (negocios && negocios.length ? negocios : u.negocios).filter((n) => u.negocios.includes(n));
      const suma = (n, desde, hasta) => ventasDeRango(n, desde, hasta, h, ahora());
      return { generado: ahora().toISOString(), negocios: ids.map((n) => {
        const caja = e.cajas.filter((c) => c.negocioId === n).slice(-1)[0];
        const bt = caja ? bloqueVentas(Object.values(caja.ventas || {}).reduce((x, y) => x + (Number(y) || 0), 0), caja.estado, caja.fecha) : null;
        // En el turno de la cajera tambien facturan el administrador y la hermana de vez en cuando: el turno dice quien hizo que
        const turno = caja ? { ...bt, abiertaPor: 'Gisela (cajera)', cerradaPor: caja.estado === 'cerrada' ? 'Yarixa (cajera)' : null, desdeHora: caja.abiertaA || null, terminal: 1,
          participantes: [{ usuario: 'gisela', nombre: 'Gisela (cajera)', abrio: true, ventas: Math.max(bt.docs - 3, 0), notas: 1, total: bt.total - Math.round(bt.total * 0.04) },
            { usuario: 'emil', nombre: 'Emil Martínez', abrio: false, ventas: 3, notas: 1, total: Math.round(bt.total * 0.04) }] } : null;
        return { negocioId: n, turno, hoy: suma(n, h, h), semana: suma(n, lunesDe(h), h), mes: suma(n, inicioMes(h), h) };
      }) };
    },
    async ventasAgrupadas({ negocios, desde, hasta, por }) {
      const u = exigirAdmin(); const h = hoy();
      const ids = (negocios && negocios.length ? negocios : u.negocios).filter((n) => u.negocios.includes(n));
      const grupos = new Map();
      for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
        const k = inicioPeriodo(d, por); const g = grupos.get(k) || { clave: k, etiqueta: k, facturas: 0, neto: 0, iva: 0, total: 0 };
        for (const n of ids) { const v = ventasDeRango(n, d, d, h, ahora()); g.facturas += v.docs; g.neto += v.neto; g.iva += v.iva; g.total += v.total; }
        grupos.set(k, g);
      }
      return [...grupos.values()].map((g) => ({ ...g, neto: Math.round(g.neto), iva: Math.round(g.iva), total: Math.round(g.total) })).sort((a, b) => a.clave.localeCompare(b.clave));
    },
    // Avisos (simulados: en el modo de prueba no se manda nada al telefono)
    async avisosEstado() { exigirAdmin(); const e = leer(); return { motivo: '', activo: !!e.avisos, prefs: e.avisos || {} }; },
    async avisosActivar() { exigirAdmin(); const e = leer(); e.avisos = {}; guardar(e); return { motivo: '', activo: true, prefs: {} }; },
    async avisosDesactivar() { exigirAdmin(); const e = leer(); e.avisos = null; guardar(e); },
    async avisosGuardarPrefs(prefs) { exigirAdmin(); const e = leer(); e.avisos = { ...prefs }; guardar(e); return e.avisos; },
    async avisosProbar() { exigirAdmin(); },
    async ventasSuscribir(cb) { exigirAdmin(); const t = setInterval(() => cb({ tipo: 'pulso' }), 20000); return () => clearInterval(t); },
    async viajes() { exigir(); return (leer().viajes || []).slice().reverse(); },
    async viajeAgregar({ destino, fecha }) {
      const u = exigir(); if (!String(destino || '').trim() || !fecha) throw new Error('Falta el destino o la fecha');
      const e = leer(); e.viajes = e.viajes || []; e.viajes.push({ id: e.viajes.length + 1, destino: String(destino).trim(), fecha, creadoPor: u.nombre, creadoEn: ahora().toISOString() }); guardar(e); return true;
    },
    async diferenciasPendientes() {
      exigirAdmin(); const e = leer(); const hechas = new Set(e.resueltas || []);
      return e.cajas.filter((c) => c.estado === 'cerrada' && !hechas.has(c.id)).map((c) => { const v = vistaCaja(e, c, true); return { cajaId: c.id, negocioId: c.negocioId, fecha: c.fecha, diferencia: v.diferencia ?? 0 }; }).filter((d) => d.diferencia !== 0);
    },
    async diferenciaResolver({ cajaId }) { exigirAdmin(); const e = leer(); e.resueltas = [...(e.resueltas || []), cajaId]; guardar(e); return true; },
    async movimientosRecientes({ limite = 8 } = {}) {
      const u = exigir(); const e = leer();
      return e.movimientos.filter((m) => m.fecha === hoy() && u.negocios.includes(m.negocioId)).slice().reverse().slice(0, limite).map((m) => ({ ...m, corregido: false }));
    },
    async movimientosSuscribir(cb) { exigir(); oyentesMov.add(cb); return () => oyentesMov.delete(cb); },
    async comprasSuscribir(cb) { exigirAdmin(); oyentes.add(cb); return () => oyentes.delete(cb); },
    async restablecerPrueba() { exigir(); guardar(generarSemilla(hoy())); reiniciarBodega(); },
    // Solo de prueba (no es parte del contrato): simula que llega una factura nueva del proveedor
    async simularFactura() {
      const e = leer(); const prov = PROVEEDORES[Math.floor(Math.random() * PROVEEDORES.length)];
      const c = crearCompra(e, { negocioId: Math.random() < 0.5 ? 'soda' : 'pollos', dia: hoy(), hora: horaTexto(ahora()), prov, neto: redondear(20000 + Math.random() * 90000, 50) });
      e.compras.push(c); guardar(e); avisar({ tipo: 'nueva', clave: c.clave }); return publicaCompra(c);
    },
  };
  if (simular) setInterval(() => { if (usuario() && esAdmin(usuario())) api.simularFactura(); }, 45000);
  return validarImplementacion(api);
}
