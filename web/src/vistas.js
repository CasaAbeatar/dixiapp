// Vistas: reciben datos ya listos y devuelven HTML. No leen ni escriben datos.
import { esc } from './ui.js';
import { colones, colonesConSigno } from './datos/formato.js';
import { fechaLarga, diaCorto, horaLegible } from './datos/fechas.js';
import { estadoDiferencia } from './datos/calculos.js';

const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const boton = (accion, texto, clases = '', extra = '') => `<button class="btn ${clases}" data-accion="${accion}" ${extra}>${texto}</button>`;

// ---------- Acceso ----------
export function vistaPin({ titulo, ayuda, pin, error, textoEntrar = 'Entrar', nota = '', enlace = '' }) {
  const puntos = Array.from({ length: 6 }, (_, i) => `<i class="${i < pin.length ? 'lleno' : ''}"></i>`).join('');
  const tecla = (n) => `<button class="tecla" data-accion="digito" data-valor="${n}" aria-label="${n}">${n}</button>`;
  return `<div class="acceso"><div class="acceso-caja">
    <div class="marca">Grupo DMA La Bomba</div><h1>${esc(titulo)}</h1>
    <p class="etq" style="margin:0">${esc(ayuda)}</p>
    <div class="puntos" aria-label="${pin.length} dígitos escritos">${puntos}</div>
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(tecla).join('')}
      <button class="tecla texto" data-accion="borrar">Borrar</button>${tecla(0)}
      <button class="tecla texto" data-accion="entrar" ${pin.length < 4 ? 'disabled' : ''} style="${pin.length >= 4 ? 'background:var(--acento);color:var(--acento-texto);border-color:var(--acento)' : 'opacity:.5'}">${esc(textoEntrar)}</button>
    </div>${enlace}${nota ? `<div class="nota-prueba">${nota}</div>` : ''}
  </div></div>`;
}

// Entrada personal de Dixia (modo real): foto a pantalla completa y panel de vidrio con un solo campo.
export function vistaEntrada({ saludo, pin, error }) {
  return `<div class="entrada"><div class="nombre-app"><div class="nombre-texto" aria-label="Dixiapp">Dixi<em>a</em>pp</div><div class="lema">¿Lista para cumplir tus sueños?</div></div><form class="entrada-panel" data-form="pin" autocomplete="off">
    <div class="marca">Grupo DMA La Bomba</div>
    <h1>${esc(saludo)}, Dixia</h1>
    <label class="entrada-campo"><span>Tu clave</span>
      <input type="password" id="a-pin" name="clave" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="Clave de 4 números" value="${esc(pin)}">
    </label>
    ${error ? `<p class="entrada-error" role="alert">${esc(error)}</p>` : ''}
  </form></div>`;
}

export function vistaCorreo({ correo, error, cargando }) {
  return `<div class="acceso"><form class="acceso-caja" data-form="correo" autocomplete="on">
    <div class="marca">Grupo DMA La Bomba</div><h1>Dixiapp</h1>
    <p class="etq" style="margin:0 0 18px">Entre con su correo y contraseña</p>
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <label class="campo" style="text-align:left"><span>Correo</span><input type="email" id="a-correo" name="email" autocomplete="username" inputmode="email" value="${esc(correo)}"></label>
    <label class="campo" style="text-align:left"><span>Contraseña</span><input type="password" id="a-clave" name="password" autocomplete="current-password"></label>
    <button class="btn primario bloque" type="submit" ${cargando ? 'disabled' : ''}>${cargando ? 'Entrando…' : 'Entrar'}</button>
    <p class="pie">Solo para administradores de Grupo DMA La Bomba.</p>
  </form></div>`;
}

// ---------- Marco ----------
export function marco({ negocio, hoy, pestana, pestanas, contenido, esPrueba }) {
  const botones = pestanas.map((p) => `<button class="pestana" data-accion="pestana" data-valor="${p}" ${p === pestana ? 'aria-current="page"' : ''}>${p}</button>`).join('');
  return `<div class="app"><header class="cabecera"><div class="cabecera-in">
      <div><div class="marca">Dixiapp</div><h1>${esc(negocio.nombre)}</h1><div class="fecha">${esc(fechaLarga(hoy))}</div></div>
      ${esPrueba ? '<span class="etiqueta-prueba">Datos de prueba</span>' : ''}</div></header>
    <main>${contenido}</main>
    <nav class="pestanas" aria-label="Secciones"><div class="pestanas-in">${botones}</div></nav></div>`;
}

export function selectorNegocio(negocios, negocioId) {
  if (negocios.length < 2) return '';
  return `<div class="fichas selector-negocio" role="group" aria-label="Negocio">${negocios.map((n) => `<button class="ficha" data-accion="negocio" data-valor="${n.id}" aria-pressed="${n.id === negocioId}">${esc(n.nombre)}</button>`).join('')}</div>`;
}

// ---------- Caja ----------
function listaMovs(movs, { puedeCorregir, corrigiendo }) {
  if (!movs.length) return '<p class="vacio">No hubo movimientos de efectivo este día.</p>';
  return `<ul class="lista">${movs.map((m) => {
    const marca = m.corrigeA ? '<span class="insignia neutra">Corrección</span> ' : m.corregido ? '<span class="insignia neutra">Corregido</span> ' : '';
    const accion = puedeCorregir && !m.corrigeA && !m.corregido
      ? (corrigiendo === m.id
        ? `<div class="confirmar-corr"><span>Se registrará un contramovimiento de ${colones(m.monto)} para anular este.</span>
            <div class="acciones">${boton('cancelar-corr', 'Cancelar')}${boton('confirmar-corr', 'Confirmar corrección', 'primario', `data-valor="${esc(m.id)}"`)}</div></div>`
        : `<button class="enlace" data-accion="corregir" data-valor="${esc(m.id)}">Corregir</button>`) : '';
    return `<li class="mov">
      <div>${marca}<span class="insignia ${m.tipo}">${m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span> <b>${esc(m.motivo)}</b></div>
      <div class="monto num">${m.tipo === 'entrada' ? '+' : '-'}${colones(m.monto)}</div>
      <div class="sub">${horaLegible(m.hora)} · ${esc(m.registradoPor)}${m.nota ? ' · ' + esc(m.nota) : ''}</div>${accion ? `<div class="sub">${accion}</div>` : ''}</li>`;
  }).join('')}</ul>`;
}

function quienCajas(cajas) {
  if (!cajas.length) return '';
  return cajas.map((c) => `<div class="fila"><span class="etq">Caja</span><span style="text-align:right">Abrió <b>${esc(c.abiertaPor)}</b> a las ${horaLegible(c.abiertaA)}${c.estado === 'cerrada' ? `<br>Cerró <b>${esc(c.cerradaPor)}</b> a las ${horaLegible(c.cerradaA)}` : '<br><span class="ok">Sigue abierta</span>'}</span></div>`).join('');
}

export function vistaCaja({ hoy, fecha, caja, act, esAdmin, form, sugerencias, aviso, error, fondo, corrigiendo, cierre }) {
  const esHoy = fecha === hoy;
  const nav = `<div class="nav-fecha"><button class="btn" data-accion="dia-menos" aria-label="Día anterior">‹</button>
    <div class="nav-fecha-t"><b>${esHoy ? 'Hoy, ' : ''}${esc(fechaLarga(fecha))}</b>${esHoy ? '' : boton('dia-hoy', 'Volver a hoy', 'enlace-btn')}</div>
    <button class="btn" data-accion="dia-mas" aria-label="Día siguiente" ${esHoy ? 'disabled' : ''}>›</button></div>`;
  const abierta = caja?.estado === 'abierta';
  let panel = '';
  if (esHoy) {
    if (!abierta) {
      panel = `<section class="tarjeta"><h2>${caja ? 'La caja está cerrada' : 'Todavía no hay caja'}</h2>
        ${caja ? `<p class="etq" style="margin-top:0">La última cerró ${esc(caja.cerradaPor)} a las ${horaLegible(caja.cerradaA)} del ${esc(fechaLarga(caja.fecha))}.</p>` : ''}
        <label class="campo"><span>Fondo inicial <small>(lo que deja para empezar; puede ser ₡0)</small></span><div class="monto-wrap"><b>₡</b><input id="a-fondo" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(fondo)}"></div></label>
        ${boton('abrir-caja', 'Abrir caja', 'primario bloque')}</section>`;
    } else {
      const ciega = `<div class="etq">Fondo inicial</div><div class="grande num">${colones(caja.fondoInicial)}</div>`;
      const admin = `<div class="etq">Efectivo esperado en caja</div><div class="grande num" data-id="esperado">${colones(caja.esperado)}</div>`;
      panel = `<section class="tarjeta">${esAdmin ? admin : ciega}
        <span class="estado abierta"><span class="punto"></span>Abierta desde las ${horaLegible(caja.abiertaA)} por ${esc(caja.abiertaPor)}</span>
        ${esAdmin ? `<div class="fila"><span class="etq">Fondo inicial</span><b class="num">${colones(caja.fondoInicial)}</b></div>
          <div class="fila"><span class="etq">Ventas en efectivo (del facturador)</span><b class="num">+${colones(caja.ventas.efectivo)}</b></div>
          <div class="fila"><span class="etq">Entradas</span><b class="num">+${colones(caja.entradas)}</b></div>
          <div class="fila"><span class="etq">Salidas</span><b class="num">-${colones(caja.salidas)}</b></div>` : '<p class="pie">Anote cada entrada y salida de efectivo. Al terminar, cuente el efectivo y cierre la caja.</p>'}</section>
        <div class="dos-botones" style="margin-top:14px">
          <button class="btn enorme ${form?.tipo === 'salida' ? 'activo' : ''}" data-accion="abrir-form" data-valor="salida">Salida<small>Dinero que sale de la caja</small></button>
          <button class="btn enorme ${form?.tipo === 'entrada' ? 'activo' : ''}" data-accion="abrir-form" data-valor="entrada">Entrada<small>Dinero que entra a la caja</small></button></div>
        ${form ? formulario(form, sugerencias) : ''}`;
    }
  }
  const cierreHtml = esHoy && abierta ? `<h2 class="titulo-seccion">Cerrar la caja</h2><section class="tarjeta" id="cierre">
      ${cierre?.faltante ? `<p class="error" role="alert"><b>Faltan ${colones(cierre.faltante)}</b> respecto a lo que debería haber. Cuente de nuevo. Si el conteo es correcto puede cerrar igual y queda registrado.</p>` : ''}
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
      <label class="campo"><span>Efectivo contado en caja</span><div class="monto-wrap"><b>₡</b><input id="c-contado" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(cierre?.contado ?? '')}"></div></label>
      ${esAdmin ? '<div class="fila"><span class="etq">Diferencia</span><b class="num" id="c-dif">Escriba lo contado</b></div>' : ''}
      ${cierre?.faltante ? `<div class="acciones">${boton('cancelar-cierre', 'Volver a contar')}${boton('cerrar-caja', 'Cerrar con faltante', 'peligro', 'data-valor="confirmar"')}</div>` : boton('cerrar-caja', 'Cerrar caja', 'primario bloque')}
      <p class="pie">Quedará guardado quién cierra y a qué hora.</p></section>` : '';
  return `${nav}${aviso ? `<p class="aviso" role="status">${esc(aviso)}</p>` : ''}${!esHoy && error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}${panel}${cierreHtml}
    <h2 class="titulo-seccion">Actividad ${esHoy ? 'de hoy' : 'del día'}</h2>
    <section class="tarjeta">${quienCajas(act.cajas)}${listaMovs(act.movimientos, { puedeCorregir: abierta, corrigiendo })}
      ${act.movimientos.length ? '<p class="pie">Los movimientos no se borran: un error se corrige con un contramovimiento.</p>' : ''}</section>`;
}

function formulario(form, sugerencias) {
  const esSalida = form.tipo === 'salida';
  return `<section class="tarjeta" style="margin-top:14px" id="formulario"><h2>${esSalida ? 'Registrar salida de efectivo' : 'Registrar entrada de efectivo'}</h2>
    ${form.error ? `<p class="error" role="alert">${esc(form.error)}</p>` : ''}
    <label class="campo"><span>Monto</span><div class="monto-wrap"><b>₡</b><input id="f-monto" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(form.monto)}"></div></label>
    <label class="campo"><span>Motivo <small>(escríbalo o toque una sugerencia)</small></span><input type="text" id="f-motivo" autocomplete="off" maxlength="120" value="${esc(form.motivo)}"></label>
    <div class="fichas" style="margin:-6px 0 16px">${sugerencias.map((m) => `<button type="button" class="ficha" data-accion="motivo" data-valor="${esc(m)}" aria-pressed="${form.motivo.toLowerCase() === m.toLowerCase()}">${esc(m)}</button>`).join('')}</div>
    <label class="campo"><span>Nota <small>(opcional)</small></span><input type="text" id="f-nota" autocomplete="off" maxlength="300" value="${esc(form.nota)}"></label>
    <div class="acciones">${boton('cancelar-form', 'Cancelar')}${boton('guardar-mov', `Guardar ${esSalida ? 'salida' : 'entrada'}`, 'primario')}</div></section>`;
}

// ---------- Cierres (solo administradores) ----------
function difTexto(d) { const e = estadoDiferencia(d); return e.clave === 'cuadra' ? 'Cuadra' : `${e.texto} ${colones(Math.abs(d))}`; }
function tarjetaCierre(c) {
  const e = estadoDiferencia(c.diferencia ?? 0);
  const v = c.ventas;
  return `<section class="tarjeta">
    <div class="cierre-cab"><h3>${esc(fechaLarga(c.fecha))}</h3><span class="insignia ${e.clave}">${difTexto(c.diferencia ?? 0)}</span></div>
    <div class="fila"><span class="etq">Efectivo esperado</span><b class="num">${colones(c.esperado)}</b></div>
    <div class="fila"><span class="etq">Efectivo contado</span><b class="num">${colones(c.contado)}</b></div>
    <div class="fila"><span class="etq">Diferencia</span><b class="num ${c.diferencia < 0 ? 'mal' : 'ok'}">${colonesConSigno(c.diferencia ?? 0)}</b></div>
    ${v ? `<div class="fila"><span class="etq">Ventas en efectivo</span><b class="num">${colones(v.efectivo)}</b></div>
    <div class="fila"><span class="etq">Ventas con tarjeta</span><b class="num">${colones(v.tarjeta)}</b></div>
    <div class="fila"><span class="etq">Ventas por SINPE</span><b class="num">${colones(v.sinpe)}</b></div>
    <div class="fila"><span class="etq">Transferencias</span><b class="num">${colones(v.transferencia)}</b></div>` : ''}
    <div class="pie">Abrió ${esc(c.abiertaPor)} a las ${horaLegible(c.abiertaA)} con ${colones(c.fondoInicial)}. Cerró ${esc(c.cerradaPor)} a las ${horaLegible(c.cerradaA)}.</div></section>`;
}

export function vistaCierres({ cierres, hayMas, semana }) {
  const semanaHtml = `<h2 class="titulo-seccion">Movimientos de efectivo, esta semana</h2>
    <section class="tarjeta"><div class="etq">Neto de la semana (entradas menos salidas)</div>
      <div class="grande num" style="font-size:36px;margin-bottom:4px" data-id="neto-semana">${colonesConSigno(semana.neto)}</div>
      <table class="tabla"><thead><tr><th>Día</th><th>Entradas</th><th>Salidas</th><th>Neto</th></tr></thead><tbody>
      ${semana.dias.map((d) => `<tr><td>${esc(diaCorto(d.fecha))}</td><td class="num">${colones(d.entradas)}</td><td class="num">${colones(d.salidas)}</td><td class="num">${colonesConSigno(d.neto)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Semana</td><td class="num">${colones(semana.entradas)}</td><td class="num">${colones(semana.salidas)}</td><td class="num">${colonesConSigno(semana.neto)}</td></tr></tfoot></table>
      <p class="pie">Cifras netas de movimientos de efectivo, sin ventas. Los días van en orden, el lunes primero.</p></section>`;
  return `<h2 class="titulo-seccion">Cierres, del más reciente al más antiguo</h2>
    <div class="cuadricula dos">${cierres.map(tarjetaCierre).join('') || '<p class="vacio">Aún no hay cierres.</p>'}</div>
    ${hayMas ? boton('mas-cierres', 'Ver cierres anteriores', 'bloque', 'style="margin-top:14px"') : '<p class="pie">No hay más cierres.</p>'}
    <p class="pie">Ventas por medio de pago tomadas del facturador, netas de notas de crédito. La diferencia es contado menos esperado.</p>
    ${semanaHtml}`;
}

// ---------- Más ----------
export function vistaMas({ usuario, tema, horarios, esAdmin, esPrueba, conBloqueo, negocios }) {
  const temas = [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];
  const hor = horarios.map((h) => `<div class="fila"><span class="etq">${esc(negocios.find((n) => n.id === h.negocioId)?.nombre.replace(' La Bomba', '') || '')} · ${esc(h.servicio)}</span><b>${esc(h.texto)}</b></div>`).join('');
  return `<h2 class="titulo-seccion">Horarios</h2><section class="tarjeta">${hor || '<p class="vacio">Sin horarios.</p>'}</section>
    <h2 class="titulo-seccion">Apariencia</h2><section class="tarjeta"><div class="fichas">${temas.map(([k, t]) => `<button class="ficha" data-accion="tema" data-valor="${k}" aria-pressed="${tema === k}">${t}</button>`).join('')}</div></section>
    <h2 class="titulo-seccion">Sesión</h2><section class="tarjeta"><div class="fila"><span class="etq">Usuario</span><b>${esc(usuario.nombre)}</b></div>
      <div class="fila"><span class="etq">Rol</span><b>${esAdmin ? 'Administrador' : 'Cajero'}</b></div>
      <div class="acciones" style="margin-top:12px">${conBloqueo ? boton('bloquear', 'Bloquear ahora') : '<span></span>'}${boton('salir', 'Salir de sesión')}</div></section>
    <h2 class="titulo-seccion">Próximas pantallas</h2><section class="tarjeta proximo"><p style="margin:0"><b>Aquí irán las pantallas nuevas.</b></p>
      <p class="etq" style="margin:6px 0 0">Está prevista Bodega (inventario). Cada módulo se agrega como una opción nueva.</p></section>
    ${esAdmin && esPrueba ? `<h2 class="titulo-seccion">Datos de prueba</h2><section class="tarjeta"><p class="etq" style="margin-top:0">Vuelve a crear los datos ficticios desde cero.</p>${boton('restablecer', 'Restablecer datos de prueba', 'bloque peligro')}</section>` : ''}`;
}
