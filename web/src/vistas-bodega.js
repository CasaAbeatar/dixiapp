// Vistas de Bodega (solo administradores). Pensadas para tableta de 8,7" y de 11": botones de al menos 48 px, tablas con scroll interno, pocos toques.
// Solo devuelven HTML. Cada seccion abre con lo de HOY y despues lo demas.
import { esc } from './ui.js';
import { fechaLarga, horaLegible } from './datos/fechas.js';
import { colones } from './datos/formato.js';

export const SECCIONES = [['existencias', 'Existencias'], ['recibir', 'Recibir'], ['sacar', 'Sacar'], ['contar', 'Contar'], ['alertas', 'Alertas'], ['minimos', 'Mínimos']];
export const TIPOS_SALIDA = [['consumo', 'Consumo', 'Uso normal'], ['merma', 'Merma', 'Se dañó o venció'], ['devolucion', 'Devolución', 'Vuelve al proveedor'], ['traslado', 'Pasar a otro lugar', 'Bodega a local']];
const n = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const boton = (accion, texto, clases = '', extra = '') => `<button class="btn ${clases}" data-accion="${accion}" ${extra}>${texto}</button>`;
const msg = (b) => `${b.error ? `<p class="error" role="alert">${esc(b.error)}</p>` : ''}${b.aviso ? `<p class="aviso" role="status">${esc(b.aviso)}</p>` : ''}`;
const pl = (c, uno, varios) => `${c} ${c === 1 ? uno : varios}`;
const NIVEL = { verde: ['Muy probable', 'ok'], amarillo: ['Revise', 'amarillo'], rojo: ['Dudosa', 'mal'] };

export function marcoBodega({ b, ubicaciones, alertas, contenido }) {
  const insignia = { alertas: alertas.bajoMinimo.length + alertas.vencenPronto.length + alertas.vencidos.length, recibir: alertas.porRecibir };
  const secciones = SECCIONES.map(([k, t]) => `<button class="seccion" data-accion="b-sec" data-valor="${k}" aria-pressed="${b.seccion === k}">${t}${insignia[k] ? `<span class="cuenta">${insignia[k]}</span>` : ''}</button>`).join('');
  const conLugar = ['existencias', 'sacar', 'contar'].includes(b.seccion);
  const fichas = ubicaciones.map((u) => `<button class="ficha" data-accion="b-ubic" data-valor="${esc(u.id)}" aria-pressed="${!(b.seccion === 'existencias' && b.todos) && u.id === b.ubicacion}">${esc(u.nombre)}</button>`).join('')
    + (b.seccion === 'existencias' ? `<button class="ficha" data-accion="b-todos" aria-pressed="${!!b.todos}">Todos los lugares</button>` : '');
  const ubic = conLugar ? `<div class="fichas selector-negocio" role="group" aria-label="Lugar">${fichas}</div>` : '';
  return `<div class="secciones-bodega" role="group" aria-label="Bodega">${secciones}</div>${ubic}${msg(b)}${contenido}`;
}

const buscador = (b, ayuda = 'Buscar un artículo') => `<input type="text" id="b-q" class="buscar" placeholder="${ayuda}" autocomplete="off" value="${esc(b.q)}" aria-label="${ayuda}">`;
// Linea de HOY: cuantas entradas y salidas hubo hoy (a partir de los movimientos recientes)
function lineaHoy(hoy, movs, extra = '') {
  const h = movs.filter((m) => m.fecha === hoy), ent = h.filter((m) => m.signo > 0).length, sal = h.filter((m) => m.signo < 0).length;
  return `<p class="hoy"><b>Hoy, ${esc(fechaLarga(hoy))}:</b> ${pl(ent, 'entrada', 'entradas')} y ${pl(sal, 'salida', 'salidas')}${extra ? ` · ${extra}` : ''}.</p>`;
}
const lotesHtml = (lotes) => lotes.length ? `<div class="lotes"><b>Lotes (por orden de vencimiento)</b><ul class="lista">${lotes.map((l) => `<li class="mov"><div>Entró ${esc(fechaLarga(l.entrada))}${l.venceEn ? '' : ' · sin vencimiento'}</div><div class="monto num">${n(l.cantidad)} ${esc(l.unidad)}</div>
  ${l.venceEn ? `<div class="sub ${l.vencido ? 'mal' : l.dias <= 5 ? 'amarillo' : ''}">${l.vencido ? 'Venció' : 'Vence'} ${esc(fechaLarga(l.venceEn))}${l.vencido ? '' : l.dias === 0 ? ' (hoy)' : ` (en ${l.dias} días)`}</div>` : ''}</li>`).join('')}</ul></div>` : '';

export function vistaExistencias({ b, filas, movimientos, hoy, lotes, ubicaciones, matriz }) {
  const extra = filas ? `${pl(filas.filter((f) => f.bajoMinimo).length, 'artículo bajo el mínimo', 'artículos bajo el mínimo')}` : '';
  const cabeza = lineaHoy(hoy, movimientos, extra);
  const buscar = `<div class="barra-busqueda">${buscador(b)}<button class="ficha" data-accion="b-solo-bajo" aria-pressed="${b.soloBajo}">Solo lo que está bajo</button></div>`;
  if (b.todos) {
    const filasM = matriz.filter((r) => !b.soloBajo || r.porLugar.some((x) => x?.bajoMinimo));
    const th = ubicaciones.map((u) => `<th>${esc(u.nombre)}</th>`).join('');
    let cat = '', cuerpo = '';
    for (const r of filasM) {
      if (r.categoria !== cat) { cat = r.categoria; cuerpo += `<tr class="cat" data-cat><td colspan="${ubicaciones.length + 1}">${esc(cat)}</td></tr>`; }
      cuerpo += `<tr data-nombre="${esc(r.articulo.toLowerCase())}"><td>${esc(r.articulo)}<span class="a-sub">${esc(r.unidad)}</span></td>${r.porLugar.map((x) => `<td class="num ${x?.bajoMinimo ? 'mal' : ''}">${x ? n(x.cantidad) : '—'}${x?.minimo ? `<span class="a-sub">mín. ${n(x.minimo)}</span>` : ''}</td>`).join('')}</tr>`;
    }
    return `${cabeza}${buscar}<section class="tarjeta"><div class="tabla-scroll"><table class="tabla tabla-lugares"><thead><tr><th>Artículo</th>${th}</tr></thead><tbody>${cuerpo || `<tr><td colspan="${ubicaciones.length + 1}" class="vacio">No hay artículos con este filtro.</td></tr>`}</tbody></table></div>
      <p class="pie">Existencia por lugar. En rojo, lo que está bajo el mínimo. Para ajustar un artículo, elija un solo lugar arriba.</p></section>`;
  }
  const vis = filas.filter((f) => !b.soloBajo || f.bajoMinimo);
  let cat = '', html = '';
  for (const f of vis) {
    if (f.categoria !== cat) { cat = f.categoria; html += `<li class="separador-dia">${esc(cat)}</li>`; }
    const abierto = b.ajustando === f.articuloId;
    html += `<li class="art" data-nombre="${esc(f.articulo.toLowerCase())}"><button class="fila-art ${f.bajoMinimo ? 'bajo' : ''}" data-accion="b-ajustar" data-valor="${esc(f.articuloId)}" aria-expanded="${abierto}">
        <span class="a-nom">${esc(f.articulo)}<span class="a-sub">${f.minimo ? `Mínimo ${n(f.minimo)}` : 'Sin mínimo'}${f.bajoMinimo ? ' · <b class="mal">Bajo el mínimo</b>' : ''}${f.vencida ? ' · <b class="mal">Vencido</b>' : ''}</span></span>
        <span class="a-cant num">${n(f.cantidad)} <small>${esc(f.unidad)}</small></span></button>
      ${abierto ? `<div class="ajuste"><label class="campo"><span>Hay en realidad</span><input id="b-real" inputmode="decimal" autocomplete="off" value="${n(f.cantidad)}"></label>
        <label class="campo"><span>Motivo del ajuste</span><input type="text" id="b-motivo-aj" autocomplete="off" value="${esc(b.motivoAj)}"></label>
        <div class="acciones">${boton('b-ajustar', 'Cerrar', '', `data-valor="${esc(f.articuloId)}"`)}${boton('b-guardar-ajuste', 'Guardar ajuste', 'primario', `data-valor="${esc(f.articuloId)}"`)}</div>
        <p class="pie">El ajuste queda como un movimiento nuevo; el historial no se modifica.</p>
        <label class="campo" style="margin-top:14px"><span>Mínimo en este lugar <small>(avisa cuando baje de aquí; 0 = sin mínimo)</small></span><input id="b-min-aqui" inputmode="decimal" autocomplete="off" value="${f.minimo ? n(f.minimo) : ''}" placeholder="Sin mínimo"></label>
        ${boton('b-guardar-min-aqui', 'Guardar mínimo', '', `data-valor="${esc(f.articuloId)}"`)}
        ${lotesHtml(lotes || [])}</div>` : ''}</li>`;
  }
  const movs = movimientos.map((m) => `<li class="mov"><div><span class="insignia ${m.signo > 0 ? 'entrada' : 'salida'}">${esc(m.tipoNombre)}</span> <b>${esc(m.articulo)}</b></div>
      <div class="monto num">${m.signo > 0 ? '+' : m.signo < 0 ? '-' : ''}${n(m.cantidad)} ${esc(m.unidad)}</div><div class="sub">${esc(fechaLarga(m.fecha))} ${horaLegible(m.hora)} · ${esc(m.usuario)}${m.motivo ? ' · ' + esc(m.motivo) : ''}</div></li>`).join('');
  return `${cabeza}${buscar}
    <section class="tarjeta"><ul class="lista lista-art">${html || '<li class="vacio">No hay artículos con este filtro.</li>'}</ul></section>
    <h2 class="titulo-seccion">Últimos movimientos</h2><section class="tarjeta"><ul class="lista">${movs.split('</li>').slice(0, 6).join('</li>') + (movs ? '</li>' : '') || '<li class="vacio">Sin movimientos.</li>'}</ul>
      <p class="pie">Nada se borra ni se edita: un error se corrige con un movimiento nuevo (ajuste o conteo).</p></section>`;
}

export function vistaSacar({ b, filas, ubicaciones, hoy, movimientos, destinoFilas }) {
  const origen = ubicaciones.find((u) => u.id === b.ubicacion);
  const otras = ubicaciones.filter((u) => u.id !== b.ubicacion);
  const tipos = `<div class="tipos-salida" role="group" aria-label="Tipo de salida">${TIPOS_SALIDA.map(([k, t, ay]) => `<button class="btn enorme ${b.tipo === k ? 'activo' : ''}" data-accion="b-tipo" data-valor="${k}" aria-pressed="${b.tipo === k}">${t}<small>${ay}</small></button>`).join('')}</div>`;
  const faltan = b.tipo === 'traslado' && b.destino && destinoFilas ? destinoFilas.filter((f) => f.bajoMinimo).length : 0;
  const destino = b.tipo === 'traslado' ? `<div class="campo"><span>Pasar a</span><div class="fichas">${otras.map((u) => `<button class="ficha" data-accion="b-destino" data-valor="${esc(u.id)}" aria-pressed="${b.destino === u.id}">${esc(u.nombre)}</button>`).join('')}</div>
    ${b.destino ? `<div style="margin-top:12px">${boton('b-llenar', faltan ? `Llenar lo que falta (${pl(faltan, 'artículo', 'artículos')} bajo el mínimo)` : 'No falta nada: todo está en su mínimo', faltan ? 'primario bloque' : 'bloque', faltan ? '' : 'disabled')}</div>` : ''}</div>` : '';
  const dest = new Map((destinoFilas || []).map((f) => [f.articuloId, f]));
  let cat = '', lista = '';
  for (const f of filas.filter((x) => x.cantidad > 0)) {
    if (f.categoria !== cat) { cat = f.categoria; lista += `<li class="separador-dia">${esc(cat)}</li>`; }
    const d = dest.get(f.articuloId);
    lista += `<li class="paso" data-nombre="${esc(f.articulo.toLowerCase())}"><div class="p-nom">${esc(f.articulo)}<span class="a-sub">Hay ${n(f.cantidad)} ${esc(f.unidad)} aquí${d ? ` · en ${esc(d.ubicacion)}: ${n(d.cantidad)}${d.minimo ? ` (mín. ${n(d.minimo)})` : ''}` : ''}</span></div>
      <div class="stepper"><button class="btn" data-accion="b-menos" data-valor="${esc(f.articuloId)}" aria-label="Menos ${esc(f.articulo)}">−</button>
        <input class="b-cant num" inputmode="decimal" autocomplete="off" placeholder="0" data-articulo="${esc(f.articuloId)}" value="${esc(b.cant[f.articuloId] ?? '')}" aria-label="Cantidad de ${esc(f.articulo)}">
        <button class="btn" data-accion="b-mas" data-valor="${esc(f.articuloId)}" aria-label="Más ${esc(f.articulo)}">+</button></div></li>`;
  }
  return `${lineaHoy(hoy, movimientos, `sale de: ${esc(origen?.nombre || '')}`)}${tipos}${destino}<label class="campo"><span>Motivo</span><input type="text" id="b-motivo" autocomplete="off" value="${esc(b.motivo)}"></label>
    ${buscador(b)}<section class="tarjeta" style="margin-top:12px"><ul class="lista lista-paso">${lista || '<li class="vacio">No hay existencias en este lugar.</li>'}</ul></section>
    <div class="barra-accion"><button class="btn primario enorme-bar" data-accion="b-guardar-salida" id="b-guardar" disabled>Elija cantidades</button></div>`;
}

const lineaFactura = (b, f, l) => {
  const k = `${f.clave}|${l.linea}`, a = b.asig[k];
  const cab = `<div><b>${esc(l.descripcion)}</b></div><div class="monto num">${n(l.cantidad)} ${esc(l.unidad)}</div>`;
  if (l.sugerencia) return `<li class="mov">${cab}<div class="sub">Entra como <b>${esc(l.sugerencia.articulo)}</b>: ${n(l.cantidad * l.sugerencia.factor)} ${esc(l.sugerencia.unidad)}${l.sugerencia.factor !== 1 ? ` (×${n(l.sugerencia.factor)})` : ''}</div></li>`;
  if (a) {
    const fac = Number(String(b.factor[k] ?? a.factor).replace(',', '.')) || 0;
    return `<li class="mov">${cab}<div class="sub asignada">Entra como <b>${esc(a.articulo)}</b>. Cada ${esc(l.unidad)} trae <input class="b-factor num" inputmode="decimal" data-cant="${l.cantidad}" data-k="${esc(k)}" value="${esc(String(b.factor[k] ?? n(a.factor)))}" aria-label="Cuántas ${esc(a.unidad)} trae cada ${esc(l.unidad)}"> ${esc(a.unidad)} = <b><span class="res">${n(l.cantidad * fac)}</span> ${esc(a.unidad)}</b>
      ${boton('b-desasignar', 'Quitar', 'chico', `data-valor="${esc(k)}"`)}</div></li>`;
  }
  const p = l.propuesta, nv = p && (NIVEL[p.nivel] || ['Propuesta', 'amarillo']);
  const prop = p ? `<div class="propuesta"><div><span class="insignia ${nv[1]}">${nv[0]}</span> La IA propone <b>${esc(p.articulo)}</b>: ${n(l.cantidad * p.factor)} ${esc(p.unidad)}${p.factor !== 1 ? ` (×${n(p.factor)})` : ''}</div>${p.razon ? `<div class="a-sub">${esc(p.razon)}</div>` : ''}
      <div class="acciones">${boton('b-usar-propuesta', 'Usar esta propuesta', 'primario', `data-valor="${esc(k)}"`)}${boton('b-elegir', 'Elegir otro artículo', '', `data-valor="${esc(k)}"`)}</div></div>`
    : `<div class="propuesta"><div class="a-sub mal">Sin equivalencia todavía y sin propuesta.</div>${boton('b-elegir', 'Elegir el artículo', 'primario', `data-valor="${esc(k)}"`)}</div>`;
  return `<li class="mov">${cab}<div class="sub">${prop}</div></li>`;
};
function selector(b, catalogo, k) {
  return `<div class="selector-art"><input type="text" id="b-qa" class="buscar" placeholder="Escriba el nombre del artículo" autocomplete="off" value="${esc(b.qa)}" aria-label="Buscar artículo">
    <ul class="lista">${(catalogo || []).map((a) => `<li data-sel="${esc(a.nombre.toLowerCase())}"><button class="fila-art" data-accion="b-asignar" data-valor="${esc(k)}" data-art="${esc(a.id)}"><span class="a-nom">${esc(a.nombre)}<span class="a-sub">${esc(a.categoria)}</span></span><span class="a-sub">${esc(a.unidad)}</span></button></li>`).join('')}</ul>
    ${boton('b-elegir', 'Cerrar', 'chico', `data-valor="${esc(k)}"`)}</div>`;
}

export function vistaRecibir({ b, facturas, recibidas, notas, catalogo, ubicaciones, hoy }) {
  const sub = `<div class="fichas segmento" role="group" aria-label="Qué ver">${[['pendientes', `Por recibir${facturas.length ? ` (${facturas.length})` : ''}`], ['recibidas', 'Ya recibidas'], ['notas', `Notas de crédito${notas.length ? ` (${notas.length})` : ''}`]]
    .map(([k, t]) => `<button class="ficha" data-accion="b-sub" data-valor="${k}" aria-pressed="${b.sub === k}">${t}</button>`).join('')}</div>`;
  if (b.sub === 'recibidas') {
    const filas = recibidas.map((r) => {
      const k = `${r.clave}|${r.linea}`, abre = b.deshaciendo === k;
      return `<li class="mov"><div><b>${esc(r.articulo)}</b></div><div class="monto num">${n(r.cantidad)} ${esc(r.unidad)}</div><div class="sub">${esc(fechaLarga(r.fecha))} · ${esc(r.ubicacion)}${r.descripcion ? ' · ' + esc(r.descripcion) : ''}</div>
        <div class="sub">${r.deshacible ? (abre ? `<label class="campo"><span>Motivo</span><input type="text" id="b-motivo-des" autocomplete="off" value="${esc(b.motivoDes)}"></label><div class="acciones">${boton('b-pedir-deshacer', 'No, dejarla', '', `data-valor="${esc(k)}"`)}${boton('b-deshacer', 'Sí, deshacer', 'peligro', `data-valor="${esc(k)}"`)}</div>` : boton('b-pedir-deshacer', 'Deshacer esta recepción', 'chico', `data-valor="${esc(k)}"`))
          : '<span class="a-sub">Ya se usó o se pasó parte: corríjalo con un ajuste en Existencias.</span>'}</div></li>`;
    }).join('');
    return `${sub}<section class="tarjeta"><ul class="lista">${filas || '<li class="vacio">No hay recepciones recientes.</li>'}</ul>
      <p class="pie">Deshacer deja un movimiento nuevo («Recepción deshecha») y la línea vuelve a quedar por recibir. Solo se puede mientras nada del lote se haya usado.</p></section>`;
  }
  if (b.sub === 'notas') {
    if (!notas.length) return `${sub}<section class="tarjeta"><p class="vacio" style="margin:0">No hay notas de crédito de proveedores por revisar.</p></section>`;
    return sub + notas.map((nt) => {
      const abre = b.notaAbierta === nt.clave;
      const lin = nt.lineas.map((l) => `<li class="mov"><div><b>${esc(l.descripcion)}</b></div><div class="monto num">${n(l.cantidad)} ${esc(l.unidad)}</div>
        ${abre && l.articuloId ? `<div class="sub"><div class="stepper"><span>Sale de ${esc(l.articulo)}:</span><input class="b-nota-cant num" inputmode="decimal" data-articulo="${esc(l.articuloId)}" value="${esc(String(b.notaCant[l.articuloId] ?? n(l.cantidad * l.factor)))}" aria-label="Cantidad de ${esc(l.articulo)} que se devuelve"></div></div>`
          : `<div class="sub">${l.articuloId ? `Descuenta <b>${esc(l.articulo)}</b>` : '<span class="mal">Sin artículo: recíbalo primero desde la factura original.</span>'}</div>`}</li>`).join('');
      const lugares = abre ? `<div class="campo" style="margin-top:10px"><span>Sale de</span><div class="fichas">${ubicaciones.map((u) => `<button class="ficha" data-accion="b-nota-ubic" data-valor="${esc(u.id)}" aria-pressed="${b.notaUbic === u.id}">${esc(u.nombre)}</button>`).join('')}</div></div>` : '';
      return `<section class="tarjeta" style="margin-bottom:14px"><div class="cierre-cab"><h3>${esc(nt.proveedor)}</h3><b class="num">${colones(nt.total)}</b></div><div class="etq">${esc(nt.tipo)} · ${esc(fechaLarga(nt.fecha))} · ${esc(nt.empresa)}</div>
        <ul class="lista">${lin}</ul>${lugares}
        <div class="acciones" style="margin-top:12px">${abre ? boton('b-nota-abrir', 'Cerrar', '', `data-valor="${esc(nt.clave)}"`) + boton('b-nota-devolver', 'Registrar la devolución', 'primario', `data-valor="${esc(nt.clave)}"`) : boton('b-nota-ignorar', 'No afecta el inventario', '', `data-valor="${esc(nt.clave)}"`) + boton('b-nota-abrir', 'Devolver mercadería', 'primario', `data-valor="${esc(nt.clave)}"`)}</div></section>`;
    }).join('') + '<p class="pie">La devolución saca la mercadería del lugar elegido, ligada a la nota de crédito; no se puede repetir.</p>';
  }
  if (!facturas.length) return `${sub}<section class="tarjeta"><p class="vacio" style="margin:0">No hay facturas de proveedores por recibir.</p></section>`;
  const ordenadas = [...facturas].sort((x, y) => (y.fecha === hoy) - (x.fecha === hoy) || y.fecha.localeCompare(x.fecha));
  let grupo = '';
  const html = ordenadas.map((f) => {
    const listas = f.lineas.filter((l) => l.sugerencia || b.asig[`${f.clave}|${l.linea}`]);
    const sep = (f.fecha === hoy ? 'Hoy' : 'Antes de hoy'); const cab = sep !== grupo ? `<h2 class="titulo-seccion">${sep}</h2>` : ''; grupo = sep;
    const abierta = b.picker && b.picker.startsWith(`${f.clave}|`);
    return `${cab}<section class="tarjeta" style="margin-bottom:14px"><div class="cierre-cab"><h3>${esc(f.proveedor)}</h3><b class="num">${colones(f.total)}</b></div>
      <div class="etq">${esc(fechaLarga(f.fecha))} · ${esc(f.empresa)}</div><ul class="lista">${f.lineas.map((l) => lineaFactura(b, f, l) + (b.picker === `${f.clave}|${l.linea}` ? `<li class="mov">${selector(b, catalogo, b.picker)}</li>` : '')).join('')}</ul>
      ${listas.length ? `<label class="campo" style="margin-top:12px"><span>Vence (si lo sabe, para todo lo que recibe ahora) <small>opcional</small></span><input type="date" class="b-vence" data-clave="${esc(f.clave)}" value="${esc(b.vence[f.clave] || '')}"></label>
        ${boton('b-recibir', `Recibir ${listas.length === f.lineas.length ? 'todo' : `${listas.length} de ${f.lineas.length} líneas`}`, 'primario bloque', `data-valor="${esc(f.clave)}"`)}` : '<p class="pie">Nada para recibir hasta que se asigne un artículo a cada línea.</p>'}</section>`;
  }).join('');
  return sub + html + '<p class="pie">Lo que se recibe suma a la Bodega central, con el costo de la factura (sin IVA). El artículo elegido queda recordado para la próxima factura del proveedor.</p>';
}

export function vistaContar({ b, conteo, ubicacion, hoy, movimientos }) {
  const estado = conteo ? `conteo abierto: ${conteo.contadas} de ${conteo.total} contados` : 'sin conteo abierto';
  return lineaHoy(hoy, movimientos, `${esc(ubicacion.nombre)}, ${estado}`) + contarInterno({ b, conteo, ubicacion });
}
function contarInterno({ b, conteo, ubicacion }) {
  if (b.resultado) {
    const r = b.resultado;
    return `<section class="tarjeta"><h2>Conteo confirmado</h2>
      ${r.ajustes.length ? `<ul class="lista">${r.ajustes.map((a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num ${a.diferencia < 0 ? 'mal' : 'ok'}">${a.diferencia > 0 ? '+' : ''}${n(a.diferencia)} ${esc(a.unidad)}</div><div class="sub">Había ${n(a.esperado)}, se contó ${n(a.contado)}</div></li>`).join('')}</ul>` : '<p class="etq">No hubo diferencias.</p>'}
      <p class="pie">${r.sinCambio} artículos sin diferencia${r.noContados ? `, ${r.noContados} sin contar` : ''}. Los ajustes quedaron como movimientos nuevos.</p>
      ${boton('b-cerrar-resultado', 'Listo', 'primario bloque', 'style="margin-top:12px"')}</section>`;
  }
  if (!conteo) {
    return `<section class="tarjeta"><h2>Conteo físico de ${esc(ubicacion.nombre)}</h2>
      <p class="etq" style="margin-top:0">Cuente lo que hay en el estante. No verá lo que el sistema espera hasta revisar; así el conteo es honesto.</p>
      ${boton('b-iniciar-conteo', `Empezar conteo`, 'primario bloque')}</section>`;
  }
  if (b.revisar) {
    const contadas = conteo.lineas.filter((l) => l.contado !== null), dif = contadas.filter((l) => l.diferencia !== 0), sin = conteo.lineas.length - contadas.length;
    return `<section class="tarjeta"><h2>Revisar antes de confirmar</h2>
      ${dif.length ? `<ul class="lista">${dif.map((l) => `<li class="mov"><div><b>${esc(l.articulo)}</b></div><div class="monto num ${l.diferencia < 0 ? 'mal' : 'ok'}">${l.diferencia > 0 ? '+' : ''}${n(l.diferencia)} ${esc(l.unidad)}</div><div class="sub">Se contó ${n(l.contado)}; el sistema tenía ${n(l.contado - l.diferencia)}</div></li>`).join('')}</ul>` : '<p class="etq">Todo lo contado coincide con el sistema.</p>'}
      <p class="pie">${contadas.length - dif.length} sin diferencia${sin ? `. ${sin} sin contar: no se tocarán.` : ''} Al confirmar, las diferencias se registran como ajustes nuevos.</p>
      <div class="acciones" style="margin-top:12px">${boton('b-volver-contar', 'Volver a contar')}${boton('b-confirmar-conteo', 'Confirmar ajustes', 'primario')}</div></section>`;
  }
  const filas = conteo.lineas.map((l) => `<li class="paso" data-nombre="${esc(l.articulo.toLowerCase())}"><div class="p-nom">${esc(l.articulo)}<span class="a-sub">${esc(l.categoria)} · ${esc(l.unidad)}</span></div>
    <div class="stepper"><input class="b-cont num" inputmode="decimal" autocomplete="off" placeholder="—" data-articulo="${esc(l.articuloId)}" value="${esc(b.conteoVals[l.articuloId] ?? (l.contado ?? ''))}" aria-label="Contado de ${esc(l.articulo)}"></div></li>`).join('');
  return `<section class="tarjeta"><div class="cierre-cab"><h2 style="margin:0">Conteo de ${esc(conteo.ubicacion)}</h2><span class="etq" id="b-progreso">${conteo.contadas} de ${conteo.total} contados</span></div>
    ${buscador(b)}<ul class="lista lista-paso" style="margin-top:10px">${filas}</ul></section>
    <div class="barra-accion dos">${boton('b-guardar-avance', 'Guardar avance')}${boton('b-revisar', 'Revisar y confirmar', 'primario')}</div>
    ${b.cancelando ? `<div class="tarjeta" style="margin-top:10px"><p style="margin-top:0">¿Cancelar este conteo? Lo contado se descarta y no cambia ninguna existencia.</p><div class="acciones">${boton('b-no-cancelar', 'No, seguir')}${boton('b-cancelar-conteo', 'Sí, cancelar', 'peligro')}</div></div>` : `<p class="pie"><button class="enlace" data-accion="b-pedir-cancelar">Cancelar este conteo</button></p>`}`;
}

export function vistaAlertas({ alertas, b, hoy }) {
  const bloque = (titulo, filas, fila, vacio) => `<section class="tarjeta" style="margin-bottom:14px"><h2>${titulo}</h2><ul class="lista">${filas.map(fila).join('') || `<li class="vacio">${vacio}</li>`}</ul></section>`;
  const venHoy = alertas.vencenPronto.filter((a) => a.dias === 0).length;
  const cab = `<p class="hoy"><b>Hoy, ${esc(fechaLarga(hoy))}:</b> ${pl(alertas.bajoMinimo.length, 'artículo bajo el mínimo', 'artículos bajo el mínimo')}, ${pl(venHoy, 'lote vence hoy', 'lotes vencen hoy')} y ${pl(alertas.vencidos.length, 'lote vencido', 'lotes vencidos')}.</p>`;
  const clave = (a) => `${a.articuloId}|${a.ubicacionId || a.ubicacion}`;
  return cab + bloque('Vencidos', alertas.vencidos, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num mal">${n(a.cantidad)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · venció ${esc(fechaLarga(a.venceEn))}</div>
      <div class="sub">${b.confirmaMerma === clave(a) ? `<div class="acciones">${boton('b-merma-vencido', 'No', '', 'data-valor=""')}${boton('b-merma-vencido', `Sí, sacar ${n(a.cantidad)} como merma`, 'peligro', `data-valor="${esc(clave(a))}"`)}</div>` : boton('b-merma-vencido', 'Sacar como merma', 'chico', `data-valor="${esc(clave(a))}"`)}</div></li>`, 'No hay nada vencido.')
    + bloque('Por vencer', alertas.vencenPronto, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num">${n(a.cantidad)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · vence ${esc(fechaLarga(a.venceEn))}${a.dias === 0 ? ' (hoy)' : ` (en ${a.dias} días)`}</div></li>`, 'Nada vence en los próximos días.')
    + bloque('Bajo el mínimo', alertas.bajoMinimo, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num mal">${n(a.existencia)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · mínimo ${n(a.minimo)} · faltan ${n(a.faltante)}</div>
      ${a.esLocal ? `<div class="sub">${boton('b-reponer', 'Reponer desde la bodega', 'chico', `data-valor="${esc(a.ubicacionId)}"`)}</div>` : ''}</li>`, 'Nada está bajo el mínimo.')
    + '<p class="pie">Los mínimos se fijan en la pestaña Mínimos o al tocar un artículo en Existencias.</p>';
}

export function vistaMinimos({ b, articulos, ubicaciones, sugerencia, bajo }) {
  const t = '';
  const cab = `<p class="hoy"><b>Hoy:</b> ${pl(bajo, 'artículo bajo el mínimo', 'artículos bajo el mínimo')}. ${articulos.filter((a) => Object.keys(a.minimos).length).length} artículos tienen mínimo fijado.</p>`;
  const sug = sugerencia.items.length && !b.sugOculta ? `<section class="tarjeta" style="margin-bottom:14px"><h2>Sugerencia para aprobar</h2>
    <p class="etq" style="margin-top:0">${esc(sugerencia.nota)} Todavía no se ha aplicado nada.</p>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Artículo</th><th>Compra por semana</th><th>Mínimo sugerido</th></tr></thead><tbody>${sugerencia.items.map((i) => `<tr><td>${esc(i.articulo)}<span class="a-sub">${esc(i.ubicacion)}</span></td><td class="num">${n(i.porSemana)}</td><td class="num"><b>${n(i.minimo)}</b></td></tr>`).join('')}</tbody></table></div>
    <div class="acciones" style="margin-top:12px">${boton('b-sug-ocultar', 'Ahora no', '')}${boton('b-sug-aplicar', `Aplicar estos ${sugerencia.items.length} mínimos`, 'primario')}</div></section>` : '';
  const vis = articulos.filter((a) => !t || a.nombre.toLowerCase().includes(t)).sort((x, y) => (Object.keys(y.minimos).length > 0) - (Object.keys(x.minimos).length > 0) || x.nombre.localeCompare(y.nombre));
  const filas = vis.map((a) => `<tr data-nombre="${esc(a.nombre.toLowerCase())}"><td>${esc(a.nombre)}<span class="a-sub">${esc(a.unidad)}</span></td>${ubicaciones.map((u) => {
    const k = `${a.id}|${u.id}`, v = b.minEdit[k] ?? (a.minimos[u.id] ? n(a.minimos[u.id]) : '');
    return `<td><input class="b-min num" inputmode="decimal" autocomplete="off" placeholder="—" data-articulo="${esc(a.id)}" data-ubic="${esc(u.id)}" value="${esc(v)}" aria-label="Mínimo de ${esc(a.nombre)} en ${esc(u.nombre)}"></td>`;
  }).join('')}</tr>`).join('');
  const cambios = Object.keys(b.minEdit).length;
  return `${cab}${sug}${buscador(b)}<section class="tarjeta" style="margin-top:12px"><div class="tabla-scroll"><table class="tabla tabla-min"><thead><tr><th>Artículo</th>${ubicaciones.map((u) => `<th>${esc(u.nombre)}</th>`).join('')}</tr></thead><tbody>${filas || `<tr><td colspan="${ubicaciones.length + 1}" class="vacio">No hay coincidencias.</td></tr>`}</tbody></table></div>
    <p class="pie">Los artículos con mínimo salen primero. Deje vacío o en 0 para quitar el mínimo.</p></section>
    <div class="barra-accion"><button class="btn primario enorme-bar" data-accion="b-guardar-minimos" id="b-guardar-min" ${cambios ? '' : 'disabled'}>${cambios ? `Guardar ${pl(cambios, 'cambio', 'cambios')}` : 'Escriba un mínimo para guardar'}</button></div>`;
}
