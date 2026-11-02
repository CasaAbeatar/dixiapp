// Implementacion VACIA lista para Supabase. No se conecta a nada.
// Para activarla: completar cada metodo con supabase-js (ver docs/esquema-supabase.sql y el README)
// y cambiar la importacion en index.js.
import { METODOS, validarImplementacion } from './interfaz.js';

export function crearDatosSupabase(/* { url, claveAnonima } */) {
  const pendiente = (nombre) => async () => {
    throw new Error(`Supabase aun no esta conectado (${nombre}). Ver README, seccion "Conectar Supabase".`);
  };
  const obj = {};
  for (const m of METODOS) obj[m] = pendiente(m);
  return validarImplementacion(obj);
}
