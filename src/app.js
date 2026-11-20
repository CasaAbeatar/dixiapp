// Antiencuadre: si otra pagina mete Dixiapp en un marco, no se muestra (GitHub Pages no deja poner frame-ancestors).
if (window.top !== window.self) { document.documentElement.style.display = 'none'; try { window.top.location = window.self.location; } catch { /* sin permiso: queda oculto */ } }
import './aviso-conexion.js';
import { datos } from './datos/index.js';
import { leerMonto, aplicarTema, esc } from './ui.js';
import { vistaPin, vistaEntrada, vistaSplash, vistaCorreo, marco, selectorNegocio, vistaCaja, vistaMas, vistaEsqueleto, MINIMOS_EFECTIVO } from './vistas.js';
import { vistaCierresTurnos } from './vistas-cierres.js';
import { resultadosBusqueda, vistaCompras } from './vistas-compras.js';
import { vistaInicio, diasHasta } from './vistas-inicio.js';
import { mensajeDelDia } from './mensajes.js';
import { fechaLarga, lunesDe, sumarDias } from './datos/fechas.js';
import { colones } from './datos/formato.js';
import { estadoDiferencia, diferencia } from './datos/calculos.js';
import { construirBodega, accionBodega, entradaBodega, despuesDePintar, estadoBodega } from './bodega.js';
import { rangoPorDefecto, rellenarPeriodos, sumarMeses, inicioMes } from './datos/compras-calc.js';
import { vistaVentas } from './vistas-ventas.js';
import { vistaSinpe, vistaPagos } from './vistas-sinpe.js';
import { rangoNegocio } from './datos/negocio-calc.js';
import { precargarTodo } from './datos/precarga.js';

const raiz = document.getElementById('app');
const leerLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const s = {
  acceso: 'sin_sesion', usuario: null, negocios: [], negocioId: null, pestana: 'Caja', tema: leerLS('dixiapp.tema', 'auto'),
  pin: '', pin1: '', faseCrear: 'nuevo', errorPin: '', correo: '', errorCorreo: '', cargando: false,
  fecha: null, aviso: '', error: '', fondo: '', cierre: null, limite: 7,
  filtro: { neg: 'ambos', proveedor: '', busca: '', rubro: '', periodo: 'ultimas' }, bodega: estadoBodega(), viaje: null, viajeForm: null, resolviendo: null, notaDif: '', avisoEfectivo: '', por: 'dia', abierta: null, ventasPor: 'dia', filtroVentas: { neg: 'ambos' }, filtroSinpe: { neg: 'ambos' }, filtroCierres: { neg: 'ambos' }, cierresDias: 30, turnosVer: {}, lineasFac: {}, vivo: false, ultimo: Date.now(), esperado: 0,
};
aplicarTema(s.tema);

const esAdmin = () => s.usuario?.rol === 'administrador';
const pestanasDe = () => (esAdmin() ? ['Inicio', 'Pagos', 'Caja', 'Ventas', 'Más'] : ['Caja', 'Más']);
let pintando = 0, enVuelo = 0;
const FRESCO_MS = 15000; // una copia de hace menos de esto no se vuelve a pedir al volver a una pantalla
const ZONA = 'America/Costa_Rica';
const hoyLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
// Hora de Costa Rica (no la del aparato): saludos y «Última lectura» no cambian si el teléfono está en otra zona o con la hora mal puesta
const horaCR24 = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
const saludoDeHora = () => { const h = horaCR24(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const ahoraCR = () => new Date().toLocaleTimeString('es-CR', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', second: '2-digit' });
// Mientras Caja, Ventas y parte de Inicio muestran datos de EJEMPLO: etiqueta corta arriba y una franja que lo dice con palabras y aclara qué sí es real
const FRANJAS = {
  Inicio: 'Ejemplo: el efectivo de las cajas, el efectivo de hoy y las diferencias. Real: SINPE Móvil, compras y bodega.',
  Caja: 'Esta caja es de ejemplo, no es la del local. Lo real está en Pagos, Compras y Bodega.',
  Ventas: 'Las ventas de hoy y los gráficos son de ejemplo. Real: «Cómo se mueve tu negocio».',
  Cierres: 'Estos turnos son de ejemplo: todavía no hay cierres reales del facturador.',
};
const etiquetaDatos = () => {
  const ejemplo = !datos.esPrueba && !!datos.esEjemploEn?.(s.pestana);
  return { esPrueba: datos.esPrueba || ejemplo, etiqueta: datos.esPrueba ? 'Datos de prueba' : s.pestana === 'Inicio' ? 'Caja y ventas de ejemplo' : s.pestana === 'Ventas' ? 'Ventas de ejemplo' : 'Datos de ejemplo',
    franja: datos.esPrueba ? 'Modo de prueba: todos los datos son ficticios.' : ejemplo ? (FRANJAS[s.pestana] || 'Cifras de ejemplo, no son las reales del local.') : '' };
};
const TITULOS = { SINPE: 'SINPE Móvil', Pagos: 'Pagos', Inicio: 'Inicio', Cierres: 'Cierres de caja', Ventas: 'Ventas', Compras: 'Compras', Bodega: 'Bodega' };
const CARGANDO = { SINPE: 'los SINPE Móvil', Pagos: 'los pagos', Inicio: 'tus números', Caja: 'la caja', Ventas: 'las ventas', Compras: 'las compras', Bodega: 'la bodega', Cierres: 'los cierres de caja', Más: 'las opciones' };

// Saludo inmediato del Inicio mientras llegan los numeros
function inicioRapido() {
  return marco({ negocio: { nombre: 'Inicio' }, hoy: hoyLocal(), pestana: 'Inicio', pestanas: pestanasDe(), ...etiquetaDatos(),
    contenido: `<section class="ini"><h2 class="ini-h">${saludoDeHora()}, Dixia</h2><p class="ini-msg">${esc(mensajeDelDia().texto)}</p><p class="ini-vacio">Cargando tus números…</p></section>` });
}
// Marco con las pestanas ya puestas y un esqueleto: sirve cuando todavia no hay copia de la pantalla (primera vez)
function marcoEsqueleto() {
  if (s.pestana === 'Inicio' && esAdmin()) return inicioRapido();
  const nombre = TITULOS[s.pestana] && esAdmin() ? TITULOS[s.pestana] : (s.negocios.find((n) => n.id === s.negocioId)?.nombre || 'Dixiapp');
  return marco({ negocio: { nombre }, hoy: s.fecha || hoyLocal(), pestana: s.pestana, pestanas: pestanasDe(), ...etiquetaDatos(), contenido: vistaEsqueleto(`Cargando ${CARGANDO[s.pestana] || 'la pantalla'}…`) });
}
function postPintado() {
  document.getElementById('a-pin')?.focus();
  if (s.usuario && s.pestana === 'Caja') actualizarDif();
  if (s.usuario && s.pestana === 'Bodega') despuesDePintar(raiz, s.bodega);
}
// Linea fina arriba mientras se actualiza lo que ya se ve (o mientras se espera la pantalla nueva)
function indicador(on, atenuar = false) {
  let el = document.getElementById('refresca');
  if (on && !el) { el = document.createElement('div'); el.id = 'refresca'; el.setAttribute('role', 'status'); el.innerHTML = '<span class="solo-voz">Actualizando datos</span>'; document.body.appendChild(el); }
  else if (!on && el) el.remove();
  if (on && atenuar) raiz.setAttribute('aria-busy', 'true'); else raiz.removeAttribute('aria-busy');
}
// Si Dixia esta escribiendo en un campo, ninguna actualizacion de fondo le cambia la pantalla debajo de los dedos
const escribiendo = () => { const a = document.activeElement; return !!a && raiz.contains(a) && a.matches('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select'); };
const resaltarPestana = (v) => raiz.querySelectorAll('.pestana').forEach((b) => { if (b.dataset.valor === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });

// Opciones: rapido = primero la ultima vista guardada (si hay) y despues los datos nuevos; pantalla = si no hay copia, pone el esqueleto de la pantalla nueva;
// arriba = vuelve al inicio de la pagina; pasivo = actualizacion de fondo (no pisa un campo en que se esta escribiendo).
// Solo las lecturas usan `rapido`: despues de escribir algo (abrir/cerrar caja, bodega...) siempre se pide lo nuevo y no se muestra nada viejo.
async function pintar({ rapido = false, pantalla = false, arriba = false, pasivo = false } = {}) {
  const yo = ++pintando;
  s.repintarAlSalir = false; indicador(false);
  try {
    let vistaCopia = false, htmlCopia = null, arribaHecho = false;
    if (rapido && s.usuario && datos.copiaSolo) {
      const D = datos.copiaSolo(), be = s.bodega.error, ba = s.bodega.aviso;
      try { htmlCopia = await construir(D, true); } catch { htmlCopia = null; }
      s.bodega.error = be; s.bodega.aviso = ba; // la vista previa no gasta los avisos de Bodega
      if (D.faltas > 0) htmlCopia = null;
      if (yo !== pintando) return;
      if (htmlCopia !== null) {
        vistaCopia = true; raiz.innerHTML = htmlCopia; postPintado(); if (arriba) { window.scrollTo(0, 0); arribaHecho = true; }
        if (D.reciente(FRESCO_MS)) return; // copia de hace segundos: no hace falta volver a pedir
        indicador(true);
      } else if (pantalla) { raiz.innerHTML = marcoEsqueleto(); postPintado(); if (arriba) { window.scrollTo(0, 0); arribaHecho = true; } indicador(true); }
      else indicador(true, true); // sin copia y en la misma pantalla: se queda lo que se ve, apagado, hasta que lleguen los datos
    } else if (s.usuario && s.pestana === 'Inicio' && esAdmin() && !s.inicioListo) raiz.innerHTML = inicioRapido(); // primer vistazo inmediato
    enVuelo++; let html;
    try { html = await construir(datos, false); } finally { enVuelo--; }
    if (yo !== pintando) return; // llego una pintura mas nueva
    indicador(false);
    if (vistaCopia && html === htmlCopia) return; // los datos nuevos son iguales a lo que ya se ve: no se toca la pantalla
    if ((rapido || pasivo) && escribiendo()) { s.repintarAlSalir = true; if (s.pestana === 'Caja') actualizarDif(); return; } // se repinta cuando suelte el campo (el esperado de la caja ya quedo al dia)
    raiz.innerHTML = html; if (s.pestana === 'Inicio') s.inicioListo = true;
    postPintado(); if (arriba && !arribaHecho) window.scrollTo(0, 0);
  } catch (e) {
    if (yo !== pintando) return;
    indicador(false);
    if (/No autorizado|sesión venció/i.test(e.message) && s.usuario) { s.usuario = null; s.acceso = await datos.estadoAcceso(); s.errorPin = 'Vuelva a entrar.'; return pintar(); }
    console.warn('Dixiapp: no se pudo actualizar la pantalla:', e && e.message);
    if (pasivo && raiz.querySelector('.pestanas')) return; // una lectura de fondo que falla no tumba lo que ya se ve (y no deja un error pendiente para la próxima pintura)
    s.error = mensajeAmable(e && e.message);
    if (s.usuario) {
      // Con sesión: se conserva la barra de botones y el encabezado; solo el contenido avisa y ofrece reintentar
      raiz.innerHTML = marco({ negocio: { nombre: (TITULOS[s.pestana] && esAdmin() ? TITULOS[s.pestana] : s.negocios.find((n) => n.id === s.negocioId)?.nombre) || 'Dixiapp' }, hoy: s.fecha || hoyLocal(), pestana: s.pestana === 'SINPE' ? 'Inicio' : s.pestana, pestanas: pestanasDe(), ...etiquetaDatos(),
        contenido: `<p class="error" role="alert">${esc(s.error)}</p><button class="btn bloque" data-accion="reintentar">Reintentar</button>` });
    } else raiz.innerHTML = `<div class="acceso"><div class="acceso-caja"><p class="error" role="alert">${esc(s.error)}</p><button class="btn bloque" data-accion="reintentar">Reintentar</button></div></div>`;
  }
}

// Los mensajes ya redactados para Dixia se muestran tal cual; un texto técnico de la base («boom interno») solo va a la consola
const AMABLES = /^(No tiene permiso|Sin conexión|La sesión venció|Su cuenta no tiene|Correo o contraseña|Ya hay una caja|Ese movimiento|Escriba|Ocurrió un error)/;
const mensajeAmable = (m) => (AMABLES.test(String(m || '')) ? m : 'No se pudo actualizar. Intente de nuevo en unos segundos.');

// D = de donde salen los datos: `datos` (red, con copia de respaldo) o la copia guardada sola (vista previa instantanea). `previa` = no gasta avisos ni errores.
async function construir(D = datos, previa = false) {
  if (!s.usuario) return vistaAccesoActual();
  const hoy = await datos.hoy(); // la fecha sale del reloj del aparato: no hay viaje a la red
  if (!s.fecha) s.fecha = hoy;
  let contenido = '', titulo = s.negocios.find((n) => n.id === s.negocioId);
  if (s.pestana === 'Inicio' && esAdmin()) {
    contenido = await construirInicio(D, hoy); titulo = { nombre: 'Inicio' };
  } else if (s.pestana === 'Caja') {
    const [caja, act] = await Promise.all([D.cajaActual(s.negocioId), D.actividad(s.negocioId, s.fecha)]);
    s.esperado = caja?.esperado ?? 0;
    contenido = selectorNegocio(s.negocios, s.negocioId) + vistaCaja({ hoy, fecha: s.fecha, caja, act, esAdmin: esAdmin(), aviso: s.aviso, error: s.error, fondo: s.fondo, cierre: s.cierre });
  } else if (s.pestana === 'SINPE' && esAdmin()) {
    contenido = await construirSinpe(D); titulo = { nombre: 'SINPE Móvil' };
  } else if (s.pestana === 'Pagos' && esAdmin()) {
    contenido = await construirPagos(D); titulo = { nombre: 'Pagos' };
  } else if (s.pestana === 'Cierres' && esAdmin()) {
    contenido = await construirCierres(D, hoy); titulo = { nombre: 'Cierres de caja' };
  } else if (s.pestana === 'Ventas' && esAdmin()) {
    contenido = await construirVentas(D, hoy); titulo = { nombre: 'Ventas' };
  } else if (s.pestana === 'Compras' && esAdmin()) {
    contenido = await construirCompras(D, hoy); titulo = { nombre: 'Compras' };
  } else if (s.pestana === 'Bodega' && esAdmin()) {
    contenido = await construirBodega(D, s.bodega, hoy); titulo = { nombre: 'Bodega' };
  } else {
    if (esAdmin()) s.avisos = await D.avisosEstado().catch(() => null);
    contenido = vistaMas({ usuario: s.usuario, tema: s.tema, esAdmin: esAdmin(), esPrueba: datos.esPrueba, conBloqueo: !datos.esPrueba, negocios: s.negocios, avisos: esAdmin() ? s.avisos : null });
    titulo = s.negocios.find((n) => n.id === s.negocioId);
  }
  if (!previa) s.error = '';
  return marco({ negocio: titulo, hoy, pestana: s.pestana === 'SINPE' ? 'Inicio' : s.pestana, pestanas: pestanasDe(), contenido, ...etiquetaDatos() });
}

async function construirInicio(D, hoy) {
  // Todo se pide a la vez (no uno despues de otro) para que el inicio llegue rapido
  const pNegocios = Promise.all(s.negocios.map(async (n) => {
    const [caja, act] = await Promise.all([D.cajaActual(n.id), D.actividad(n.id, hoy)]);
    return { id: n.id, nombre: n.nombre, caja, movs: act.movimientos.length };
  }));
  const nombreNeg = (id) => s.negocios.find((n) => n.id === id)?.nombre || id;
  const sinpeInicio = D.sinpeConsulta({ negocios: null, dias: 7 }).catch(() => null); // solo consulta: si falla, la tarjeta simplemente no sale
  const [negocios, alertas, compras, difs, viajes, movs] = await Promise.all([pNegocios,
    D.bodegaAlertas().catch(() => ({ bajoMinimo: [] })), D.comprasResumen({ negocios: null }).catch(() => ({ semana: { facturas: 0, total: 0 } })),
    D.diferenciasPendientes().catch(() => []), D.viajes().catch(() => []), D.movimientosRecientes({ limite: 6 }).catch(() => []),
  ]);
  const sinpe = await sinpeInicio;
  s.viaje = viajes[0] && viajes[0].fecha >= hoy ? viajes[0] : null;
  const decisiones = [];
  const porUbic = new Map();
  for (const a of alertas.bajoMinimo) porUbic.set(a.ubicacion, (porUbic.get(a.ubicacion) || 0) + 1);
  for (const [ub, n] of porUbic) decisiones.push({ letra: 'B', color: '#F3A62C', titulo: `Reponer ${n} producto${n === 1 ? '' : 's'} de ${ub}`, detalle: 'Está bajo el mínimo', accion: 'ir-bodega', valor: 'alertas' });
  for (const c of difs) {
    const d = c.diferencia ?? 0, abierta = s.resolviendo === String(c.cajaId);
    decisiones.push({ letra: 'C', color: '#b81622', titulo: 'Revisar una diferencia de caja', detalle: `${nombreNeg(c.negocioId)} · ${fechaLarga(c.fecha)} · ${d < 0 ? 'faltaron' : 'sobraron'} ${colones(Math.abs(d))}`, accion: 'dif-abrir', valor: String(c.cajaId),
      extra: abierta ? `<div class="ini-resolver"><label>¿Qué pasó? <small>(opcional)</small><input id="d-nota" type="text" maxlength="300" autocomplete="off" value="${esc(s.notaDif)}" placeholder="Por ejemplo, se pagó un gas sin anotar"></label>
        <div class="ini-fila-b"><button class="ini-link" data-accion="dif-cancelar">Cancelar</button><button class="ini-btn" data-accion="dif-resolver" data-valor="${esc(String(c.cajaId))}">Marcar como resuelta</button></div></div>` : '' });
  }
  return vistaInicio({ saludo: saludoDeHora(), mensaje: mensajeDelDia().texto, negocios, decisiones, semana: compras.semana, viaje: s.viaje, viajeForm: s.viajeForm, movimientos: movs.map((m) => ({ ...m, negocio: nombreNeg(m.negocioId) })), aviso: s.avisoEfectivo, hoy, sinpe, ejemplo: !datos.esPrueba && !!datos.esEjemploEn?.('Inicio') });
}

const leerSinpe = (D, negs) => D.sinpeConsulta({ negocios: negs, dias: 30 });
async function construirPagos(D) {
  const negs = s.filtroSinpe.neg === 'ambos' ? null : [s.filtroSinpe.neg];
  const d = await leerSinpe(D, negs);
  const ahoraTexto = ahoraCR();
  return vistaPagos({ datos: d, negociosPermitidos: s.negocios, filtro: s.filtroSinpe, vivo: s.vivoPagos, error: s.error, ahoraTexto, sinConexion: !!datos.copia?.sinConexion });
}

async function construirSinpe(D) {
  const negs = s.filtroSinpe.neg === 'ambos' ? null : [s.filtroSinpe.neg];
  const d = await leerSinpe(D, negs);
  const ahoraTexto = ahoraCR();
  return vistaSinpe({ datos: d, negociosPermitidos: s.negocios, filtro: s.filtroSinpe, error: s.error, ahoraTexto });
}

async function construirCierres(D, hoy) {
  const negs = s.filtroCierres.neg === 'ambos' ? null : [s.filtroCierres.neg];
  const r = await D.cierresTurnos({ negocios: negs, desde: sumarDias(hoy, -(s.cierresDias - 1)), hasta: hoy, limite: 300 });
  return vistaCierresTurnos({ turnos: r.turnos, hoy, negociosPermitidos: s.negocios, filtro: s.filtroCierres, dias: s.cierresDias, hayMas: r.hayMas, error: s.error, abiertos: s.turnosVer });
}

async function construirVentas(D, hoy) {
  const negs = s.filtroVentas.neg === 'ambos' ? null : [s.filtroVentas.neg];
  const rango = s.ventasPor === 'mes' ? { desde: sumarMeses(hoy, -11), hasta: hoy } : rangoPorDefecto(hoy, s.ventasPor);
  const rangoMes = { desde: sumarMeses(hoy, -11), hasta: hoy };
  const topPor = s.ventasTop || 'hoy', rangoTop = { desde: topPor === 'hoy' ? hoy : topPor === 'semana' ? lunesDe(hoy) : inicioMes(hoy), hasta: hoy };
  const negocioPor = s.negocioPor || 'mes', rangoNeg = rangoNegocio(negocioPor, hoy);
  const [enVivo, serie, meses, top, horasDia, comercial, combos, clientes] = await Promise.all([
    D.ventasEnVivo({ negocios: negs }), D.ventasAgrupadas({ negocios: negs, ...rango, por: s.ventasPor }), D.ventasAgrupadas({ negocios: negs, ...rangoMes, por: 'mes' }),
    D.ventasTop({ negocios: negs, ...rangoTop, limite: 5 }).catch(() => null), D.ventasPorHora({ negocios: negs, fecha: hoy }).catch(() => null),
    D.ventasComercial({ negocios: negs, ...rangoNeg }).catch(() => null), D.ventasCombos({ negocios: negs, ...rangoNeg, limite: 5 }).catch(() => null), D.ventasClientes({ negocios: negs, ...rangoNeg }).catch(() => null),
  ]);
  const ahoraTexto = ahoraCR();
  return vistaVentas({ negociosPermitidos: s.negocios, filtro: s.filtroVentas, vivo: s.vivoVentas, en_vivo: enVivo, por: s.ventasPor,
    grafico: rellenarPeriodos(serie, s.ventasPor, rango.desde, rango.hasta), meses: rellenarPeriodos(meses, 'mes', rangoMes.desde, rangoMes.hasta), error: s.error, ahoraTexto, top, topPor, horasDia, hoy, negocio: { comercial, combos, clientes }, negocioPor });
}

async function construirCompras(D, hoy) {
  const negs = s.filtro.neg === 'ambos' ? null : [s.filtro.neg];
  const rubro = s.filtro.rubro || null;
  const base = { negocios: negs, proveedor: s.filtro.proveedor || null, rubro };
  const rango = rangoPorDefecto(hoy, s.por);
  const per = s.filtro.periodo || 'ultimas';
  const lapso = per === 'hoy' ? { desde: hoy, hasta: hoy } : per === 'semana' ? { desde: lunesDe(hoy), hasta: hoy } : { desde: inicioMes(hoy), hasta: hoy };
  const lista = per === 'ultimas' ? { limite: 8 } : { ...lapso, limite: 300 };
  // Todo se pide a la vez, incluida la lista de proveedores (antes iba primero y las otras siete esperaban su respuesta: dos viajes a la red en fila).
  // Proveedores por orden alfabetico (nombre comercial si existe); si hay clasificacion, solo los que vendieron eso.
  const [proveedores, resumen, ultimas, serie, tipos, rubros, provs, provsPeriodo] = await Promise.all([
    D.comprasProveedores({ negocios: negs, rubro }),
    D.comprasResumen(base), D.comprasUltimas({ ...base, ...lista }),
    D.comprasAgrupadas({ ...base, ...rango, por: s.por }),
    D.comprasAgrupadas({ ...base, ...rango, por: 'tipo_proveedor' }),
    D.comprasAgrupadas({ negocios: negs, proveedor: s.filtro.proveedor || null, ...rango, por: 'rubro' }), // sin filtrar por clasificacion, para poder cambiar de una a otra
    D.comprasAgrupadas({ ...base, ...rango, por: 'proveedor' }),
    D.comprasProveedores({ negocios: negs, rubro, ...lapso }),
  ]);
  s.provsCache = proveedores;
  // Si el proveedor elegido ya no esta en la lista (cambio el filtro), se quita y se vuelve a armar sin el
  if (s.filtro.proveedor && !proveedores.some((p) => p.cedula === s.filtro.proveedor)) { s.filtro.proveedor = ''; return construirCompras(D, hoy); }
  return vistaCompras({ hoy, negociosPermitidos: s.negocios, filtro: s.filtro, proveedores, resumen, ultimas, por: s.por, lineas: s.lineasFac, grafico: rellenarPeriodos(serie, s.por, rango.desde, rango.hasta), rango, tipos, rubros, provs, provsPeriodo, abierta: s.abierta, vivo: s.vivo, error: s.error });
}

function vistaAccesoActual() {
  const nota = datos.esPrueba ? '<b>Modo de prueba, datos ficticios.</b><br>PIN del administrador: 1234. PIN del cajero: 4321.' : '';
  if (datos.acceso === 'pin' && !datos.esPrueba) { return vistaEntrada({ saludo: saludoDeHora(), pin: s.pin, error: s.errorPin }); }
  if (datos.acceso === 'pin') return vistaPin({ titulo: datos.esPrueba ? 'Dixiapp' : 'Dixia', ayuda: datos.esPrueba ? 'Escriba su PIN de 4 a 6 dígitos' : 'Escriba su clave de 4 números', pin: s.pin, error: s.errorPin, nota });
  if (s.acceso === 'sin_sesion') return vistaCorreo({ correo: s.correo, error: s.errorCorreo, cargando: s.cargando });
  const enlace = '<button class="enlace" style="margin-top:6px" data-accion="otra-cuenta">Entrar con otro correo</button>';
  if (s.acceso === 'crear_pin') {
    return vistaPin({ titulo: s.faseCrear === 'nuevo' ? 'Cree su PIN' : 'Repita su PIN', ayuda: s.faseCrear === 'nuevo' ? 'De 4 a 6 dígitos. Solo sirve en este aparato.' : 'Escríbalo otra vez para confirmar', pin: s.pin, error: s.errorPin, textoEntrar: s.faseCrear === 'nuevo' ? 'Siguiente' : 'Guardar', enlace });
  }
  return vistaPin({ titulo: 'Dixiapp bloqueada', ayuda: 'Escriba su PIN para continuar', pin: s.pin, error: s.errorPin, enlace });
}

async function entrarConUsuario(u) {
  s.usuario = u; s.negocios = await datos.negocios();
  const guardado = leerLS('dixiapp.negocio', '');
  s.negocioId = s.negocios.some((n) => n.id === guardado) ? guardado : s.negocios[0].id;
  s.inicioListo = false; s.bodega = estadoBodega(); s.pestana = esAdmin() ? 'Inicio' : 'Caja'; s.fecha = null; s.pin = ''; s.pin1 = ''; s.errorPin = ''; s.cierre = null; s.aviso = ''; s.error = '';
  suscribirCompras(); suscribirEfectivo(); suscribirVentas(); pulsarPagos();
  if (esAdmin()) setTimeout(async () => { try { await precargarTodo(datos, { hoy: await datos.hoy(), ceder: cederAlUsuario }); } catch { /* la copia local es un extra: nunca estorba */ } }, 4000);
}

// La precarga solo trabaja cuando Dixia no esta pidiendo nada: espera mientras haya una pantalla cargando o un toque reciente
const cederAlUsuario = async () => { while (s.usuario && (enVuelo > 0 || Date.now() - s.ultimo < 2500 || document.hidden)) await new Promise((r) => setTimeout(r, 400)); };

let cancelarEfectivo = null;
async function suscribirEfectivo() {
  if (cancelarEfectivo) { cancelarEfectivo(); cancelarEfectivo = null; }
  try {
    cancelarEfectivo = await datos.movimientosSuscribir(async (m) => {
      const neg = s.negocios.find((n) => n.id === m.negocioId)?.nombre || '';
      s.avisoEfectivo = `${m.tipo === 'entrada' ? 'Entró' : 'Salió'} efectivo en ${neg}: ${colones(m.monto)} (${m.motivo}).`;
      if (s.usuario && s.pestana === 'Inicio' && !document.activeElement?.matches?.('input')) await pintar({ pasivo: true });
    });
  } catch { /* sin tiempo real: se ve al abrir el inicio */ }
}

let cancelarSuscripcion = null, temporizador = null;
async function suscribirCompras() {
  if (cancelarSuscripcion) { cancelarSuscripcion(); cancelarSuscripcion = null; }
  if (!esAdmin()) return;
  try {
    cancelarSuscripcion = await datos.comprasSuscribir(() => {
      clearTimeout(temporizador);
      temporizador = setTimeout(async () => {
        s.vivo = true;
        if (s.usuario && s.pestana === 'Compras') await pintar({ pasivo: true });
        setTimeout(() => { s.vivo = false; const el = document.querySelector('[data-id="vivo"]'); if (el) { el.classList.remove('on'); el.lastChild.textContent = 'En vivo'; } }, 4000);
      }, 300);
    });
  } catch { /* sin tiempo real: la vista sigue funcionando al abrirla */ }
}

// Pestana Pagos: se vuelve a leer sola cada 20 segundos mientras esta abierta y la app se ve (los SINPE nuevos aparecen arriba)
let pulsoPagos = null;
function pulsarPagos() {
  if (pulsoPagos) return;
  pulsoPagos = setInterval(async () => {
    if (s.usuario && s.pestana === 'Pagos' && !document.hidden && esAdmin()) { s.vivoPagos = true; await pintar({ pasivo: true }); setTimeout(() => { s.vivoPagos = false; const el = document.querySelector('[data-id="pagos-vivo"]'); if (el && !datos.copia?.sinConexion) { el.classList.remove('on'); el.textContent = 'Se actualiza sola'; } }, 4000); }
  }, 20000);
}

let cancelarVentas = null;
async function suscribirVentas() {
  if (cancelarVentas) { cancelarVentas(); cancelarVentas = null; }
  if (!esAdmin()) return;
  try {
    cancelarVentas = await datos.ventasSuscribir(async () => {
      if (s.usuario && s.pestana === 'Ventas' && !document.hidden) { s.vivoVentas = true; await pintar({ pasivo: true }); setTimeout(() => { s.vivoVentas = false; }, 4000); }
    });
  } catch { /* sin pulso: se ve al abrir la pestana */ }
}

async function evaluarAcceso() {
  s.acceso = await datos.estadoAcceso();
  if (s.acceso === 'abierta') { const u = await datos.sesionActual(); if (u) await entrarConUsuario(u); }
  else { s.usuario = null; s.pin = ''; s.pin1 = ''; s.faseCrear = 'nuevo'; }
}

async function intentarPin() {
  s.errorPin = '';
  const etq = document.querySelector('.entrada-campo span'); if (etq) etq.textContent = 'Entrando…';
  try {
    if (datos.acceso === 'pin') {
      const u = await datos.iniciarSesion({ pin: s.pin });
      if (!u) { s.errorPin = datos.esPrueba ? 'PIN incorrecto. Intente de nuevo.' : 'Clave incorrecta. Intente de nuevo.'; s.pin = ''; } else { const bienvenida = mostrarSplash(); await entrarConUsuario(u); s.pin = ''; await pintar({ rapido: true, pantalla: true }); await bienvenida; return; }
    } else if (s.acceso === 'crear_pin') {
      if (s.faseCrear === 'nuevo') { s.pin1 = s.pin; s.pin = ''; s.faseCrear = 'confirmar'; }
      else if (s.pin !== s.pin1) { s.errorPin = 'Los PIN no coinciden. Empiece de nuevo.'; s.pin = ''; s.pin1 = ''; s.faseCrear = 'nuevo'; }
      else { await datos.configurarPinLocal(s.pin); await evaluarAcceso(); }
    } else {
      const u = await datos.desbloquear(s.pin);
      if (!u) { s.errorPin = 'PIN incorrecto. Intente de nuevo.'; s.pin = ''; } else await evaluarAcceso();
    }
  } catch (e) { s.errorPin = e.message; s.pin = ''; await evaluarAcceso().catch(() => {}); }
  pintar();
}

function actualizarDif() {
  const salida = document.getElementById('c-dif'); const inp = document.getElementById('c-contado');
  if (!salida || !inp) return;
  const v = leerMonto(inp.value);
  if (v === null) { salida.textContent = 'Escriba lo contado'; salida.className = 'num'; return; }
  const d = diferencia(v, s.esperado); const e = estadoDiferencia(d);
  salida.textContent = e.clave === 'cuadra' ? 'Cuadra' : `${e.texto} ${colones(Math.abs(d))}`;
  salida.className = 'num ' + (d < 0 ? 'mal' : 'ok');
}

const sumarDiasTexto = sumarDias; // texto AAAA-MM-DD sin zona horaria (la fecha de «hoy» ya sale de la hora de Costa Rica)

raiz.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]'); if (!el) return;
  const a = el.dataset.accion, v = el.dataset.valor;
  if (s.usuario && s.pestana === 'Bodega' && await accionBodega(a, v, { datos, b: s.bodega, raiz, repintar: pintar, el })) return;
  try {
    if (a === 'digito') { if (s.pin.length < (datos.esPrueba ? 6 : 4)) s.pin += v; s.errorPin = ''; return pintar(); }
    if (a === 'borrar') { s.pin = s.pin.slice(0, -1); return pintar(); }
    if (a === 'entrar') return intentarPin();
    if (a === 'otra-cuenta') { await datos.cerrarSesion(); await evaluarAcceso(); return pintar(); }
    if (a === 'reintentar') { s.error = ''; return pintar({ rapido: true, pantalla: true }); }
    if (a === 'pestana') { s.pestana = v; s.aviso = ''; s.error = ''; s.cierre = null; resaltarPestana(v); return pintar({ rapido: true, pantalla: true, arriba: true }); }
    if (a === 'salir') { await datos.cerrarSesion(); Object.assign(s, { usuario: null, aviso: '', pin: '' }); if (cancelarSuscripcion) { cancelarSuscripcion(); cancelarSuscripcion = null; } if (cancelarEfectivo) { cancelarEfectivo(); cancelarEfectivo = null; } await evaluarAcceso(); return pintar(); }
    if (a === 'bloquear') { await datos.bloquear(); await evaluarAcceso(); return pintar(); }
    if (a === 'negocio') { s.negocioId = v; escribirLS('dixiapp.negocio', v); Object.assign(s, { limite: 7, fecha: null, aviso: '', cierre: null }); return pintar({ rapido: true, pantalla: true }); }
    if (a === 'tema') { s.tema = v; escribirLS('dixiapp.tema', v); aplicarTema(v); return pintar({ rapido: true }); }
    if (a === 'restablecer') { await datos.restablecerPrueba(); s.aviso = ''; return pintar(); }
    if (a === 'avisos-activar') { s.avisos = await datos.avisosActivar(); return pintar(); }
    if (a === 'avisos-desactivar') { await datos.avisosDesactivar(); return pintar(); }
    if (a === 'avisos-probar') { await datos.avisosProbar(); return pintar(); }
    if (a === 'aviso-pref') { const p = { ...(s.avisos?.prefs || {}) }; p[v] = !(p[v] ?? true); await datos.avisosGuardarPrefs(p); return pintar(); }
    if (a === 'aviso-min') { const p = { ...(s.avisos?.prefs || {}) }; const i = MINIMOS_EFECTIVO.indexOf(Number(p.efectivo_minimo || 0)); p.efectivo_minimo = MINIMOS_EFECTIVO[(i + 1) % MINIMOS_EFECTIVO.length]; await datos.avisosGuardarPrefs(p); return pintar(); }
    if (a === 'ir-bodega') { s.bodega.seccion = v; s.pestana = 'Bodega'; return pintar({ rapido: true, pantalla: true, arriba: true }); }
    if (a === 'dif-abrir') { s.resolviendo = v; s.notaDif = ''; return pintar({ rapido: true }); }
    if (a === 'dif-cancelar') { s.resolviendo = null; return pintar({ rapido: true }); }
    if (a === 'dif-resolver') { await datos.diferenciaResolver({ cajaId: /^\d+$/.test(v) ? Number(v) : v, nota: s.notaDif }); s.resolviendo = null; s.notaDif = ''; return pintar(); }
    if (a === 'aviso-cerrar') { s.avisoEfectivo = ''; return pintar({ rapido: true }); }
    if (a === 'ir-cierres') { s.pestana = 'Cierres'; return pintar({ rapido: true, pantalla: true, arriba: true }); }
    if (a === 'viaje-editar') { s.viajeForm = { destino: s.viaje?.destino || '', fecha: s.viaje?.fecha || '', error: '' }; return pintar({ rapido: true }); }
    if (a === 'viaje-cancelar') { s.viajeForm = null; return pintar({ rapido: true }); }
    if (a === 'viaje-guardar') {
      const f = s.viajeForm; f.destino = f.destino.trim();
      if (!f.destino) f.error = 'Escribe a dónde quieres ir.'; else if (!f.fecha) f.error = 'Elige el día en que sales.'; else if (diasHasta(await datos.hoy(), f.fecha) < 0) f.error = 'Esa fecha ya pasó. Elige una que esté por llegar.'; else f.error = '';
      if (!f.error) { await datos.viajeAgregar({ destino: f.destino, fecha: f.fecha }); s.viajeForm = null; }
      return pintar();
    }
    // Caja
    if (a === 'dia-menos' || a === 'dia-mas') { s.fecha = sumarDiasTexto(s.fecha, a === 'dia-mas' ? 1 : -1); s.aviso = ''; return pintar({ rapido: true }); }
    if (a === 'dia-hoy') { s.fecha = null; return pintar({ rapido: true }); }
    if (a === 'abrir-caja') return abrirCaja();
    if (a === 'cerrar-caja') return cerrar(v === 'confirmar');
    if (a === 'cancelar-cierre') { s.cierre = null; return pintar({ rapido: true }); }
    // Cierres de caja del facturador (solo consulta)
    if (a === 'cierres-negocio') { s.filtroCierres.neg = v; s.turnosVer = {}; return pintar({ rapido: true }); }
    if (a === 'cierres-mas') { s.cierresDias += 30; return pintar({ rapido: true }); }
    if (a === 'turno-ver') { s.turnosVer = { ...s.turnosVer, [v]: !s.turnosVer[v] }; return pintar({ rapido: true }); }
    // SINPE Movil (solo consulta)
    if (a === 'ir-sinpe') { s.pestana = 'SINPE'; resaltarPestana('Inicio'); return pintar({ rapido: true, pantalla: true, arriba: true }); }
    if (a === 'sinpe-negocio') { s.filtroSinpe.neg = v; return pintar({ rapido: true }); }
    if (a === 'sinpe-actualizar') return pintar({ arriba: false });
    // Ventas
    if (a === 'ventas-negocio') { s.filtroVentas.neg = v; return pintar({ rapido: true }); }
    if (a === 'ventas-por') { s.ventasPor = v; return pintar({ rapido: true }); }
    if (a === 'ventas-top') { s.ventasTop = v; return pintar({ rapido: true }); }
    if (a === 'negocio-por') { s.negocioPor = v; return pintar({ rapido: true }); }
    // Compras
    if (a === 'filtro-negocio') { s.filtro.neg = v; s.abierta = null; return pintar({ rapido: true }); }
    if (a === 'elegir-prov') { s.filtro.proveedor = v; s.filtro.busca = ''; s.abierta = null; return pintar({ rapido: true }); }
    if (a === 'por') { s.por = v; return pintar({ rapido: true }); }
    if (a === 'periodo') { s.filtro.periodo = v; s.abierta = null; return pintar({ rapido: true }); }
    if (a === 'factura') {
      s.abierta = s.abierta === v ? null : v; pintar({ rapido: true });
      if (s.abierta && !(s.abierta in s.lineasFac)) {
        const clave = s.abierta;
        try { s.lineasFac[clave] = await datos.comprasLineas(clave); } catch (e) { s.lineasFac[clave] = []; }
        if (s.abierta === clave) pintar({ rapido: true });
      }
      return;
    }
  } catch (e) { s.error = e.message; pintar(); }
});

raiz.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (s.usuario && s.pestana === 'Bodega' && entradaBodega(ev, raiz, s.bodega)) return;
  if (['c-contado', 'a-fondo'].includes(id)) {
    const n = leerMonto(ev.target.value);
    ev.target.value = n === null ? '' : miles(n);
    if (id === 'a-fondo') s.fondo = ev.target.value;
    if (id === 'c-contado') actualizarDif();
  }
  if (id === 'f-busca') { s.filtro.busca = ev.target.value; const r = document.getElementById('f-resultados'); if (r) r.innerHTML = resultadosBusqueda(s.provsCache || [], s.filtro.busca); return; }
  if (id === 'd-nota') s.notaDif = ev.target.value;
  if (id === 'v-destino' && s.viajeForm) s.viajeForm.destino = ev.target.value;
  if (id === 'v-fecha' && s.viajeForm) s.viajeForm.fecha = ev.target.value;
  if (id === 'a-pin') {
    s.pin = ev.target.value.replace(/\D/g, '').slice(0, 32); ev.target.value = s.pin; s.errorPin = '';   // sin largo fijo y sin envio automatico: se envia con Enter o el boton «Entrar»
    return;
  }
  if (id === 'a-correo') s.correo = ev.target.value;
});
raiz.addEventListener('focusout', () => setTimeout(() => { if (s.repintarAlSalir && s.usuario && !escribiendo()) pintar({ rapido: true }); }, 150));
raiz.addEventListener('change', (ev) => {
  if (ev.target.id === 'f-proveedor') { s.filtro.proveedor = ev.target.value; s.abierta = null; pintar({ rapido: true }); }
  if (ev.target.id === 'f-rubro') { s.filtro.rubro = ev.target.value; s.abierta = null; pintar({ rapido: true }); }
});
raiz.addEventListener('submit', async (ev) => {
  if (ev.target.dataset.form === 'pin') { ev.preventDefault(); if (s.pin) intentarPin(); else { s.errorPin = 'Escriba su clave.'; pintar(); } return; }
  if (ev.target.dataset.form !== 'correo') return;
  ev.preventDefault();
  s.correo = document.getElementById('a-correo').value; const clave = document.getElementById('a-clave').value;
  s.cargando = true; s.errorCorreo = ''; await pintar();
  try { await datos.iniciarSesion({ correo: s.correo, clave }); await evaluarAcceso(); } catch (e) { s.errorCorreo = e.message; }
  s.cargando = false; pintar();
});
document.addEventListener('keydown', (ev) => {
  s.ultimo = Date.now();
  if (s.usuario || (datos.acceso === 'correo' && s.acceso === 'sin_sesion')) return;
  const campo = document.getElementById('a-pin'); // entrada con campo propio: el campo recibe las teclas, este manejador no las repite
  if (campo) { if (document.activeElement !== campo) campo.focus(); return; }
  if (/^\d$/.test(ev.key) && s.pin.length < 6) { s.pin += ev.key; s.errorPin = ''; pintar(); }
  else if (ev.key === 'Backspace') { s.pin = s.pin.slice(0, -1); pintar(); }
  else if (ev.key === 'Enter' && s.pin.length >= 4) intentarPin();
});
for (const t of ['click', 'touchstart']) document.addEventListener(t, () => { s.ultimo = Date.now(); }, { passive: true });
// Sin bloqueo por inactividad: una vez que Dixia entra, la sesion queda abierta en ese aparato hasta que ella toque «Salir de sesión».
// Pantalla de bienvenida de 4 segundos (solo en modo real): al abrir, al volver a la app, al tocar un aviso (la app se abre o vuelve al frente) y al entrar con la clave.
const SPLASH_MS = 4000;
function mostrarSplash(ms = SPLASH_MS) {
  if (datos.esPrueba || datos.acceso !== 'pin') return Promise.resolve();
  document.getElementById('splash')?.remove();
  const el = document.createElement('div'); el.id = 'splash'; el.innerHTML = vistaSplash(); document.body.appendChild(el);
  return new Promise((fin) => setTimeout(() => { el.classList.add('sale'); setTimeout(() => { el.remove(); fin(); }, 350); }, ms));
}
let oculta = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { oculta = Date.now(); return; }
  if (s.usuario && oculta) { oculta = 0; mostrarSplash(); }
});

async function abrirCaja() {
  const fondo = leerMonto(s.fondo) ?? 0;
  try { await datos.abrirCaja(s.negocioId, { fondoInicial: fondo }); s.aviso = `Caja abierta con un fondo de ${colones(fondo)}.`; s.fondo = ''; s.error = ''; }
  catch (e) { s.error = e.message; }
  pintar();
}

async function cerrar(confirmar) {
  const inp = document.getElementById('c-contado');
  const contado = leerMonto(inp.value);
  if (contado === null) { s.error = 'Escriba el efectivo contado en caja antes de cerrar.'; return pintar(); }
  try {
    const r = await datos.cerrarCaja(s.negocioId, { contado, confirmarFaltante: confirmar });
    s.error = '';
    if (r.requiereConfirmacion) { s.cierre = { faltante: r.faltante, contado: miles(contado) }; return pintar(); }
    s.cierre = null;
    s.aviso = r.diferencia === undefined ? 'Caja cerrada. Quedó guardado quién la cerró.' : `Caja cerrada. ${r.diferencia === 0 ? 'Cuadra.' : r.diferencia < 0 ? `Faltan ${colones(-r.diferencia)}.` : `Sobran ${colones(r.diferencia)}.`}`;
  } catch (e) { s.error = e.message; }
  pintar();
}

async function iniciar() {
  mostrarSplash();
  try { await evaluarAcceso(); } catch (e) { s.errorPin = e.message; }
  const destino = { '#ventas': 'Ventas', '#cierres': 'Cierres', '#bodega': 'Bodega', '#compras': 'Compras', '#sinpe': 'SINPE' }[location.hash]; // al tocar un aviso se abre la pantalla que corresponde
  if (destino && s.usuario && esAdmin()) s.pestana = destino;
  await pintar({ rapido: true, pantalla: true });
}
iniciar();
if (datos.esPrueba) window.dixiPrueba = datos; // solo para pruebas automaticas en modo de prueba
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Actualizacion automatica: busca version nueva al abrir y cada vez que vuelves a la app, y se recarga sola una vez cuando llega
  const habia = !!navigator.serviceWorker.controller; let recargada = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habia || recargada) return;
    recargada = true;
    // Si Dixia está escribiendo, la recarga espera a que suelte el campo (no se pierde lo tecleado)
    if (escribiendo()) { const ir = () => setTimeout(() => location.reload(), 300); raiz.addEventListener('focusout', ir, { once: true }); } else location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const buscar = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
    setInterval(buscar, 10 * 60 * 1000);
  }).catch(() => {});
}
