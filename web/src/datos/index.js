// Punto unico donde se elige la fuente de datos, segun config.js.
// En modo 'supabase' la libreria (web/vendor/supabase-js.js) se carga solo si hace falta.
import { CONFIG } from './config.js';
import { crearDatosPrueba } from './prueba.js';

async function crear() {
  if (CONFIG.modo !== 'supabase') return crearDatosPrueba({ simular: typeof document !== 'undefined' });
  const { createClient } = await import('../../vendor/supabase-js.js');
  const { crearDatosSupabase } = await import('./supabase.js');
  const cliente = createClient(CONFIG.url, CONFIG.llave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const real = crearDatosSupabase({ cliente, modoAcceso: 'pin', urlAcceso: `${CONFIG.url}/functions/v1/dixi-acceso`, llave: CONFIG.llave });
  if (!CONFIG.ejemplo) return real;
  const { crearDatosMixto } = await import('./mixto.js'); // caja, ventas y cierres con datos de ejemplo; compras y bodega reales
  return crearDatosMixto(real);
}
export const datos = await crear();
