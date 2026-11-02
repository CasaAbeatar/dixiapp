// Calculos puros de Compras. Misma logica que dixi.compras_agrupadas (SQL) para que la prueba y la base coincidan.
import { lunesDe, sumarDias, deTexto, aTexto } from './fechas.js';

export const inicioMes = (t) => t.slice(0, 8) + '01';
export function sumarMeses(t, n) { const d = deTexto(inicioMes(t)); d.setMonth(d.getMonth() + n); return aTexto(d); }
const redond = (n) => Math.round(n * 100) / 100;

// Inicio del periodo (dia, semana que empieza lunes, mes) al que pertenece la fecha
export function inicioPeriodo(t, por) { return por === 'semana' ? lunesDe(t) : por === 'mes' ? inicioMes(t) : t; }
export function siguientePeriodo(t, por) { return por === 'semana' ? sumarDias(t, 7) : por === 'mes' ? sumarMeses(t, 1) : sumarDias(t, 1); }

// Rango por defecto de cada agrupacion (siempre termina hoy): 14 dias, 8 semanas, 6 meses
export function rangoPorDefecto(hoy, por) {
  if (por === 'semana') return { desde: sumarDias(lunesDe(hoy), -7 * 7), hasta: hoy };
  if (por === 'mes') return { desde: sumarMeses(hoy, -5), hasta: hoy };
  return { desde: sumarDias(hoy, -13), hasta: hoy };
}

// Rellena con ceros los periodos sin compras, en orden cronologico (izquierda a derecha)
export function rellenarPeriodos(filas, por, desde, hasta) {
  const mapa = new Map(filas.map((f) => [f.clave, f]));
  const out = [];
  for (let p = inicioPeriodo(desde, por); p <= hasta; p = siguientePeriodo(p, por)) {
    out.push(mapa.get(p) || { clave: p, etiqueta: p, facturas: 0, neto: 0, iva: 0, total: 0 });
  }
  return out;
}

const tipoDe = (c) => c.tipoProveedor;
export function agruparCompras(compras, { negocios = null, desde, hasta, por, proveedor = null }) {
  const sel = compras.filter((c) => (!negocios || negocios.includes(c.negocioId)) && c.dia >= desde && c.dia <= hasta && (!proveedor || c.proveedorCedula === proveedor));
  const grupos = new Map();
  const sumar = (clave, etiqueta, c, neto, iva, clavefac) => {
    const g = grupos.get(clave) || { clave, etiqueta, claves: new Set(), neto: 0, iva: 0 };
    g.claves.add(clavefac); g.neto += neto; g.iva += iva; grupos.set(clave, g);
  };
  for (const c of sel) {
    if (['dia', 'semana', 'mes'].includes(por)) { const k = inicioPeriodo(c.dia, por); sumar(k, k, c, c.netoCrc, c.ivaCrc, c.clave); }
    else if (por === 'proveedor') sumar(c.proveedorCedula, c.proveedor, c, c.netoCrc, c.ivaCrc, c.clave);
    else if (por === 'tipo_proveedor') sumar(tipoDe(c), tipoDe(c), c, c.netoCrc, c.ivaCrc, c.clave);
    else if (por === 'grupo' || por === 'rubro') for (const r of c.rubros) {
      const k = por === 'grupo' ? r.grupo : r.rubro;
      if (r.neto !== 0 || r.iva !== 0) sumar(k, k, c, r.neto, r.iva, c.clave);
    } else throw new Error('Agrupación desconocida: ' + por);
  }
  const filas = [...grupos.values()].map((g) => ({ clave: g.clave, etiqueta: g.etiqueta, facturas: g.claves.size, neto: redond(g.neto), iva: redond(g.iva), total: redond(g.neto + g.iva) }));
  return ['dia', 'semana', 'mes'].includes(por) ? filas.sort((a, b) => a.clave.localeCompare(b.clave)) : filas.sort((a, b) => b.total - a.total);
}

// De las filas por dia (desde el lunes o el 1.o del mes, lo que sea anterior, hasta hoy) saca hoy, semana y mes
export function resumenDesdeDias(dias, hoy) {
  const vacio = () => ({ facturas: 0, neto: 0, iva: 0, total: 0 });
  const r = { hoy: vacio(), semana: vacio(), mes: vacio() };
  const lun = lunesDe(hoy), mes = inicioMes(hoy);
  const acum = (o, d) => { o.facturas += Number(d.facturas); o.neto = redond(o.neto + Number(d.neto)); o.iva = redond(o.iva + Number(d.iva)); o.total = redond(o.total + Number(d.total)); };
  for (const d of dias) {
    if (d.clave === hoy) acum(r.hoy, d);
    if (d.clave >= lun && d.clave <= hoy) acum(r.semana, d);
    if (d.clave >= mes && d.clave <= hoy) acum(r.mes, d);
  }
  return r;
}
export const desdeResumen = (hoy) => { const l = lunesDe(hoy), m = inicioMes(hoy); return l < m ? l : m; };
