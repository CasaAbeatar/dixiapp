// Calculos puros de caja. Sin acceso a datos ni a la pantalla: se reutilizan con cualquier implementacion.

export const suma = (lista, f) => lista.reduce((a, x) => a + f(x), 0);

export function totalesMovimientos(movs) {
  const entradas = suma(movs.filter((m) => m.tipo === 'entrada'), (m) => m.monto);
  const salidas = suma(movs.filter((m) => m.tipo === 'salida'), (m) => m.monto);
  return { entradas, salidas, neto: entradas - salidas };
}

// Efectivo esperado = fondo inicial + ventas en efectivo + entradas - salidas
export function efectivoEsperado(caja, movs) {
  const t = totalesMovimientos(movs);
  return caja.fondoInicial + caja.ventasEfectivo + t.entradas - t.salidas;
}

// Positivo = sobra, negativo = falta
export const diferencia = (contado, esperado) => contado - esperado;

export function estadoDiferencia(dif) {
  if (dif === 0) return { clave: 'cuadra', texto: 'Cuadra' };
  if (dif > 0) return { clave: 'sobra', texto: 'Sobra' };
  return { clave: 'falta', texto: 'Falta' };
}
