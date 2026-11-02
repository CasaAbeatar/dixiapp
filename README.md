# Dixiapp

App interna de Grupo DMA La Bomba (Soda La Bomba y Pollos La Bomba): **Caja**, **Compras** (facturas de proveedores) y **Bodega** (inventario). Solo para administradores; el rol `empleado` ya existe en la base pero hoy no se usa. Sin conexion configurada, funciona con **datos de prueba** ficticios en el navegador.

## Probarla

```
npm install
npm run servir        # http://127.0.0.1:8100   (PUERTO=xxxx para otro puerto)
npm test              # pruebas de datos y de la capa Supabase (con cliente falso, sin red)
npm run test:e2e      # flujo en navegador real (servidor en marcha; Playwright; NODE_PATH=/opt/npm-tools/node_modules)
npm run capturas      # capturas en capturas/ (telefono, tableta horizontal y vertical, escritorio)
```

Modo de prueba: PIN 1234 (administrador: caja, compras, bodega, cierres) y PIN 4321 (cajero de prueba: solo caja ciega). Instalable como PWA ("Instalar app").

## Que hace

- **Caja**: cualquier cajero abre y cierra caja; quien abre fija el fondo inicial (sin monto fijo) y queda guardado quien abrio y quien cerro. Entradas y salidas con motivo en texto libre mas sugerencias aprendidas. Los errores se corrigen con un **contramovimiento** (nunca se edita ni se borra). Se ve la actividad de cualquier fecha. **Cierre ciego**: un cajero nunca ve el esperado ni el sobrante, solo un aviso de faltante que debe confirmar. Las ventas por medio de pago salen del facturador (esquema `fact`), no se digitan.
- **Compras**: facturas recibidas de proveedores de Soda y Pollos. Tarjetas Hoy / Semana / Mes, ultimas facturas en tiempo real (detalle al tocar), grafico por dia, semana o mes (ejes rotulados, de izquierda a derecha en orden cronologico, barra = total con IVA, parte oscura = neto sin IVA), desglose por tipo de proveedor, clasificacion (la misma del inventario) y proveedor. Filtros por negocio y proveedor que se conservan al cambiar de pestana.
- **Bodega**: existencias por lugar (Bodega central, Local Soda, Local Pollos) con minimos, recibir facturas de proveedores con un toque, sacar (consumo, merma, devolucion) o pasar a otro lugar con botones de + y -, conteo fisico ciego con revision y ajustes, ajuste directo, y alertas de minimos y vencimientos. Ver `docs/bodega.md`.

## Conectar Supabase

La base ya esta lista (proyecto `dwlbcbtwdungyrykgahm`, esquema `dixi`). Para que la app use la base real:

1. `web/src/datos/config.js`: cambiar `modo: 'prueba'` a `modo: 'supabase'`. La URL y la llave **publicable** ya estan; nunca poner aqui la llave `service_role`.
2. **Exponer el esquema** (accion manual, una vez): Supabase > Settings > API > Exposed schemas > agregar `dixi` (y guardar). Sin esto el cliente no ve las tablas de caja ni de compras.
3. **Dar de alta a los administradores** (hoy `dixi.perfiles` esta vacio; la app no crea cuentas). Crear el usuario en Authentication (correo y contrasena) y luego, en el editor SQL:

```sql
insert into dixi.perfiles (id, nombre, rol) values ('<uuid del usuario en auth.users>', 'Nombre', 'administrador');
insert into dixi.perfil_negocios (perfil_id, negocio_id) values ('<uuid>', 'soda'), ('<uuid>', 'pollos');
```
   Para **Bodega**, esa misma cuenta debe ser tambien administradora del facturador (`fact.usuarios`, `admin = true`), porque Bodega llama a las funciones `public.fx_inv_*` del facturador, que exigen eso. Con una cuenta que no lo sea, Bodega muestra "no tiene acceso al inventario del facturador"; Caja y Compras siguen funcionando.
4. Recomendado: activar *Leaked password protection* en Authentication (el asesor de seguridad lo marca como advertencia del proyecto).
5. Si cambia la libreria: `npm run vendor` regenera `web/vendor/supabase-js.js` (version exacta 2.118.0, empaquetada en un solo archivo porque la app no usa bundler).

### Como entra la gente (decision de acceso)

Correo y contrasena de Supabase Auth, y despues un **PIN local por aparato** (4 a 6 digitos) para no escribir la clave cada vez. El PIN se guarda solo como hash PBKDF2-SHA256 (150.000 vueltas, con sal) en ese aparato; nunca viaja ni se guarda en claro, y solo sirve mientras hay una sesion valida. Cinco PIN errados borran el PIN y cierran la sesion local. La app se bloquea sola tras 5 minutos sin tocarla. Se descartaron: PIN como contrasena de Supabase (demasiado corto para internet), enlaces magicos (poco practico en una tableta compartida) y un servicio externo de identidad (costo y complejidad sin beneficio). La autorizacion nunca usa `user_metadata`: el rol y los negocios salen de `dixi.perfiles` y `dixi.perfil_negocios`, protegidos por RLS.

### Que se aplico en la base

Solo el esquema nuevo `dixi` (aditivo; no se toco `fact` ni ninguna tabla existente). SQL de referencia: `docs/esquema-dixi.sql` (caja) y `docs/esquema-dixi-compras.sql` (compras). Reversion completa: `docs/reversion-dixi.sql`. Pruebas de seguridad contra la base real, con usuarios de prueba que se eliminan solos (el bloque termina en un error a proposito para revertir): `tests/rls.sql` y `tests/rls-compras.sql`; se ejecutan en el editor SQL y el mensaje final dice `INFORME ok=N fallos=0`.

- Compras se llena cada minuto desde las facturas recibidas (`dixi.sincronizar_compras`, tarea `dixi-sincronizar-compras`), asi que una factura nueva tarda **hasta un minuto** en aparecer. La pantalla se actualiza sola por Realtime sobre la tabla `dixi.compras`.
- El tipo de proveedor se calcula por el grupo de inventario que mas se le compra y se puede corregir en `dixi.proveedores.tipo_manual`.
- Las facturas cuyo receptor no es la cedula de Soda o de Pollos no se muestran.

## Publicar y firmar (todo preparado, nada ejecutado)

- `docs/publicacion.md` y `scripts/publicar.sh`: GitHub Pages en dixiapp.dmalabomba.com (CNAME hacia casaabeatar.github.io). Falta el token y el DNS.
- `docs/firma-apk.md` y `scripts/crear-llave-firma.sh`: llave de firma cifrada, para ejecutar en la Mac de Emil. No existe todavia.
- APK marco o completo sin editar a mano: `npm run apk:marco`, `npm run apk:completo`, `npm run apk:estado`; firmado: `npm run apk:release`.
- `docs/cuentas-y-seguridad.md`: usuarios de Emil y su hermana, y ajustes de seguridad pendientes.

## Estructura

```
web/                       lo que se sirve y lo que empaqueta Capacitor
  index.html, estilos.css, manifest.webmanifest, sw.js, iconos/
  vendor/supabase-js.js    cliente de Supabase empaquetado (se carga solo en modo 'supabase')
  src/app.js               estado y eventos
  src/vistas.js            caja, cierres, acceso, mas
  src/vistas-compras.js    compras (tarjetas, lista, grafico, desglose)
  src/bodega.js, vistas-bodega.js   modulo Bodega (controlador y pantallas)
  src/datos/               capa de datos
    interfaz.js            contrato (metodos y tipos); un modulo nuevo = metodos nuevos aqui
    config.js              modo y llave publicable
    index.js               UNICO punto donde se elige prueba o supabase
    prueba.js, prueba-bodega.js   datos ficticios (localStorage)
    supabase.js            implementacion real (cliente inyectable para pruebas)
    calculos.js, compras-calc.js, fechas.js, formato.js
docs/                      esquema-dixi*.sql, reversion-dixi.sql, bodega.md, propuesta (obsoleta) esquema-supabase.sql
tests/                     datos.test.js, supabase.test.js, flujo.e2e.js, rls.sql, rls-compras.sql
scripts/                   servir, iconos, capturas, supabase-entrada.js, modo-apk.js, publicar.sh, crear-llave-firma.sh, apk/ (variantes marco y completo)
android/                   proyecto Capacitor (Android)
```

El service worker guarda en cache solo la interfaz (lista cerrada de archivos); los datos nunca se cachean.

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
