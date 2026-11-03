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
  const { conCopiaLocal } = await import('./copia-local.js'); // sin internet: lo ultimo visto (solo lectura)
  const avisar = (e) => { try { globalThis.dispatchEvent?.(new CustomEvent('dixiapp:conexion', { detail: e })); } catch { /* sin ventana */ } };
  const conCopia = conCopiaLocal(real, { avisar });
  if (typeof window !== 'undefined') { window.addEventListener('offline', () => avisar({ sinConexion: true, ultima: conCopia.copia.ultima })); window.addEventListener('online', () => avisar({ sinConexion: false, ultima: null })); }
  if (!CONFIG.ejemplo) return conCopia;
  const { crearDatosMixto } = await import('./mixto.js'); // caja, ventas y cierres con datos de ejemplo; compras y bodega reales
  return crearDatosMixto(conCopia);
}
export const datos = await crear();
