// Avisos en el telefono (notificaciones push web): permiso, suscripcion y deteccion de lo que el aparato permite.
const aBytes = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

// '' = se puede; si no, el motivo en una palabra clave
export function motivoNoDisponible() {
  if (esIOS() && !instalada()) return 'ios_sin_instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sin_soporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return '';
}
export async function suscripcionActual() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}
export async function crearSuscripcion(vapidPublica) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(vapidPublica) });
}
export const datosDe = (sub) => { const j = sub.toJSON(); return { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }; };
