// Vista de Cierres de caja del facturador (solo administradores, solo consulta). Recibe datos ya listos y devuelve HTML.
// Primero lo de hoy, despues el resumen del periodo y al final los dias anteriores. Un turno abierto no muestra cifras.
import { esc } from './ui.js';
import { colones, colonesConSigno } from './datos/formato.js';
import { fechaLarga, horaLegible } from './datos/fechas.js';
import { estadoDiferencia } from './datos/calculos.js';
import { agruparPorDia, resumenPorNegocio, resumirTurnos } from './datos/cierres-calc.js';

const nombreCorto = (n) => String(n || '').replace(/ La Bomba$/, '');
const dif = (d) => { const e = estadoDiferencia(d ?? 0); return e.clave === 'cuadra' ? 'Cuadra' : `${e.texto} ${colones(Math.abs(d))}`; };
const claseDif = (d) => estadoDiferencia(d ?? 0).clave;
const MEDIOS = [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['sinpe', 'SINPE'], ['transferencia', 'Transferencia'], ['otros', 'Otros medios']];

function filaDetalle(etq, valor, clase = '') { return `<div class="fila ${clase}"><span class="etq">${etq}</span><b class="num">${valor}</b></div>`; }

function movimientos(titulo, lista, signo) {
  if (!lista.length) return '';
  return `<div class="tn-movs"><div class="etq">${titulo}</div>${lista.map((m) => `<div class="fila"><span>${esc(m.motivo)}<br><span class="etq">${horaLegible(m.hora)} · ${esc(m.por)}</span></span><b class="num">${signo}${colones(m.monto)}</b></div>`).join('')}</div>`;
}

function detalle(t, nombre, hoy) {
  const otroDia = t.abiertoDia !== t.dia;
  if (t.estado !== 'cerrado') return `<div class="tn-detalle"><p class="etq" style="margin:0">Este turno sigue abierto. Las cifras aparecen cuando la cajera lo cierre.</p>
    ${filaDetalle('Empresa', esc(nombre), 'texto')}${filaDetalle('Abrió', `${esc(t.abiertoPor)}, ${otroDia ? esc(fechaLarga(t.abiertoDia)) + ' ' : ''}${horaLegible(t.abiertoHora)}`, 'texto')}</div>`;
  const ajuste = Math.round((t.ventasNetas - t.totalVentas) * 100) / 100;
  const medios = MEDIOS.filter(([k]) => k !== 'otros' || t.ventas.otros).map(([k, n]) => filaDetalle(n, colones(t.ventas[k])));
  return `<div class="tn-detalle">
    ${filaDetalle('Empresa', esc(nombre), 'texto')}
    ${filaDetalle('Abrió', `${esc(t.abiertoPor)}, ${otroDia ? esc(fechaLarga(t.abiertoDia)) + ' ' : ''}${horaLegible(t.abiertoHora)}`, 'texto')}
    ${filaDetalle('Cerró', `${esc(t.cerradoPor)}, ${horaLegible(t.cerradoHora)}`, 'texto')}
    <h4 class="tn-sub">Ventas por medio de pago</h4>
    ${medios.join('')}
    ${filaDetalle('Total de ventas', colones(t.totalVentas), 'total')}
    ${ajuste ? filaDetalle('Notas de crédito y de débito', colonesConSigno(ajuste)) + filaDetalle('Ventas netas', colones(t.ventasNetas), 'total') : ''}
    <h4 class="tn-sub">Efectivo en caja</h4>
    ${filaDetalle('Fondo inicial', colones(t.fondo))}
    ${filaDetalle('Ventas en efectivo', `+${colones(t.ventas.efectivo)}`)}
    ${t.cobrosNotaDebito ? filaDetalle('Cobros por notas de débito', `+${colones(t.cobrosNotaDebito)}`) : ''}
    ${filaDetalle('Entradas de efectivo', `+${colones(t.entradas)}`)}
    ${filaDetalle('Salidas de efectivo', `-${colones(t.salidas)}`)}
    ${t.devolucionesEfectivo ? filaDetalle('Devuelto en efectivo (notas de crédito)', `-${colones(t.devolucionesEfectivo)}`) : ''}
    ${filaDetalle('Efectivo esperado', colones(t.esperado), 'total')}
    ${filaDetalle('Efectivo contado', colones(t.contado))}
    ${filaDetalle('Diferencia', dif(t.diferencia), `total ${t.diferencia < 0 ? 'mal' : t.diferencia > 0 ? 'ok' : ''}`)}
    ${movimientos('Entradas de efectivo', t.movEntradas, '+')}${movimientos('Salidas de efectivo', t.movSalidas, '-')}
    ${t.nota ? `<p class="etq" style="margin:10px 0 0">Nota de la cajera: ${esc(t.nota)}</p>` : ''}</div>`;
}

function fila(t, nombre, abierto, hoy) {
  const cerrado = t.estado === 'cerrado';
  const horas = cerrado ? `${horaLegible(t.abiertoHora)} a ${horaLegible(t.cerradoHora)}` : `Desde las ${horaLegible(t.abiertoHora)}`;
  const quien = cerrado ? `Abrió ${esc(t.abiertoPor)} · Cerró ${esc(t.cerradoPor)}` : `Abrió ${esc(t.abiertoPor)}`;
  return `<li class="tn" data-id="turno-${esc(t.id)}"><button class="tn-fila" data-accion="turno-ver" data-valor="${esc(t.id)}" aria-expanded="${abierto}">
      <span class="tn-izq"><b>${esc(nombre)}</b> <span class="etq">${cerrado ? '· ' : ''}${esc(horas)}</span><span class="etq tn-quien">${quien}</span></span>
      <span class="tn-der">${cerrado ? `<b class="num">${colones(t.totalVentas)}</b><span class="insignia ${claseDif(t.diferencia)}">${dif(t.diferencia)}</span>` : '<span class="insignia neutra">Abierto</span><span class="etq">Sin cifras hasta el cierre</span>'}</span>
      <span class="tn-ver">${abierto ? 'Ocultar detalle ▴' : 'Ver detalle ▾'}</span></button>
    ${abierto ? detalle(t, nombre, hoy) : ''}</li>`;
}

function listaTurnos(turnos, nombres, abiertos, hoy) {
  return `<ul class="lista tn-lista">${turnos.map((t) => fila(t, nombres[t.negocioId] || t.negocioId, !!abiertos[t.id], hoy)).join('')}</ul>`;
}

function tarjetaHoy(dia, hoy, nombres, abiertos) {
  if (!dia) return `<section class="tarjeta" data-id="cierres-hoy"><p class="vacio" style="margin:0">Hoy todavía no hay turnos de caja en el facturador.</p></section>`;
  return `<section class="tarjeta" data-id="cierres-hoy">
    <div class="etq">Ventas de los turnos cerrados hoy</div>
    <div class="grande num" style="font-size:36px;margin-bottom:2px" data-id="cierres-total-hoy">${colones(dia.totalVentas)}</div>
    <div class="etq">con IVA incluido, antes de notas de crédito</div>
    ${filaDetalle('Turnos cerrados', String(dia.cerrados))}${dia.abiertos ? filaDetalle('Turnos abiertos ahora', String(dia.abiertos)) : ''}
    ${filaDetalle('Diferencia de efectivo de hoy', `${dif(dia.diferencia)}`, dia.diferencia < 0 ? 'mal' : dia.diferencia > 0 ? 'ok' : '')}
    ${listaTurnos(dia.turnos, nombres, abiertos, hoy)}</section>`;
}

function resumenPeriodo(turnos, ids, nombres, dias) {
  const cerr = turnos.filter((t) => t.estado === 'cerrado');
  if (!cerr.length) return '';
  const por = resumenPorNegocio(turnos, ids).filter((r) => r.turnos);
  const tot = resumirTurnos(turnos);
  const filas = por.map((r) => `<tr><th scope="row">${esc(nombres[r.negocioId] || r.negocioId)}</th><td class="num">${r.cerrados}</td><td class="num">${colones(r.totalVentas)}</td><td class="num ${r.faltantes < 0 ? 'mal' : ''}">${r.faltantes ? colones(r.faltantes) : '₡0'}</td><td class="num ${r.sobrantes > 0 ? 'ok' : ''}">${r.sobrantes ? '+' + colones(r.sobrantes) : '₡0'}</td></tr>`).join('');
  return `<h2 class="titulo-seccion">Resumen de los últimos ${dias} días</h2>
    <section class="tarjeta" data-id="cierres-resumen"><div class="tabla-desliza"><table class="tabla tabla-ancha">
      <thead><tr><th></th><th scope="col">Turnos cerrados</th><th scope="col">Ventas</th><th scope="col">Faltantes</th><th scope="col">Sobrantes</th></tr></thead>
      <tbody>${filas}${por.length > 1 ? `<tr class="total"><th scope="row">Total</th><td class="num">${tot.cerrados}</td><td class="num">${colones(tot.totalVentas)}</td><td class="num ${tot.faltantes < 0 ? 'mal' : ''}">${tot.faltantes ? colones(tot.faltantes) : '₡0'}</td><td class="num ${tot.sobrantes > 0 ? 'ok' : ''}">${tot.sobrantes ? '+' + colones(tot.sobrantes) : '₡0'}</td></tr>` : ''}</tbody></table></div>
      <p class="pie">Ventas con IVA incluido, antes de notas de crédito. Faltante y sobrante son la diferencia entre el efectivo contado y el esperado de cada turno; se suman por separado para que uno no tape al otro.</p></section>`;
}

export function vistaCierresTurnos({ turnos, hoy, negociosPermitidos, filtro, dias, hayMas, error, abiertos = {} }) {
  const nombres = Object.fromEntries(negociosPermitidos.map((n) => [n.id, nombreCorto(n.nombre)]));
  const opciones = [['ambos', 'Ambos'], ...negociosPermitidos.map((n) => [n.id, nombreCorto(n.nombre)])];
  const fichas = opciones.length > 2 ? `<div class="barra-filtros"><div class="fichas" role="group" aria-label="Local">${opciones.map(([k, t]) => `<button class="ficha" data-accion="cierres-negocio" data-valor="${k}" aria-pressed="${filtro.neg === k}">${esc(t)}</button>`).join('')}</div></div>` : '';
  const porDia = agruparPorDia(turnos);
  const delDia = porDia.find((d) => d.dia === hoy) || null;
  const anteriores = porDia.filter((d) => d.dia !== hoy);
  const ids = negociosPermitidos.map((n) => n.id);
  const dias_ = anteriores.map((d) => `<section class="tarjeta tn-dia" data-id="cierres-dia-${esc(d.dia)}">
      <div class="cierre-cab"><h3>${esc(fechaLarga(d.dia))}</h3>${d.cerrados ? `<span class="insignia ${claseDif(d.diferencia)}">${d.diferencia ? 'Efectivo: ' : ''}${dif(d.diferencia)}</span>` : '<span class="insignia neutra">Sin cierres</span>'}</div>
      ${d.cerrados ? `<div class="etq">${d.cerrados} ${d.cerrados === 1 ? 'turno cerrado' : 'turnos cerrados'} · ventas <b class="num">${colones(d.totalVentas)}</b></div>` : ''}
      ${listaTurnos(d.turnos, nombres, abiertos, hoy)}</section>`).join('');
  return `${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}${fichas}
    <h2 class="titulo-seccion">Hoy, ${esc(fechaLarga(hoy))}</h2>
    ${tarjetaHoy(delDia, hoy, nombres, abiertos)}
    ${resumenPeriodo(turnos, ids, nombres, dias)}
    <h2 class="titulo-seccion">Días anteriores, del más reciente al más antiguo</h2>
    <div class="cuadricula dos">${dias_ || '<p class="vacio">No hay turnos en días anteriores de este periodo.</p>'}</div>
    <button class="btn bloque" data-accion="cierres-mas" style="margin-top:14px">Ver 30 días más atrás</button>
    <p class="pie">${hayMas ? 'Hay más turnos de los que caben en esta lista; se muestran los más recientes. ' : ''}Son los turnos de caja que abren y cierran las cajeras en el facturador. Toque un turno para ver su detalle. Un turno abierto no muestra cifras hasta que se cierre.</p>`;
}
