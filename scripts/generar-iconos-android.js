// Genera los iconos y las pantallas de arranque de Android a partir del mismo simbolo de colon de la PWA.
// Usa Playwright (ya usado en generar-iconos.js). Sin costo. Escribe en android/app/src/main/res.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const res = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'res');
const AZUL = '#2563eb';
const glifo = (escala) => `<g transform="translate(256 256) scale(${escala}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round">
  <path d="M338 186 A104 104 0 1 0 338 326"/><path d="M214 118 L190 394"/><path d="M290 118 L266 394"/></g>`;
// forma: 'cuadro' (esquinas redondeadas), 'circulo', 'ninguna' (solo simbolo sobre transparente, para la capa frontal adaptable)
const svg = (forma, escala, lado) => {
  const fondo = forma === 'circulo' ? `<circle cx="256" cy="256" r="256" fill="${AZUL}"/>`
    : forma === 'cuadro' ? `<rect width="512" height="512" rx="112" fill="${AZUL}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${lado}" height="${lado}">${fondo}${glifo(escala)}</svg>`;
};
const densidades = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
const navegador = await chromium.launch(); const pagina = await navegador.newPage();
async function png(ruta, ancho, alto, html) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.setContent(`<body style="margin:0;background:transparent">${html}</body>`);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  await pagina.screenshot({ path: ruta, omitBackground: true });
}
for (const [d, [lado, adaptable]] of Object.entries(densidades)) {
  const dir = path.join(res, `mipmap-${d}`);
  await png(path.join(dir, 'ic_launcher.png'), lado, lado, svg('cuadro', 1, lado));
  await png(path.join(dir, 'ic_launcher_round.png'), lado, lado, svg('circulo', 0.92, lado));
  // capa frontal adaptable: lienzo de 108 dp, simbolo dentro de la zona segura (66 dp)
  await png(path.join(dir, 'ic_launcher_foreground.png'), adaptable, adaptable, svg('ninguna', 0.9, adaptable));
}
// Pantallas de arranque: fondo blanco (igual a backgroundColor) con el icono al centro. Se conservan las medidas existentes.
const medidas = { 'drawable': [480, 320] };
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const f = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }[d];
  medidas[`drawable-port-${d}`] = [Math.round(320 * f), Math.round(480 * f)];
  medidas[`drawable-land-${d}`] = [Math.round(480 * f), Math.round(320 * f)];
}
for (const [carpeta, [ancho, alto]] of Object.entries(medidas)) {
  const lado = Math.round(Math.min(ancho, alto) * 0.28);
  const html = `<div style="width:${ancho}px;height:${alto}px;background:#fff;display:flex;align-items:center;justify-content:center">${svg('cuadro', 1, lado)}</div>`;
  await png(path.join(res, carpeta, 'splash.png'), ancho, alto, html);
}
await navegador.close();
console.log('Iconos y pantallas de arranque de Android listos en', res);
