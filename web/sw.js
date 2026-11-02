// Service worker de Dixiapp: cachea SOLO la interfaz (archivos estaticos de esta lista).
// Nunca guarda datos de caja: cualquier otra peticion (por ejemplo Supabase) va directo a la red.
const VERSION = 'dixiapp-interfaz-v1';
const INTERFAZ = [
  './', './index.html', './estilos.css', './manifest.webmanifest',
  './src/app.js', './src/vistas.js', './src/ui.js',
  './src/datos/index.js', './src/datos/interfaz.js', './src/datos/prueba.js', './src/datos/supabase.js',
  './src/datos/calculos.js', './src/datos/fechas.js', './src/datos/formato.js',
  './iconos/icono-180.png', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-maskable-512.png',
];
const permitidas = new Set(INTERFAZ.map((r) => new URL(r, self.location).pathname));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(INTERFAZ)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== self.location.origin || !permitidas.has(url.pathname)) return; // red directa
  // Primero la red (para ver cambios), y si no hay conexion, la copia de la interfaz
  e.respondWith(fetch(r).then((res) => { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); return res; }).catch(() => caches.match(r)));
});
