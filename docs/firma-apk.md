# Llave de firma del APK (Mac de Emil)

El APK que se instala en la tableta y se actualiza después tiene que estar firmado **siempre con la misma llave**. Si se pierde, no se puede actualizar la app instalada: hay que desinstalarla e instalarla de nuevo. Por eso la llave se crea una sola vez, en la Mac, y se guardan copias cifradas fuera de la tableta y fuera del repositorio.

**La llave no se ha generado todavía.** Este proyecto solo trae el script.

## 1. Crearla (una vez, en la Mac)

Requisitos: Java (viene con Android Studio) y `openssl` (ya está en la Mac).

```
cd dixiapp
scripts/crear-llave-firma.sh
```

El script:
- crea la llave RSA de 4096 bits y una contraseña larga al azar,
- guarda todo en `~/DixiappLlave/` (fuera del repositorio, permisos solo para su usuario),
- le pide una **frase** y hace una copia cifrada con AES-256: `dixiapp-llave-respaldo.enc`,
- escribe `android/keystore.properties` (ignorado por git) para que `npm run apk:release` firme solo,
- no sube nada a internet y no muestra la contraseña en pantalla.

Si ya existe una llave en esa carpeta, no la toca.

## 2. Copias (esto es lo que protege la app)

1. Copie `dixiapp-llave-respaldo.enc` a **dos lugares distintos**, fuera de la tableta y del repositorio: por ejemplo una memoria USB guardada en un cajón y un almacenamiento en la nube privado.
2. Guarde la **frase** de cifrado en su gestor de contraseñas (nunca junto al archivo).
3. Compruebe que se puede descifrar antes de borrar nada:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in dixiapp-llave-respaldo.enc | tar -tf -`
   debe listar `dixiapp-release.jks` y `contrasena.txt`.
4. Borre `~/DixiappLlave/contrasena.txt`. El `.jks` y `android/keystore.properties` se quedan en la Mac para compilar.
5. Anote la huella (`~/DixiappLlave/huella-sha256.txt`): sirve para verificar después que un APK lo firmó usted.

Nunca: subir el `.jks`, el `.enc` con su frase, ni `keystore.properties` al repositorio, a un correo o a un chat. El `.gitignore` ya excluye `*.jks`, `*.keystore` y `keystore.properties`.

## 3. Compilar el APK firmado

```
npm run apk:marco        # APK «marco»: carga https://dixiapp.dmalabomba.com (recomendado)
npm run apk:release      # sincroniza y compila app-release.apk y el bundle .aab, firmados
```
Salida: `android/app/build/outputs/apk/release/app-release.apk`. Instalar en la tableta: copiar el archivo y abrirlo (permitir «instalar apps de origen desconocido» solo para ese gestor de archivos), o `adb install app-release.apk`.

Si desea el APK con la web dentro (no depende del sitio): `npm run apk:completo && npm run apk:release`. El estado actual: `npm run apk:estado`.

## Marco o completo

| | Marco (por defecto) | Completo |
|---|---|---|
| Dónde está la web | en dixiapp.dmalabomba.com | dentro del APK |
| Un cambio en la web | llega solo al publicar | exige compilar e instalar otro APK |
| Sin internet | pantalla «No hay conexión» con botón de reintentar | abre, pero la caja y la bodega necesitan internet igual |
| Requiere | el sitio publicado (docs/publicacion.md) | nada |

`capacitor.config.json` lo escribe el script a partir de `scripts/apk/capacitor.marco.json` o `capacitor.completo.json`; no se edita a mano.

## Si algún día se quiere publicar en Google Play

Play pide el `.aab` y su propia llave de subida; con «Play App Signing» la llave de firma final la guarda Google. Esa decisión se toma entonces; para uso interno basta el APK firmado de arriba.
