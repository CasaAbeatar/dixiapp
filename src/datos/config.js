// Configuracion de la fuente de datos. 'prueba' = datos ficticios sin conexion; 'supabase' = base real.
// La llave es la PUBLICABLE (segura para el cliente: la proteccion real esta en el RLS de la base).
// NUNCA poner aqui la llave service_role ni contrasenas.
export const CONFIG = {
  modo: 'prueba',
  url: 'https://dwlbcbtwdungyrykgahm.supabase.co',
  llave: 'sb_publishable_gUoYvCNka0je2rbNeWPpUA_l26vgQbO',
};
