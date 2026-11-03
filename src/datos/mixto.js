// Capa MIXTA: Compras, Bodega, avisos y acceso siguen siendo REALES; caja, cierres, ventas y viajes usan datos de ejemplo
// (los de prueba.js, guardados solo en este aparato) mientras la base todavia no tiene esos datos.
// Se apaga poniendo `ejemplo: false` en config.js: la app vuelve a leer todo de la base real.
import { crearDatosPrueba } from './prueba.js';

const EJEMPLO = ['cajaActual', 'abrirCaja', 'actividad', 'registrarMovimiento', 'corregirMovimiento', 'sugerenciasMotivos', 'cerrarCaja', 'cierres', 'resumenSemana',
  'ventasEnVivo', 'ventasAgrupadas', 'ventasTop', 'ventasPorHora', 'ventasSuscribir', 'viajes', 'viajeAgregar', 'diferenciasPendientes', 'diferenciaResolver',
  'movimientosRecientes', 'movimientosSuscribir'];
// Pestanas que muestran datos de ejemplo (la etiqueta se ve arriba de la pantalla)
const PESTANAS_EJEMPLO = ['Inicio', 'Caja', 'Ventas', 'Cierres'];

export function crearDatosMixto(real, opciones = {}) {
  const ej = crearDatosPrueba({ ...opciones, simular: false });
  const api = { ...real };
  // El ejemplo necesita su propia sesion interna: se abre sola (administrador de ejemplo) cuando la sesion real esta abierta
  const abrirEjemplo = async () => { if ((await ej.estadoAcceso()) !== 'abierta') await ej.iniciarSesion({ pin: '1234' }); };
  for (const m of EJEMPLO) api[m] = async (...a) => { await abrirEjemplo(); return ej[m](...a); };
  api.cerrarSesion = async () => { await ej.cerrarSesion(); return real.cerrarSesion(); };
  api.bloquear = async () => { await ej.cerrarSesion(); return real.bloquear(); };
  api.ejemplo = true;
  api.esEjemploEn = (pestana) => PESTANAS_EJEMPLO.includes(pestana);
  return api;
}
