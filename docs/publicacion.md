# Publicar Dixiapp en dixiapp.dmalabomba.com (GitHub Pages)

Nada de esto se ha ejecutado: falta un token de GitHub y acceso al DNS. Todo está preparado para correr en unos minutos.

## Lo que ya está en el repositorio
- `web/CNAME` con `dixiapp.dmalabomba.com` y `web/.nojekyll`.
- `.github/workflows/pages.yml`: cada cambio en `web/` de la rama `main` corre las pruebas y publica la carpeta `web/`.
- `scripts/publicar.sh`: crea el repositorio, sube el código, activa Pages y el dominio. Sin `--ejecutar` solo muestra lo que haría.
- PWA: manifest con `id`, iconos 192/512/maskable, service worker que guarda solo la interfaz (los datos nunca) y vuelve a `index.html` sin conexión, política de contenido (CSP) que solo permite hablar con Supabase.

## Pasos
1. **Antes de publicar, apuntar a la base real.** En `web/src/datos/config.js` cambiar `modo: 'prueba'` por `modo: 'supabase'` y hacer commit. Si no, el sitio muestra datos ficticios.
2. **Exponer el esquema `dixi`** (una vez, desde el panel de Supabase: Settings > API > Exposed schemas > agregar `dixi`). Es una acción de su cuenta; sin ella Caja y Compras no ven sus tablas. Bodega no la necesita (usa funciones `public`).
3. **Token de GitHub** (cuenta o organización `casaabeatar`): fine-grained sobre el repositorio con Administration, Contents, Pages y Workflows en lectura y escritura (o clásico con `repo` y `workflow`).
4. **Ejecutar:**
   ```
   GH_TOKEN=ghp_... scripts/publicar.sh --ejecutar
   ```
   El repositorio queda público (GitHub Pages gratis lo exige); no hay secretos en el código, solo la llave *publicable* de Supabase, pensada para ser pública. Si prefiere repositorio privado, hace falta un plan de GitHub que permita Pages en privados.
5. **DNS** (quien administre dmalabomba.com): crear el registro `CNAME` de `dixiapp` hacia `casaabeatar.github.io`. No lleva `https://` ni punto final raro; solo ese nombre. Propaga en minutos.
6. **HTTPS:** cuando GitHub emite el certificado (hasta unos 30 minutos tras el DNS), el último paso del script activa «Enforce HTTPS». Si el script ya pasó, se activa en Settings > Pages.
7. **Comprobar:** `https://dixiapp.dmalabomba.com` abre la pantalla de acceso; en la tableta, el menú del navegador ofrece «Instalar app».

## Después
- Compilar el APK marco (`npm run apk:marco && npm run apk:release`, ver `docs/firma-apk.md`). Se instala una vez; la web se actualiza sola.
- El service worker se actualiza al abrir la app con internet (primero red, luego copia guardada).
- Para volver atrás un cambio: revertir el commit en `main`; el flujo vuelve a publicar.
