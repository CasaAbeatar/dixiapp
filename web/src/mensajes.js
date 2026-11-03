// Mensajes del inicio (aprobados por Emil). Un mensaje por dia; el tema cambia cada dia.
// Orden mezclado y fijo: nunca dos temas seguidos iguales (tampoco al volver a empezar).
export const CATEGORIAS = [
 {
  "id": 0,
  "nombre": "Tu camino",
  "mensajes": [
   "Saliste de la zona de confort y creaste esto. Hoy lo sigues sosteniendo.",
   "Catorce años de decisiones tuyas. Cada una está en lo que ves hoy.",
   "Lo que empezó con una idea hoy tiene tres negocios y un equipo.",
   "Nadie te regaló esto. Lo construiste tú.",
   "Tu olfato para los negocios te trajo hasta aquí.",
   "Abriste cuando muchos dudaban. Hoy hay mesas llenas gracias a eso.",
   "Mira hacia atrás un momento: llegaste lejos.",
   "Una dueña que decide con criterio. Eso se nota en todo."
  ]
 },
 {
  "id": 1,
  "nombre": "Tu equipo y sus familias",
  "mensajes": [
   "Más de 35 empleos directos. Detrás de cada uno hay una familia que cuenta contigo.",
   "Cada turno que cubres, cada sueldo que pagas, sostiene un hogar.",
   "Tu trabajo llega a muchas más casas de las que ves.",
   "Un buen equipo se nota en los detalles. El tuyo lleva años contigo.",
   "Dar trabajo es una de las formas más grandes de generar bienestar.",
   "Hoy 35 familias pueden contar con tu negocio."
  ]
 },
 {
  "id": 2,
  "nombre": "Tu familia y lo que dejas",
  "mensajes": [
   "Lo que levantas hoy también es para tus nietos.",
   "Tu nieto crece viendo a una abuela que construye.",
   "Un negocio bien llevado es una herencia que se siente.",
   "Lo que haces hoy les va a servir a quienes vienen detrás.",
   "Tu hermano está contigo en esto.",
   "No estás sola en esto: tu hermano está contigo."
  ]
 },
 {
  "id": 3,
  "nombre": "Decidir con criterio",
  "mensajes": [
   "Cada decisión de hoy cuida lo que construiste y a quienes viven de ello.",
   "Decidir con información es decidir con tranquilidad.",
   "No decides a ciegas: decides con datos y con experiencia.",
   "Las buenas decisiones se toman con calma. Hoy tienes todo a la vista.",
   "Tienes más claridad hoy que ayer, porque la información está a la mano."
  ]
 },
 {
  "id": 4,
  "nombre": "Crecer",
  "mensajes": [
   "Salir de la zona de confort ya lo hiciste una vez. Sabes cómo se hace.",
   "Cada negocio tuyo empezó con una decisión que otros no se animaron a tomar.",
   "Lo mejor de crecer es que lo decides tú, y a tu ritmo."
  ]
 },
 {
  "id": 5,
  "nombre": "Viajes y sueños",
  "mensajes": [
   "Los sueños también se planifican. ¿Ya elegiste el próximo destino?",
   "Trabajar bien hoy es ganar tiempo para recorrer el mundo mañana.",
   "Un viaje también es una meta. Ponle fecha.",
   "Mereces conocer los lugares que te gustan.",
   "El mundo es grande y tú ya demostraste que puedes con cosas grandes."
  ]
 },
 {
  "id": 6,
  "nombre": "Gestión",
  "mensajes": [
   "Un buen proveedor se cuida: compara de vez en cuando, pero valora a quien cumple.",
   "Lo que se mide se mejora. Hoy tienes los números al día.",
   "Las sorpresas se evitan mirando las cifras pronto, no a fin de mes.",
   "Revisar la bodega con frecuencia ahorra más que cualquier descuento."
  ]
 },
 {
  "id": 7,
  "nombre": "Cada día",
  "mensajes": [
   "Hoy es un buen día para cuidar lo que construiste.",
   "Empieza por lo que más te importa, lo demás se acomoda.",
   "Respira. Lo importante ya está en marcha.",
   "Que la jornada te encuentre con ganas y con tiempo.",
   "Hoy puedes cerrar el día con la tranquilidad de haber decidido bien."
  ]
 }
];

function construirOrden() {
  const resto = CATEGORIAS.map((c) => c.mensajes.length);
  const usados = CATEGORIAS.map(() => 0);
  const total = resto.reduce((a, b) => a + b, 0);
  const orden = [];
  let ultima = -1;
  for (let n = 0; n < total; n++) {
    let mejor = -1, mejorV = -1;
    CATEGORIAS.forEach((c, i) => {
      if (i === ultima || resto[i] === 0) return;
      const v = resto[i] / c.mensajes.length;
      if (v > mejorV + 1e-9 || (Math.abs(v - mejorV) < 1e-9 && c.mensajes.length > CATEGORIAS[mejor].mensajes.length)) { mejor = i; mejorV = v; }
    });
    orden.push({ categoria: CATEGORIAS[mejor].nombre, texto: CATEGORIAS[mejor].mensajes[usados[mejor]++] });
    resto[mejor]--; ultima = mejor;
  }
  // Costura: que el ultimo no repita el tema del primero (al volver a empezar)
  const n = orden.length, c = (k) => orden[((k % n) + n) % n].categoria;
  if (c(n - 1) === c(0)) {
    for (let j = 1; j < n - 2; j++) {
      const ok = c(j) !== c(0) && c(j - 1) !== c(n - 1) && c(j + 1) !== c(n - 1) && c(n - 2) !== c(j) && c(n - 1 + 0) !== c(j);
      if (ok) { [orden[j], orden[n - 1]] = [orden[n - 1], orden[j]]; break; }
    }
  }
  return orden;
}

export const ORDEN = construirOrden();

// Dia local -> numero de dia (sin horas, para que no cambie con la zona horaria)
export function numeroDeDia(fecha = new Date()) {
  return Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86400000);
}

export function mensajeDelDia(fecha = new Date()) {
  return ORDEN[((numeroDeDia(fecha) % ORDEN.length) + ORDEN.length) % ORDEN.length];
}
