// Run a check script against Spotify's page over the Chrome DevTools Protocol.
//   node compat/tools/cdp.mjs <script.js> [args...]
// Spotify must run with --remote-debugging-port=9222 (see restart-debug.sh). The script's body runs
// as an async function with these in scope:
//   send(method, params)  raw CDP call
//   evaluate(expr)        evaluate in the page and return the value ({ error } on failure)
//   shot(path, clip?)     PNG screenshot, optionally clipped { x, y, width, height }
//   sleep(ms), events     console errors and exceptions seen so far
//   go(route)             Spicetify.Platform.History.push(route) and wait for the page
//   args                  the extra command-line arguments
import { readFileSync, writeFileSync } from "node:fs";

let page;
for (const host of ["127.0.0.1", "[::1]"]) {
    try {
        const list = await (await fetch(`http://${host}:9222/json/list`)).json();
        page = list.find((t) => t.type === "page" && t.url.includes("xpui"));
        if (page) break;
    } catch {}
}
if (!page) {
    console.error("Spotify's page is not reachable on port 9222. Start it with restart-debug.sh.");
    process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        events.push("EXC " + String(d.exception?.description || d.text).slice(0, 1500));
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        events.push("ERROR " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 1500));
    }
    if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.error ? { __error: msg.error } : msg.result);
        pending.delete(msg.id);
    }
});
await new Promise((resolve) => ws.addEventListener("open", resolve));

const send = (method, params = {}) =>
    new Promise((resolve) => {
        const msgId = ++id;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.__error || r.exceptionDetails) {
        return { error: r.__error ?? r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
    }
    return r.result.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shot = async (path, clip) => {
    const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { scale: 1, ...clip } } : {}) });
    writeFileSync(path, Buffer.from(r.data, "base64"));
};
const go = async (route, wait = 3500) => {
    // Git Bash rewrites "/album/x" into a Windows path unless MSYS_NO_PATHCONV=1, and pushing that
    // route leaves every page on Spotify's "Something went wrong" until a reload.
    if (!/^\/[a-z-]*(\/|$)/i.test(route) || route.includes(":")) throw new Error(`refusing odd route ${route} (set MSYS_NO_PATHCONV=1)`);
    await evaluate(`Spicetify.Platform.History.push(${JSON.stringify(route)})`);
    await sleep(wait);
};

await send("Runtime.enable");
await send("Page.enable");
const body = readFileSync(process.argv[2], "utf8");
const args = process.argv.slice(3);
try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction("send", "evaluate", "shot", "sleep", "events", "go", "args", body)(send, evaluate, shot, sleep, events, go, args);
} catch (e) {
    console.error("SCRIPT ERROR", e);
    process.exitCode = 1;
}
ws.close();
