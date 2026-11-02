// Fechas locales como texto AAAA-MM-DD (sin zona horaria) y formato de Costa Rica.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

const dos = (n) => String(n).padStart(2, '0');
export const aTexto = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const deTexto = (t) => { const [a, m, d] = t.split('-').map(Number); return new Date(a, m - 1, d, 12); };
export const sumarDias = (t, n) => { const d = deTexto(t); d.setDate(d.getDate() + n); return aTexto(d); };
export const horaTexto = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;

export const fechaLarga = (t) => { const d = deTexto(t); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
export const diaCorto = (t) => { const d = deTexto(t); return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}`; };

// "14:05" -> "2:05 p. m."
export function horaLegible(h) {
  if (!h) return '';
  const [H, M] = h.split(':').map(Number);
  const suf = H < 12 ? 'a. m.' : 'p. m.';
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}:${dos(M)} ${suf}`;
}

// Lunes de la semana de la fecha dada
export function lunesDe(t) {
  const d = deTexto(t);
  const atras = (d.getDay() + 6) % 7;
  return sumarDias(t, -atras);
}
// Fechas de la semana en orden cronologico: del lunes hasta hoy
export function diasDeLaSemana(hoy) {
  const out = []; let f = lunesDe(hoy);
  while (f <= hoy) { out.push(f); f = sumarDias(f, 1); }
  return out;
}
