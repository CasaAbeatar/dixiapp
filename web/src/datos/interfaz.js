// CONTRATO de la capa de datos de Dixiapp.
// Cualquier implementacion (prueba.js, supabase.js) debe exponer estas funciones, todas asincronas.
// Para cambiar de fuente de datos solo se reemplaza el archivo importado en index.js.
//
// Tipos (resumen):
//  Negocio    { id, nombre }
//  Usuario    { id, nombre, rol: 'gerente' | 'empleada', negocios: [negocioId] }
//  Caja       { id, negocioId, fecha, fondoInicial, abiertaA: 'HH:MM', ventasEfectivo, ventasTarjeta, ventasSinpe,
//               estado: 'abierta' | 'cerrada', esperado, entradas, salidas }
//  Movimiento { id, negocioId, fecha, hora, tipo: 'entrada' | 'salida', monto, motivo, nota, registradoPor }
//  Cierre     { id, negocioId, fecha, hora, esperado, contado, diferencia, tarjeta, sinpe, cerradoPor }
//
// Permisos: la empleada solo puede ver la caja de hoy y registrar movimientos de hoy.
// Las funciones de gerente lanzan Error('No autorizado') si el rol no alcanza.

export const METODOS = [
  'hoy',                  // () => 'AAAA-MM-DD'
  'iniciarSesion',        // (pin) => Usuario | null
  'sesionActual',         // () => Usuario | null
  'cerrarSesion',         // () => void
  'negocios',             // () => Negocio[] (solo los permitidos al usuario)
  'cajaDeHoy',            // (negocioId) => Caja
  'movimientos',          // (negocioId, fecha) => Movimiento[] (orden cronologico)
  'registrarMovimiento',  // ({negocioId, tipo, monto, motivo, nota, registradoPor}) => Movimiento
  'cerrarCaja',           // (negocioId, {contado, tarjeta, sinpe}) => Cierre            [gerente]
  'cierres',              // (negocioId, {limite}) => { items: Cierre[] (recientes primero), hayMas }  [gerente]
  'resumenSemana',        // (negocioId) => { dias: [{fecha, entradas, salidas, neto}], entradas, salidas, neto } [gerente]
  'restablecerPrueba',    // () => void (solo implementacion de prueba)
];

export const MOTIVOS_SALIDA = ['Proveedor', 'Gas', 'Hielo e insumos', 'Pago a personal', 'Transporte', 'Otro'];
export const MOTIVOS_ENTRADA = ['Sencillo o cambio', 'Aporte de la gerencia', 'Devolución de proveedor', 'Otro'];

export function validarImplementacion(obj) {
  const faltan = METODOS.filter((m) => typeof obj[m] !== 'function');
  if (faltan.length) throw new Error('La implementacion de datos no cumple el contrato. Faltan: ' + faltan.join(', '));
  return obj;
}
