#!/bin/sh
set -eu

export DISPLAY=:99
profile=${LUSTRE_BROWSER_PROFILE:-/data/browser-profile}
mkdir -p "$profile"
Xvfb :99 -screen 0 1440x900x24 -nolisten tcp &
browser=$(node -e "const { chromium } = require('playwright'); process.stdout.write(chromium.executablePath())")
"$browser" --no-sandbox --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="$profile" --no-first-run about:blank &
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw &
websockify --web /usr/share/novnc 6080 127.0.0.1:5900 &
exec npm run start
