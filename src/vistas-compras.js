// Vista de Compras (solo administradores, solo consulta). Recibe datos ya listos y devuelve HTML.
import { esc } from './ui.js';
import { colones, colonesCompacto, dinero } from './datos/formato.js';
import { fechaLarga, deTexto } from './datos/fechas.js';
import { horaLegible } from './datos/fechas.js';
import { ESTADOS_COMPRA, GRUPOS_COMPRA, CLASES_COMPRA } from './datos/interfaz.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const corto = (t) => { const d = deTexto(t); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const NOMBRE_TIPO = { ...GRUPOS_COMPRA };

export const POR = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']];
const TITULO_POR = { dia: 'por día, últimos 14 días', semana: 'por semana, últimas 8 semanas', mes: 'por mes, últimos 6 meses' };
const EJE_X = { dia: 'Día', semana: 'Semana (empieza el lunes)', mes: 'Mes' };

function etiquetaX(clave, por, i, n) {
  const d = deTexto(clave);
  if (por === 'mes') return d.getMonth() === 0 || i === 0 ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : MESES[d.getMonth()];
  if (por === 'semana') return corto(clave);
  return n > 8 && i % 2 === (n - 1) % 2 ? '' : corto(clave); // en dias, se muestra uno por medio para que se lea
}

function ticks(max) {
  if (max <= 0) return [0, 1];
  const bruto = max / 4, mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto);
  const t = []; for (let v = 0; v <= max + paso * 0.001; v += paso) t.push(v);
  if (t[t.length - 1] < max) t.push(t[t.length - 1] + paso);
  return t;
}

// Grafico de barras apiladas: neto (sin IVA) + IVA = total (con IVA). Cronologico de izquierda a derecha.
export function graficoBarras(filas, por) {
  const W = 640, H = 290, ml = 74, mr = 10, mt = 14, mb = 54;
  const pw = W - ml - mr, ph = H - mt - mb;
  const maxVal = Math.max(0, ...filas.map((f) => f.total));
  const ts = ticks(maxVal), techo = ts[ts.length - 1] || 1;
  const y = (v) => mt + ph - (Math.max(v, 0) / techo) * ph;
  const bw = pw / filas.length, ancho = Math.min(bw * 0.7, 46);
  const rejilla = ts.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/><text x="${ml - 8}" y="${y(v) + 5}" text-anchor="end" class="g-tx">${colonesCompacto(v)}</text>`).join('');
  const barras = filas.map((f, i) => {
    const cx = ml + bw * i + bw / 2, neto = Math.max(f.neto, 0), iva = Math.max(f.iva, 0);
    const yn = y(neto), yt = y(neto + iva);
    return `<g><title>${esc(corto(f.clave))}: total con IVA ${colones(f.total)}, neto sin IVA ${colones(f.neto)}, IVA ${colones(f.iva)}, ${f.facturas} facturas</title>
      <rect x="${cx - ancho / 2}" y="${yn}" width="${ancho}" height="${Math.max(ph + mt - yn, 0)}" fill="var(--acento)" rx="2"/>
      ${iva > 0 ? `<rect x="${cx - ancho / 2}" y="${yt}" width="${ancho}" height="${Math.max(yn - yt, 0)}" fill="var(--acento-fondo)" stroke="var(--acento)" stroke-width="1" rx="2"/>` : ''}
      <text x="${cx}" y="${H - mb + 18}" text-anchor="middle" class="g-tx">${esc(etiquetaX(f.clave, por, i, filas.length))}</text></g>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Compras ${TITULO_POR[por]}. Barras de izquierda (más antiguo) a derecha (más reciente)">
    ${rejilla}${barras}
    <line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--linea-fuerte)"/>
    <text x="${ml + pw / 2}" y="${H - 6}" text-anchor="middle" class="g-eje">${EJE_X[por]}, de más antiguo a más reciente</text>
    <text x="14" y="${mt + ph / 2}" text-anchor="middle" class="g-eje" transform="rotate(-90 14 ${mt + ph / 2})">Colones (₡)</text></svg>
    <div class="leyenda"><span><i class="cuad solido"></i>Neto, sin IVA</span><span><i class="cuad claro"></i>IVA</span><span class="etq">La barra completa es el total con IVA.</span></div>`;
}

function tarjetaResumen(titulo, r) {
  return `<section class="tarjeta resumen"><div class="etq">${titulo}</div>
    <div class="grande num" data-id="${esc(titulo)}">${colones(r.total)}</div>
    <div class="etq">con IVA incluido</div>
    <div class="fila"><span class="etq">Neto, sin IVA</span><b class="num">${colones(r.neto)}</b></div>
    <div class="fila"><span class="etq">Facturas</span><b class="num">${r.facturas}</b></div></section>`;
}

const NEGOCIO = { soda: 'Soda', pollos: 'Pollos' };
function insigniaEstado(e) { return `<span class="insignia ${e === 'aceptada' || e === 'aceptada_parcial' ? 'cuadra' : e === 'pendiente' || e === 'sin_respuesta' ? 'neutra' : 'falta'}">${ESTADOS_COMPRA[e] || esc(e)}</span>`; }

function lineasHtml(c, lineas) {
  if (!lineas) return '<div class="lineas-fac"><b>Lo que se compró</b><p class="pie">Cargando las líneas…</p></div>';
  if (!lineas.length) return '<div class="lineas-fac"><b>Lo que se compró</b><p class="pie">Esta factura no trae líneas.</p></div>';
  const cant = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
  return `<div class="lineas-fac"><b>Lo que se compró</b><ul class="lista">${lineas.map((l) => `<li class="lin-f"><span class="lin-d">${esc(l.detalle)}</span>
      <span class="lin-c num">${cant(l.cantidad)} ${esc(l.unidad)} × ${dinero(l.precioUnitario, c.moneda)}</span><b class="lin-t num">${dinero(l.total, c.moneda)}</b></li>`).join('')}</ul></div>`;
}

function filaFactura(c, abierta, lineas) {
  const detalle = abierta ? `${lineasHtml(c, lineas)}<div class="detalle">
      <div class="fila"><span class="etq">Neto, sin IVA</span><b class="num">${dinero(c.neto, c.moneda)}</b></div>
      <div class="fila"><span class="etq">IVA</span><b class="num">${dinero(c.iva, c.moneda)}</b></div>
      <div class="fila total"><span>Total, con IVA incluido</span><b class="num">${dinero(c.total, c.moneda)}</b></div>
      ${c.moneda !== 'CRC' ? `<div class="fila"><span class="etq">Equivalente en colones</span><b class="num">${colones(c.totalCrc)}</b></div>` : ''}
      <div class="fila"><span class="etq">Documento</span><b>${esc(CLASES_COMPRA[c.clase] || c.clase)}</b></div>
      <div class="fila"><span class="etq">Tipo de proveedor</span><b>${esc(NOMBRE_TIPO[c.tipoProveedor] || c.tipoProveedor)}</b></div>
      <div class="fila"><span class="etq">Clasificación principal</span><b>${esc(c.rubro)}</b></div>
      <div class="fila"><span class="etq">Estado</span>${insigniaEstado(c.estado)}</div>
      ${c.consecutivo ? `<div class="fila"><span class="etq">Consecutivo</span><span class="num">${esc(c.consecutivo)}</span></div>` : ''}</div>` : '';
  const signo = c.clase === 'nota_credito' ? '-' : '';
  return `<li><button class="factura ${abierta ? 'abierta' : ''}" data-accion="factura" data-valor="${esc(c.clave)}" aria-expanded="${abierta}">
      <span class="f-prov">${esc(c.proveedor)}</span>
      <span class="f-monto num">${signo}${dinero(c.total, c.moneda)}</span>
      <span class="f-sub">${horaLegible(c.hora)} · ${NEGOCIO[c.negocioId] || ''} · ${insigniaEstado(c.estado)}</span>
      <span class="f-sub f-iva">con IVA</span></button>${detalle}</li>`;
}

function barrasDesglose(titulo, filas, nombre = (x) => x, nota = '') {
  const max = Math.max(1, ...filas.map((f) => Math.abs(f.total)));
  const cuerpo = filas.length ? filas.map((f) => `<li class="d-fila"><div class="d-cab"><span>${esc(nombre(f.etiqueta))}</span><b class="num">${colones(f.total)}</b></div>
      <div class="d-barra"><i style="width:${Math.max(2, Math.round((Math.abs(f.total) / max) * 100))}%"></i></div>
      <div class="d-sub etq">Neto ${colones(f.neto)} · ${f.facturas} ${f.facturas === 1 ? 'factura' : 'facturas'}</div></li>`).join('') : '<li class="vacio">Sin compras en este periodo.</li>';
  return `<section class="tarjeta"><h2>${titulo}</h2><ul class="lista">${cuerpo}</ul>${nota ? `<p class="pie">${nota}</p>` : ''}</section>`;
}

export function vistaCompras({ lineas, hoy, negociosPermitidos, filtro, proveedores, resumen, ultimas, por, grafico, rango, tipos, rubros, provs, abierta, vivo, error }) {
  const opcionesNeg = [['ambos', 'Ambos'], ...negociosPermitidos.map((n) => [n.id, n.nombre.replace(' La Bomba', '')])];
  const fichasNeg = opcionesNeg.length > 2
    ? `<div class="fichas" role="group" aria-label="Negocio">${opcionesNeg.map(([k, t]) => `<button class="ficha" data-accion="filtro-negocio" data-valor="${k}" aria-pressed="${filtro.neg === k}">${t}</button>`).join('')}</div>` : '';
  const selProv = `<select id="f-proveedor" aria-label="Proveedor"><option value="">Todos los proveedores</option>${proveedores.map((p) => `<option value="${esc(p.cedula)}" ${p.cedula === filtro.proveedor ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`;
  let facturas = '', ultimoDia = '';
  for (const c of ultimas) {
    if (c.dia !== ultimoDia) { ultimoDia = c.dia; facturas += `<li class="separador-dia">${c.dia === hoy ? 'Hoy, ' : ''}${esc(fechaLarga(c.dia))}</li>`; }
    facturas += filaFactura(c, abierta === c.clave, lineas && lineas[c.clave]);
  }
  return `${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <div class="barra-filtros">${fichasNeg}${selProv}</div>
    <div class="cuadricula tres">${tarjetaResumen('Hoy', resumen.hoy)}${tarjetaResumen('Esta semana', resumen.semana)}${tarjetaResumen('Este mes', resumen.mes)}</div>
    <p class="pie">Cifras brutas con IVA incluido y netas sin IVA, en colones. La semana empieza el lunes.</p>
    <div class="columnas">
      <section class="tarjeta"><div class="cierre-cab"><h2 style="margin:0">Últimas facturas</h2><span class="vivo ${vivo ? 'on' : ''}" data-id="vivo"><i class="punto"></i>${vivo ? 'Actualizado ahora' : 'En vivo'}</span></div>
        <ul class="lista facturas">${facturas || '<li class="vacio">No hay facturas con este filtro.</li>'}</ul>
        <p class="pie">Lo más reciente primero. Toque una factura para ver el detalle. “Sin responder” significa que aún no se contestó a Hacienda.</p></section>
      <section class="tarjeta"><div class="cierre-cab"><h2 style="margin:0">Compras ${TITULO_POR[por]}</h2></div>
        <div class="fichas segmento" role="group" aria-label="Agrupar por">${POR.map(([k, t]) => `<button class="ficha" data-accion="por" data-valor="${k}" aria-pressed="${por === k}">${t}</button>`).join('')}</div>
        ${graficoBarras(grafico, por)}</section>
    </div>
    <h2 class="titulo-seccion">Desglose, ${esc(corto(rango.desde))} a ${esc(corto(rango.hasta))}</h2>
    <div class="cuadricula tres">
      ${barrasDesglose('Por tipo de proveedor', tipos, (k) => NOMBRE_TIPO[k] || k, 'El tipo sale de lo que más se le compra a cada proveedor.')}
      ${barrasDesglose('Por clasificación', rubros, (k) => k, 'Misma clasificación que el inventario del facturador.')}
      ${barrasDesglose('Por proveedor', provs.slice(0, 6))}
    </div>`;
}
