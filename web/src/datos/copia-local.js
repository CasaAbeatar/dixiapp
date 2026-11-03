// Copia local de lecturas: sin internet, Dixiapp muestra lo ultimo que se vio. Solo LECTURAS; las escrituras de dinero o inventario
// nunca se guardan ni se reenvian despues (podrian duplicarse): sin internet avisan que necesitan conexion.
// Las copias se borran al cerrar sesion o bloquear.
const PREF = 'dixiapp.copia.';
export const LECTURAS = ['negocios', 'horarios', 'cajaActual', 'actividad', 'cierres', 'cierresTurnos', 'resumenSemana', 'comprasProveedores', 'comprasLineas', 'comprasUltimas', 'comprasResumen', 'comprasAgrupadas', 'ventasEnVivo', 'ventasAgrupadas', 'ventasTop', 'ventasPorHora', 'bodegaUbicaciones', 'bodegaExistencias', 'bodegaAlertas', 'bodegaPorRecibir', 'bodegaConteo', 'bodegaMovimientos', 'bodegaArticulos', 'bodegaSugerenciaMinimos', 'bodegaLotes', 'bodegaRecibidas', 'bodegaNotas', 'viajes', 'diferenciasPendientes', 'movimientosRecientes'];
export const ESCRITURAS = ['abrirCaja', 'cerrarCaja', 'bodegaRecibir', 'bodegaSalida', 'bodegaTrasladar', 'bodegaConteoIniciar', 'bodegaConteoRegistrar', 'bodegaConteoConfirmar', 'bodegaConteoCancelar', 'bodegaAjustar', 'bodegaDeshacerRecepcion', 'bodegaFijarMinimos', 'bodegaNotaDevolver', 'bodegaNotaIgnorar', 'viajeAgregar', 'diferenciaResolver', 'avisosActivar', 'avisosDesactivar', 'avisosGuardarPrefs', 'avisosProbar'];
export const MSG_SIN_CONEXION = 'Sin conexión: esto necesita internet. Lo que ve en pantalla es lo último que se guardó.';

const esRed = (e) => e instanceof TypeError || /failed to fetch|network|load failed|fetch|conexi/i.test(String(e?.message || ''));

export function conCopiaLocal(real, { almacen = globalThis.localStorage, enLinea = () => globalThis.navigator?.onLine !== false, ahora = () => Date.now(), avisar = () => {} } = {}) {
  const estado = { sinConexion: false, ultima: null };
  const poner = (sin, t) => { const cambio = estado.sinConexion !== sin || (sin && estado.ultima !== t); estado.sinConexion = sin; if (sin) estado.ultima = t; if (cambio) avisar({ ...estado }); };
  const leer = (k) => { try { const v = almacen.getItem(PREF + k); return v ? JSON.parse(v) : null; } catch { return null; } };
  const borrarTodo = () => { try { const ks = []; for (let i = 0; i < almacen.length; i++) { const k = almacen.key(i); if (k && k.startsWith(PREF)) ks.push(k); } ks.forEach((k) => almacen.removeItem(k)); } catch { /* sin almacenamiento */ } };
  const guardar = (k, v) => {
    const txt = JSON.stringify({ t: ahora(), v });
    try { almacen.setItem(PREF + k, txt); } catch { borrarTodo(); try { almacen.setItem(PREF + k, txt); } catch { /* sin espacio: queda sin copia */ } }
  };
  const llave = (m, a) => m + ':' + JSON.stringify(a);

  const api = { ...real };
  for (const m of LECTURAS) {
    api[m] = async (...args) => {
      const k = llave(m, args);
      const dePrueba = () => { const c = leer(k); if (c) { poner(true, c.t); return c.v; } throw new Error('Sin conexión y todavía no hay una copia de esta pantalla. Ábrala una vez con internet.'); };
      if (!enLinea()) return dePrueba();
      let r;
      try {
        try { r = await real[m](...args); }
        catch (e) { if (/No autorizado/i.test(String(e?.message)) && real.estadoAcceso) { await real.estadoAcceso(); r = await real[m](...args); } else throw e; }
      } catch (e) { if (esRed(e)) return dePrueba(); throw e; }
      guardar(k, r); poner(false, null); return r;
    };
  }
  for (const m of ESCRITURAS) {
    api[m] = async (...args) => { if (!enLinea()) throw new Error(MSG_SIN_CONEXION); try { return await real[m](...args); } catch (e) { throw esRed(e) ? new Error(MSG_SIN_CONEXION) : e; } };
  }
  api.estadoAcceso = async () => { if (!enLinea()) { return leer('usuario') ? 'abierta' : 'sin_sesion'; } return real.estadoAcceso(); };
  api.sesionActual = async () => {
    if (!enLinea()) { const c = leer('usuario'); if (c) { poner(true, c.t); return c.v; } return null; }
    try { const u = await real.sesionActual(); if (u) guardar('usuario', u); return u; }
    catch (e) { if (esRed(e)) { const c = leer('usuario'); if (c) { poner(true, c.t); return c.v; } } throw e; }
  };
  api.cerrarSesion = async () => { borrarTodo(); poner(false, null); return real.cerrarSesion(); };
  api.bloquear = async () => { borrarTodo(); poner(false, null); return real.bloquear(); };
  api.copia = estado;
  return api;
}
