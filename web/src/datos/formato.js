// Colones con formato de Costa Rica: ₡184.500 (punto como separador de miles)
export function colones(n) {
  const v = Math.round(Math.abs(n));
  const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}₡${s}`;
}
// Con signo explicito, para diferencias y netos: +₡1.500 / -₡1.500 / ₡0
export function colonesConSigno(n) {
  if (n === 0) return '₡0';
  return `${n > 0 ? '+' : ''}${colones(n)}`;
}
