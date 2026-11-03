// Configuracion de la fuente de datos. 'prueba' = datos ficticios sin conexion; 'supabase' = base real.
// La llave es la PUBLICABLE (segura para el cliente: la proteccion real esta en el RLS de la base).
// NUNCA poner aqui la llave service_role ni contrasenas.
export const CONFIG = {
  modo: 'supabase',
  // true: Inicio, Caja, Ventas y Cierres muestran datos de EJEMPLO (con etiqueta); Compras y Bodega siguen reales. Poner false cuando haya datos reales.
  ejemplo: true,
  url: 'https://dwlbcbtwdungyrykgahm.supabase.co',
  llave: 'sb_publishable_gUoYvCNka0je2rbNeWPpUA_l26vgQbO',
  // Llave PUBLICA de los avisos al telefono (la privada vive solo en el servidor)
  vapid: 'BK4luWGGj_3rBvLitnIhJxskdq7vxz7uExAMsVscYwUPD2OKrFbwQN9t0ag1oNO-8NBNbFpfD7WHKhycUCLgxWg',
};
