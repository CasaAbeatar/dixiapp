// Vistas: reciben datos ya listos y devuelven HTML. No leen ni escriben datos.
import { esc } from './ui.js';
import { colones, colonesConSigno } from './datos/formato.js';
import { fechaLarga, diaCorto, horaLegible } from './datos/fechas.js';
import { estadoDiferencia } from './datos/calculos.js';
import { MOTIVOS_SALIDA, MOTIVOS_ENTRADA } from './datos/interfaz.js';

const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function vistaAcceso({ pin, error }) {
  const puntos = Array.from({ length: 6 }, (_, i) => `<i class="${i < pin.length ? 'lleno' : ''}"></i>`).join('');
  const tecla = (n) => `<button class="tecla" data-accion="digito" data-valor="${n}" aria-label="${n}">${n}</button>`;
  return `<div class="acceso"><div class="acceso-caja">
    <div class="marca">Grupo DMA La Bomba</div><h1>Dixiapp</h1>
    <p class="etq" style="margin:0">Escriba su PIN de 4 a 6 dígitos</p>
    <div class="puntos" aria-label="${pin.length} dígitos escritos">${puntos}</div>
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(tecla).join('')}
      <button class="tecla texto" data-accion="borrar">Borrar</button>${tecla(0)}
      <button class="tecla texto" data-accion="entrar" ${pin.length < 4 ? 'disabled' : ''} style="${pin.length >= 4 ? 'background:var(--acento);color:var(--acento-texto);border-color:var(--acento)' : 'opacity:.5'}">Entrar</button>
    </div>
    <div class="nota-prueba"><b>Modo de prueba, datos ficticios.</b><br>PIN de la gerente: 1234. PIN de la empleada: 4321.</div>
  </div></div>`;
}

export function marco({ usuario, negocio, hoy, pestana, pestanas, contenido }) {
  const botones = pestanas.map((p) => `<button class="pestana" data-accion="pestana" data-valor="${p}" ${p === pestana ? 'aria-current="page"' : ''}>${p}</button>`).join('');
  return `<div class="app"><header class="cabecera"><div class="cabecera-in">
      <div><div class="marca">Dixiapp</div><h1>${esc(negocio.nombre)}</h1><div class="fecha">${esc(fechaLarga(hoy))}</div></div>
      <span class="etiqueta-prueba">Datos de prueba</span></div></header>
    <main>${contenido}</main>
    <nav class="pestanas" aria-label="Secciones"><div class="pestanas-in">${botones}</div></nav></div>`;
}

function listaMovs(movs, vacio) {
  if (!movs.length) return `<p class="vacio">${vacio}</p>`;
  return `<ul class="lista">${movs.map((m) => `<li class="mov">
    <div><span class="insignia ${m.tipo}">${m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span> <b>${esc(m.motivo)}</b></div>
    <div class="monto num">${m.tipo === 'entrada' ? '+' : '-'}${colones(m.monto)}</div>
    <div class="sub">${horaLegible(m.hora)} · ${esc(m.registradoPor)}${m.nota ? ' · ' + esc(m.nota) : ''}</div></li>`).join('')}</ul>`;
}

export function vistaHoy({ caja, movs, esGerente }) {
  const cerrada = caja.estado === 'cerrada';
  const estado = cerrada
    ? `<span class="estado"><span class="punto"></span>Caja cerrada a las ${horaLegible(caja.cierre?.hora)}</span>`
    : `<span class="estado abierta"><span class="punto"></span>Caja abierta desde las ${horaLegible(caja.abiertaA)}</span>`;
  const ultimos = movs.slice(-5).reverse();
  return `<div class="cuadricula dos">
    <section class="tarjeta"><div class="etq">Efectivo esperado en caja</div>
      <div class="grande num" data-id="esperado">${colones(caja.esperado)}</div>${estado}
      ${esGerente && !cerrada ? `<button class="btn bloque" style="margin-top:16px" data-accion="pestana" data-valor="Cierres">Contar y cerrar caja</button>` : ''}</section>
    <section class="tarjeta"><h2>Cómo se calcula hoy</h2>
      <div class="fila"><span class="etq">Fondo inicial</span><b class="num">${colones(caja.fondoInicial)}</b></div>
      <div class="fila"><span class="etq">Ventas en efectivo</span><b class="num">+${colones(caja.ventasEfectivo)}</b></div>
      <div class="fila"><span class="etq">Entradas de efectivo</span><b class="num">+${colones(caja.entradas)}</b></div>
      <div class="fila"><span class="etq">Salidas de efectivo</span><b class="num">-${colones(caja.salidas)}</b></div>
      <div class="fila total"><span>Efectivo esperado</span><b class="num">${colones(caja.esperado)}</b></div></section>
  </div>
  <h2 class="titulo-seccion">Últimos movimientos de hoy</h2>
  <section class="tarjeta">${listaMovs(ultimos, 'Todavía no hay movimientos de efectivo hoy.')}
    <button class="btn bloque" style="margin-top:12px" data-accion="pestana" data-valor="Efectivo">Registrar un movimiento de efectivo</button></section>`;
}

function difTexto(d) {
  const e = estadoDiferencia(d);
  if (e.clave === 'cuadra') return 'Cuadra';
  return `${e.texto} ${colones(Math.abs(d))}`;
}

function tarjetaCierre(c) {
  const e = estadoDiferencia(c.diferencia);
  return `<section class="tarjeta">
    <div class="cierre-cab"><h3>${esc(fechaLarga(c.fecha))}</h3><span class="insignia ${e.clave}">${difTexto(c.diferencia)}</span></div>
    <div class="fila"><span class="etq">Efectivo esperado</span><b class="num">${colones(c.esperado)}</b></div>
    <div class="fila"><span class="etq">Efectivo contado</span><b class="num">${colones(c.contado)}</b></div>
    <div class="fila"><span class="etq">Diferencia</span><b class="num ${c.diferencia < 0 ? 'mal' : 'ok'}">${colonesConSigno(c.diferencia)}</b></div>
    <div class="fila"><span class="etq">Tarjeta</span><b class="num">${colones(c.tarjeta)}</b></div>
    <div class="fila"><span class="etq">SINPE</span><b class="num">${colones(c.sinpe)}</b></div>
    <div class="pie">Cerró ${esc(c.cerradoPor)} a las ${horaLegible(c.hora)}</div></section>`;
}

export function vistaCierres({ caja, cierres, hayMas, errorCierre }) {
  let hoy;
  if (caja.estado === 'abierta') {
    hoy = `<section class="tarjeta"><h2>Cierre de hoy, ${esc(fechaLarga(caja.fecha))}</h2>
      <p class="etq" style="margin-top:0">Efectivo esperado: <b class="num" style="color:var(--texto)">${colones(caja.esperado)}</b></p>
      ${errorCierre ? `<p class="error" role="alert">${esc(errorCierre)}</p>` : ''}
      <label class="campo"><span>Efectivo contado en caja</span><div class="monto-wrap"><b>₡</b><input id="c-contado" inputmode="numeric" autocomplete="off" placeholder="0"></div></label>
      <div class="acciones"><label class="campo"><span>Ventas con tarjeta</span><div class="monto-wrap"><b>₡</b><input id="c-tarjeta" inputmode="numeric" autocomplete="off" value="${miles(caja.ventasTarjeta)}"></div></label>
      <label class="campo"><span>Ventas por SINPE</span><div class="monto-wrap"><b>₡</b><input id="c-sinpe" inputmode="numeric" autocomplete="off" value="${miles(caja.ventasSinpe)}"></div></label></div>
      <div class="fila"><span class="etq">Diferencia</span><b class="num" id="c-dif">Escriba lo contado</b></div>
      <button class="btn primario bloque" style="margin-top:12px" data-accion="cerrar-caja">Cerrar caja de hoy</button></section>`;
  } else {
    hoy = `<h2 class="titulo-seccion">Hoy</h2>${tarjetaCierre(caja.cierre)}`;
  }
  const previos = cierres.filter((c) => c.fecha !== caja.fecha);
  return `${hoy}
    <h2 class="titulo-seccion">Cierres anteriores, del más reciente al más antiguo</h2>
    <div class="cuadricula dos">${previos.map(tarjetaCierre).join('') || '<p class="vacio">Aún no hay cierres anteriores.</p>'}</div>
    ${hayMas ? `<button class="btn bloque" style="margin-top:14px" data-accion="mas-cierres">Ver cierres anteriores</button>` : '<p class="pie">No hay más cierres anteriores.</p>'}
    <p class="pie">Cifras brutas por forma de pago, tal como se contaron al cerrar. La diferencia es efectivo contado menos esperado.</p>`;
}

export function vistaEfectivo({ caja, movs, semana, form, aviso, esGerente, personas }) {
  const cerrada = caja.estado === 'cerrada';
  let formulario = '';
  if (form) {
    const esSalida = form.tipo === 'salida';
    const motivos = esSalida ? MOTIVOS_SALIDA : MOTIVOS_ENTRADA;
    formulario = `<section class="tarjeta" style="margin-top:14px" id="formulario"><h2>${esSalida ? 'Registrar salida de efectivo' : 'Registrar entrada de efectivo'}</h2>
      ${form.error ? `<p class="error" role="alert">${esc(form.error)}</p>` : ''}
      <label class="campo"><span>Monto</span><div class="monto-wrap"><b>₡</b><input id="f-monto" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(form.monto)}"></div></label>
      <div class="campo"><span>Motivo</span><div class="fichas">${motivos.map((m) => `<button type="button" class="ficha" data-accion="motivo" data-valor="${esc(m)}" aria-pressed="${form.motivo === m}">${esc(m)}</button>`).join('')}</div></div>
      ${form.motivo === 'Otro' ? `<label class="campo"><span>Escriba el motivo</span><input type="text" id="f-otro" autocomplete="off" value="${esc(form.otro)}"></label>` : ''}
      <label class="campo"><span>Quién lo registra</span><select id="f-quien">${personas.map((p) => `<option ${p === form.quien ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      <label class="campo"><span>Nota <small>(opcional)</small></span><input type="text" id="f-nota" autocomplete="off" value="${esc(form.nota)}"></label>
      <div class="acciones"><button class="btn" data-accion="cancelar-form">Cancelar</button><button class="btn primario" data-accion="guardar-mov">Guardar ${esSalida ? 'salida' : 'entrada'}</button></div></section>`;
  }
  const botones = cerrada
    ? `<p class="aviso" style="background:none;color:var(--suave);border-color:var(--linea-fuerte)">La caja de hoy ya está cerrada. No se pueden registrar más movimientos.</p>`
    : `<div class="dos-botones">
        <button class="btn enorme ${form?.tipo === 'salida' ? 'activo' : ''}" data-accion="abrir-form" data-valor="salida">Registrar salida de efectivo<small>Dinero que sale de la caja</small></button>
        <button class="btn enorme ${form?.tipo === 'entrada' ? 'activo' : ''}" data-accion="abrir-form" data-valor="entrada">Registrar entrada de efectivo<small>Dinero que entra a la caja</small></button></div>`;
  const semanaHtml = semana ? `<h2 class="titulo-seccion">Esta semana, de lunes a hoy</h2>
    <section class="tarjeta"><div class="etq">Neto de la semana (entradas menos salidas)</div>
      <div class="grande num" style="font-size:36px;margin-bottom:4px" data-id="neto-semana">${colonesConSigno(semana.neto)}</div>
      <table class="tabla"><thead><tr><th>Día</th><th>Entradas</th><th>Salidas</th><th>Neto</th></tr></thead><tbody>
      ${semana.dias.map((d) => `<tr><td>${esc(diaCorto(d.fecha))}</td><td class="num">${colones(d.entradas)}</td><td class="num">${colones(d.salidas)}</td><td class="num">${colonesConSigno(d.neto)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Semana</td><td class="num">${colones(semana.entradas)}</td><td class="num">${colones(semana.salidas)}</td><td class="num">${colonesConSigno(semana.neto)}</td></tr></tfoot></table>
      <p class="pie">Cifras netas de movimientos de efectivo. No incluyen ventas. Los días van en orden, el lunes primero.</p></section>` : '';
  return `${aviso ? `<p class="aviso" role="status">${esc(aviso)}</p>` : ''}${botones}${formulario}
    <h2 class="titulo-seccion">Movimientos de hoy</h2><section class="tarjeta">${listaMovs([...movs].reverse(), 'Todavía no hay movimientos de efectivo hoy.')}</section>${semanaHtml}`;
}

export function vistaMas({ usuario, negocios, negocioId, tema, esGerente }) {
  const neg = negocios.length > 1
    ? `<div class="dos-botones">${negocios.map((n) => `<button class="btn enorme ${n.id === negocioId ? 'activo' : ''}" data-accion="negocio" data-valor="${n.id}" aria-pressed="${n.id === negocioId}">${esc(n.nombre)}<small>${n.id === negocioId ? 'Negocio activo' : 'Toque para cambiar'}</small></button>`).join('')}</div>`
    : `<p class="vacio">Su usuario solo tiene acceso a ${esc(negocios[0].nombre)}.</p>`;
  const temas = [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];
  return `<h2 class="titulo-seccion">Cambiar de negocio</h2><section class="tarjeta">${neg}</section>
    <h2 class="titulo-seccion">Apariencia</h2><section class="tarjeta"><div class="fichas">${temas.map(([k, t]) => `<button class="ficha" data-accion="tema" data-valor="${k}" aria-pressed="${tema === k}">${t}</button>`).join('')}</div></section>
    <h2 class="titulo-seccion">Sesión</h2><section class="tarjeta"><div class="fila"><span class="etq">Usuario</span><b>${esc(usuario.nombre)}</b></div>
      <div class="fila"><span class="etq">Rol</span><b>${esGerente ? 'Gerente: ve toda la caja' : 'Empleada: caja de hoy y movimientos'}</b></div>
      <button class="btn bloque" style="margin-top:12px" data-accion="salir">Salir de sesión</button></section>
    <h2 class="titulo-seccion">Próximas pantallas</h2><section class="tarjeta proximo"><p style="margin:0"><b>Aquí irán las pantallas que la gerente pida.</b></p>
      <p class="etq" style="margin:6px 0 0">Por ejemplo proveedores, planilla o reportes. Cada una se agrega como una opción nueva en esta sección.</p></section>
    ${esGerente ? `<h2 class="titulo-seccion">Datos de prueba</h2><section class="tarjeta"><p class="etq" style="margin-top:0">Vuelve a crear los datos ficticios desde cero.</p><button class="btn bloque peligro" data-accion="restablecer">Restablecer datos de prueba</button></section>` : ''}`;
}
