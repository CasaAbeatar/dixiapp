#!/usr/bin/env bash
# Publica Dixiapp en GitHub Pages (https://dixiapp.dmalabomba.com). LISTO PARA EJECUTAR cuando haya token; hoy NO se ha ejecutado.
# Guia: docs/publicacion.md. Por defecto solo SIMULA (muestra lo que haria). Para hacerlo de verdad:  GH_TOKEN=... scripts/publicar.sh --ejecutar
# El token necesita (fine-grained) sobre el repositorio: Administration, Contents, Pages y Workflows en lectura y escritura; o un token clasico con repo + workflow.
set -euo pipefail
DUENO="${DIXIAPP_DUENO:-casaabeatar}"; REPO="${DIXIAPP_REPO:-dixiapp}"; DOMINIO="dixiapp.dmalabomba.com"
EJECUTAR=0; [ "${1:-}" = "--ejecutar" ] && EJECUTAR=1
cd "$(cd "$(dirname "$0")/.." && pwd)"
paso() { echo "-> $*"; }
correr() { if [ "$EJECUTAR" = 1 ]; then "$@"; else echo "   (simulado) $*"; fi; }

[ -n "${GH_TOKEN:-}" ] || { [ "$EJECUTAR" = 0 ] || { echo "Falta GH_TOKEN."; exit 1; }; }
paso "1. Pruebas locales"; npm test >/dev/null && echo "   pruebas de datos: ok"
paso "2. La web debe apuntar a la base real (config.js modo 'supabase')"
grep -q "modo: 'supabase'" web/src/datos/config.js || { echo "   AVISO: config.js sigue en modo 'prueba'. Cambie a modo: 'supabase' (y haga commit) antes de publicar, o el sitio mostrará datos de prueba."; [ "$EJECUTAR" = 0 ] || exit 1; }
paso "3. Repositorio $DUENO/$REPO (público: Pages gratis lo exige; el código no lleva secretos, solo la llave publicable)"
correr gh repo create "$DUENO/$REPO" --public --description "Dixiapp: caja, compras y bodega de Grupo DMA La Bomba" || true
paso "4. Subir el código"
correr git remote add origin "https://github.com/$DUENO/$REPO.git" 2>/dev/null || true
correr git branch -M main
correr git push -u origin main
paso "5. Activar Pages con el flujo de Actions y el dominio propio"
correr gh api -X POST "repos/$DUENO/$REPO/pages" -f build_type=workflow || correr gh api -X PUT "repos/$DUENO/$REPO/pages" -f build_type=workflow
correr gh api -X PUT "repos/$DUENO/$REPO/pages" -f cname="$DOMINIO"
paso "6. DNS (lo hace quien administra dmalabomba.com): registro CNAME  dixiapp  ->  $DUENO.github.io"
echo "   Cuando GitHub emita el certificado (unos minutos, el DNS ya debe apuntar):"
correr gh api -X PUT "repos/$DUENO/$REPO/pages" -F https_enforced=true
paso "7. Comprobar"; echo "   curl -sI https://$DOMINIO | head -1   (debe decir 200)"
