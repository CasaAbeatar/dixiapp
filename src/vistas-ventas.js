// Vista de Ventas en vivo (solo administradores, solo consulta). Recibe datos ya listos y devuelve HTML.
// Cifras del facturador: ventas facturadas, menos notas de credito, mas notas de debito. "Con IVA" es lo que pago el cliente.
import { esc } from './ui.js';
import { colones, colonesCompacto } from './datos/formato.js';
import { horaLegible, deTexto, lunesDe } from './datos/fechas.js';
import { graficoBarras, POR } from './vistas-compras.js';

const NEGOCIO = { soda: 'Soda', pollos: 'Pollos' };
export const TITULO_POR_VENTAS = { dia: 'por día, últimos 14 días', semana: 'por semana, últimas 8 semanas', mes: 'por mes, últimos 12 meses' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const vacio = () => ({ total: 0, iva: 0, neto: 0, docs: 0 });
const sumar = (a, b) => ({ total: a.total + b.total, iva: a.iva + b.iva, neto: a.neto + b.neto, docs: a.docs + b.docs });

// "6:30 a. m." a partir de un instante (hora de Costa Rica) o de un texto HH:MM
export function horaDeApertura(desde, desdeHora) {
  if (desdeHora) return horaLegible(desdeHora);
  if (!desde) return '';
  const d = new Date(desde); if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return horaLegible(p.replace(/^24:/, '00:'));
}

function tarjetaTurno(n) {
  const t = n.turno, nombre = NEGOCIO[n.negocioId] || n.negocioId;
  if (!t) return `<section class="tarjeta resumen"><div class="etq">Turno · ${esc(nombre)}</div><div class="grande num">—</div><div class="etq">Todavía no hay turno en el facturador.</div></section>`;
  const abierto = t.estado === 'abierta';
  return `<section class="tarjeta resumen turno"><div class="etq">Turno · ${esc(nombre)} <span class="insignia ${abierto ? 'cuadra' : 'neutra'}">${abierto ? 'Abierto' : 'Cerrado'}</span></div>
    <div class="grande num" data-id="turno-${esc(n.negocioId)}">${colones(t.total)}</div>
    <div class="etq">con IVA incluido</div>
    <div class="fila"><span class="etq">Abrió</span><b>${esc(t.abiertaPor || 'sin nombre')}</b></div>
    <div class="fila"><span class="etq">${abierto ? 'Desde las' : 'Último turno desde las'}</span><b>${esc(horaDeApertura(t.desde, t.desdeHora))}</b></div>
    ${!abierto ? `<div class="fila"><span class="etq">Cerró</span><b>${esc(t.cerradaPor || 'sin dato')}</b></div>` : ''}
    <div class="fila"><span class="etq">Neto, sin IVA</span><b class="num">${colones(t.neto)}</b></div>
    <div class="fila"><span class="etq">Documentos</span><b class="num">${t.docs}</b></div>
    </section>`;
}

function tarjetaPeriodo(titulo, r) {
  return `<section class="tarjeta resumen"><div class="etq">${titulo}</div>
    <div class="grande num" data-id="${esc(titulo)}">${colones(r.total)}</div>
    <div class="etq">con IVA incluido</div>
    <div class="fila"><span class="etq">Neto, sin IVA</span><b class="num">${colones(r.neto)}</b></div>
    <div class="fila"><span class="etq">Documentos</span><b class="num">${r.docs}</b></div></section>`;
}

function porLocal(negocios) {
  if (negocios.length < 2) return '';
  const filas = negocios.map((n) => `<tr><th scope="row">${esc(NEGOCIO[n.negocioId] || n.negocioId)}</th><td class="num">${colones(n.hoy.total)}</td><td class="num">${colones(n.semana.total)}</td><td class="num">${colones(n.mes.total)}</td></tr>`);
  const tot = (k) => colones(negocios.reduce((a, n) => a + n[k].total, 0));
  return `<section class="tarjeta"><h2>Por local</h2><div class="tabla-desliza"><table class="tabla">
    <thead><tr><th></th><th scope="col">Hoy</th><th scope="col">Esta semana</th><th scope="col">Este mes</th></tr></thead>
    <tbody>${filas.join('')}<tr class="total"><th scope="row">Total</th><td class="num">${tot('hoy')}</td><td class="num">${tot('semana')}</td><td class="num">${tot('mes')}</td></tr></tbody></table></div>
    <p class="pie">Todo con IVA incluido. Primero lo de hoy, después la semana y el mes.</p></section>`;
}

function nombreMes(clave) { const d = deTexto(clave); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; }

function listaMeses(filas) {
  const cuerpo = filas.map((f) => `<tr><th scope="row">${esc(nombreMes(f.clave))}</th><td class="num">${colones(f.total)}</td><td class="num">${colones(f.neto)}</td><td class="num">${f.facturas}</td></tr>`).join('');
  return `<section class="tarjeta"><h2>Ventas acumuladas por mes</h2><div class="tabla-desliza"><table class="tabla tabla-ancha">
    <thead><tr><th></th><th scope="col">Con IVA</th><th scope="col">Sin IVA</th><th scope="col">Documentos</th></tr></thead><tbody>${cuerpo}</tbody></table></div>
    <p class="pie">Últimos 12 meses, el más reciente al final. Es lo facturado menos notas de crédito, más notas de débito.</p></section>`;
}

// ---------- Lo mas y lo menos vendido ----------
const PERIODOS_TOP = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']];
const unidades = (n) => { const v = Math.round(n * 10) / 10; const t = Number.isInteger(v) ? String(v) : String(v).replace('.', ','); return `${t} ${v === 1 ? 'unidad' : 'unidades'}`; };
function filasTop(lista) {
  return `<ol class="top-lista">${lista.map((p, i) => `<li><span class="top-n">${i + 1}</span><span class="top-nombre">${esc(p.nombre)}</span><span class="top-cifras"><b class="num">${colones(p.total)}</b><span class="etq">${unidades(p.unidades)}</span></span></li>`).join('')}</ol>`;
}
function textoPeriodoTop(por, hoy) {
  const d = deTexto(hoy), largo = `${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (por === 'hoy') return `Hoy, ${largo}`;
  if (por === 'semana') return `Desde el lunes ${deTexto(lunesDe(hoy)).getDate()} de ${MESES[deTexto(lunesDe(hoy)).getMonth()]} hasta hoy, ${largo}`;
  return `${MESES[d.getMonth()][0].toUpperCase()}${MESES[d.getMonth()].slice(1)} de ${d.getFullYear()}, hasta hoy`;
}
export function bloqueTop({ top, topPor, filtro, hoy }) {
  if (!top) return '';
  const quien = filtro.neg === 'ambos' ? 'Soda y Pollos juntos' : (NEGOCIO[filtro.neg] || filtro.neg);
  const fichas = `<div class="fichas segmento" role="group" aria-label="Periodo de lo más y lo menos vendido">${PERIODOS_TOP.map(([k, t]) => `<button class="ficha" data-accion="ventas-top" data-valor="${k}" aria-pressed="${topPor === k}">${t}</button>`).join('')}</div>`;
  const cuerpo = top.vendidos === 0
    ? `<p class="top-vacio">Todavía no hay ventas en este periodo.</p>`
    : `<div class="top-dos"><div><h3 class="top-sub">Los ${top.mas.length} más vendidos</h3>${filasTop(top.mas)}</div>
        <div><h3 class="top-sub">Los ${top.menos.length || 5} menos vendidos <span class="etq">entre los que sí se vendieron</span></h3>${top.menos.length ? filasTop(top.menos) : '<p class="top-vacio">Hay muy pocos productos vendidos para separar los menos vendidos.</p>'}</div></div>`;
  const sin = top.sinVentas != null && top.menuTotal > 0
    ? `<p class="top-sin"><b class="num" data-id="top-sin-ventas">${top.sinVentas}</b> de ${top.menuTotal} productos del menú no se vendieron nada en este periodo.</p>` : '';
  return `<section class="tarjeta" data-id="ventas-top"><h2>Lo más y lo menos vendido</h2>
    <p class="pie" style="margin-top:0">${esc(quien)} · ${esc(textoPeriodoTop(topPor, hoy))}</p>
    ${fichas}${cuerpo}${sin}
    <p class="pie">Montos con IVA incluido, sin contar facturas anuladas y restando notas de crédito. No cuenta adicionales ni porciones extra.</p></section>`;
}

// ---------- Horas fuertes del dia ----------
const rango = (h) => `${h}:00 a ${h}:59`;
const DIA_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
function ticksHora(max) {
  if (max <= 0) return [0, 1];
  const bruto = max / 4, mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto);
  const t = []; for (let v = 0; v <= max + paso * 0.001; v += paso) t.push(v);
  if (t[t.length - 1] < max) t.push(t[t.length - 1] + paso);
  return t;
}
export function graficoHoras(horas) {
  const W = 500, H = 330, ml = 148, mr = 8, mt = 14, mb = 74, pw = W - ml - mr, ph = H - mt - mb;
  const maxVal = Math.max(0, ...horas.map((h) => Math.max(h.hoy, h.promedio || 0)));
  const ts = ticksHora(maxVal), techo = ts[ts.length - 1] || 1;
  const y = (v) => mt + ph - (Math.max(v, 0) / techo) * ph;
  const bw = pw / horas.length, ancho = Math.min(bw * 0.4, 24), hay = horas.some((h) => h.promedio != null);
  const rejilla = ts.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/><text x="${ml - 8}" y="${y(v) + 7}" text-anchor="end" class="g-tx g-grande">${colonesCompacto(v)}</text>`).join('');
  const barras = horas.map((h, i) => {
    const cx = ml + bw * i + bw / 2, p = h.promedio || 0;
    const xa = hay ? cx - ancho - 1 : cx - ancho / 2, xb = cx + 1;
    return `<g><title>${h.hora}:00 a ${h.hora}:59: hoy ${colones(h.hoy)}${h.promedio != null ? `, promedio ${colones(p)}` : ''}</title>
      <rect x="${xa}" y="${y(h.hoy)}" width="${ancho}" height="${Math.max(y(0) - y(h.hoy), 0)}" fill="var(--acento)" rx="2"/>
      ${hay ? `<rect x="${xb}" y="${y(p)}" width="${ancho}" height="${Math.max(y(0) - y(p), 0)}" fill="var(--linea-fuerte)" stroke="var(--suave)" stroke-width="1" rx="2"/>` : ''}
      <text x="${cx}" y="${H - mb + 26}" text-anchor="middle" class="g-tx g-grande">${horas.length <= 12 || h.hora % 2 === 0 ? h.hora : ''}</text></g>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas por hora de hoy comparadas con el promedio. Horas de izquierda (más temprano) a derecha (más tarde)">
    ${rejilla}${barras}
    <line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--linea-fuerte)"/>
    <text x="${ml + pw / 2}" y="${H - 8}" text-anchor="middle" class="g-eje g-grande">Hora del día (reloj de 24 horas)</text>
    <text x="20" y="${mt + ph / 2}" text-anchor="middle" class="g-eje g-grande" transform="rotate(-90 20 ${mt + ph / 2})">Colones (₡) con IVA</text></svg>
    <div class="leyenda"><span><i class="cuad solido"></i>Hoy</span>${hay ? '<span><i class="cuad gris"></i>Promedio de otros días</span>' : ''}</div>`;
}
export function bloqueHoras({ horasDia }) {
  if (!horasDia) return '';
  const todas = horasDia.horas, dia = DIA_PLURAL[deTexto(horasDia.fecha).getDay()];
  const activas = todas.filter((h) => h.hoy > 0 || (h.promedio || 0) > 0);
  const cab = '<h2>Horas fuertes del día</h2>';
  const pie = '<p class="pie">Montos con IVA incluido, hora de Costa Rica. En el gráfico, el 12 es de 12:00 a 12:59. Las horas que todavía no llegan hoy se ven vacías.</p>';
  if (!activas.length) return `<section class="tarjeta" data-id="ventas-horas">${cab}<p class="top-vacio">Todavía no hay ventas hoy ni días anteriores para comparar.</p>${pie}</section>`;
  const ini = Math.min(...activas.map((h) => h.hora)), fin = Math.max(...activas.map((h) => h.hora));
  const hasta = Math.min(23, Math.max(fin, ini + 5)), recorte = todas.filter((h) => h.hora >= Math.max(0, Math.min(ini, hasta - 5)) && h.hora <= hasta);
  const mayor = (k) => recorte.reduce((a, h) => ((h[k] || 0) > (a ? a[k] || 0 : 0) ? h : a), null);
  const hoyMax = mayor('hoy'), proMax = horasDia.semanas > 0 ? mayor('promedio') : null;
  const lineas = [hoyMax ? `Hoy la hora más fuerte va siendo de ${rango(hoyMax.hora)}, con ${colones(hoyMax.hoy)}.` : 'Hoy todavía no hay ventas.',
    proMax ? `En otros ${dia} lo habitual es de ${rango(proMax.hora)}, con ${colones(proMax.promedio)}.` : `Todavía no hay ${dia} anteriores para comparar.`];
  return `<section class="tarjeta" data-id="ventas-horas">${cab}
    <p class="pie" style="margin-top:0">Hoy, comparado con el promedio de los ${dia} de las últimas 4 semanas${horasDia.semanas > 0 && horasDia.semanas < 4 ? ` (hay ${horasDia.semanas} con ventas)` : ''}.</p>
    ${graficoHoras(recorte)}
    <p class="top-sin">${lineas.map(esc).join(' ')}</p>${pie}</section>`;
}

export function vistaVentas({ negociosPermitidos, filtro, vivo, en_vivo, por, grafico, meses, error, ahoraTexto, top, topPor = 'hoy', horasDia, hoy }) {
  const opciones = [['ambos', 'Ambos'], ...negociosPermitidos.map((n) => [n.id, n.nombre.replace(' La Bomba', '')])];
  const fichas = opciones.length > 2
    ? `<div class="barra-filtros"><div class="fichas" role="group" aria-label="Negocio">${opciones.map(([k, t]) => `<button class="ficha" data-accion="ventas-negocio" data-valor="${k}" aria-pressed="${filtro.neg === k}">${t}</button>`).join('')}</div></div>` : '';
  const ns = (en_vivo?.negocios || []).map((n) => ({ ...n, hoy: n.hoy || vacio(), semana: n.semana || vacio(), mes: n.mes || vacio() }));
  const comb = (k) => ns.reduce((a, n) => sumar(a, n[k]), vacio());
  return `${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    ${fichas}
    <div class="cierre-cab"><h2 style="margin:0">Ventas en vivo</h2><span class="vivo ${vivo ? 'on' : ''}" data-id="vivo-ventas"><i class="punto"></i>${vivo ? 'Actualizado ahora' : 'En vivo'}</span></div>
    <p class="pie">Se actualiza solo cada pocos segundos. ${ahoraTexto ? `Última lectura: ${esc(ahoraTexto.replace(/\.$/, ''))}.` : ''}</p>
    <div class="cuadricula tres">${ns.map(tarjetaTurno).join('')}</div>
    <h2 class="titulo-seccion">Acumulado${ns.length > 1 ? ' de los dos locales' : ''}</h2>
    <div class="cuadricula tres">${tarjetaPeriodo('Hoy', comb('hoy'))}${tarjetaPeriodo('Esta semana', comb('semana'))}${tarjetaPeriodo('Este mes', comb('mes'))}</div>
    <p class="pie">Cifras brutas con IVA incluido y netas sin IVA, en colones. La semana va de lunes a domingo.</p>
    ${porLocal(ns)}
    <div class="columnas">${bloqueHoras({ horasDia })}${bloqueTop({ top, topPor, filtro, hoy })}</div>
    <div class="columnas">
      <section class="tarjeta"><div class="cierre-cab"><h2 style="margin:0">Ventas ${TITULO_POR_VENTAS[por]}</h2></div>
        <div class="fichas segmento" role="group" aria-label="Agrupar por">${POR.map(([k, t]) => `<button class="ficha" data-accion="ventas-por" data-valor="${k}" aria-pressed="${por === k}">${t}</button>`).join('')}</div>
        ${graficoBarras(grafico, por, 'Ventas', TITULO_POR_VENTAS)}</section>
      ${listaMeses(meses)}
    </div>`;
}
