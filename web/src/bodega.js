// Controlador de Bodega: junta los datos con las vistas y atiende los toques. app.js solo lo llama.
import { marcoBodega, vistaExistencias, vistaSacar, vistaRecibir, vistaContar, vistaAlertas, TIPOS_SALIDA } from './vistas-bodega.js';

const MOTIVO_DEFECTO = { consumo: 'Consumo del día', merma: 'Merma', devolucion: 'Devolución a proveedor', traslado: '' };
export const estadoBodega = () => ({
  seccion: 'existencias', ubicacion: null, q: '', soloBajo: false, ajustando: null, motivoAj: 'Ajuste directo',
  tipo: 'consumo', destino: null, motivo: MOTIVO_DEFECTO.consumo, cant: {}, conteoVals: {}, revisar: false, resultado: null, cancelando: false, error: '', aviso: '',
});
const num = (t) => { const x = Number(String(t).trim().replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const fmt = (x) => String(Math.round(x * 1000) / 1000);

export async function construirBodega(datos, b) {
  const ubicaciones = await datos.bodegaUbicaciones();
  if (!ubicaciones.some((u) => u.id === b.ubicacion)) b.ubicacion = ubicaciones[0].id;
  const ubicacion = ubicaciones.find((u) => u.id === b.ubicacion);
  const alertas = await datos.bodegaAlertas();
  let contenido = '';
  if (b.seccion === 'existencias') {
    const [filas, movimientos] = await Promise.all([datos.bodegaExistencias({ ubicacion: b.ubicacion }), datos.bodegaMovimientos({ ubicacion: b.ubicacion, limite: 6 })]);
    contenido = vistaExistencias({ b, filas, movimientos });
  } else if (b.seccion === 'sacar') {
    contenido = vistaSacar({ b, filas: await datos.bodegaExistencias({ ubicacion: b.ubicacion }), ubicaciones });
  } else if (b.seccion === 'recibir') {
    contenido = vistaRecibir({ b, facturas: await datos.bodegaPorRecibir() });
  } else if (b.seccion === 'contar') {
    contenido = vistaContar({ b, conteo: await datos.bodegaConteo(b.ubicacion), ubicacion });
  } else contenido = vistaAlertas({ alertas });
  const html = marcoBodega({ b, ubicaciones, alertas, contenido });
  b.error = ''; b.aviso = '';
  return html;
}

// Despues de pintar: reaplica el buscador y el estado del boton de guardar (todo sin volver a pedir datos)
export function despuesDePintar(raiz, b) { filtrar(raiz, b.q); refrescarBarra(raiz, b); }
function filtrar(raiz, q) {
  const t = String(q || '').trim().toLowerCase();
  raiz.querySelectorAll('[data-nombre]').forEach((el) => { el.hidden = !!t && !el.dataset.nombre.includes(t); });
}
function refrescarBarra(raiz, b) {
  const boton = raiz.querySelector('#b-guardar'); if (!boton) return;
  const n = Object.values(b.cant).filter((v) => num(v) > 0).length;
  boton.disabled = n === 0;
  const verbo = b.tipo === 'traslado' ? 'Pasar' : 'Guardar salida de';
  boton.textContent = n === 0 ? 'Elija cantidades' : `${verbo} ${n} ${n === 1 ? 'artículo' : 'artículos'}`;
}

export function entradaBodega(ev, raiz, b) {
  const el = ev.target;
  if (el.id === 'b-q') { b.q = el.value; filtrar(raiz, b.q); return true; }
  if (el.id === 'b-motivo') { b.motivo = el.value; return true; }
  if (el.id === 'b-motivo-aj') { b.motivoAj = el.value; return true; }
  if (el.classList?.contains('b-cant')) { b.cant[el.dataset.articulo] = el.value; refrescarBarra(raiz, b); return true; }
  if (el.classList?.contains('b-cont')) { b.conteoVals[el.dataset.articulo] = el.value; return true; }
  return false;
}

const reiniciarCaptura = (b) => Object.assign(b, { cant: {}, destino: null, conteoVals: {}, revisar: false, resultado: null, cancelando: false, ajustando: null, q: '' });

// Atiende un toque de Bodega. Devuelve true si lo manejo.
export async function accionBodega(a, v, { datos, b, raiz, repintar }) {
  if (!a.startsWith('b-')) return false;
  try {
    if (a === 'b-sec') { b.seccion = v; Object.assign(b, { q: '', error: '', aviso: '', ajustando: null, revisar: false, cancelando: false }); }
    else if (a === 'b-ubic') { b.ubicacion = v; reiniciarCaptura(b); }
    else if (a === 'b-solo-bajo') b.soloBajo = !b.soloBajo;
    else if (a === 'b-ajustar') { b.ajustando = b.ajustando === v ? null : v; b.motivoAj = 'Ajuste directo'; }
    else if (a === 'b-guardar-ajuste') {
      const real = num(raiz.querySelector('#b-real').value);
      if (!(real >= 0)) throw new Error('Escriba la cantidad real (un número, puede ser 0).');
      const r = await datos.bodegaAjustar({ ubicacion: b.ubicacion, items: [{ articuloId: v, cantidadReal: real }], motivo: b.motivoAj });
      const x = r.ajustes[0]; b.aviso = x.diferencia === 0 ? 'Sin cambios: ya coincidía.' : `Ajuste guardado: ${x.articulo} pasó de ${fmt(x.antes)} a ${fmt(x.despues)}.`; b.ajustando = null;
    }
    else if (a === 'b-tipo') { b.tipo = v; b.motivo = MOTIVO_DEFECTO[v]; b.destino = null; }
    else if (a === 'b-destino') b.destino = v;
    else if (a === 'b-mas' || a === 'b-menos') {
      const entrada = raiz.querySelector(`.b-cant[data-articulo="${CSS.escape(v)}"]`);
      const nuevo = Math.max(0, (num(entrada.value) || 0) + (a === 'b-mas' ? 1 : -1));
      entrada.value = nuevo ? fmt(nuevo) : ''; b.cant[v] = entrada.value; refrescarBarra(raiz, b); return true;
    }
    else if (a === 'b-guardar-salida') {
      const items = Object.entries(b.cant).filter(([, c]) => num(c) > 0).map(([articuloId, c]) => ({ articuloId, cantidad: num(c) }));
      if (!items.length) throw new Error('Elija al menos un artículo y su cantidad.');
      if (b.tipo === 'traslado') {
        if (!b.destino) throw new Error('Elija a dónde se pasa.');
        await datos.bodegaTrasladar({ origen: b.ubicacion, destino: b.destino, items, motivo: b.motivo });
      } else {
        if (String(b.motivo).trim().length < 3) throw new Error('Escriba el motivo (al menos 3 letras).');
        await datos.bodegaSalida({ tipo: b.tipo, ubicacion: b.ubicacion, items, motivo: b.motivo });
      }
      b.aviso = `${b.tipo === 'traslado' ? 'Traslado' : (TIPOS_SALIDA.find((t) => t[0] === b.tipo) || [])[1] || 'Salida'} guardado: ${items.length} ${items.length === 1 ? 'artículo' : 'artículos'}.`;
      b.cant = {}; b.destino = null;
    }
    else if (a === 'b-recibir') {
      const f = (await datos.bodegaPorRecibir()).find((x) => x.clave === v);
      if (!f) throw new Error('Esa factura ya no está pendiente.');
      const lineas = f.lineas.filter((l) => l.sugerencia).map((l) => ({ clave: f.clave, linea: l.linea, articuloId: l.sugerencia.articuloId, factor: l.sugerencia.factor }));
      const r = await datos.bodegaRecibir({ lineas });
      b.aviso = `Recibido: ${r.recibidas} ${r.recibidas === 1 ? 'línea' : 'líneas'} de ${f.proveedor}. Ya suman a la bodega.`;
    }
    else if (a === 'b-iniciar-conteo') { await datos.bodegaConteoIniciar(b.ubicacion); b.conteoVals = {}; b.resultado = null; }
    else if (a === 'b-guardar-avance' || a === 'b-revisar') {
      const c = await datos.bodegaConteo(b.ubicacion);
      const items = [...raiz.querySelectorAll('.b-cont')].filter((i) => i.value.trim() !== '').map((i) => ({ articuloId: i.dataset.articulo, contado: num(i.value) }));
      if (items.some((i) => !(i.contado >= 0))) throw new Error('Hay una cantidad contada que no es un número.');
      if (items.length) await datos.bodegaConteoRegistrar(c.id, items);
      if (a === 'b-guardar-avance') { b.aviso = items.length ? 'Avance guardado.' : 'No hay nada nuevo que guardar.'; b.conteoVals = {}; }
      else { if (!items.length && !c.contadas) throw new Error('Cuente al menos un artículo antes de revisar.'); b.revisar = true; b.conteoVals = {}; }
    }
    else if (a === 'b-volver-contar') b.revisar = false;
    else if (a === 'b-confirmar-conteo') { const c = await datos.bodegaConteo(b.ubicacion); b.resultado = await datos.bodegaConteoConfirmar(c.id); b.revisar = false; }
    else if (a === 'b-cerrar-resultado') b.resultado = null;
    else if (a === 'b-pedir-cancelar') b.cancelando = true;
    else if (a === 'b-no-cancelar') b.cancelando = false;
    else if (a === 'b-cancelar-conteo') { const c = await datos.bodegaConteo(b.ubicacion); await datos.bodegaConteoCancelar(c.id, 'Cancelado desde Dixiapp'); b.cancelando = false; b.revisar = false; b.aviso = 'Conteo cancelado. No se cambió ninguna existencia.'; }
    else return false;
  } catch (e) { b.error = e.message; }
  await repintar();
  return true;
}
