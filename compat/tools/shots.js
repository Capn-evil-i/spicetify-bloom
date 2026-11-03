// Screenshot pages. node compat/tools/cdp.mjs compat/tools/shots.js <outDir> <prefix> "<route>[|scrollTop]" ...
const fs = await import("node:fs");
const [dir, prefix, ...specs] = args;
fs.mkdirSync(dir, { recursive: true });
for (const spec of specs) {
    const [route, scroll] = spec.split("|");
    await go(route, 4500);
    await evaluate(`(() => { const v = document.querySelector("#main-view [data-overlayscrollbars-viewport]") || document.querySelector(".main-view-container__scroll-node"); if (v) v.scrollTop = ${Number(scroll || 0)}; })()`);
    await sleep(1000);
    const name = `${prefix}_${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 24) || "home"}${scroll ? "_s" + scroll : ""}.png`;
    await shot(`${dir}/${name}`);
    console.log(name);
}
