// Genera los iconos PNG a partir de un SVG propio (simbolo de colon dentro de un cuadrado azul). Usa Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'iconos');
fs.mkdirSync(dir, { recursive: true });
const glifo = (escala) => `<g transform="translate(256 256) scale(${escala}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round">
  <path d="M338 186 A104 104 0 1 0 338 326"/><path d="M214 118 L190 394"/><path d="M290 118 L266 394"/></g>`;
const svg = (redondo, escala, lado = 512) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${lado}" height="${lado}">
  <rect width="512" height="512" rx="${redondo ? 112 : 0}" fill="#2563eb"/>${glifo(escala)}</svg>`;
fs.writeFileSync(path.join(dir, 'icono.svg'), svg(true, 1));
const navegador = await chromium.launch(); const pagina = await navegador.newPage();
async function png(nombre, lado, redondo, escala) {
  await pagina.setViewportSize({ width: lado, height: lado });
  await pagina.setContent(`<body style="margin:0;background:transparent">${svg(redondo, escala, lado)}</body>`);
  await pagina.screenshot({ path: path.join(dir, nombre), omitBackground: true });
}
await png('icono-180.png', 180, false, 0.9);
await png('icono-192.png', 192, true, 1);
await png('icono-512.png', 512, true, 1);
await png('icono-maskable-512.png', 512, false, 0.72);
await navegador.close();
console.log('Iconos listos en', dir);
