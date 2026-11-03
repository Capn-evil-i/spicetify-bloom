// Print the structure (tags, classes, attributes, boxes) under selectors on given pages.
//   node compat/tools/cdp.mjs compat/tools/dump.js <out.txt> "<route>|<selector>|<depth>|<maxChildren>|<nth>|<scrollTop>" ...
// Use it to find stable hooks (test ids, roles, attributes) for elements that lost their class names.
const fs = await import("node:fs");
const fn = (sel, depth, maxk, nth) => {
    const skip = ["class", "style", "d", "viewBox", "src", "srcset", "loading", "sizes", "draggable", "tabindex", "fill", "height", "width", "xmlns"];
    const lines = [];
    const walk = (e, left, ind) => {
        const b = e.getBoundingClientRect();
        const attrs = [...e.attributes]
            .filter((a) => !skip.includes(a.name) && !a.name.startsWith("on"))
            .map((a) => a.name.replace("data-", "") + "=" + a.value.slice(0, 34))
            .join(" ");
        const cls = String(e.className.baseVal ?? e.className).trim().replace(/\s+/g, ".").slice(0, 100);
        const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 30);
        lines.push(`${ind}${e.tagName.toLowerCase()}.${cls} [${attrs}] ${[b.x | 0, b.y | 0, b.width | 0, b.height | 0].join(",")}${own ? ' "' + own + '"' : ""}`);
        if (left > 0) [...e.children].slice(0, maxk).forEach((c) => walk(c, left - 1, ind + "  "));
    };
    const e = document.querySelectorAll(sel)[nth];
    if (!e) return "NONE (" + document.querySelectorAll(sel).length + " matches)";
    walk(e, depth, "");
    return lines.join("\n");
};
let out = "";
let current = "";
for (const spec of args.slice(1)) {
    const [route, sel, depth = "4", maxk = "8", nth = "0", scroll = ""] = spec.split("|");
    if (route && route !== current) {
        await go(route, 4500);
        current = route;
    }
    if (scroll) {
        await evaluate(`(() => { const v = document.querySelector("#main-view [data-overlayscrollbars-viewport]") || document.querySelector(".main-view-container__scroll-node"); if (v) v.scrollTop = ${Number(scroll)}; })()`);
        await sleep(900);
    }
    out += `\n### ${current} :: ${sel} [${nth}]${scroll ? " scroll " + scroll : ""}\n`;
    out += await evaluate(`(${fn.toString()})(${JSON.stringify(sel)}, ${Number(depth)}, ${Number(maxk)}, ${Number(nth)})`);
}
fs.writeFileSync(args[0], out);
console.log("wrote", args[0], out.length, "chars");
