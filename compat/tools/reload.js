// Reload Spotify's page (after `spicetify refresh`) if nothing is playing, then report what the
// bloom-compat extension resolved.  node compat/tools/cdp.mjs compat/tools/reload.js
// Playing on another device (Spotify Connect) is fine: reloading this window does not touch it.
const playingHere = await evaluate(
    "Spicetify.Player.isPlaying() && (Spicetify.Platform.ConnectAPI?.state?.activeDevice?.isLocal ?? true)",
);
if (playingHere) {
    console.log("Spotify is playing on this computer; not reloading.");
    process.exitCode = 1;
} else {
    await evaluate("location.reload()");
    await sleep(10000);
    const report = () => {
        const style = document.getElementById("bloom-13-compat-style");
        const text = style ? style.textContent : "";
        return JSON.stringify({
            ready: !!window.Spicetify?.Player,
            compatChars: text.length,
            unresolvedTokens: [...new Set(text.match(/bloom-token-lyrics-\w+/g) || [])],
            lyricsCard: document.documentElement.dataset.bloomLyricsCard,
            lastInBody: document.body.lastElementChild?.id,
        });
    };
    console.log(await evaluate(`(${report.toString()})()`));
    const errors = events.filter((e) => /bloom|EXC/.test(e));
    if (errors.length) console.log(errors.slice(0, 5).join("\n---\n"));
}
