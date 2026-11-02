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
// Para ejes de graficos: ₡250 mil, ₡1,2 M
export function colonesCompacto(n) {
  const v = Math.abs(n), s = n < 0 ? '-' : '';
  const f = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (v >= 1e6) return `${s}₡${f(v / 1e6)} M`;
  if (v >= 1e3) return `${s}₡${f(v / 1e3)} mil`;
  return `${s}₡${Math.round(v)}`;
}
// Monto en su moneda original: ₡12.500 o $120,50
export function dinero(n, moneda = 'CRC') {
  if (moneda === 'CRC') return colones(n);
  const [e, d] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${moneda === 'USD' ? '$' : moneda + ' '}${e.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
}
