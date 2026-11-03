// List wide elements in the main view that paint a gradient or a solid background, with their place in the tree.
//   node compat/tools/cdp.mjs compat/tools/gradients.js <route> ...
for (const route of args) {
    await go(route, 4500);
    await evaluate(`(() => { const v = document.querySelector("#main-view [data-overlayscrollbars-viewport]"); if (v) v.scrollTop = 0; })()`);
    await sleep(600);
    const fn = () =>
        JSON.stringify(
            [...document.querySelectorAll("#main-view *")]
                .filter((e) => {
                    const s = getComputedStyle(e);
                    const b = e.getBoundingClientRect();
                    return b.width > 500 && (s.backgroundImage.includes("gradient") || (s.backgroundColor !== "rgba(0, 0, 0, 0)" && b.height > 40));
                })
                .map((e) => {
                    const s = getComputedStyle(e);
                    const b = e.getBoundingClientRect();
                    const at = [...e.attributes].filter((a) => a.name.startsWith("data-") || a.name === "role").map((a) => a.name + "=" + a.value.slice(0, 20)).join(" ");
                    const kids = [...e.parentElement.children].indexOf(e);
                    return [String(e.className).slice(0, 60), at, "child#" + kids + " of " + String(e.parentElement.className).slice(0, 40), s.backgroundColor, s.backgroundImage.slice(0, 70), [b.y | 0, b.height | 0]];
                }),
            null,
            0,
        );
    console.log("==", route, "\n" + (await evaluate(`(${fn.toString()})()`)).replace(/\],\[/g, "]\n["));
}
