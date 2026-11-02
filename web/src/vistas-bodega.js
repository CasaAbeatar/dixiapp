// Vistas de Bodega (solo administradores). Pensadas para tableta: botones grandes, pocos toques. Solo devuelven HTML.
import { esc } from './ui.js';
import { fechaLarga, horaLegible } from './datos/fechas.js';
import { colones } from './datos/formato.js';

export const SECCIONES = [['existencias', 'Existencias'], ['recibir', 'Recibir'], ['sacar', 'Sacar'], ['contar', 'Contar'], ['alertas', 'Alertas']];
export const TIPOS_SALIDA = [['consumo', 'Consumo', 'Uso normal'], ['merma', 'Merma', 'Se dañó o venció'], ['devolucion', 'Devolución', 'Vuelve al proveedor'], ['traslado', 'Pasar a otro lugar', 'Bodega a local']];
const n = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const boton = (accion, texto, clases = '', extra = '') => `<button class="btn ${clases}" data-accion="${accion}" ${extra}>${texto}</button>`;
const msg = (b) => `${b.error ? `<p class="error" role="alert">${esc(b.error)}</p>` : ''}${b.aviso ? `<p class="aviso" role="status">${esc(b.aviso)}</p>` : ''}`;

export function marcoBodega({ b, ubicaciones, alertas, contenido }) {
  const insignia = { alertas: alertas.bajoMinimo.length + alertas.vencenPronto.length + alertas.vencidos.length, recibir: alertas.porRecibir };
  const secciones = SECCIONES.map(([k, t]) => `<button class="seccion" data-accion="b-sec" data-valor="${k}" aria-pressed="${b.seccion === k}">${t}${insignia[k] ? `<span class="cuenta">${insignia[k]}</span>` : ''}</button>`).join('');
  const ubic = ['recibir', 'alertas'].includes(b.seccion) ? '' : `<div class="fichas selector-negocio" role="group" aria-label="Lugar">${ubicaciones.map((u) => `<button class="ficha" data-accion="b-ubic" data-valor="${esc(u.id)}" aria-pressed="${u.id === b.ubicacion}">${esc(u.nombre)}</button>`).join('')}</div>`;
  return `<div class="secciones-bodega" role="group" aria-label="Bodega">${secciones}</div>${ubic}${msg(b)}${contenido}`;
}

const buscador = (b, ayuda = 'Buscar un artículo') => `<input type="text" id="b-q" class="buscar" placeholder="${ayuda}" autocomplete="off" value="${esc(b.q)}" aria-label="${ayuda}">`;

export function vistaExistencias({ b, filas, movimientos }) {
  const vis = filas.filter((f) => !b.soloBajo || f.bajoMinimo);
  let cat = '', html = '';
  for (const f of vis) {
    if (f.categoria !== cat) { cat = f.categoria; html += `<li class="separador-dia">${esc(cat)}</li>`; }
    const abierto = b.ajustando === f.articuloId;
    html += `<li class="art" data-nombre="${esc(f.articulo.toLowerCase())}"><button class="fila-art ${f.bajoMinimo ? 'bajo' : ''}" data-accion="b-ajustar" data-valor="${esc(f.articuloId)}" aria-expanded="${abierto}">
        <span class="a-nom">${esc(f.articulo)}<span class="a-sub">${f.minimo ? `Mínimo ${n(f.minimo)}` : 'Sin mínimo'}${f.bajoMinimo ? ' · <b class="mal">Bajo el mínimo</b>' : ''}${f.vencida ? ' · <b class="mal">Vencido</b>' : ''}</span></span>
        <span class="a-cant num">${n(f.cantidad)} <small>${esc(f.unidad)}</small></span></button>
      ${abierto ? `<div class="ajuste"><label class="campo"><span>Hay en realidad</span><input id="b-real" inputmode="decimal" autocomplete="off" value="${n(f.cantidad)}"></label>
        <label class="campo"><span>Motivo</span><input type="text" id="b-motivo-aj" autocomplete="off" value="${esc(b.motivoAj)}"></label>
        <div class="acciones">${boton('b-ajustar', 'Cancelar', '', `data-valor="${esc(f.articuloId)}"`)}${boton('b-guardar-ajuste', 'Guardar ajuste', 'primario', `data-valor="${esc(f.articuloId)}"`)}</div>
        <p class="pie">El ajuste queda como un movimiento nuevo; el historial no se modifica.</p></div>` : ''}</li>`;
  }
  const movs = movimientos.map((m) => `<li class="mov"><div><span class="insignia ${m.signo > 0 ? 'entrada' : 'salida'}">${esc(m.tipoNombre)}</span> <b>${esc(m.articulo)}</b></div>
      <div class="monto num">${m.signo > 0 ? '+' : m.signo < 0 ? '-' : ''}${n(m.cantidad)} ${esc(m.unidad)}</div><div class="sub">${esc(fechaLarga(m.fecha))} ${horaLegible(m.hora)} · ${esc(m.usuario)}${m.motivo ? ' · ' + esc(m.motivo) : ''}</div></li>`).join('');
  return `<div class="barra-busqueda">${buscador(b)}<button class="ficha" data-accion="b-solo-bajo" aria-pressed="${b.soloBajo}">Solo lo que está bajo</button></div>
    <section class="tarjeta"><ul class="lista lista-art">${html || '<li class="vacio">No hay artículos con este filtro.</li>'}</ul></section>
    <h2 class="titulo-seccion">Últimos movimientos</h2><section class="tarjeta"><ul class="lista">${movs || '<li class="vacio">Sin movimientos.</li>'}</ul>
      <p class="pie">Nada se borra ni se edita: un error se corrige con un movimiento nuevo (ajuste o conteo).</p></section>`;
}

export function vistaSacar({ b, filas, ubicaciones }) {
  const otras = ubicaciones.filter((u) => u.id !== b.ubicacion);
  const tipos = `<div class="tipos-salida" role="group" aria-label="Tipo de salida">${TIPOS_SALIDA.map(([k, t, ay]) => `<button class="btn enorme ${b.tipo === k ? 'activo' : ''}" data-accion="b-tipo" data-valor="${k}" aria-pressed="${b.tipo === k}">${t}<small>${ay}</small></button>`).join('')}</div>`;
  const destino = b.tipo === 'traslado' ? `<div class="campo"><span>Pasar a</span><div class="fichas">${otras.map((u) => `<button class="ficha" data-accion="b-destino" data-valor="${esc(u.id)}" aria-pressed="${b.destino === u.id}">${esc(u.nombre)}</button>`).join('')}</div></div>` : '';
  let cat = '', lista = '';
  for (const f of filas.filter((x) => x.cantidad > 0)) {
    if (f.categoria !== cat) { cat = f.categoria; lista += `<li class="separador-dia">${esc(cat)}</li>`; }
    lista += `<li class="paso" data-nombre="${esc(f.articulo.toLowerCase())}"><div class="p-nom">${esc(f.articulo)}<span class="a-sub">Hay ${n(f.cantidad)} ${esc(f.unidad)}</span></div>
      <div class="stepper"><button class="btn" data-accion="b-menos" data-valor="${esc(f.articuloId)}" aria-label="Menos ${esc(f.articulo)}">−</button>
        <input class="b-cant num" inputmode="decimal" autocomplete="off" placeholder="0" data-articulo="${esc(f.articuloId)}" value="${esc(b.cant[f.articuloId] ?? '')}" aria-label="Cantidad de ${esc(f.articulo)}">
        <button class="btn" data-accion="b-mas" data-valor="${esc(f.articuloId)}" aria-label="Más ${esc(f.articulo)}">+</button></div></li>`;
  }
  return `${tipos}${destino}<label class="campo"><span>Motivo</span><input type="text" id="b-motivo" autocomplete="off" value="${esc(b.motivo)}"></label>
    ${buscador(b)}<section class="tarjeta" style="margin-top:12px"><ul class="lista lista-paso">${lista || '<li class="vacio">No hay existencias en este lugar.</li>'}</ul></section>
    <div class="barra-accion"><button class="btn primario enorme-bar" data-accion="b-guardar-salida" id="b-guardar" disabled>Elija cantidades</button></div>`;
}

export function vistaRecibir({ b, facturas }) {
  if (!facturas.length) return `<section class="tarjeta"><p class="vacio" style="margin:0">No hay facturas de proveedores por recibir.</p></section>`;
  return facturas.map((f) => {
    const listas = f.lineas.filter((l) => l.sugerencia);
    const lineas = f.lineas.map((l) => `<li class="mov"><div><b>${esc(l.descripcion)}</b></div><div class="monto num">${n(l.cantidad)} ${esc(l.unidad)}</div>
      <div class="sub">${l.sugerencia ? `Entra como <b>${esc(l.sugerencia.articulo)}</b>: ${n(l.cantidad * l.sugerencia.factor)} ${esc(l.sugerencia.unidad)}${l.sugerencia.factor !== 1 ? ` (×${n(l.sugerencia.factor)})` : ''}` : '<span class="mal">Falta asignarle un artículo. Hágalo una vez en el panel del facturador.</span>'}</div></li>`).join('');
    return `<section class="tarjeta" style="margin-bottom:14px"><div class="cierre-cab"><h3>${esc(f.proveedor)}</h3><b class="num">${colones(f.total)}</b></div>
      <div class="etq">${esc(fechaLarga(f.fecha))} · ${esc(f.empresa)}</div><ul class="lista">${lineas}</ul>
      ${listas.length ? boton('b-recibir', `Recibir ${listas.length === f.lineas.length ? 'todo' : `lo reconocido (${listas.length})`}`, 'primario bloque', `data-valor="${esc(f.clave)}" style="margin-top:12px"`) : '<p class="pie">Nada para recibir hasta que se asignen los artículos.</p>'}</section>`;
  }).join('') + '<p class="pie">Lo que se recibe suma a la Bodega central, con el costo de la factura (sin IVA).</p>';
}

export function vistaContar({ b, conteo, ubicacion }) {
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

export function vistaAlertas({ alertas }) {
  const bloque = (titulo, filas, fila, vacio) => `<section class="tarjeta" style="margin-bottom:14px"><h2>${titulo}</h2><ul class="lista">${filas.map(fila).join('') || `<li class="vacio">${vacio}</li>`}</ul></section>`;
  return bloque('Bajo el mínimo', alertas.bajoMinimo, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num mal">${n(a.existencia)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · mínimo ${n(a.minimo)} · faltan ${n(a.faltante)}</div></li>`, 'Nada está bajo el mínimo.')
    + bloque('Por vencer', alertas.vencenPronto, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num">${n(a.cantidad)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · vence ${esc(fechaLarga(a.venceEn))}${a.dias === 0 ? ' (hoy)' : ` (en ${a.dias} días)`}</div></li>`, 'Nada vence en los próximos días.')
    + bloque('Vencidos', alertas.vencidos, (a) => `<li class="mov"><div><b>${esc(a.articulo)}</b></div><div class="monto num mal">${n(a.cantidad)} ${esc(a.unidad)}</div><div class="sub">${esc(a.ubicacion)} · venció ${esc(fechaLarga(a.venceEn))}. Sáquelo como merma.</div></li>`, 'No hay nada vencido.')
    + '<p class="pie">Los mínimos se definen en el inventario del facturador.</p>';
}
