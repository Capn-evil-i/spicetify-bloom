// Read or set Spotify's window bounds.
//   node compat/tools/cdp.mjs compat/tools/window.js                 print bounds
//   node compat/tools/cdp.mjs compat/tools/window.js maximized       maximize
//   node compat/tools/cdp.mjs compat/tools/window.js 1600 1000 [x y] normal window of that outer size
const targets = await send("Target.getTargets");
const page = targets.targetInfos.find((t) => t.type === "page" && t.url.includes("xpui"));
const { windowId, bounds } = await send("Browser.getWindowForTarget", { targetId: page.targetId });
if (args[0] === "maximized" || args[0] === "normal") {
    // A minimised window has to be restored before it can be maximised.
    if (bounds.windowState === "minimized") {
        await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
        await sleep(600);
    }
    await send("Browser.setWindowBounds", { windowId, bounds: { windowState: args[0] } });
    await sleep(1200);
} else if (args[0]) {
    await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await sleep(400);
    await send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: Number(args[0]), height: Number(args[1]), left: Number(args[2] ?? bounds.left), top: Number(args[3] ?? bounds.top) },
    });
    await sleep(1200);
}
const now = await send("Browser.getWindowForTarget", { targetId: page.targetId });
console.log(JSON.stringify({ before: bounds, now: now.bounds, inner: await evaluate("[innerWidth, innerHeight, devicePixelRatio]") }));
