import { datos } from './datos/index.js';
import { leerMonto, aplicarTema, esc } from './ui.js';
import { vistaPin, vistaEntrada, vistaCorreo, marco, selectorNegocio, vistaCaja, vistaCierres, vistaMas } from './vistas.js';
import { vistaCompras } from './vistas-compras.js';
import { vistaInicio, diasHasta } from './vistas-inicio.js';
import { mensajeDelDia } from './mensajes.js';
import { fechaLarga } from './datos/fechas.js';
import { colones } from './datos/formato.js';
import { estadoDiferencia, diferencia } from './datos/calculos.js';
import { construirBodega, accionBodega, entradaBodega, despuesDePintar, estadoBodega } from './bodega.js';
import { rangoPorDefecto, rellenarPeriodos } from './datos/compras-calc.js';

const raiz = document.getElementById('app');
const leerLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const s = {
  acceso: 'sin_sesion', usuario: null, negocios: [], negocioId: null, pestana: 'Caja', tema: leerLS('dixiapp.tema', 'auto'),
  pin: '', pin1: '', faseCrear: 'nuevo', errorPin: '', correo: '', errorCorreo: '', cargando: false,
  fecha: null, form: null, aviso: '', error: '', fondo: '', cierre: null, corrigiendo: null, limite: 7,
  filtro: { neg: 'ambos', proveedor: '' }, bodega: estadoBodega(), viaje: null, viajeForm: null, resolviendo: null, notaDif: '', avisoEfectivo: '', por: 'dia', abierta: null, vivo: false, ultimo: Date.now(), esperado: 0,
};
aplicarTema(s.tema);

const esAdmin = () => s.usuario?.rol === 'administrador';
const pestanasDe = () => (esAdmin() ? ['Inicio', 'Caja', 'Compras', 'Bodega', 'Cierres', 'Más'] : ['Caja', 'Más']);
let pintando = 0;

async function pintar() {
  const yo = ++pintando;
  try {
    const html = await construir();
    if (yo !== pintando) return; // llego una pintura mas nueva
    raiz.innerHTML = html;
    document.getElementById('a-pin')?.focus();
    if (s.usuario && s.pestana === 'Caja') actualizarDif();
    if (s.usuario && s.pestana === 'Bodega') despuesDePintar(raiz, s.bodega);
  } catch (e) {
    if (yo !== pintando) return;
    if (/No autorizado|sesión venció/i.test(e.message) && s.usuario) { s.usuario = null; s.acceso = await datos.estadoAcceso(); s.errorPin = 'Vuelva a entrar.'; return pintar(); }
    s.error = e.message; raiz.innerHTML = `<div class="acceso"><div class="acceso-caja"><p class="error" role="alert">${e.message}</p><button class="btn bloque" data-accion="reintentar">Reintentar</button></div></div>`;
  }
}

async function construir() {
  if (!s.usuario) return vistaAccesoActual();
  const hoy = await datos.hoy();
  if (!s.fecha) s.fecha = hoy;
  let contenido = '', titulo = s.negocios.find((n) => n.id === s.negocioId);
  if (s.pestana === 'Inicio' && esAdmin()) {
    contenido = await construirInicio(hoy); titulo = { nombre: 'Inicio' };
  } else if (s.pestana === 'Caja') {
    const [caja, act] = await Promise.all([datos.cajaActual(s.negocioId), datos.actividad(s.negocioId, s.fecha)]);
    s.esperado = caja?.esperado ?? 0;
    contenido = selectorNegocio(s.negocios, s.negocioId) + vistaCaja({ hoy, fecha: s.fecha, caja, act, esAdmin: esAdmin(), form: s.form, sugerencias: s.form?.sug || [], aviso: s.aviso, error: s.error, fondo: s.fondo, corrigiendo: s.corrigiendo, cierre: s.cierre });
  } else if (s.pestana === 'Cierres' && esAdmin()) {
    const [{ items, hayMas }, semana] = await Promise.all([datos.cierres(s.negocioId, { limite: s.limite }), datos.resumenSemana(s.negocioId)]);
    contenido = selectorNegocio(s.negocios, s.negocioId) + vistaCierres({ cierres: items, hayMas, semana });
  } else if (s.pestana === 'Compras' && esAdmin()) {
    contenido = await construirCompras(hoy); titulo = { nombre: 'Compras' };
  } else if (s.pestana === 'Bodega' && esAdmin()) {
    contenido = await construirBodega(datos, s.bodega, hoy); titulo = { nombre: 'Bodega' };
  } else {
    contenido = vistaMas({ usuario: s.usuario, tema: s.tema, horarios: await datos.horarios(), esAdmin: esAdmin(), esPrueba: datos.esPrueba, conBloqueo: !datos.esPrueba, negocios: s.negocios });
    titulo = s.negocios.find((n) => n.id === s.negocioId);
  }
  s.error = '';
  return marco({ negocio: titulo, hoy, pestana: s.pestana, pestanas: pestanasDe(), contenido, esPrueba: datos.esPrueba });
}

async function construirInicio(hoy) {
  const negocios = await Promise.all(s.negocios.map(async (n) => {
    const [caja, act] = await Promise.all([datos.cajaActual(n.id), datos.actividad(n.id, hoy)]);
    return { id: n.id, nombre: n.nombre, caja, movs: act.movimientos.length };
  }));
  const nombreNeg = (id) => s.negocios.find((n) => n.id === id)?.nombre || id;
  const [alertas, compras, difs, viajes, movs] = await Promise.all([
    datos.bodegaAlertas().catch(() => ({ bajoMinimo: [] })), datos.comprasResumen({ negocios: null }).catch(() => ({ semana: { facturas: 0, total: 0 } })),
    datos.diferenciasPendientes().catch(() => []), datos.viajes().catch(() => []), datos.movimientosRecientes({ limite: 6 }).catch(() => []),
  ]);
  s.viaje = viajes[0] && viajes[0].fecha >= hoy ? viajes[0] : null;
  const decisiones = [];
  const porUbic = new Map();
  for (const a of alertas.bajoMinimo) porUbic.set(a.ubicacion, (porUbic.get(a.ubicacion) || 0) + 1);
  for (const [ub, n] of porUbic) decisiones.push({ letra: 'B', color: '#1fa971', titulo: `Reponer ${n} producto${n === 1 ? '' : 's'} de ${ub}`, detalle: 'Está bajo el mínimo', accion: 'ir-bodega', valor: 'alertas' });
  for (const c of difs) {
    const d = c.diferencia ?? 0, abierta = s.resolviendo === String(c.cajaId);
    decisiones.push({ letra: 'C', color: '#b81622', titulo: 'Revisar una diferencia de caja', detalle: `${nombreNeg(c.negocioId)} · ${fechaLarga(c.fecha)} · ${d < 0 ? 'faltaron' : 'sobraron'} ${colones(Math.abs(d))}`, accion: 'dif-abrir', valor: String(c.cajaId),
      extra: abierta ? `<div class="ini-resolver"><label>¿Qué pasó? <small>(opcional)</small><input id="d-nota" type="text" maxlength="300" autocomplete="off" value="${esc(s.notaDif)}" placeholder="Por ejemplo, se pagó un gas sin anotar"></label>
        <div class="ini-fila-b"><button class="ini-link" data-accion="dif-cancelar">Cancelar</button><button class="ini-btn" data-accion="dif-resolver" data-valor="${esc(String(c.cajaId))}">Marcar como resuelta</button></div></div>` : '' });
  }
  const h = new Date().getHours();
  return vistaInicio({ saludo: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches', mensaje: mensajeDelDia().texto, negocios, decisiones, semana: compras.semana, viaje: s.viaje, viajeForm: s.viajeForm, movimientos: movs.map((m) => ({ ...m, negocio: nombreNeg(m.negocioId) })), aviso: s.avisoEfectivo, hoy });
}

async function construirCompras(hoy) {
  const negs = s.filtro.neg === 'ambos' ? null : [s.filtro.neg];
  let proveedores = await datos.comprasProveedores({ negocios: negs });
  if (s.filtro.proveedor && !proveedores.some((p) => p.cedula === s.filtro.proveedor)) s.filtro.proveedor = '';
  const base = { negocios: negs, proveedor: s.filtro.proveedor || null };
  const rango = rangoPorDefecto(hoy, s.por);
  const [resumen, ultimas, serie, tipos, rubros, provs] = await Promise.all([
    datos.comprasResumen(base), datos.comprasUltimas({ ...base, limite: 8 }),
    datos.comprasAgrupadas({ ...base, ...rango, por: s.por }),
    datos.comprasAgrupadas({ ...base, ...rango, por: 'tipo_proveedor' }), datos.comprasAgrupadas({ ...base, ...rango, por: 'rubro' }), datos.comprasAgrupadas({ ...base, ...rango, por: 'proveedor' }),
  ]);
  return vistaCompras({ hoy, negociosPermitidos: s.negocios, filtro: s.filtro, proveedores, resumen, ultimas, por: s.por, grafico: rellenarPeriodos(serie, s.por, rango.desde, rango.hasta), rango, tipos, rubros, provs, abierta: s.abierta, vivo: s.vivo, error: s.error });
}

function vistaAccesoActual() {
  const nota = datos.esPrueba ? '<b>Modo de prueba, datos ficticios.</b><br>PIN del administrador: 1234. PIN del cajero: 4321.' : '';
  if (datos.acceso === 'pin' && !datos.esPrueba) { const h = new Date().getHours(); return vistaEntrada({ saludo: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches', pin: s.pin, error: s.errorPin }); }
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
  s.bodega = estadoBodega(); s.pestana = esAdmin() ? 'Inicio' : 'Caja'; s.fecha = null; s.pin = ''; s.pin1 = ''; s.errorPin = ''; s.form = null; s.cierre = null; s.aviso = ''; s.error = '';
  suscribirCompras(); suscribirEfectivo();
}

let cancelarEfectivo = null;
async function suscribirEfectivo() {
  if (cancelarEfectivo) { cancelarEfectivo(); cancelarEfectivo = null; }
  try {
    cancelarEfectivo = await datos.movimientosSuscribir(async (m) => {
      const neg = s.negocios.find((n) => n.id === m.negocioId)?.nombre || '';
      s.avisoEfectivo = `${m.tipo === 'entrada' ? 'Entró' : 'Salió'} efectivo en ${neg}: ${colones(m.monto)} (${m.motivo}).`;
      if (s.usuario && s.pestana === 'Inicio' && !document.activeElement?.matches?.('input')) await pintar();
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
        if (s.usuario && s.pestana === 'Compras') await pintar();
        setTimeout(() => { s.vivo = false; const el = document.querySelector('[data-id="vivo"]'); if (el) { el.classList.remove('on'); el.lastChild.textContent = 'En vivo'; } }, 4000);
      }, 300);
    });
  } catch { /* sin tiempo real: la vista sigue funcionando al abrirla */ }
}

async function evaluarAcceso() {
  s.acceso = await datos.estadoAcceso();
  if (s.acceso === 'abierta') { const u = await datos.sesionActual(); if (u) await entrarConUsuario(u); }
  else { s.usuario = null; s.pin = ''; s.pin1 = ''; s.faseCrear = 'nuevo'; }
}

async function intentarPin() {
  s.errorPin = '';
  try {
    if (datos.acceso === 'pin') {
      const u = await datos.iniciarSesion({ pin: s.pin });
      if (!u) { s.errorPin = datos.esPrueba ? 'PIN incorrecto. Intente de nuevo.' : 'Clave incorrecta. Intente de nuevo.'; s.pin = ''; } else await entrarConUsuario(u);
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

const sumarDiasTexto = (t, n) => { const d = new Date(`${t}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

raiz.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]'); if (!el) return;
  const a = el.dataset.accion, v = el.dataset.valor;
  if (s.usuario && s.pestana === 'Bodega' && await accionBodega(a, v, { datos, b: s.bodega, raiz, repintar: pintar, el })) return;
  try {
    if (a === 'digito') { if (s.pin.length < (datos.esPrueba ? 6 : 4)) s.pin += v; s.errorPin = ''; return pintar(); }
    if (a === 'borrar') { s.pin = s.pin.slice(0, -1); return pintar(); }
    if (a === 'entrar') return intentarPin();
    if (a === 'otra-cuenta') { await datos.cerrarSesion(); await evaluarAcceso(); return pintar(); }
    if (a === 'reintentar') { s.error = ''; return pintar(); }
    if (a === 'pestana') { s.pestana = v; s.aviso = ''; s.error = ''; s.cierre = null; s.corrigiendo = null; await pintar(); return void window.scrollTo(0, 0); }
    if (a === 'salir') { await datos.cerrarSesion(); Object.assign(s, { usuario: null, form: null, aviso: '', pin: '' }); if (cancelarSuscripcion) { cancelarSuscripcion(); cancelarSuscripcion = null; } if (cancelarEfectivo) { cancelarEfectivo(); cancelarEfectivo = null; } await evaluarAcceso(); return pintar(); }
    if (a === 'bloquear') { await datos.bloquear(); await evaluarAcceso(); return pintar(); }
    if (a === 'negocio') { s.negocioId = v; escribirLS('dixiapp.negocio', v); Object.assign(s, { form: null, limite: 7, fecha: null, aviso: '', cierre: null, corrigiendo: null }); return pintar(); }
    if (a === 'tema') { s.tema = v; escribirLS('dixiapp.tema', v); aplicarTema(v); return pintar(); }
    if (a === 'restablecer') { await datos.restablecerPrueba(); s.aviso = ''; return pintar(); }
    if (a === 'mas-cierres') { s.limite += 7; return pintar(); }
    if (a === 'ir-bodega') { s.bodega.seccion = v; s.pestana = 'Bodega'; await pintar(); return void window.scrollTo(0, 0); }
    if (a === 'dif-abrir') { s.resolviendo = v; s.notaDif = ''; return pintar(); }
    if (a === 'dif-cancelar') { s.resolviendo = null; return pintar(); }
    if (a === 'dif-resolver') { await datos.diferenciaResolver({ cajaId: /^\d+$/.test(v) ? Number(v) : v, nota: s.notaDif }); s.resolviendo = null; s.notaDif = ''; return pintar(); }
    if (a === 'aviso-cerrar') { s.avisoEfectivo = ''; return pintar(); }
    if (a === 'ir-cierres') { s.pestana = 'Cierres'; await pintar(); return void window.scrollTo(0, 0); }
    if (a === 'viaje-editar') { s.viajeForm = { destino: s.viaje?.destino || '', fecha: s.viaje?.fecha || '', error: '' }; return pintar(); }
    if (a === 'viaje-cancelar') { s.viajeForm = null; return pintar(); }
    if (a === 'viaje-guardar') {
      const f = s.viajeForm; f.destino = f.destino.trim();
      if (!f.destino) f.error = 'Escribe a dónde quieres ir.'; else if (!f.fecha) f.error = 'Elige el día en que sales.'; else if (diasHasta(await datos.hoy(), f.fecha) < 0) f.error = 'Esa fecha ya pasó. Elige una que esté por llegar.'; else f.error = '';
      if (!f.error) { await datos.viajeAgregar({ destino: f.destino, fecha: f.fecha }); s.viajeForm = null; }
      return pintar();
    }
    // Caja
    if (a === 'dia-menos' || a === 'dia-mas') { s.fecha = sumarDiasTexto(s.fecha, a === 'dia-mas' ? 1 : -1); s.aviso = ''; return pintar(); }
    if (a === 'dia-hoy') { s.fecha = null; return pintar(); }
    if (a === 'abrir-caja') return abrirCaja();
    if (a === 'abrir-form') { s.aviso = ''; s.form = { tipo: v, monto: '', motivo: '', nota: '', error: '', sug: await datos.sugerenciasMotivos(v) }; await pintar(); return void document.getElementById('formulario')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (a === 'cancelar-form') { s.form = null; return pintar(); }
    if (a === 'motivo') { s.form.motivo = v; s.form.error = ''; await pintar(); return void document.getElementById('f-monto')?.focus(); }
    if (a === 'guardar-mov') return guardarMovimiento();
    if (a === 'corregir') { s.corrigiendo = v; return pintar(); }
    if (a === 'cancelar-corr') { s.corrigiendo = null; return pintar(); }
    if (a === 'confirmar-corr') { await datos.corregirMovimiento(v, {}); s.corrigiendo = null; s.aviso = 'Corrección registrada. El movimiento original queda a la vista.'; return pintar(); }
    if (a === 'cerrar-caja') return cerrar(v === 'confirmar');
    if (a === 'cancelar-cierre') { s.cierre = null; return pintar(); }
    // Compras
    if (a === 'filtro-negocio') { s.filtro.neg = v; s.abierta = null; return pintar(); }
    if (a === 'por') { s.por = v; return pintar(); }
    if (a === 'factura') { s.abierta = s.abierta === v ? null : v; return pintar(); }
  } catch (e) { s.error = e.message; s.corrigiendo = null; pintar(); }
});

raiz.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (s.usuario && s.pestana === 'Bodega' && entradaBodega(ev, raiz, s.bodega)) return;
  if (['f-monto', 'c-contado', 'a-fondo'].includes(id)) {
    const n = leerMonto(ev.target.value);
    ev.target.value = n === null ? '' : miles(n);
    if (id === 'f-monto') s.form.monto = ev.target.value;
    if (id === 'a-fondo') s.fondo = ev.target.value;
    if (id === 'c-contado') actualizarDif();
  }
  if (id === 'd-nota') s.notaDif = ev.target.value;
  if (id === 'v-destino' && s.viajeForm) s.viajeForm.destino = ev.target.value;
  if (id === 'v-fecha' && s.viajeForm) s.viajeForm.fecha = ev.target.value;
  if (id === 'f-motivo') s.form.motivo = ev.target.value;
  if (id === 'f-nota') s.form.nota = ev.target.value;
  if (id === 'a-pin') {
    s.pin = ev.target.value.replace(/\D/g, '').slice(0, 4); ev.target.value = s.pin; s.errorPin = '';
    if (s.pin.length === 4) intentarPin();
    return;
  }
  if (id === 'a-correo') s.correo = ev.target.value;
});
raiz.addEventListener('change', (ev) => { if (ev.target.id === 'f-proveedor') { s.filtro.proveedor = ev.target.value; s.abierta = null; pintar(); } });
raiz.addEventListener('submit', async (ev) => {
  if (ev.target.dataset.form === 'pin') { ev.preventDefault(); if (s.pin.length === 4) intentarPin(); return; }
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
// Bloqueo por inactividad (solo con acceso real): pide el PIN otra vez tras 5 minutos sin tocar la pantalla
setInterval(async () => {
  if (datos.esPrueba || !s.usuario || Date.now() - s.ultimo < 5 * 60 * 1000) return;
  await datos.bloquear(); await evaluarAcceso(); pintar();
}, 15000);

async function abrirCaja() {
  const fondo = leerMonto(s.fondo) ?? 0;
  try { await datos.abrirCaja(s.negocioId, { fondoInicial: fondo }); s.aviso = `Caja abierta con un fondo de ${colones(fondo)}.`; s.fondo = ''; s.error = ''; }
  catch (e) { s.error = e.message; }
  pintar();
}

async function guardarMovimiento() {
  const f = s.form; f.error = ''; const monto = leerMonto(f.monto); const motivo = f.motivo.trim();
  if (!monto) f.error = 'Escriba el monto en colones.';
  else if (!motivo) f.error = 'Escriba el motivo o toque una sugerencia.';
  if (f.error) { await pintar(); return; }
  try {
    await datos.registrarMovimiento({ negocioId: s.negocioId, tipo: f.tipo, monto, motivo, nota: f.nota });
    s.aviso = `${f.tipo === 'salida' ? 'Salida' : 'Entrada'} de ${colones(monto)} guardada.`;
    s.form = null;
  } catch (e) { f.error = e.message; }
  await pintar();
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
  try { await evaluarAcceso(); } catch (e) { s.errorPin = e.message; }
  await pintar();
}
iniciar();
if (datos.esPrueba) window.dixiPrueba = datos; // solo para pruebas automaticas en modo de prueba
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
