#!/usr/bin/env bash
# Crea la LLAVE DE FIRMA del APK de Dixiapp. Ejecutar UNA SOLA VEZ, en la Mac de Emil (no en la tableta, no en un servidor).
# Guia completa: docs/firma-apk.md
#
# Que hace:
#   1. Genera una llave RSA de 4096 bits (validez 10.000 dias) y una contrasena larga al azar.
#   2. Guarda todo en ~/DixiappLlave/ (fuera del repositorio) con permisos solo para su usuario.
#   3. Hace una copia CIFRADA (AES-256, con una frase que usted escribe) lista para llevar a otros dos lugares.
#   4. Escribe android/keystore.properties (ignorado por git) para que `npm run apk:release` firme solo.
# No sube nada a internet y no imprime la contrasena en pantalla: queda en el archivo de respaldo.
set -euo pipefail

DESTINO="${DIXIAPP_LLAVE_DIR:-$HOME/DixiappLlave}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS="dixiapp"

case "$DESTINO/" in "$REPO"/*) echo "ERROR: la carpeta de la llave no puede estar dentro del repositorio ($REPO)."; exit 1;; esac
[ "$(uname -s)" = "Darwin" ] || echo "Aviso: esto se pensó para la Mac; en otro sistema funciona igual si hay keytool y openssl."
command -v keytool >/dev/null || { echo "Falta keytool (viene con Java). En la Mac: instale Android Studio (trae Java) o ejecute: brew install openjdk@21"; exit 1; }
command -v openssl >/dev/null || { echo "Falta openssl."; exit 1; }
if [ -e "$DESTINO/dixiapp-release.jks" ]; then echo "Ya existe una llave en $DESTINO. NO se sobrescribe (perderla o cambiarla impide actualizar la app). Revise esa carpeta."; exit 1; fi

mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
CLAVE="$(openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40)"
echo "Datos del certificado (solo informativos; pueden dejarse como están):"
keytool -genkeypair -v -keystore "$DESTINO/dixiapp-release.jks" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$CLAVE" -keypass "$CLAVE" -dname "CN=Dixiapp, OU=Grupo DMA La Bomba, O=Corporacion DMA Costa Rica SRL, L=Horquetas de Sarapiqui, C=CR" >/dev/null
chmod 600 "$DESTINO/dixiapp-release.jks"

umask 077
printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' "$DESTINO/dixiapp-release.jks" "$CLAVE" "$ALIAS" "$CLAVE" > "$REPO/android/keystore.properties"
printf 'LLAVE DE FIRMA DE DIXIAPP\nArchivo: dixiapp-release.jks\nAlias: %s\nContraseña (almacén y llave): %s\n' "$ALIAS" "$CLAVE" > "$DESTINO/contrasena.txt"

echo
echo "Ahora escriba una FRASE para cifrar la copia de respaldo (la pedirá dos veces). Guárdela en su gestor de contraseñas."
tar -C "$DESTINO" -cf - dixiapp-release.jks contrasena.txt | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -out "$DESTINO/dixiapp-llave-respaldo.enc"
chmod 600 "$DESTINO/dixiapp-llave-respaldo.enc"
SHA="$(keytool -list -v -keystore "$DESTINO/dixiapp-release.jks" -alias "$ALIAS" -storepass "$CLAVE" 2>/dev/null | grep 'SHA256:' | head -1 | sed 's/^ *//')"
printf '%s\n' "$SHA" > "$DESTINO/huella-sha256.txt"

cat <<TXT

LISTO. Se creó en $DESTINO:
  dixiapp-release.jks            la llave (NO salir de su Mac sin cifrar)
  contrasena.txt                 la contraseña (bórrela cuando termine el paso 2)
  dixiapp-llave-respaldo.enc     copia cifrada con su frase: ESTA es la que se guarda fuera
  huella-sha256.txt              $SHA

SIGUIENTE (docs/firma-apk.md, sección "Copias"):
  1. Copie dixiapp-llave-respaldo.enc a DOS lugares distintos fuera de la tableta y fuera del repositorio
     (por ejemplo una memoria USB guardada y un almacenamiento en la nube privado).
  2. Guarde la FRASE de cifrado en el gestor de contraseñas. Compruebe que puede descifrar:
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in dixiapp-llave-respaldo.enc | tar -tf -
  3. Después de comprobarlo, borre contrasena.txt (la contraseña ya está en el respaldo cifrado y en android/keystore.properties).
  4. Compile el APK firmado:  npm run apk:marco && npm run apk:release
TXT
