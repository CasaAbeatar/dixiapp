// Vista de Ventas en vivo (solo administradores, solo consulta). Recibe datos ya listos y devuelve HTML.
// Cifras del facturador: ventas facturadas, menos notas de credito, mas notas de debito. "Con IVA" es lo que pago el cliente.
import { esc } from './ui.js';
import { colones } from './datos/formato.js';
import { horaLegible, deTexto } from './datos/fechas.js';
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

export function vistaVentas({ negociosPermitidos, filtro, vivo, en_vivo, por, grafico, meses, error, ahoraTexto }) {
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
    <div class="columnas">
      <section class="tarjeta"><div class="cierre-cab"><h2 style="margin:0">Ventas ${TITULO_POR_VENTAS[por]}</h2></div>
        <div class="fichas segmento" role="group" aria-label="Agrupar por">${POR.map(([k, t]) => `<button class="ficha" data-accion="ventas-por" data-valor="${k}" aria-pressed="${por === k}">${t}</button>`).join('')}</div>
        ${graficoBarras(grafico, por, 'Ventas', TITULO_POR_VENTAS)}</section>
      ${listaMeses(meses)}
    </div>`;
}
