// Utilidades de interfaz: escape de texto y lectura de montos.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "184.500", "184500", "₡ 184 500" -> 184500 (entero) ; vacio -> null
export function leerMonto(texto) {
  const limpio = String(texto ?? '').replace(/\D/g, '');
  return limpio === '' ? null : parseInt(limpio, 10);
}
export function aplicarTema(tema) {
  const r = document.documentElement;
  if (tema === 'claro' || tema === 'oscuro') r.setAttribute('data-tema', tema); else r.removeAttribute('data-tema');
}
