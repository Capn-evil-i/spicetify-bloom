// Which of Bloom's classes, and which compat-map targets, exist in the running Spotify.
//   node compat/tools/cdp.mjs compat/tools/coverage.js [map.json]
// Run it after every Spotify update: anything listed as gone needs a new target in the map.
const fs = await import("node:fs");
const path = await import("node:path");
const root = path.resolve(path.dirname(process.argv[2]), "..", "..");
const css = fs.readFileSync(path.join(root, "src", "user.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const mapFile = args[0] || fs.readdirSync(path.join(root, "compat")).filter((f) => /^spotify-.*\.json$/.test(f)).sort().pop();
const map = JSON.parse(fs.readFileSync(path.join(root, "compat", path.basename(mapFile)), "utf8"));

// Class names used in selectors (text before each "{").
const classes = new Set();
for (const m of css.matchAll(/([^{}]+)\{/g)) {
    for (const c of m[1].matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) classes.add(c[1]);
}
// Lyric targets are placeholders the extension fills in at runtime; check them with the real classes.
const lyricClasses = JSON.parse((await evaluate("JSON.stringify(window.bloomCompatLyricClasses || null)")) || "null");
if (!lyricClasses) console.log("note: the extension has not resolved the lyric classes (is bloom-compat installed and current?)");
const targets = Object.entries(map)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => [k, v.replace(/\.bloom-token-lyrics-(\w+)/g, (token, name) => (lyricClasses && lyricClasses[name] ? "." + lyricClasses[name] : token))]);

const pages = [
    ["/", 0],
    ["/album/42WVQWuf1teDysXiOupIZt", 0],
    ["/album/42WVQWuf1teDysXiOupIZt", 700],
    ["/playlist/37i9dQZEVXcFwH9H0SLboG", 0],
    ["/artist/0Y5tJX1MQlPlqiwlOH1tJY", 0],
    ["/search", 0],
    ["/collection/tracks", 0],
    ["/lyrics", 0],
];
const seenClass = new Set();
const seenTarget = new Map();
const names = [...classes];
for (const [route, scroll] of pages) {
    await go(route, 4000);
    if (scroll) {
        await evaluate(`(() => { const v = document.querySelector("#main-view [data-overlayscrollbars-viewport]") || document.querySelector(".main-view-container__scroll-node"); if (v) v.scrollTop = ${scroll}; })()`);
        await sleep(900);
    }
    const found = JSON.parse(await evaluate(`JSON.stringify(${JSON.stringify(names)}.filter((n) => document.getElementsByClassName(n).length))`));
    found.forEach((n) => seenClass.add(n));
    const hits = JSON.parse(await evaluate(`JSON.stringify(${JSON.stringify(targets.map((t) => t[1]))}.map((s) => { try { return document.querySelectorAll(s).length; } catch (e) { return -1; } }))`));
    hits.forEach((n, i) => {
        if (n !== 0) seenTarget.set(i, n);
    });
}

console.log(`Bloom classes present: ${seenClass.size} of ${classes.size}`);
console.log(`\nCompat map (${path.basename(mapFile)}):`);
targets.forEach(([from, to], i) => {
    const n = seenTarget.get(i);
    console.log(`${n === undefined ? "GONE " : n < 0 ? "BAD  " : "ok   "} ${from.padEnd(50)} ${to}`);
});
fs.writeFileSync(path.join(root, "compat", "tools", ".last-coverage.json"), JSON.stringify({ present: [...seenClass].sort() }, null, 1));
