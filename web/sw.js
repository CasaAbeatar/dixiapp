// Service worker de Dixiapp: cachea SOLO la interfaz (archivos estaticos de esta lista).
// Nunca guarda datos de caja: cualquier otra peticion (por ejemplo Supabase) va directo a la red.
const VERSION = 'dixiapp-interfaz-v15';
const INTERFAZ = [
  './', './index.html', './estilos.css', './manifest.webmanifest',
  './src/app.js', './src/vistas.js', './src/vistas-compras.js', './src/vistas-inicio.js', './src/mensajes.js', './src/vistas-bodega.js', './src/bodega.js', './src/ui.js', './vendor/supabase-js.js',
  './src/datos/index.js', './src/datos/interfaz.js', './src/datos/prueba.js', './src/datos/prueba-bodega.js', './src/datos/supabase.js',
  './src/datos/config.js', './src/datos/minimos-sugeridos.js', './sin-conexion.html', './src/datos/compras-calc.js', './src/datos/calculos.js', './src/datos/fechas.js', './src/datos/formato.js',
  './fotos/entrada.jpg', './iconos/favicon.svg', './iconos/favicon-64.png', './favicon.ico', './fuentes/colon-400.woff2', './fuentes/colon-500.woff2', './fuentes/colon-600.woff2', './fuentes/colon-700.woff2', './fuentes/colon-800.woff2', './fuentes/figtree-400.woff2', './fuentes/figtree-600.woff2', './fuentes/figtree-700.woff2', './iconos/icono-180.png', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-maskable-512.png',
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
  e.respondWith(fetch(r).then((res) => { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); return res; }).catch(() => caches.match(r).then((c) => c || (r.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
