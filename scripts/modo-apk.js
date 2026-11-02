// Alterna el APK entre dos modos SIN editar nada a mano:
//   marco    la app carga https://dixiapp.dmalabomba.com (se actualiza sola al publicar la web; solo hay que reinstalar el APK si cambia el codigo nativo)
//   completo la web va empaquetada dentro del APK (funciona sin que el sitio este publicado; hay que recompilar para cada cambio)
// Uso: node scripts/modo-apk.js marco|completo|estado   (o npm run apk:marco / apk:completo / apk:estado)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'capacitor.config.json');
const modo = process.argv[2];
const actual = () => (JSON.parse(fs.readFileSync(destino, 'utf8')).server?.url ? 'marco' : 'completo');
if (modo === 'estado' || !modo) { console.log(`Modo actual del APK: ${actual()}`); process.exit(0); }
if (!['marco', 'completo'].includes(modo)) { console.error('Use: marco, completo o estado.'); process.exit(1); }
fs.copyFileSync(path.join(raiz, 'scripts', 'apk', `capacitor.${modo}.json`), destino);
console.log(`APK en modo ${modo}. Siguiente paso: npx cap sync android (ya lo hacen apk:marco y apk:completo).`);
