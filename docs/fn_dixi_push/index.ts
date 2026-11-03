// Dixiapp: envia los avisos al telefono (notificaciones push web). Lo llama pg_cron cada minuto cuando hay avisos pendientes.
// Seguridad: encabezado x-fact-secreto (el mismo secreto de envio del facturador), comparado en tiempo constante. Sin JWT.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const iguales = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!, llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, llave, { db: { schema: 'dixi' }, auth: { persistSession: false } });
  const { data: sec } = await db.rpc('push_secretos');
  const esperado = typeof sec?.envio === 'string' ? sec.envio : '';
  if (!esperado || !iguales(req.headers.get('x-fact-secreto') ?? '', esperado)) return new Response('no autorizado', { status: 401 });
  const vp = sec?.vapid;
  if (!vp?.pub || !vp?.priv) return new Response('faltan las llaves de avisos', { status: 500 });
  webpush.setVapidDetails(vp.sujeto ?? 'mailto:emilmartinez@outlook.com', vp.pub, vp.priv);
  const { data: avisos, error } = await db.rpc('push_tomar');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let enviados = 0;
  for (const a of avisos ?? []) {
    let ok = 0; const muertos: string[] = [];
    const carga = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tipo: a.tipo });
    for (const d of a.destinos) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, carga, { TTL: 60 * 60 * 12, urgency: 'high' });
        ok++;
      } catch (e) {
        const s = (e as { statusCode?: number }).statusCode;
        if (s === 404 || s === 410) muertos.push(d.id);
      }
    }
    await db.rpc('push_resultado', { p_id: a.id, p_ok: ok, p_muertos: muertos });
    enviados += ok;
  }
  return new Response(JSON.stringify({ avisos: (avisos ?? []).length, enviados }), { headers: { 'Content-Type': 'application/json' } });
});
