// Calculos puros de los cierres de caja del facturador (turnos). Sin acceso a datos ni a la pantalla.
// Solo cuentan los turnos CERRADOS; un turno abierto no trae cifras y solo se cuenta como abierto.
import { suma } from './calculos.js';

const MEDIOS = ['efectivo', 'tarjeta', 'sinpe', 'transferencia', 'otros'];
const r2 = (n) => Math.round(n * 100) / 100;

export function resumirTurnos(turnos) {
  const cer = turnos.filter((t) => t.estado === 'cerrado');
  const medios = Object.fromEntries(MEDIOS.map((m) => [m, r2(suma(cer, (t) => t.ventas[m] || 0))]));
  const difs = cer.map((t) => t.diferencia ?? 0);
  return {
    turnos: turnos.length, cerrados: cer.length, abiertos: turnos.length - cer.length,
    totalVentas: r2(suma(cer, (t) => t.totalVentas)), ventasNetas: r2(suma(cer, (t) => t.ventasNetas)), medios,
    entradas: r2(suma(cer, (t) => t.entradas)), salidas: r2(suma(cer, (t) => t.salidas)),
    faltantes: r2(suma(difs.filter((d) => d < 0), (d) => d)), sobrantes: r2(suma(difs.filter((d) => d > 0), (d) => d)), diferencia: r2(suma(difs, (d) => d)),
    conDiferencia: difs.filter((d) => d !== 0).length,
  };
}

// Dias del mas reciente al mas antiguo; dentro del dia, el turno mas reciente primero (los abiertos arriba)
export function agruparPorDia(turnos) {
  const porDia = new Map();
  for (const t of turnos) { if (!porDia.has(t.dia)) porDia.set(t.dia, []); porDia.get(t.dia).push(t); }
  const clave = (t) => (t.estado === 'abierto' ? 'z' : 'a') + (t.cerradoHora || '');
  return [...porDia.keys()].sort().reverse().map((dia) => {
    const lista = porDia.get(dia).slice().sort((a, b) => (clave(b) < clave(a) ? -1 : clave(b) > clave(a) ? 1 : 0));
    return { ...resumirTurnos(lista), dia, turnos: lista }; // `turnos` es la lista (el resumen trae el conteo, que aqui es lista.length)
  });
}

// Un resumen por negocio, en el orden de `ids`
export function resumenPorNegocio(turnos, ids) {
  return ids.map((id) => ({ negocioId: id, ...resumirTurnos(turnos.filter((t) => t.negocioId === id)) }));
}
