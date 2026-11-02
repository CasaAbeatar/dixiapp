// Punto unico donde se elige la fuente de datos.
// Para pasar a Supabase: importar crearDatosSupabase de './supabase.js' y exportar su resultado.
import { crearDatosPrueba } from './prueba.js';

export const datos = crearDatosPrueba();
