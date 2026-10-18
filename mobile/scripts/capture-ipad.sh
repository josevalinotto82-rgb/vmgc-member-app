#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ARTIFACTS="$PWD/build/ipad-screenshots"
mkdir -p "$ARTIFACTS"
# Elegir entre los dispositivos/runtimes instalados; no depender de un nombre de versión fijo.
xcrun simctl list devicetypes --json > "$ARTIFACTS/device-types.json"
xcrun simctl list runtimes --json > "$ARTIFACTS/runtimes.json"
DEVICE_TYPE=$(node -e 'const fs=require("fs");const types=JSON.parse(fs.readFileSync(process.argv[1])).devicetypes;const match=types.find(d=>/iPad Pro.*13-inch.*M4/i.test(d.name))||types.find(d=>/iPad Pro.*13-inch/i.test(d.name))||types.find(d=>/iPad Pro.*12\.9-inch/i.test(d.name));if(!match)throw Error("Falta un simulador de iPad Pro de 13 o 12.9 pulgadas");process.stdout.write(match.identifier);' "$ARTIFACTS/device-types.json")
RUNTIME=$(node -e 'const fs=require("fs");const list=JSON.parse(fs.readFileSync(process.argv[1])).runtimes.filter(r=>r.isAvailable&&/iOS/.test(r.name));list.sort((a,b)=>b.version.localeCompare(a.version,"en",{numeric:true}));if(!list.length)throw Error("No hay runtime iOS disponible");process.stdout.write(list[0].identifier);' "$ARTIFACTS/runtimes.json")
DEVICE=$(xcrun simctl create "VMGC-Capturas-iPad" "$DEVICE_TYPE" "$RUNTIME")
cleanup(){ xcrun simctl shutdown "$DEVICE" >/dev/null 2>&1 || true; xcrun simctl delete "$DEVICE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl status_bar "$DEVICE" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "platform=iOS Simulator,id=$DEVICE" -derivedDataPath build/ipad-simulator CODE_SIGNING_ALLOWED=NO build > "$ARTIFACTS/xcodebuild.log" 2>&1 || { tail -n 100 "$ARTIFACTS/xcodebuild.log"; exit 1; }
APP="$PWD/build/ipad-simulator/Build/Products/Debug-iphonesimulator/App.app"
BUNDLE='ar.com.villamariagolf.members'
xcrun simctl install "$DEVICE" "$APP"
DATA=$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data)
for SCENE in inicio perfil hcp; do
  READY="$DATA/Documents/store-capture-ready.json"
  rm -f "$READY"
  SIMCTL_CHILD_VMGC_CAPTURE_SCENE="$SCENE" xcrun simctl launch --terminate-running-process "$DEVICE" "$BUNDLE"
  node scripts/wait-store-capture.mjs "$READY" "$SCENE"
  # Un fotograma adicional permite que WKWebView termine de componer su superficie.
  sleep 2
  case "$SCENE" in inicio) NAME='01-inicio';; perfil) NAME='02-perfil-ejemplo';; hcp) NAME='03-handicap';; esac
  xcrun simctl io "$DEVICE" screenshot --type=png "$ARTIFACTS/$NAME.png"
  WIDTH=$(sips -g pixelWidth "$ARTIFACTS/$NAME.png" | awk '/pixelWidth/ { print $2 }')
  HEIGHT=$(sips -g pixelHeight "$ARTIFACTS/$NAME.png" | awk '/pixelHeight/ { print $2 }')
  if ! { [ "$WIDTH" = '2064' ] && [ "$HEIGHT" = '2752' ]; } && ! { [ "$WIDTH" = '2048' ] && [ "$HEIGHT" = '2732' ]; }; then
    echo "Tamaño inesperado de iPad: ${WIDTH}x${HEIGHT}"; exit 1
  fi
  # Quitar alpha sin redimensionar, mediante las herramientas nativas de macOS.
  sips -s format jpeg -s formatOptions 95 "$ARTIFACTS/$NAME.png" --out "$ARTIFACTS/$NAME.jpg" >/dev/null
  rm -f "$ARTIFACTS/$NAME.png"
done
printf 'Capturas reales del simulador iPad de 13 pulgadas. Datos ficticios. Subir los JPG numerados de 01 a 03 a App Store Connect.\n' > "$ARTIFACTS/LEEME.txt"
(cd "$ARTIFACTS" && zip -q Capturas-iPad-App-Store.zip 0*.jpg LEEME.txt)
echo "LISTO: build/ipad-screenshots/Capturas-iPad-App-Store.zip"
