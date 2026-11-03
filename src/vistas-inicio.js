// Pantalla de inicio de Dixia: un mensaje, el efectivo de hoy, lo que espera su decision, fechas y viaje.
import { esc } from './ui.js';
import { colones } from './datos/formato.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Proxima ocurrencia de un dia/mes a partir de hoy ('AAAA-MM-DD'): devuelve {fecha, dias}
export function proximaFecha(hoy, mes, dia) {
  const [a] = hoy.split('-').map(Number);
  const base = Date.UTC(...hoy.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
  let f = Date.UTC(a, mes - 1, dia);
  if (f < base) f = Date.UTC(a + 1, mes - 1, dia);
  return { dia, mes, dias: Math.round((f - base) / 86400000) };
}
export function diasHasta(hoy, fecha) {
  const t = (x) => Date.UTC(...x.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  return Math.round((t(fecha) - t(hoy)) / 86400000);
}
const cuando = (d) => (d === 0 ? 'Es hoy' : d === 1 ? 'Mañana' : `Faltan ${d} días`);

function tarjetaNegocio(n, cls) {
  const c = n.caja;
  const abierta = c?.estado === 'abierta';
  const valor = c && c.esperado != null ? colones(c.esperado) : '—';
  const detalle = !c ? 'Todavía no hay caja' : abierta ? `Caja abierta · ${n.movs} movimiento${n.movs === 1 ? '' : 's'} de efectivo` : 'Caja cerrada';
  return `<div class="ini-k ${cls}"><small>${esc(n.nombre)} · efectivo esperado</small><div class="ini-n">${valor}</div><div class="ini-d">${detalle}</div></div>`;
}

function decision(d) {
  return `<div class="ini-dec"><span class="ini-ic" style="background:${d.color}">${esc(d.letra)}</span>
    <div class="ini-t"><b>${esc(d.titulo)}</b><small>${esc(d.detalle)}</small></div>
    ${d.extra ? '' : `<button class="ini-btn" data-accion="${esc(d.accion)}" ${d.valor ? `data-valor="${esc(d.valor)}"` : ''}>Decidir</button>`}${d.extra || ''}</div>`;
}

function bloqueViaje(viaje, hoy, form) {
  if (viaje && viaje.fecha) {
    const d = diasHasta(hoy, viaje.fecha);
    if (d >= 0) {
      const [, m, dd] = viaje.fecha.split('-').map(Number);
      return `<div class="ini-f"><div class="ini-dt viaje"><b>${dd}</b><i>${MESES[m - 1]}</i></div><div class="ini-ft"><b>Tu próximo viaje: ${esc(viaje.destino)}</b><small>${cuando(d)}</small></div><button class="ini-link" data-accion="viaje-editar">Cambiar</button></div>`;
    }
  }
  if (form) {
    return `<div class="ini-viaje"><b>Tu próximo viaje</b>
      <label>¿A dónde?<input id="v-destino" type="text" maxlength="60" autocomplete="off" value="${esc(form.destino)}" placeholder="Por ejemplo, Nueva York"></label>
      <label>¿Qué día sales?<input id="v-fecha" type="date" value="${esc(form.fecha)}"></label>
      ${form.error ? `<p class="ini-err">${esc(form.error)}</p>` : ''}
      <div class="ini-fila-b"><button class="ini-link" data-accion="viaje-cancelar">Cancelar</button><button class="ini-btn" data-accion="viaje-guardar">Guardar mi viaje</button></div></div>`;
  }
  return `<div class="ini-f"><div class="ini-dt viaje"><b>✈</b><i>viaje</i></div><div class="ini-ft"><b>Tu próximo viaje</b><small>¿A dónde te gustaría ir?</small></div><button class="ini-btn" data-accion="viaje-editar">Ponerle fecha</button></div>`;
}

export function vistaInicio({ saludo, mensaje, negocios, decisiones, semana, viaje, viajeForm, movimientos, aviso, hoy }) {
  const total = negocios.reduce((a, n) => a + (n.caja?.esperado ?? 0), 0);
  const kpis = negocios.map((n, i) => tarjetaNegocio(n, i === 0 ? 'k1' : 'k2')).join('')
    + `<div class="ini-k k3"><small>Los dos negocios · efectivo esperado</small><div class="ini-n">${colones(total)}</div><div class="ini-d">Suma de ambas cajas</div></div>`;
  const cumple = proximaFecha(hoy, 6, 8), soda = proximaFecha(hoy, 9, 30);
  const fecha = (f, t, s) => `<div class="ini-f"><div class="ini-dt"><b>${f.dia}</b><i>${MESES[f.mes - 1]}</i></div><div class="ini-ft"><b>${t}</b><small>${f.dias === 0 ? 'Es hoy' : s} · ${cuando(f.dias).toLowerCase()}</small></div></div>`;
  return `<section class="ini">
    <h2 class="ini-h">${esc(saludo)}, Dixia</h2>
    <p class="ini-msg">${esc(mensaje)}</p>
    ${aviso ? `<div class="ini-aviso" role="status"><span>${esc(aviso)}</span><button class="ini-link" data-accion="aviso-cerrar">Entendido</button></div>` : ''}
    <div class="ini-kpis">${kpis}</div>
    <div class="ini-grid">
      <div class="ini-c"><h3>Decisiones que esperan por ti <span>${decisiones.length}</span></h3>
        ${decisiones.map(decision).join('') || '<p class="ini-vacio">Por ahora no hay nada esperando tu decisión.</p>'}</div>
      <div>
        <div class="ini-ia"><b>Resumen de la semana</b><span>${semana.facturas ? `Han llegado ${semana.facturas} facturas de proveedores por ${colones(semana.total)} (con IVA).` : 'Esta semana todavía no han llegado facturas de proveedores.'}</span></div>
        <div class="ini-c" style="margin-bottom:14px"><h3>Efectivo de hoy <span>entradas y salidas</span></h3>
          ${movimientos.map((m) => `<div class="ini-f"><span class="ini-mov ${m.tipo === 'entrada' ? 'mov-e' : 'mov-s'}">${m.tipo === 'entrada' ? '+' : '−'}</span><div class="ini-ft"><b>${esc(m.motivo)}</b><small>${esc(m.negocio)} · ${esc(m.hora || '')} · ${esc(m.registradoPor)}</small></div><b>${m.tipo === 'entrada' ? '+' : '-'}${colones(m.monto)}</b></div>`).join('') || '<p class="ini-vacio">Todavía no hay entradas ni salidas de efectivo hoy.</p>'}</div>
        <div class="ini-c"><h3>Tus próximas fechas</h3>
          ${fecha(cumple, 'Tu cumpleaños', 'Te lo mereces')}${fecha(soda, 'Aniversario de Soda La Bomba', 'Lo construiste tú')}
          ${bloqueViaje(viaje, hoy, viajeForm)}</div>
      </div>
    </div></section>`;
}
