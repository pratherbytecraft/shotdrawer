#!/bin/sh
# Builds assets/Shotdrawer.icns from design/app-icon.svg and the menu bar
# glyph assets/trayTemplate.png (and @2x) from design/tray.svg. Run from the
# repo root. Chrome draws each SVG large, sips makes the smaller sizes and
# iconutil packs the app icon.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
SET="$TMP/Shotdrawer.iconset"
mkdir -p "$SET"

draw() { # svg, size, out
  printf '<html><body style="margin:0;background:transparent"><img src="%s" width="%s" height="%s"></body></html>' "file://$PWD/$1" "$2" "$2" > "$TMP/draw.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 \
    --allow-file-access-from-files --window-size="$2,$2" --screenshot="$3" "file://$TMP/draw.html" >/dev/null 2>&1
}

draw design/app-icon.svg 1024 "$TMP/1024.png"
for n in 16 32 128 256 512; do
  sips -z $n $n "$TMP/1024.png" --out "$SET/icon_${n}x${n}.png" >/dev/null
  d=$((n * 2))
  sips -z $d $d "$TMP/1024.png" --out "$SET/icon_${n}x${n}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o assets/Shotdrawer.icns

draw design/tray.svg 360 "$TMP/tray.png"
sips -z 18 18 "$TMP/tray.png" --out assets/trayTemplate.png >/dev/null
sips -z 36 36 "$TMP/tray.png" --out assets/trayTemplate@2x.png >/dev/null

rm -rf "$TMP"
echo "assets/Shotdrawer.icns assets/trayTemplate.png assets/trayTemplate@2x.png"
