import { datos } from './datos/index.js';
import { MOTIVOS_SALIDA } from './datos/interfaz.js';
import { leerMonto, aplicarTema } from './ui.js';
import { vistaAcceso, marco, vistaHoy, vistaCierres, vistaEfectivo, vistaMas } from './vistas.js';
import { colones } from './datos/formato.js';
import { estadoDiferencia, diferencia } from './datos/calculos.js';

const raiz = document.getElementById('app');
const leerLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

const s = { usuario: null, negocios: [], negocioId: null, pestana: 'Hoy', pin: '', errorPin: '', form: null, aviso: '', limite: 7, errorCierre: '', tema: leerLS('dixiapp.tema', 'auto') };
aplicarTema(s.tema);

const esGerente = () => s.usuario?.rol === 'gerente';
const pestanasDe = () => (esGerente() ? ['Hoy', 'Cierres', 'Efectivo', 'Más'] : ['Hoy', 'Efectivo', 'Más']);

async function pintar() {
  if (!s.usuario) { raiz.innerHTML = vistaAcceso({ pin: s.pin, error: s.errorPin }); return; }
  const hoy = await datos.hoy();
  const negocio = s.negocios.find((n) => n.id === s.negocioId);
  const caja = await datos.cajaDeHoy(s.negocioId);
  const movs = await datos.movimientos(s.negocioId, hoy);
  s.esperado = caja.esperado;
  let contenido = '';
  if (s.pestana === 'Hoy') contenido = vistaHoy({ caja, movs, esGerente: esGerente() });
  else if (s.pestana === 'Cierres' && esGerente()) {
    const { items, hayMas } = await datos.cierres(s.negocioId, { limite: s.limite });
    contenido = vistaCierres({ caja, cierres: items, hayMas, errorCierre: s.errorCierre });
  } else if (s.pestana === 'Efectivo') {
    const semana = esGerente() ? await datos.resumenSemana(s.negocioId) : null;
    const personas = [...new Set([s.usuario.nombre, 'Gerente de prueba', 'Empleada de prueba', 'Otra persona'])];
    contenido = vistaEfectivo({ caja, movs, semana, form: s.form, aviso: s.aviso, esGerente: esGerente(), personas });
  } else contenido = vistaMas({ usuario: s.usuario, negocios: s.negocios, negocioId: s.negocioId, tema: s.tema, esGerente: esGerente() });
  raiz.innerHTML = marco({ usuario: s.usuario, negocio: negocio, hoy, pestana: s.pestana, pestanas: pestanasDe(), contenido });
  if (s.pestana === 'Cierres') actualizarDif();
}

async function entrarConUsuario(u) {
  s.usuario = u; s.negocios = await datos.negocios();
  const guardado = leerLS('dixiapp.negocio', '');
  s.negocioId = s.negocios.some((n) => n.id === guardado) ? guardado : s.negocios[0].id;
  s.pestana = 'Hoy'; s.pin = ''; s.errorPin = '';
}

async function intentarEntrar() {
  try {
    const u = await datos.iniciarSesion(s.pin);
    if (!u) { s.errorPin = 'PIN incorrecto. Intente de nuevo.'; s.pin = ''; return pintar(); }
    await entrarConUsuario(u);
  } catch (e) { s.errorPin = e.message; s.pin = ''; }
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

raiz.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]'); if (!el) return;
  const a = el.dataset.accion, v = el.dataset.valor;
  try {
    if (a === 'digito') { if (s.pin.length < 6) s.pin += v; s.errorPin = ''; return pintar(); }
    if (a === 'borrar') { s.pin = s.pin.slice(0, -1); return pintar(); }
    if (a === 'entrar') return intentarEntrar();
    if (a === 'pestana') { s.pestana = v; s.aviso = ''; s.errorCierre = ''; await pintar(); return void window.scrollTo(0, 0); }
    if (a === 'salir') { await datos.cerrarSesion(); Object.assign(s, { usuario: null, form: null, aviso: '', pin: '' }); return pintar(); }
    if (a === 'negocio') { s.negocioId = v; escribirLS('dixiapp.negocio', v); s.form = null; s.limite = 7; return pintar(); }
    if (a === 'tema') { s.tema = v; escribirLS('dixiapp.tema', v); aplicarTema(v); return pintar(); }
    if (a === 'restablecer') { await datos.restablecerPrueba(); s.aviso = ''; return pintar(); }
    if (a === 'mas-cierres') { s.limite += 7; return pintar(); }
    if (a === 'abrir-form') {
      s.aviso = '';
      s.form = { tipo: v, monto: '', motivo: '', otro: '', quien: s.usuario.nombre, nota: '', error: '' };
      await pintar(); return void document.getElementById('formulario')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (a === 'cancelar-form') { s.form = null; return pintar(); }
    if (a === 'motivo') { s.form.motivo = v; s.form.error = ''; await pintar(); return void document.getElementById(v === 'Otro' ? 'f-otro' : 'f-monto')?.focus(); }
    if (a === 'guardar-mov') return guardarMovimiento();
    if (a === 'cerrar-caja') return cerrar();
  } catch (e) { alert(e.message); }
});

raiz.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (['f-monto', 'c-contado', 'c-tarjeta', 'c-sinpe'].includes(id)) {
    const n = leerMonto(ev.target.value);
    ev.target.value = n === null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (id === 'f-monto') s.form.monto = ev.target.value;
    if (id === 'c-contado') actualizarDif();
  }
  if (id === 'f-otro') s.form.otro = ev.target.value;
  if (id === 'f-nota') s.form.nota = ev.target.value;
});
raiz.addEventListener('change', (ev) => { if (ev.target.id === 'f-quien') s.form.quien = ev.target.value; });
document.addEventListener('keydown', (ev) => {
  if (s.usuario) return;
  if (/^\d$/.test(ev.key) && s.pin.length < 6) { s.pin += ev.key; s.errorPin = ''; pintar(); }
  else if (ev.key === 'Backspace') { s.pin = s.pin.slice(0, -1); pintar(); }
  else if (ev.key === 'Enter' && s.pin.length >= 4) intentarEntrar();
});

async function guardarMovimiento() {
  const f = s.form; const monto = leerMonto(f.monto);
  const motivo = f.motivo === 'Otro' ? f.otro.trim() : f.motivo;
  if (!monto) f.error = 'Escriba el monto en colones.';
  else if (!f.motivo) f.error = 'Elija un motivo de la lista.';
  else if (!motivo) f.error = 'Escriba cuál es el otro motivo.';
  if (f.error) { await pintar(); return; }
  try {
    await datos.registrarMovimiento({ negocioId: s.negocioId, tipo: f.tipo, monto, motivo, nota: f.nota, registradoPor: f.quien });
    s.aviso = `${f.tipo === 'salida' ? 'Salida' : 'Entrada'} de ${colones(monto)} guardada. El efectivo esperado ya se actualizó.`;
    s.form = null;
  } catch (e) { f.error = e.message; }
  await pintar();
}

async function cerrar() {
  const contado = leerMonto(document.getElementById('c-contado').value);
  const tarjeta = leerMonto(document.getElementById('c-tarjeta').value) ?? 0;
  const sinpe = leerMonto(document.getElementById('c-sinpe').value) ?? 0;
  if (contado === null) { s.errorCierre = 'Escriba el efectivo contado en caja antes de cerrar.'; return pintar(); }
  try { await datos.cerrarCaja(s.negocioId, { contado, tarjeta, sinpe }); s.errorCierre = ''; } catch (e) { s.errorCierre = e.message; }
  pintar();
}

async function iniciar() {
  const u = await datos.sesionActual();
  if (u) await entrarConUsuario(u);
  await pintar();
}
iniciar();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
