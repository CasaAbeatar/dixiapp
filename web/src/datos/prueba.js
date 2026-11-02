// Implementacion de PRUEBA: datos ficticios en memoria, guardados en localStorage.
// No toca ninguna base de datos real.
import { validarImplementacion } from './interfaz.js';
import { efectivoEsperado, totalesMovimientos, diferencia } from './calculos.js';
import { aTexto, horaTexto, sumarDias, diasDeLaSemana } from './fechas.js';

const CLAVE = 'dixiapp.prueba.v1';
const CLAVE_SESION = 'dixiapp.sesion.v1';

export const NEGOCIOS = [
  { id: 'soda', nombre: 'Soda La Bomba' },
  { id: 'pollos', nombre: 'Pollos La Bomba' },
];
export const USUARIOS = [
  { id: 'u-gerente', nombre: 'Gerente de prueba', rol: 'gerente', pin: '1234', negocios: ['soda', 'pollos'] },
  { id: 'u-empleada', nombre: 'Empleada de prueba', rol: 'empleada', pin: '4321', negocios: ['soda'] },
];

function azar(semilla) { // generador determinista
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const redondear = (n, paso = 500) => Math.round(n / paso) * paso;
const SALIDAS_EJ = [['Proveedor', 18000, 45000], ['Gas', 12000, 20000], ['Hielo e insumos', 3000, 9000], ['Pago a personal', 15000, 30000], ['Transporte', 2000, 6000]];
const ENTRADAS_EJ = [['Sencillo o cambio', 10000, 30000], ['Aporte de la gerencia', 20000, 50000]];

export function generarSemilla(hoy) {
  const estado = { version: 1, cajas: [], cierres: [], movimientos: [], siguiente: 1 };
  const id = (p) => `${p}-${estado.siguiente++}`;
  NEGOCIOS.forEach((neg, ni) => {
    const rnd = azar(7919 * (ni + 3));
    const escala = ni === 0 ? 1 : 0.8;
    for (let k = 30; k >= 0; k--) {
      const fecha = sumarDias(hoy, -k);
      const esHoy = k === 0;
      const caja = {
        id: id('caja'), negocioId: neg.id, fecha, fondoInicial: 50000, abiertaA: '06:30',
        ventasEfectivo: redondear((90000 + rnd() * 140000) * escala * (esHoy ? 0.55 : 1)),
        ventasTarjeta: redondear((120000 + rnd() * 180000) * escala * (esHoy ? 0.5 : 1)),
        ventasSinpe: redondear((40000 + rnd() * 90000) * escala * (esHoy ? 0.5 : 1)),
        estado: esHoy ? 'abierta' : 'cerrada',
      };
      estado.cajas.push(caja);
      const nS = esHoy ? 2 : 1 + Math.floor(rnd() * 3), nE = esHoy ? 1 : Math.floor(rnd() * 2.2);
      const movs = [];
      for (let i = 0; i < nS; i++) {
        const [motivo, lo, hi] = SALIDAS_EJ[Math.floor(rnd() * SALIDAS_EJ.length)];
        movs.push({ tipo: 'salida', monto: redondear(lo + rnd() * (hi - lo)), motivo });
      }
      for (let i = 0; i < nE; i++) {
        const [motivo, lo, hi] = ENTRADAS_EJ[Math.floor(rnd() * ENTRADAS_EJ.length)];
        movs.push({ tipo: 'entrada', monto: redondear(lo + rnd() * (hi - lo)), motivo });
      }
      movs.forEach((m, i) => {
        const hh = 7 + Math.floor(((i + 1) * 9) / (movs.length + 1));
        estado.movimientos.push({
          id: id('mov'), negocioId: neg.id, fecha, hora: `${String(hh).padStart(2, '0')}:${i % 2 ? '40' : '15'}`,
          ...m, nota: '', registradoPor: i % 2 ? 'Empleada de prueba' : 'Gerente de prueba',
        });
      });
      if (!esHoy) {
        const esperado = efectivoEsperado(caja, movs);
        const r = rnd();
        const dif = r < 0.7 ? 0 : r < 0.85 ? -redondear(500 + rnd() * 4500) : redondear(500 + rnd() * 2500);
        const cierre = {
          id: id('cierre'), negocioId: neg.id, fecha, hora: rnd() < 0.5 ? '21:10' : '21:45', esperado, contado: esperado + dif,
          diferencia: dif, tarjeta: caja.ventasTarjeta, sinpe: caja.ventasSinpe, ventasEfectivo: caja.ventasEfectivo,
          cerradoPor: rnd() < 0.6 ? 'Gerente de prueba' : 'Empleada de prueba',
        };
        estado.cierres.push(cierre);
      }
    }
  });
  return estado;
}

function almacenMemoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function almacenPorDefecto() {
  try { if (typeof localStorage !== 'undefined') { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } } catch { /* sin localStorage */ }
  return almacenMemoria();
}

export function crearDatosPrueba({ almacen = almacenPorDefecto(), ahora = () => new Date() } = {}) {
  const hoy = () => aTexto(ahora());
  const leer = () => {
    try { const t = almacen.getItem(CLAVE); if (t) { const e = JSON.parse(t); if (e.version === 1 && e.cajas.some((c) => c.fecha === hoy())) return e; } } catch { /* corrupto: se regenera */ }
    const e = generarSemilla(hoy()); guardar(e); return e;
  };
  const guardar = (e) => almacen.setItem(CLAVE, JSON.stringify(e));
  const usuario = () => { try { const id = almacen.getItem(CLAVE_SESION); return USUARIOS.find((u) => u.id === id) || null; } catch { return null; } };
  const quitarPin = ({ pin, ...resto }) => resto; // el PIN nunca sale de esta capa
  const exigir = (rol) => { const u = usuario(); if (!u) throw new Error('No autorizado'); if (rol && u.rol !== rol) throw new Error('No autorizado'); return u; };
  const exigirNegocio = (u, negocioId) => { if (!u.negocios.includes(negocioId)) throw new Error('No autorizado'); };
  let fallos = 0, bloqueoHasta = 0;

  const movsDe = (e, negocioId, fecha) => e.movimientos.filter((m) => m.negocioId === negocioId && m.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));

  const api = {
    async hoy() { return hoy(); },
    async iniciarSesion(pin) {
      if (Date.now() < bloqueoHasta) throw new Error('Demasiados intentos. Espere unos segundos e intente de nuevo.');
      if (!/^\d{4,6}$/.test(String(pin))) return null;
      const u = USUARIOS.find((x) => x.pin === String(pin));
      if (!u) { fallos++; if (fallos >= 5) { bloqueoHasta = Date.now() + 30000; fallos = 0; } return null; }
      fallos = 0; almacen.setItem(CLAVE_SESION, u.id); return quitarPin(u);
    },
    async sesionActual() { const u = usuario(); return u ? quitarPin(u) : null; },
    async cerrarSesion() { almacen.removeItem(CLAVE_SESION); },
    async negocios() { const u = exigir(); return NEGOCIOS.filter((n) => u.negocios.includes(n.id)); },
    async cajaDeHoy(negocioId) {
      const u = exigir(); exigirNegocio(u, negocioId);
      const e = leer(); const f = hoy();
      const caja = e.cajas.find((c) => c.negocioId === negocioId && c.fecha === f);
      const t = totalesMovimientos(movsDe(e, negocioId, f));
      const cierre = e.cierres.find((c) => c.negocioId === negocioId && c.fecha === f);
      return { ...caja, ...t, esperado: efectivoEsperado(caja, movsDe(e, negocioId, f)), cierre: cierre || null };
    },
    async movimientos(negocioId, fecha) {
      const u = exigir(); exigirNegocio(u, negocioId);
      if (u.rol !== 'gerente' && fecha !== hoy()) throw new Error('No autorizado');
      return movsDe(leer(), negocioId, fecha);
    },
    async registrarMovimiento({ negocioId, tipo, monto, motivo, nota = '', registradoPor }) {
      const u = exigir(); exigirNegocio(u, negocioId);
      if (!['entrada', 'salida'].includes(tipo)) throw new Error('Tipo de movimiento inválido');
      if (!Number.isInteger(monto) || monto <= 0) throw new Error('El monto debe ser un número entero mayor que cero');
      if (!motivo || !String(motivo).trim()) throw new Error('Falta el motivo');
      const e = leer(); const f = hoy();
      const caja = e.cajas.find((c) => c.negocioId === negocioId && c.fecha === f);
      if (caja.estado === 'cerrada') throw new Error('La caja de hoy ya está cerrada');
      const mov = { id: `mov-${e.siguiente++}`, negocioId, fecha: f, hora: horaTexto(ahora()), tipo, monto, motivo: String(motivo).trim(), nota: String(nota || '').trim(), registradoPor: registradoPor || u.nombre };
      e.movimientos.push(mov); guardar(e); return mov;
    },
    async cerrarCaja(negocioId, { contado, tarjeta, sinpe }) {
      const u = exigir('gerente'); exigirNegocio(u, negocioId);
      for (const [n, v] of [['efectivo contado', contado], ['tarjeta', tarjeta], ['SINPE', sinpe]]) if (!Number.isInteger(v) || v < 0) throw new Error(`Monto inválido en ${n}`);
      const e = leer(); const f = hoy();
      const caja = e.cajas.find((c) => c.negocioId === negocioId && c.fecha === f);
      if (caja.estado === 'cerrada') throw new Error('La caja de hoy ya está cerrada');
      const esperado = efectivoEsperado(caja, movsDe(e, negocioId, f));
      const cierre = { id: `cierre-${e.siguiente++}`, negocioId, fecha: f, hora: horaTexto(ahora()), esperado, contado, diferencia: diferencia(contado, esperado), tarjeta, sinpe, ventasEfectivo: caja.ventasEfectivo, cerradoPor: u.nombre };
      caja.estado = 'cerrada'; e.cierres.push(cierre); guardar(e); return cierre;
    },
    async cierres(negocioId, { limite = 7 } = {}) {
      const u = exigir('gerente'); exigirNegocio(u, negocioId);
      const todos = leer().cierres.filter((c) => c.negocioId === negocioId).sort((a, b) => b.fecha.localeCompare(a.fecha));
      return { items: todos.slice(0, limite), hayMas: todos.length > limite };
    },
    async resumenSemana(negocioId) {
      const u = exigir('gerente'); exigirNegocio(u, negocioId);
      const e = leer();
      const dias = diasDeLaSemana(hoy()).map((fecha) => ({ fecha, ...totalesMovimientos(movsDe(e, negocioId, fecha)) }));
      return { dias, entradas: dias.reduce((a, d) => a + d.entradas, 0), salidas: dias.reduce((a, d) => a + d.salidas, 0), neto: dias.reduce((a, d) => a + d.neto, 0) };
    },
    async restablecerPrueba() { exigir('gerente'); guardar(generarSemilla(hoy())); },
  };
  return validarImplementacion(api);
}
