// Bodega en modo de PRUEBA: inventario ficticio con el mismo comportamiento que el del facturador
// (entradas desde facturas, salidas, traslados, conteo fisico y ajustes). Todo es un movimiento nuevo: nada se edita ni se borra.
import { sumarDias, horaTexto } from './fechas.js';

const CLAVE = 'dixiapp.prueba.bodega.v1';
export const UBICACIONES = [
  { id: 'bc', nombre: 'Bodega central', tipo: 'bodega' },
  { id: 'ls', nombre: 'Local Soda', tipo: 'local' },
  { id: 'lp', nombre: 'Local Pollos', tipo: 'local' },
];
const ART = [
  ['pollo', 'Pollo entero', 'Carnes', 'unidad'], ['pechuga', 'Pechuga de pollo', 'Carnes', 'kg'], ['costilla', 'Costilla de cerdo', 'Carnes', 'kg'], ['molida', 'Carne molida', 'Carnes', 'kg'],
  ['tomate', 'Tomate', 'Verduras', 'kg'], ['cebolla', 'Cebolla', 'Verduras', 'kg'], ['papa', 'Papa', 'Verduras', 'kg'], ['lechuga', 'Lechuga', 'Verduras', 'unidad'],
  ['arroz', 'Arroz', 'Abarrotes', 'kg'], ['frijoles', 'Frijoles', 'Abarrotes', 'kg'], ['aceite', 'Aceite', 'Abarrotes', 'litro'], ['azucar', 'Azúcar', 'Abarrotes', 'kg'],
  ['cola', 'Gaseosa 355 ml', 'Bebidas', 'unidad'], ['agua', 'Agua 600 ml', 'Bebidas', 'unidad'], ['jugo', 'Jugo natural', 'Bebidas', 'litro'],
  ['vasos', 'Vasos 12 oz', 'Empaques', 'unidad'], ['cajas', 'Cajas para pollo', 'Empaques', 'unidad'], ['bolsas', 'Bolsas', 'Empaques', 'paquete'], ['servilletas', 'Servilletas', 'Empaques', 'paquete'],
  ['gas', 'Gas 25 lb', 'Suministros', 'cilindro'], ['jabon', 'Jabón de platos', 'Suministros', 'unidad'],
].map(([id, nombre, categoria, unidad]) => ({ id, nombre, categoria, unidad }));
const TIPOS = { entrada_factura: ['Entrada por factura', 1], entrada_manual: ['Entrada manual', 1], traslado_salida: ['Traslado (sale)', -1], traslado_entrada: ['Traslado (entra)', 1],
  consumo: ['Consumo', -1], merma: ['Merma', -1], devolucion: ['Devolución a proveedor', -1], ajuste_conteo: ['Ajuste por conteo', 0], ajuste_manual: ['Ajuste directo', 0] };
const NOMBRE_SALIDA = { consumo: 'Consumo', merma: 'Merma', devolucion: 'Devolución a proveedor' };

// [bodega, soda, pollos] por articulo y minimos [bodega, soda, pollos]
const STOCK = {
  pollo: [[60, 8, 45], [20, 12, 15]], pechuga: [[25, 0, 12], [10, 0, 6]], costilla: [[12, 5, 0], [5, 3, 0]], molida: [[10, 6, 0], [4, 3, 0]],
  tomate: [[18, 6, 4], [8, 4, 2]], cebolla: [[15, 5, 3], [6, 3, 2]], papa: [[40, 8, 20], [15, 5, 8]], lechuga: [[12, 3, 2], [5, 3, 2]],
  arroz: [[50, 10, 3], [20, 6, 5]], frijoles: [[30, 6, 4], [10, 4, 3]], aceite: [[20, 4, 12], [8, 3, 6]], azucar: [[16, 3, 0], [6, 2, 0]],
  cola: [[120, 48, 36], [48, 24, 24]], agua: [[96, 36, 30], [36, 24, 18]], jugo: [[10, 5, 0], [4, 3, 0]],
  vasos: [[400, 150, 120], [200, 100, 80]], cajas: [[300, 0, 90], [120, 0, 60]], bolsas: [[20, 6, 8], [8, 4, 4]], servilletas: [[24, 6, 8], [10, 4, 4]],
  gas: [[6, 1, 1], [2, 1, 1]], jabon: [[10, 3, 2], [4, 2, 1]],
};
export function semillaBodega(hoy) {
  const est = { version: 1, existencias: {}, movimientos: [], conteos: [], siguiente: 1, facturas: [] };
  ART.forEach((a) => UBICACIONES.forEach((u, i) => {
    const [cant, min] = [STOCK[a.id][0][i], STOCK[a.id][1][i]];
    if (cant || min) est.existencias[`${a.id}|${u.id}`] = { cant, min, vence: null };
  }));
  est.existencias['lechuga|ls'].vence = sumarDias(hoy, 2); est.existencias['jugo|bc'].vence = sumarDias(hoy, 3); est.existencias['molida|bc'].vence = sumarDias(hoy, -1);
  const fac = (clave, proveedor, empresa, total, dias, lineas) => ({ clave, proveedor, empresa, total, fecha: sumarDias(hoy, -dias), lineas });
  est.facturas = [
    fac('F-0001', 'Avícola Central (ficticio)', 'Pollos La Bomba', 218400, 0, [
      { linea: 1, descripcion: 'Pollo entero fresco', cantidad: 40, unidad: 'unidad', sug: { articuloId: 'pollo', factor: 1 } },
      { linea: 2, descripcion: 'Pechuga de pollo caja 15 kg', cantidad: 2, unidad: 'caja', sug: { articuloId: 'pechuga', factor: 15 } }]),
    fac('F-0002', 'Verduras Don Beto (ficticio)', 'Soda La Bomba', 64500, 0, [
      { linea: 1, descripcion: 'Tomate', cantidad: 30, unidad: 'kg', sug: { articuloId: 'tomate', factor: 1 } },
      { linea: 2, descripcion: 'Cebolla blanca', cantidad: 20, unidad: 'kg', sug: { articuloId: 'cebolla', factor: 1 } },
      { linea: 3, descripcion: 'Culantro manojo', cantidad: 12, unidad: 'unidad', sug: null }]),
    fac('F-0003', 'Bebidas del Norte (ficticio)', 'Soda La Bomba', 143800, 1, [
      { linea: 1, descripcion: 'Gaseosa 355 ml caja de 24', cantidad: 5, unidad: 'caja', sug: { articuloId: 'cola', factor: 24 } }]),
  ];
  return est;
}

export function crearBodegaPrueba({ almacen, hoy, ahora, exigirAdmin, nombreUsuario }) {
  const leer = () => {
    try { const t = almacen.getItem(CLAVE); if (t) { const e = JSON.parse(t); if (e.version === 1) return e; } } catch { /* corrupto */ }
    const e = semillaBodega(hoy()); almacen.setItem(CLAVE, JSON.stringify(e)); return e;
  };
  const guardar = (e) => almacen.setItem(CLAVE, JSON.stringify(e));
  const art = (id) => { const a = ART.find((x) => x.id === id); if (!a) throw new Error('El artículo no existe.'); return a; };
  const ubic = (id) => { const u = UBICACIONES.find((x) => x.id === id); if (!u) throw new Error('La ubicación no existe.'); return u; };
  const cant = (e, a, u) => e.existencias[`${a}|${u}`]?.cant ?? 0;
  const numero = (x, que) => { const n = Number(x); if (!Number.isFinite(n) || n <= 0) throw new Error(`La cantidad de ${que} debe ser mayor que cero.`); return Math.round(n * 1000) / 1000; };
  const mover = (e, tipo, a, u, c, motivo, extra = {}) => { // c con signo
    const k = `${a}|${u}`; const fila = e.existencias[k] || (e.existencias[k] = { cant: 0, min: 0, vence: null });
    fila.cant = Math.round((fila.cant + c) * 1000) / 1000;
    const x = { id: e.siguiente++, tipo, tipoNombre: TIPOS[tipo][0], signo: TIPOS[tipo][1], articuloId: a, articulo: art(a).nombre, unidad: art(a).unidad, cantidad: Math.abs(c), ubicacion: ubic(u).nombre,
      motivo, usuario: nombreUsuario(), fecha: hoy(), hora: horaTexto(ahora()), ...extra };
    e.movimientos.push(x); return x;
  };
  const sacar = (e, tipo, u, items, motivo) => {
    if (!Array.isArray(items) || !items.length) throw new Error('Indique qué artículos y cuánto.');
    if (String(motivo || '').trim().length < 3) throw new Error('Escriba el motivo (al menos 3 letras).');
    for (const it of items) { const a = art(it.articuloId); const c = numero(it.cantidad, a.nombre); if (cant(e, a.id, u) < c) throw new Error(`No hay suficiente «${a.nombre}» en ${ubic(u).nombre} (hay ${cant(e, a.id, u)}).`); }
    return items.map((it) => mover(e, tipo, it.articuloId, u, -numero(it.cantidad, art(it.articuloId).nombre), motivo.trim()));
  };
  const vistaConteo = (e, k) => {
    const ls = k.lineas.map((l) => ({ articuloId: l.articuloId, articulo: art(l.articuloId).nombre, categoria: art(l.articuloId).categoria, unidad: art(l.articuloId).unidad, contado: l.contado,
      diferencia: l.contado === null ? null : Math.round((l.contado - cant(e, l.articuloId, k.ubicacionId)) * 1000) / 1000 }));
    return { id: k.id, ubicacionId: k.ubicacionId, ubicacion: ubic(k.ubicacionId).nombre, estado: k.estado, total: ls.length, contadas: ls.filter((l) => l.contado !== null).length, lineas: ls };
  };
  const abierto = (e, u) => e.conteos.find((k) => k.ubicacionId === u && k.estado === 'abierto');
  const fila = (e, key, a, u) => { const [aid, uid] = key.split('|'); const v = e.existencias[key];
    return { articuloId: aid, articulo: a.nombre, categoria: a.categoria, unidad: a.unidad, ubicacionId: uid, ubicacion: u.nombre, cantidad: v.cant, minimo: v.min || null,
      bajoMinimo: v.min > 0 && v.cant < v.min, vencida: !!(v.vence && v.vence < hoy() && v.cant > 0), proximoVencimiento: v.vence }; };

  return {
    async bodegaUbicaciones() { exigirAdmin(); return UBICACIONES; },
    async bodegaExistencias({ ubicacion = null, q = '' } = {}) {
      exigirAdmin(); const e = leer(); const t = String(q || '').trim().toLowerCase(); const out = [];
      for (const key of Object.keys(e.existencias)) {
        const [aid, uid] = key.split('|'); if (ubicacion && uid !== ubicacion) continue;
        const a = art(aid); if (t && !a.nombre.toLowerCase().includes(t)) continue;
        out.push(fila(e, key, a, ubic(uid)));
      }
      return out.sort((x, y) => x.categoria.localeCompare(y.categoria) || x.articulo.localeCompare(y.articulo));
    },
    async bodegaAlertas() {
      exigirAdmin(); const e = leer(); const filas = Object.keys(e.existencias).map((k) => fila(e, k, art(k.split('|')[0]), ubic(k.split('|')[1])));
      const h = hoy(), pronto = sumarDias(h, 5);
      const dias = (f) => Math.round((new Date(`${f}T12:00:00`) - new Date(`${h}T12:00:00`)) / 86400000);
      return {
        bajoMinimo: filas.filter((f) => f.bajoMinimo).map((f) => ({ articuloId: f.articuloId, articulo: f.articulo, unidad: f.unidad, ubicacionId: f.ubicacionId, ubicacion: f.ubicacion, existencia: f.cantidad, minimo: f.minimo, faltante: f.minimo - f.cantidad }))
          .sort((a, b) => a.existencia / a.minimo - b.existencia / b.minimo),
        vencenPronto: filas.filter((f) => f.proximoVencimiento && f.cantidad > 0 && f.proximoVencimiento >= h && f.proximoVencimiento <= pronto).map((f) => ({ articuloId: f.articuloId, articulo: f.articulo, unidad: f.unidad, ubicacion: f.ubicacion, cantidad: f.cantidad, venceEn: f.proximoVencimiento, dias: dias(f.proximoVencimiento) })),
        vencidos: filas.filter((f) => f.vencida).map((f) => ({ articuloId: f.articuloId, articulo: f.articulo, unidad: f.unidad, ubicacion: f.ubicacion, cantidad: f.cantidad, venceEn: f.proximoVencimiento })),
        porRecibir: e.facturas.reduce((a, f) => a + f.lineas.length, 0),
      };
    },
    async bodegaPorRecibir() {
      exigirAdmin();
      return leer().facturas.filter((f) => f.lineas.length).map((f) => ({ clave: f.clave, proveedor: f.proveedor, fecha: f.fecha, empresa: f.empresa, total: f.total,
        lineas: f.lineas.map((l) => ({ linea: l.linea, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, sugerencia: l.sug ? { articuloId: l.sug.articuloId, articulo: art(l.sug.articuloId).nombre, factor: l.sug.factor, unidad: art(l.sug.articuloId).unidad } : null })) }));
    },
    async bodegaRecibir({ lineas }) {
      exigirAdmin(); const e = leer(); if (!Array.isArray(lineas) || !lineas.length) throw new Error('No hay líneas para recibir.');
      let n = 0;
      for (const l of lineas) {
        const f = e.facturas.find((x) => x.clave === l.clave); const i = f?.lineas.findIndex((x) => x.linea === l.linea) ?? -1;
        if (i < 0) throw new Error('Esa línea ya fue recibida.');
        const li = f.lineas[i]; if (!l.articuloId) throw new Error(`La línea «${li.descripcion}» no tiene artículo asignado.`);
        const factor = l.factor ?? li.sug?.factor ?? 1;
        mover(e, 'entrada_factura', l.articuloId, 'bc', Math.round(li.cantidad * factor * 1000) / 1000, `Factura ${f.clave}`);
        f.lineas.splice(i, 1); n++;
      }
      guardar(e); return { recibidas: n };
    },
    async bodegaSalida({ tipo, ubicacion, items, motivo }) {
      exigirAdmin(); if (!NOMBRE_SALIDA[tipo]) throw new Error('El tipo de salida debe ser consumo, merma o devolución.');
      const e = leer(); ubic(ubicacion); sacar(e, tipo, ubicacion, items, motivo); guardar(e); return { items: items.length };
    },
    async bodegaTrasladar({ origen, destino, items, motivo }) {
      exigirAdmin(); const e = leer(); if (origen === destino) throw new Error('El origen y el destino son el mismo lugar.'); ubic(destino);
      const sal = sacar(e, 'traslado_salida', origen, items, motivo || `Traslado a ${ubic(destino).nombre}`);
      sal.forEach((m, i) => mover(e, 'traslado_entrada', m.articuloId, destino, m.cantidad, `Traslado desde ${ubic(origen).nombre}`));
      guardar(e); return { items: items.length };
    },
    async bodegaConteo(ubicacion) { exigirAdmin(); const e = leer(); const k = abierto(e, ubicacion); return k ? vistaConteo(e, k) : null; },
    async bodegaConteoIniciar(ubicacion) {
      exigirAdmin(); const e = leer(); ubic(ubicacion);
      if (abierto(e, ubicacion)) throw new Error(`Ya hay un conteo abierto en ${ubic(ubicacion).nombre}: termínelo o cancélelo primero.`);
      const lineas = Object.keys(e.existencias).filter((k) => k.endsWith(`|${ubicacion}`) && e.existencias[k].cant > 0).map((k) => ({ articuloId: k.split('|')[0], contado: null }))
        .sort((a, b) => art(a.articuloId).categoria.localeCompare(art(b.articuloId).categoria) || art(a.articuloId).nombre.localeCompare(art(b.articuloId).nombre));
      const k = { id: `conteo-${e.siguiente++}`, ubicacionId: ubicacion, estado: 'abierto', lineas }; e.conteos.push(k); guardar(e); return vistaConteo(e, k);
    },
    async bodegaConteoRegistrar(conteoId, items) {
      exigirAdmin(); const e = leer(); const k = e.conteos.find((x) => x.id === conteoId); if (!k) throw new Error('No se encontró ese conteo.');
      if (k.estado !== 'abierto') throw new Error(`Este conteo ya está ${k.estado}: no se puede cambiar.`);
      if (!Array.isArray(items) || !items.length) throw new Error('Indique qué artículos contó y cuánto.');
      for (const it of items) {
        const l = k.lineas.find((x) => x.articuloId === it.articuloId); const c = Number(it.contado);
        if (!Number.isFinite(c) || c < 0) throw new Error(`Lo contado de «${art(it.articuloId).nombre}» no es válido.`);
        if (l) l.contado = Math.round(c * 1000) / 1000; else k.lineas.push({ articuloId: it.articuloId, contado: Math.round(c * 1000) / 1000 });
      }
      guardar(e); return vistaConteo(e, k);
    },
    async bodegaConteoConfirmar(conteoId) {
      exigirAdmin(); const e = leer(); const k = e.conteos.find((x) => x.id === conteoId); if (!k) throw new Error('No se encontró ese conteo.');
      if (k.estado !== 'abierto') throw new Error(`Este conteo ya está ${k.estado}.`);
      const ajustes = []; let sin = 0;
      for (const l of k.lineas.filter((x) => x.contado !== null)) {
        const esperado = cant(e, l.articuloId, k.ubicacionId), d = Math.round((l.contado - esperado) * 1000) / 1000;
        if (d === 0) { sin++; continue; }
        mover(e, 'ajuste_conteo', l.articuloId, k.ubicacionId, d, 'Conteo físico', { cantidad: Math.abs(d), signo: Math.sign(d) });
        ajustes.push({ articulo: art(l.articuloId).nombre, unidad: art(l.articuloId).unidad, esperado, contado: l.contado, diferencia: d });
      }
      k.estado = 'confirmado'; guardar(e); return { ajustes, sinCambio: sin, noContados: k.lineas.filter((x) => x.contado === null).length };
    },
    async bodegaConteoCancelar(conteoId) {
      exigirAdmin(); const e = leer(); const k = e.conteos.find((x) => x.id === conteoId); if (!k || k.estado !== 'abierto') throw new Error('Ese conteo ya no está abierto.');
      k.estado = 'cancelado'; guardar(e);
    },
    async bodegaAjustar({ ubicacion, items, motivo }) {
      exigirAdmin(); const e = leer(); ubic(ubicacion);
      if (String(motivo || '').trim().length < 3) throw new Error('Escriba el motivo (al menos 3 letras).');
      const ajustes = items.map((it) => {
        const antes = cant(e, it.articuloId, ubicacion), despues = Number(it.cantidadReal);
        if (!Number.isFinite(despues) || despues < 0) throw new Error('La cantidad real no es válida.');
        const d = Math.round((despues - antes) * 1000) / 1000;
        if (d !== 0) mover(e, 'ajuste_manual', it.articuloId, ubicacion, d, motivo.trim(), { cantidad: Math.abs(d), signo: Math.sign(d) });
        return { articulo: art(it.articuloId).nombre, antes, despues, diferencia: d };
      });
      guardar(e); return { ajustes };
    },
    async bodegaMovimientos({ ubicacion = null, limite = 10 } = {}) {
      exigirAdmin(); const nombre = ubicacion ? ubic(ubicacion).nombre : null;
      return leer().movimientos.filter((m) => !nombre || m.ubicacion === nombre).slice(-limite).reverse().map(({ articuloId, ...m }) => m);
    },
    reiniciarBodega() { guardar(semillaBodega(hoy())); },
  };
}
