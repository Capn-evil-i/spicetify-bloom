// Parse the compat section of src/user.css in Spotify's own Chrome and report anything it rejects.
//   node compat/tools/cdp.mjs compat/tools/validate.js
// Chrome drops rules with an invalid selector and declarations it does not understand without a
// word, so the number of blocks in the file is compared with the rules Chrome kept, and rules left
// with no declarations are listed.
const fs = await import("node:fs");
const path = await import("node:path");
const root = path.resolve(path.dirname(process.argv[2]), "..", "..");
const text = fs.readFileSync(path.join(root, "src", "user.css"), "utf8");
const start = text.indexOf("/* ===== Bloom -> Spotify 1.3 compatibility layer");
const section = text.slice(start).replace(/\/\*[\s\S]*?\*\//g, "");

// Count blocks: every "{" opens a rule or a group (@media, @container, nested rule).
let blocks = 0;
let quote = null;
for (let i = 0; i < section.length; i++) {
    const ch = section[i];
    if (quote) {
        if (ch === quote && section[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") blocks++;
}

const check = (css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    const out = { rules: 0, empty: [] };
    const walk = (list) => {
        for (const rule of list) {
            out.rules++;
            if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
            if (rule.style && rule.style.length === 0 && !(rule.cssRules && rule.cssRules.length)) out.empty.push(rule.selectorText);
        }
    };
    walk(sheet.cssRules);
    return JSON.stringify(out);
};
const result = JSON.parse(await evaluate(`(${check.toString()})(${JSON.stringify(section)})`));
console.log(`blocks in file: ${blocks}, rules Chrome kept: ${result.rules}`);
if (result.empty.length) console.log("rules with no declarations left:\n  " + result.empty.join("\n  "));
if (blocks !== result.rules) {
    console.log("MISMATCH: Chrome dropped " + (blocks - result.rules) + " rule(s)");
    process.exitCode = 1;
} else if (!result.empty.length) console.log("ok");
