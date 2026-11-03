// CONTRATO de la capa de datos de Dixiapp.
// Cualquier implementacion (prueba.js, supabase.js) debe exponer estas funciones, todas asincronas,
// mas dos propiedades simples: `esPrueba` (boolean) y `acceso` ('pin' | 'correo').
// Para cambiar de fuente de datos solo se cambia la configuracion (config.js); la app no se entera.
//
// Tipos (resumen):
//  Negocio    { id, nombre }
//  Usuario    { id, nombre, rol: 'administrador' | 'empleado', negocios: [negocioId] }
//  Caja       { id, negocioId, fecha, estado: 'abierta'|'cerrada', fondoInicial, abiertaA:'HH:MM', abiertaPor,
//               cerradaA, cerradaPor }                      <- visible para todo cajero (informacion ciega)
//             + solo administradores: esperado, ventas {efectivo,tarjeta,sinpe,transferencia}, entradas, salidas, contado, diferencia
//  Movimiento { id, cajaId, negocioId, fecha, hora, tipo:'entrada'|'salida', monto, motivo, nota, registradoPor,
//               corrigeA (id|null), corregido (boolean) }
//  Compra     { clave, negocioId, dia, hora, proveedor, proveedorCedula, tipoProveedor, clase, moneda, total, neto, iva,
//               totalCrc, netoCrc, ivaCrc, estado, grupo, rubro }
//
// Permisos: un cajero (cualquier rol activo del negocio) abre y cierra caja y ve la actividad de cualquier fecha,
// pero NUNCA el esperado, el sobrante ni las ventas. Lo demas lanza Error('No autorizado').
// Dixiapp SOLO CONSULTA el efectivo: las entradas y salidas se registran y corrigen en el facturador (decision de Emil, 3 nov 2026). No hay metodos para registrarlas ni corregirlas.

export const METODOS = [
  'hoy',                  // () => 'AAAA-MM-DD' (hora de Costa Rica)
  'estadoAcceso',         // () => 'sin_sesion' | 'crear_pin' | 'bloqueada' | 'abierta'
  'iniciarSesion',        // ({pin} | {correo, clave}) => Usuario | null
  'configurarPinLocal',   // (pin) => Usuario        (solo acceso por correo: PIN de este aparato)
  'desbloquear',          // (pin) => Usuario | null
  'bloquear',             // () => void              (pide el PIN otra vez)
  'sesionActual',         // () => Usuario | null
  'cerrarSesion',         // () => void
  'negocios',             // () => Negocio[]
  'horarios',             // () => [{negocioId, servicio, texto}]
  'cajaActual',           // (negocioId) => Caja | null   (la abierta, o la ultima cerrada)
  'abrirCaja',            // (negocioId, {fondoInicial}) => Caja
  'actividad',            // (negocioId, fecha) => { cajas: Caja[], movimientos: Movimiento[] }
  'cerrarCaja',           // (negocioId, {contado, confirmarFaltante}) => {cerrada:true} | {requiereConfirmacion:true, faltante}
  'cierres',              // (negocioId, {limite}) => { items: Cierre[], hayMas }      [administrador]
  'cierresTurnos',        // ({negocios, desde, hasta, limite}) => { generado, hoy, hayMas, turnos: Turno[] }  [administrador] turnos de caja del FACTURADOR, del mas reciente al mas antiguo. Turno {id, negocioId, terminal, estado:'abierto'|'cerrado', dia (AAAA-MM-DD del cierre; de la apertura si sigue abierto), abiertoPor, abiertoDia, abiertoHora:'HH:MM'} y, SOLO si esta cerrado: numero, cerradoPor, cerradoHora, fondo, entradas, salidas, devolucionesEfectivo, cobrosNotaDebito, ventas {efectivo,tarjeta,sinpe,transferencia,otros}, totalVentas, ventasNetas, esperado, contado, diferencia (negativa = faltante), nota, movEntradas/movSalidas [{motivo, monto, hora, por}]. Un turno abierto no trae ninguna cifra. Montos con IVA
  'resumenSemana',        // (negocioId) => { dias:[{fecha,entradas,salidas,neto}], entradas, salidas, neto } [administrador]
  // Compras (solo administradores)
  'comprasProveedores',   // ({negocios, desde, hasta, rubro}) => [{cedula, nombre (comercial si existe), legal, facturas, neto, iva, total}] por nombre
  'comprasLineas',        // (clave) => [{linea, detalle, cantidad, unidad, precioUnitario, subtotal, impuesto, total}] (solo lectura)
  'comprasUltimas',       // ({negocios, proveedor, rubro, desde, hasta, limite}) => Compra[] (mas reciente primero)
  'comprasResumen',       // ({negocios, proveedor}) => { hoy, semana, mes } cada uno { facturas, neto, iva, total }
  'comprasAgrupadas',     // ({negocios, desde, hasta, por, proveedor}) => [{clave, etiqueta, facturas, neto, iva, total}]
  'comprasSuscribir',     // (callback) => funcion para cancelar (tiempo real)
  // Ventas (solo administradores, solo consulta; salen del facturador con la misma regla de la caja: ventas facturadas menos notas de credito mas notas de debito)
  'ventasEnVivo',         // ({negocios}) => { generado, negocios: [{negocioId, turno: {estado, desde, hasta, abiertaPor, cerradaPor, terminal, participantes:[{usuario, nombre, abrio, ventas, notas, total}], total, iva, neto, docs}|null  (turno del FACTURADOR: lo abre la cajera y dentro facturan tambien administrador y hermana), hoy, semana, mes}] } cada bloque {total, iva, neto, docs}; total = con IVA
  'ventasAgrupadas',      // ({negocios, desde, hasta, por: 'dia'|'semana'|'mes'}) => [{clave, etiqueta, facturas, neto, iva, total}]  (facturas = documentos de venta)
  'ventasTop',            // ({negocios, desde, hasta, limite=5}) => { desde, hasta, mas:[{nombre, unidades, total}], menos:[{nombre, unidades, total}] (los que SI se vendieron; sin repetir los de 'mas'), vendidos, menuTotal, sinVentas|null }; total = con IVA
  'ventasPorHora',        // ({negocios, fecha}) => { fecha, semanas (cuantos de los 4 mismos dias anteriores tuvieron ventas), horas:[{hora 0..23, hoy, promedio|null, docs}] }; con IVA, hora de Costa Rica
  'avisosEstado',         // () => {motivo:''|'ios_sin_instalar'|'sin_soporte'|'bloqueado', activo, prefs}
  'avisosActivar',        // () => {activo, prefs}   (pide el permiso del telefono)
  'avisosDesactivar',     // () => void
  'avisosGuardarPrefs',   // (prefs) => prefs
  'avisosProbar',         // () => void   (manda un aviso de prueba)
  'ventasSuscribir',      // (callback) => funcion para cancelar (se avisa cada pocos segundos mientras este abierta)
  // Bodega (solo administradores): se apoya en el inventario del facturador (fact.inv_*), sin duplicarlo
  'bodegaUbicaciones',    // () => [{id, nombre, tipo: 'bodega'|'local'}]
  'bodegaExistencias',    // ({ubicacion, q}) => [{articuloId, articulo, categoria, unidad, ubicacionId, ubicacion, cantidad, minimo, bajoMinimo, vencida, proximoVencimiento}]
  'bodegaAlertas',        // () => {bajoMinimo:[...], vencenPronto:[...], vencidos:[...], porRecibir}
  'bodegaPorRecibir',     // () => [{clave, proveedor, fecha, empresa, total, lineas:[{linea, descripcion, cantidad, unidad, sugerencia: {articuloId, articulo, factor, unidad}|null, propuesta: {articuloId, articulo, factor, unidad, nivel, razon, modelo}|null}]}]
  'bodegaRecibir',        // ({lineas:[{clave, linea, articuloId, factor, venceEn?}]}) => {recibidas}   (articuloId distinto del sugerido = asignar; el facturador lo recuerda)
  'bodegaSalida',         // ({tipo:'consumo'|'merma'|'devolucion', ubicacion, items:[{articuloId, cantidad}], motivo}) => {valor}
  'bodegaTrasladar',      // ({origen, destino, items, motivo}) => {}
  'bodegaConteo',         // (ubicacion) => Conteo | null   Conteo {id, ubicacion, ubicacionId, estado, contadas, total, lineas:[{articuloId, articulo, categoria, unidad, contado, diferencia}]}
  'bodegaConteoIniciar',  // (ubicacion) => Conteo
  'bodegaConteoRegistrar',// (conteoId, items:[{articuloId, contado}]) => Conteo
  'bodegaConteoConfirmar',// (conteoId) => {ajustes:[{articulo, unidad, esperado, contado, diferencia}], sinCambio}
  'bodegaConteoCancelar', // (conteoId, motivo) => void
  'bodegaAjustar',        // ({ubicacion, items:[{articuloId, cantidadReal}], motivo}) => {ajustes:[{articulo, antes, despues, diferencia}]}
  'bodegaMovimientos',    // ({ubicacion, limite}) => [{id, tipo, tipoNombre, articulo, unidad, cantidad, ubicacion, motivo, usuario, fecha, hora}]
  'bodegaArticulos',      // ({q}) => [{id, nombre, categoria, unidad, existencia, minimos:{[ubicacionId]: numero}}]  (catalogo para elegir y para fijar minimos)
  'bodegaFijarMinimos',   // ({items:[{articuloId, ubicacionId, minimo}]}) => {guardados}   (minimo 0 = sin minimo)
  'bodegaSugerenciaMinimos', // () => {nota, items:[{articuloId, articulo, ubicacionId, ubicacion, minimo, porSemana, unidad}]}  SOLO sugerencia: no aplica nada
  'bodegaLotes',          // ({articulo, ubicacion}) => [{id, articuloId, articulo, unidad, ubicacion, cantidad, inicial, venceEn, dias, vencido, entrada, origen}]
  'bodegaRecibidas',      // ({limite}) => [{clave, linea, proveedor, descripcion, articulo, unidad, cantidad, ubicacion, fecha, deshacible}]  (recepciones que se pueden deshacer)
  'bodegaDeshacerRecepcion', // ({clave, linea, motivo}) => {clave, linea}   (contramovimiento; solo si el lote no se uso)
  'bodegaNotas',          // ({estado}) => [{clave, tipo, proveedor, fecha, empresa, total, estado, lineas:[{linea, descripcion, cantidad, unidad, articuloId, articulo, factor}]}]
  'bodegaNotaDevolver',   // ({clave, ubicacion, items:[{articuloId, cantidad}], motivo}) => {items}   (salida por devolucion ligada a la nota de credito)
  'bodegaNotaIgnorar',    // ({clave, motivo}) => void   («no afecta el inventario»)
  // Inicio de Dixia
  'viajes',               // () => [{id, destino, fecha, creadoPor, creadoEn}] (el mas reciente primero)
  'viajeAgregar',         // ({destino, fecha}) => true   (queda en historial; el aviso a admin@ lo envia un proceso aparte)
  'diferenciasPendientes',// () => [{cajaId, negocioId, fecha, diferencia}]  cierres con diferencia aun sin resolver [administrador]
  'diferenciaResolver',   // ({cajaId, nota}) => true     [administrador]
  'movimientosRecientes', // ({limite}) => Movimiento[] de hoy en todos los negocios del usuario, el mas reciente primero
  'movimientosSuscribir', // (callback(Movimiento)) => funcion para cancelar (tiempo real)
  'restablecerPrueba',    // () => void (solo implementacion de prueba)
];

export const ESTADOS_COMPRA = {
  aceptada: 'Aceptada', aceptada_parcial: 'Aceptada parcial', rechazada: 'Rechazada', rechazada_hacienda: 'Rechazada por Hacienda',
  pendiente: 'Sin responder', sin_respuesta: 'No requiere respuesta',
};
export const GRUPOS_COMPRA = { comida_preparada: 'Comida preparada', unitario: 'Unitarios', suministro: 'Suministros', otros: 'Otros' };
export const CLASES_COMPRA = { factura: 'Factura', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito', tiquete: 'Tiquete', compra: 'Factura de compra' };

export function validarImplementacion(obj) {
  const faltan = METODOS.filter((m) => typeof obj[m] !== 'function');
  if (faltan.length) throw new Error('La implementacion de datos no cumple el contrato. Faltan: ' + faltan.join(', '));
  if (typeof obj.esPrueba !== 'boolean' || !['pin', 'correo'].includes(obj.acceso)) throw new Error('Faltan esPrueba o acceso en la implementacion de datos');
  return obj;
}
