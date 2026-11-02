# Dixiapp

App interna de caja de Grupo DMA La Bomba. Primera version: **solo datos de prueba** (ficticios, en el navegador). No se conecta a Supabase ni a ningun servicio real.

## Probarla

```
npm install
npm run servir        # http://127.0.0.1:8100   (PUERTO=xxxx para otro puerto)
npm test              # pruebas de la capa de datos
npm run test:e2e      # flujo en navegador real (con el servidor en marcha; usa Playwright)
npm run capturas      # capturas en capturas/
```

PIN de prueba: gerente 1234 (ve todo), empleada 4321 (solo caja de hoy y registrar movimientos).
Instalable como PWA desde Chrome (Android o escritorio): "Instalar app".

## Estructura

```
web/                   lo que se sirve y lo que empaqueta Capacitor
  index.html, estilos.css, manifest.webmanifest, sw.js, iconos/
  src/app.js           estado y eventos
  src/vistas.js        pantallas (HTML)
  src/ui.js            utilidades
  src/datos/           capa de datos
    interfaz.js        contrato (metodos y tipos)
    prueba.js          implementacion de prueba (localStorage)
    supabase.js        implementacion vacia lista para Supabase
    index.js           UNICO punto donde se elige cual se usa
    calculos.js, fechas.js, formato.js
docs/esquema-supabase.sql   esquema propuesto (NO ejecutado)
tests/                 datos.test.js (unitarias) y flujo.e2e.js (navegador)
scripts/               servir, iconos, capturas
android/               proyecto Capacitor (Android)
.github/workflows/apk.yml   compila el APK en GitHub Actions
```

El service worker guarda en cache solo la interfaz (lista cerrada de archivos). Cualquier otra peticion va directo a la red; los datos de caja nunca se cachean.

## Compilar el APK de depuracion

Requisitos: Node 22, Java 21, Android SDK (plataforma 36). Versiones del proyecto: Android Gradle Plugin 8.13.0, Gradle 8.14.3, compileSdk y targetSdk 36, minSdk 23, Capacitor 7.

```
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```
Resultado: `android/app/build/outputs/apk/debug/app-debug.apk`. Instalarlo en la tableta: copiar el archivo y abrirlo (permitir instalar de origen desconocido), o con `adb install app-debug.apk`.

Sin Android SDK local: subir el proyecto a un repositorio de GitHub y ejecutar el flujo "Compilar APK de depuracion" (pestaña Actions, boton Run workflow). El APK queda como artefacto descargable.

Icono de Android: ya es el de Dixiapp (simbolo de colon sobre azul), generado con `npm run iconos:android` a partir del mismo dibujo de la PWA. Nota: `npx cap sync` vuelve a escribir `android/capacitor-cordova-android-plugins/build.gradle` con el plugin 8.7.2 de la plantilla; es inofensivo, pero si se quiere uniformidad se vuelve a poner 8.13.0.

## Llave de firma (version de produccion)

**No hay ninguna llave en este proyecto.** El APK de depuracion se firma con la llave de depuracion automatica de Android, que no sirve para distribuir.

Para una version firmada (por unica vez, en un computador de confianza):
```
keytool -genkeypair -v -keystore dixiapp-release.jks -alias dixiapp -keyalg RSA -keysize 4096 -validity 10000
```
Custodia:
1. Elegir una contraseña larga y guardarla en un gestor de contraseñas, no en el repositorio.
2. Cifrar el archivo `.jks` (por ejemplo `gpg --symmetric --cipher-algo AES256 dixiapp-release.jks`) y guardar **dos copias del cifrado** en dos lugares distintos fuera del repositorio y fuera de la tableta (por ejemplo una memoria USB guardada y un almacenamiento en la nube privado).
3. Nunca subir el `.jks` ni la contraseña al repositorio (el `.gitignore` ya excluye `*.jks`, `*.keystore` y `keystore.properties`).
4. Si la llave se pierde, no se pueden publicar actualizaciones sobre la misma instalacion: hay que desinstalar y reinstalar.
5. Para firmar en GitHub Actions, guardar el `.jks` en base64 y las contraseñas como Secrets del repositorio, y agregar un paso `assembleRelease` con firma.

## Conectar Supabase (cuando se decida)

1. Crear un proyecto de Supabase propio de Dixiapp y revisar `docs/esquema-supabase.sql`; ajustarlo y aplicarlo como migracion.
2. Resolver como se inicia sesion con PIN (ver nota 1 del SQL) y crear los usuarios y sus negocios.
3. Completar cada metodo de `web/src/datos/supabase.js` (ver `interfaz.js`) con `@supabase/supabase-js`, usando solo la clave publica (anon); la seguridad la da RLS.
4. En `web/src/datos/index.js`, exportar `crearDatosSupabase(...)` en lugar de `crearDatosPrueba()`.
5. Agregar el dominio de Supabase a la lista de conexiones permitidas si se agrega una politica CSP. El service worker ya lo deja pasar sin cachear.
6. Repetir `npm test` y `npm run test:e2e` contra un proyecto de pruebas.
