// Franja fija arriba cuando no hay internet: dice que se ven datos guardados y de que hora son.
const cinta = document.createElement('div');
cinta.id = 'sin-conexion'; cinta.setAttribute('role', 'status'); cinta.hidden = true;
document.body.appendChild(cinta);
const hora = (t) => (t ? new Date(t).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
addEventListener('dixiapp:conexion', (e) => {
  const d = e.detail || {};
  cinta.hidden = !d.sinConexion;
  cinta.textContent = d.sinConexion ? 'Sin conexión · ' + (d.ultima ? 'datos de ' + hora(d.ultima) : 'mostrando lo último guardado') : '';
});
