// Controlador de Bodega: junta los datos con las vistas y atiende los toques. app.js solo lo llama.
import { marcoBodega, vistaExistencias, vistaSacar, vistaRecibir, vistaContar, vistaAlertas, vistaMinimos, TIPOS_SALIDA } from './vistas-bodega.js';

const MOTIVO_DEFECTO = { consumo: 'Consumo del día', merma: 'Merma', devolucion: 'Devolución a proveedor', traslado: '' };
export const estadoBodega = () => ({
  seccion: 'existencias', ubicacion: null, todos: false, q: '', qs: {}, soloBajo: false, ajustando: null, motivoAj: 'Ajuste directo',
  tipo: 'consumo', destino: null, motivo: MOTIVO_DEFECTO.consumo, cant: {}, conteoVals: {}, revisar: false, resultado: null, cancelando: false, error: '', aviso: '',
  sub: 'pendientes', asig: {}, factor: {}, vence: {}, picker: null, qa: '', deshaciendo: null, motivoDes: 'Se recibió por error', notaAbierta: null, notaCant: {}, notaUbic: null,
  minEdit: {}, sugOculta: false, confirmaMerma: null,
});
const num = (t) => { const x = Number(String(t).trim().replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const fmt = (x) => String(Math.round(x * 1000) / 1000);

export async function construirBodega(datos, b, hoy) {
  const ubicaciones = await datos.bodegaUbicaciones();
  if (!ubicaciones.some((u) => u.id === b.ubicacion)) b.ubicacion = ubicaciones[0].id;
  const ubicacion = ubicaciones.find((u) => u.id === b.ubicacion);
  const alertas = await datos.bodegaAlertas();
  const local = new Set(ubicaciones.filter((u) => u.tipo === 'local').map((u) => u.id));
  alertas.bajoMinimo.forEach((a) => { a.esLocal = local.has(a.ubicacionId); });
  let contenido = '';
  if (b.seccion === 'existencias') {
    const movimientos = await datos.bodegaMovimientos({ ubicacion: b.todos ? null : b.ubicacion, limite: 80 });
    if (b.todos) {
      const porLugar = await Promise.all(ubicaciones.map((u) => datos.bodegaExistencias({ ubicacion: u.id })));
      const mapa = new Map();
      porLugar.forEach((filas, i) => filas.forEach((f) => { if (!mapa.has(f.articuloId)) mapa.set(f.articuloId, { articuloId: f.articuloId, articulo: f.articulo, categoria: f.categoria, unidad: f.unidad, porLugar: ubicaciones.map(() => null) }); mapa.get(f.articuloId).porLugar[i] = f; }));
      const matriz = [...mapa.values()].sort((x, y) => x.categoria.localeCompare(y.categoria) || x.articulo.localeCompare(y.articulo));
      contenido = vistaExistencias({ b, filas: porLugar.flat(), movimientos, hoy, ubicaciones, matriz });
    } else {
      const [filas, lotes] = await Promise.all([datos.bodegaExistencias({ ubicacion: b.ubicacion }), b.ajustando ? datos.bodegaLotes({ articulo: b.ajustando, ubicacion: b.ubicacion }) : []]);
      contenido = vistaExistencias({ b, filas, movimientos, hoy, lotes, ubicaciones });
    }
  } else if (b.seccion === 'sacar') {
    const [filas, movimientos, destinoFilas] = await Promise.all([datos.bodegaExistencias({ ubicacion: b.ubicacion }), datos.bodegaMovimientos({ ubicacion: b.ubicacion, limite: 80 }),
      b.tipo === 'traslado' && b.destino ? datos.bodegaExistencias({ ubicacion: b.destino }) : null]);
    contenido = vistaSacar({ b, filas, ubicaciones, hoy, movimientos, destinoFilas });
  } else if (b.seccion === 'recibir') {
    const [facturas, notas] = await Promise.all([datos.bodegaPorRecibir(), datos.bodegaNotas({ estado: 'por_revisar' })]);
    const recibidas = b.sub === 'recibidas' ? await datos.bodegaRecibidas({ limite: 15 }) : [];
    const catalogo = b.picker ? await datos.bodegaArticulos({}) : null;
    contenido = vistaRecibir({ b, facturas, recibidas, notas, catalogo, ubicaciones, hoy });
  } else if (b.seccion === 'contar') {
    const [conteo, movimientos] = await Promise.all([datos.bodegaConteo(b.ubicacion), datos.bodegaMovimientos({ ubicacion: b.ubicacion, limite: 80 })]);
    contenido = vistaContar({ b, conteo, ubicacion, hoy, movimientos });
  } else if (b.seccion === 'minimos') {
    const [articulos, sug] = await Promise.all([datos.bodegaArticulos({}), datos.bodegaSugerenciaMinimos()]);
    sug.items = sug.items.filter((i) => (articulos.find((a) => a.id === i.articuloId)?.minimos[i.ubicacionId] || 0) !== i.minimo);
    contenido = vistaMinimos({ b, articulos, ubicaciones, sugerencia: sug, bajo: alertas.bajoMinimo.length });
  } else contenido = vistaAlertas({ alertas, b, hoy });
  const html = marcoBodega({ b, ubicaciones, alertas, contenido });
  b.error = ''; b.aviso = '';
  return html;
}

// Despues de pintar: reaplica el buscador y el estado del boton de guardar (todo sin volver a pedir datos)
export function despuesDePintar(raiz, b) { filtrar(raiz, b.q); filtrarSelector(raiz, b.qa); refrescarBarra(raiz, b); refrescarMinimos(raiz, b); }
function filtrar(raiz, q) {
  const t = String(q || '').trim().toLowerCase();
  raiz.querySelectorAll('[data-nombre]').forEach((el) => { el.hidden = !!t && !el.dataset.nombre.includes(t); });
  raiz.querySelectorAll('tr[data-cat]').forEach((el) => { el.hidden = !!t; });
}
function filtrarSelector(raiz, qa) {
  const t = String(qa || '').trim().toLowerCase(); let visibles = 0;
  raiz.querySelectorAll('[data-sel]').forEach((el) => { const ok = (!t || el.dataset.sel.includes(t)) && visibles < 8; el.hidden = !ok; if (ok) visibles++; });
}
function refrescarMinimos(raiz, b) {
  const boton = raiz.querySelector('#b-guardar-min'); if (!boton) return;
  const c = Object.keys(b.minEdit).length; boton.disabled = c === 0; boton.parentElement.hidden = c === 0; boton.textContent = c ? `Guardar ${c} ${c === 1 ? 'cambio' : 'cambios'}` : 'Escriba un mínimo para guardar';
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
  if (el.id === 'b-motivo-des') { b.motivoDes = el.value; return true; }
  if (el.id === 'b-qa') { b.qa = el.value; filtrarSelector(raiz, b.qa); return true; }
  if (el.classList?.contains('b-vence')) { b.vence[el.dataset.clave] = el.value; return true; }
  if (el.classList?.contains('b-factor')) { b.factor[el.dataset.k] = el.value; const r = el.closest('.asignada')?.querySelector('.res'); if (r) r.textContent = fmt((num(el.dataset.cant) || 0) * (num(el.value) || 0)); return true; }
  if (el.classList?.contains('b-nota-cant')) { b.notaCant[el.dataset.articulo] = el.value; return true; }
  if (el.classList?.contains('b-min')) { b.minEdit[`${el.dataset.articulo}|${el.dataset.ubic}`] = el.value; refrescarMinimos(raiz, b); return true; }
  if (el.classList?.contains('b-cant')) { b.cant[el.dataset.articulo] = el.value; refrescarBarra(raiz, b); return true; }
  if (el.classList?.contains('b-cont')) { b.conteoVals[el.dataset.articulo] = el.value; return true; }
  return false;
}

const reiniciarCaptura = (b) => Object.assign(b, { cant: {}, destino: null, conteoVals: {}, revisar: false, resultado: null, cancelando: false, ajustando: null });

// Atiende un toque de Bodega. Devuelve true si lo manejo.
export async function accionBodega(a, v, { datos, b, raiz, repintar, el }) {
  if (!a.startsWith('b-')) return false;
  try {
    if (a === 'b-sec') { b.qs[b.seccion] = b.q; b.seccion = v; b.q = b.qs[v] || ''; Object.assign(b, { error: '', aviso: '', ajustando: null, revisar: false, cancelando: false, picker: null, deshaciendo: null, notaAbierta: null, confirmaMerma: null }); }
    else if (a === 'b-todos') { b.todos = !b.todos; b.ajustando = null; }
    else if (a === 'b-ubic') { b.ubicacion = v; b.todos = false; reiniciarCaptura(b); }
    else if (a === 'b-solo-bajo') b.soloBajo = !b.soloBajo;
    else if (a === 'b-ajustar') { b.ajustando = b.ajustando === v ? null : v; b.motivoAj = 'Ajuste directo'; }
    else if (a === 'b-guardar-ajuste') {
      const real = num(raiz.querySelector('#b-real').value);
      if (!(real >= 0)) throw new Error('Escriba la cantidad real (un número, puede ser 0).');
      const r = await datos.bodegaAjustar({ ubicacion: b.ubicacion, items: [{ articuloId: v, cantidadReal: real }], motivo: b.motivoAj });
      const x = r.ajustes[0]; b.aviso = x.diferencia === 0 ? 'Sin cambios: ya coincidía.' : `Ajuste guardado: ${x.articulo} pasó de ${fmt(x.antes)} a ${fmt(x.despues)}.`; b.ajustando = null;
    }
    else if (a === 'b-guardar-min-aqui') {
      const t = raiz.querySelector('#b-min-aqui').value.trim(); const m = t === '' ? 0 : num(t);
      if (!(m >= 0)) throw new Error('El mínimo debe ser un número, 0 o más.');
      await datos.bodegaFijarMinimos({ items: [{ articuloId: v, ubicacionId: b.ubicacion, minimo: m }] });
      b.aviso = m ? `Mínimo guardado: ${fmt(m)}.` : 'Se quitó el mínimo de este artículo.';
    }
    // ---------- Recibir: asignar articulo, recibir, deshacer, notas de credito ----------
    else if (a === 'b-sub') { b.sub = v; b.picker = null; b.deshaciendo = null; b.notaAbierta = null; }
    else if (a === 'b-elegir') { b.picker = b.picker === v ? null : v; b.qa = ''; }
    else if (a === 'b-asignar') {
      const art = (await datos.bodegaArticulos({})).find((x) => x.id === el.dataset.art); if (!art) throw new Error('Ese artículo ya no existe.');
      b.asig[v] = { articuloId: art.id, articulo: art.nombre, unidad: art.unidad, factor: 1 }; delete b.factor[v]; b.picker = null; b.qa = '';
    }
    else if (a === 'b-usar-propuesta') {
      const [clave, linea] = v.split('|'); const f = (await datos.bodegaPorRecibir()).find((x) => x.clave === clave); const l = f?.lineas.find((x) => String(x.linea) === linea);
      if (!l?.propuesta) throw new Error('Esa propuesta ya no está disponible.');
      b.asig[v] = { articuloId: l.propuesta.articuloId, articulo: l.propuesta.articulo, unidad: l.propuesta.unidad, factor: l.propuesta.factor }; delete b.factor[v];
    }
    else if (a === 'b-desasignar') { delete b.asig[v]; delete b.factor[v]; }
    else if (a === 'b-pedir-deshacer') { b.deshaciendo = b.deshaciendo === v ? null : v; }
    else if (a === 'b-deshacer') {
      const [clave, linea] = v.split('|'); await datos.bodegaDeshacerRecepcion({ clave, linea, motivo: b.motivoDes });
      b.deshaciendo = null; b.aviso = 'Recepción deshecha: la mercadería salió de la bodega y la línea volvió a «Por recibir».';
    }
    else if (a === 'b-nota-abrir') {
      b.notaAbierta = b.notaAbierta === v ? null : v; b.notaCant = {};
      const us = await datos.bodegaUbicaciones(); if (!b.notaUbic) b.notaUbic = (us.find((u) => u.tipo === 'bodega') || us[0]).id;
    }
    else if (a === 'b-nota-ubic') b.notaUbic = v;
    else if (a === 'b-nota-devolver') {
      const nt = (await datos.bodegaNotas({ estado: 'por_revisar' })).find((x) => x.clave === v); if (!nt) throw new Error('Esa nota ya fue atendida.');
      const items = nt.lineas.filter((l) => l.articuloId).map((l) => ({ articuloId: l.articuloId, cantidad: num(b.notaCant[l.articuloId] ?? (l.cantidad * l.factor)) })).filter((i) => i.cantidad > 0);
      if (!items.length) throw new Error('Esta nota no tiene líneas con artículo para devolver.');
      await datos.bodegaNotaDevolver({ clave: v, ubicacion: b.notaUbic, items, motivo: 'Nota de crédito del proveedor' });
      b.notaAbierta = null; b.notaCant = {}; b.aviso = `Devolución registrada (${items.length} ${items.length === 1 ? 'artículo' : 'artículos'}). La mercadería ya salió del inventario.`;
    }
    else if (a === 'b-nota-ignorar') { await datos.bodegaNotaIgnorar({ clave: v, motivo: 'No afecta el inventario' }); b.aviso = 'Listo: esa nota no afecta el inventario.'; }
    // ---------- Traslados: llenar lo que falta en un local ----------
    else if (a === 'b-llenar' || a === 'b-reponer') {
      if (a === 'b-reponer') { const us = await datos.bodegaUbicaciones(); const bod = us.find((u) => u.tipo === 'bodega'); if (!bod) throw new Error('No hay bodega central.'); Object.assign(b, { seccion: 'sacar', tipo: 'traslado', motivo: '', ubicacion: bod.id, destino: v, cant: {}, todos: false }); }
      const [origen, destino] = await Promise.all([datos.bodegaExistencias({ ubicacion: b.ubicacion }), datos.bodegaExistencias({ ubicacion: b.destino })]);
      const disp = new Map(origen.map((f) => [f.articuloId, f.cantidad])); b.cant = {}; let sinStock = 0;
      for (const f of destino.filter((x) => x.bajoMinimo)) {
        const falta = Math.round((f.minimo - f.cantidad) * 1000) / 1000, hay = disp.get(f.articuloId) || 0, c = Math.min(falta, hay);
        if (c > 0) b.cant[f.articuloId] = fmt(c); else sinStock++;
      }
      const n = Object.keys(b.cant).length; b.aviso = n ? `Listo para pasar ${n} ${n === 1 ? 'artículo' : 'artículos'} hasta el mínimo.${sinStock ? ` ${sinStock} no hay en la bodega.` : ''} Revise y guarde.` : 'Nada que pasar: lo que falta no está en la bodega.';
    }
    else if (a === 'b-merma-vencido') {
      if (!v) b.confirmaMerma = null;
      else if (b.confirmaMerma !== v) b.confirmaMerma = v;
      else {
        const al = (await datos.bodegaAlertas()).vencidos.find((x) => `${x.articuloId}|${x.ubicacionId || x.ubicacion}` === v); if (!al) throw new Error('Ese lote ya no está vencido.');
        await datos.bodegaSalida({ tipo: 'merma', ubicacion: al.ubicacionId, items: [{ articuloId: al.articuloId, cantidad: al.cantidad }], motivo: `Vencido el ${al.venceEn}` });
        b.confirmaMerma = null; b.aviso = `Merma guardada: ${fmt(al.cantidad)} ${al.unidad} de ${al.articulo}.`;
      }
    }
    // ---------- Minimos ----------
    else if (a === 'b-sug-ocultar') b.sugOculta = true;
    else if (a === 'b-sug-aplicar') {
      const sug = await datos.bodegaSugerenciaMinimos();
      await datos.bodegaFijarMinimos({ items: sug.items.map((i) => ({ articuloId: i.articuloId, ubicacionId: i.ubicacionId, minimo: i.minimo })) });
      b.aviso = `Se aplicaron ${sug.items.length} mínimos sugeridos.`;
    }
    else if (a === 'b-guardar-minimos') {
      const items = Object.entries(b.minEdit).map(([k, t]) => { const [articuloId, ubicacionId] = k.split('|'); const m = String(t).trim() === '' ? 0 : num(t); return { articuloId, ubicacionId, minimo: m }; });
      if (items.some((i) => !(i.minimo >= 0))) throw new Error('Hay un mínimo que no es un número.');
      await datos.bodegaFijarMinimos({ items }); b.minEdit = {}; b.aviso = `Mínimos guardados (${items.length}).`;
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
      const venceEn = b.vence[v] || null;
      if (venceEn && venceEn < new Date().toLocaleDateString('en-CA')) throw new Error('La fecha de vencimiento ya pasó. Revísela o déjela vacía.');
      const lineas = [];
      for (const l of f.lineas) {
        const k = `${f.clave}|${l.linea}`, x = b.asig[k];
        if (l.sugerencia) lineas.push({ clave: f.clave, linea: l.linea, articuloId: l.sugerencia.articuloId, factor: l.sugerencia.factor, venceEn });
        else if (x) { const fac = num(b.factor[k] ?? x.factor); if (!(fac > 0)) throw new Error(`Revise cuánto trae cada ${l.unidad} de «${l.descripcion}».`); lineas.push({ clave: f.clave, linea: l.linea, articuloId: x.articuloId, factor: fac, venceEn }); }
      }
      if (!lineas.length) throw new Error('Asigne al menos un artículo antes de recibir.');
      const r = await datos.bodegaRecibir({ lineas });
      for (const l of lineas) { delete b.asig[`${l.clave}|${l.linea}`]; delete b.factor[`${l.clave}|${l.linea}`]; }
      delete b.vence[v];
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

