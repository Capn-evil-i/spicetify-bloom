#!/usr/bin/env bash
# Restart Spotify with the DevTools port open so compat/tools/cdp.mjs can reach it.
# The occlusion flags keep it rendering while it sits behind other windows.
# Check that nothing is playing before running this: it closes Spotify.
taskkill //IM Spotify.exe >/dev/null 2>&1
for _ in $(seq 1 10); do
    sleep 1
    tasklist 2>/dev/null | grep -qi spotify || break
done
taskkill //F //IM Spotify.exe >/dev/null 2>&1
sleep 1
(cd "$APPDATA/Spotify" && ./Spotify.exe --remote-debugging-port=9222 --remote-allow-origins=* \
    --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
    --disable-background-timer-throttling >/dev/null 2>&1 &)
for _ in $(seq 1 40); do
    sleep 1
    curl -s -m 2 http://127.0.0.1:9222/json/list 2>/dev/null | grep -q xpui && exit 0
done
echo "Spotify did not open its DevTools port" >&2
exit 1
