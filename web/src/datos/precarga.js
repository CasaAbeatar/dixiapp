// Precarga en segundo plano (solo administradores, con internet): baja todas las variantes que ofrecen las pantallas,
// incluido todo el historial de cierres, para que la copia local de copia-local.js las tenga sin que alguien las abra una por una.
// Usa exactamente los mismos argumentos que app.js, porque la copia se identifica por metodo + argumentos.
import { lunesDe, sumarDias } from './fechas.js';
import { rangoPorDefecto, sumarMeses, inicioMes } from './compras-calc.js';

const CLAVE = 'dixiapp.precarga.ultima';
const CADA_MS = 3 * 3600 * 1000;
const lapsoDe = (per, hoy) => (per === 'hoy' ? { desde: hoy, hasta: hoy } : per === 'semana' ? { desde: lunesDe(hoy), hasta: hoy } : { desde: inicioMes(hoy), hasta: hoy });

export async function precargarTodo(datos, { hoy, almacen = globalThis.localStorage, ahora = Date.now, enLinea = () => globalThis.navigator?.onLine !== false, forzar = false } = {}) {
  if (!enLinea()) return { hecho: false, motivo: 'sin_internet' };
  try { if (!forzar && ahora() - Number(almacen.getItem(CLAVE) || 0) < CADA_MS) return { hecho: false, motivo: 'reciente' }; } catch { /* sin almacenamiento */ }
  const negocios = await datos.negocios();
  const grupos = [null, ...negocios.map((n) => [n.id])];
  const tareas = [];
  const t = (f) => tareas.push(f);
  for (const negs of grupos) {
    // Ventas
    const rangoMes = { desde: sumarMeses(hoy, -11), hasta: hoy };
    t(() => datos.ventasEnVivo({ negocios: negs }));
    for (const por of ['dia', 'semana', 'mes']) {
      const rango = por === 'mes' ? rangoMes : rangoPorDefecto(hoy, por);
      t(() => datos.ventasAgrupadas({ negocios: negs, ...rango, por }));
    }
    t(() => datos.ventasAgrupadas({ negocios: negs, ...rangoMes, por: 'mes' }));
    for (const top of ['hoy', 'semana', 'mes']) t(() => datos.ventasTop({ negocios: negs, ...lapsoDe(top, hoy), limite: 5 }));
    t(() => datos.ventasPorHora({ negocios: negs, fecha: hoy }));
    // Compras
    const base = { negocios: negs, proveedor: null, rubro: null };
    t(() => datos.comprasProveedores({ negocios: negs, rubro: null }));
    t(() => datos.comprasResumen(base));
    t(() => datos.comprasUltimas({ ...base, limite: 8 }));
    for (const per of ['hoy', 'semana', 'mes']) {
      const lapso = lapsoDe(per, hoy);
      t(() => datos.comprasUltimas({ ...base, ...lapso, limite: 300 }));
      t(() => datos.comprasProveedores({ negocios: negs, rubro: null, ...lapso }));
    }
    for (const por of ['dia', 'semana', 'mes']) {
      const rango = rangoPorDefecto(hoy, por);
      t(() => datos.comprasAgrupadas({ ...base, ...rango, por }));
      t(() => datos.comprasAgrupadas({ ...base, ...rango, por: 'tipo_proveedor' }));
      t(() => datos.comprasAgrupadas({ negocios: negs, proveedor: null, ...rango, por: 'rubro' }));
      t(() => datos.comprasAgrupadas({ ...base, ...rango, por: 'proveedor' }));
    }
  }
  // Cierres: todo el historial, de 30 en 30 dias, hasta que ya no haya mas
  const cierres = async (negs) => {
    for (let dias = 30; dias <= 30 * 60; dias += 30) {
      const r = await datos.cierresTurnos({ negocios: negs, desde: sumarDias(hoy, -(dias - 1)), hasta: hoy, limite: 300 });
      if (!r?.hayMas) break;
    }
  };
  for (const negs of grupos) t(() => cierres(negs));
  // Inicio y bodega (sin fechas)
  t(() => datos.diferenciasPendientes()); t(() => datos.viajes()); t(() => datos.movimientosRecientes({ limite: 6 }));
  t(async () => {
    const ubic = await datos.bodegaUbicaciones();
    await datos.bodegaAlertas(); await datos.bodegaPorRecibir(); await datos.bodegaNotas({ estado: 'por_revisar' });
    await datos.bodegaRecibidas({ limite: 15 }); await datos.bodegaArticulos({}); await datos.bodegaSugerenciaMinimos();
    await datos.bodegaMovimientos({ ubicacion: null, limite: 80 });
    for (const u of ubic) { await datos.bodegaExistencias({ ubicacion: u.id }); await datos.bodegaMovimientos({ ubicacion: u.id, limite: 80 }); }
  });
  // De dos en dos para no cargar la base ni el telefono
  let fallos = 0, i = 0;
  const trabajador = async () => { while (i < tareas.length) { const f = tareas[i++]; try { await f(); } catch { fallos++; } } };
  await Promise.all([trabajador(), trabajador()]);
  try { almacen.setItem(CLAVE, String(ahora())); } catch { /* sin almacenamiento */ }
  return { hecho: true, tareas: tareas.length, fallos };
}
