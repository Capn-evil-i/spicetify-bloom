// Measure layout spacing so inconsistencies show up as numbers.
//   node compat/tools/cdp.mjs compat/tools/spacing.js [route]
if (args[0]) await go(args[0], 4500);
const fn = () => {
    const R = (sel) => {
        const e = typeof sel === "string" ? document.querySelector(sel) : sel;
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    };
    const f = (n) => (n == null ? "-" : Math.round(n * 10) / 10);
    const out = {};
    const nav = R("#global-nav-bar");
    const left = R("#Desktop_LeftSidebar_Id");
    const main = R("#main-view");
    const right = R('div:has(> #main-view) > div:has(> .LayoutResizer__inline-start)');
    const npb = R('[data-testid="now-playing-bar"]');
    const W = innerWidth, H = innerHeight;
    out.window = [W, H];
    out.panels = {
        "screen→left": f(left?.l),
        "left→main": f(main && left && main.l - left.r),
        "main→right": f(right && main && right.l - main.r),
        "right→screen": f(right && W - right.r),
        "nav→left top": f(left && nav && left.t - nav.b),
        "nav→main top": f(main && nav && main.t - nav.b),
        "nav→right top": f(right && nav && right.t - nav.b),
        "left→player": f(npb && left && npb.t - left.b),
        "main→player": f(npb && main && npb.t - main.b),
        "right→player": f(npb && right && npb.t - right.b),
    };
    out.player = { "screen→player left": f(npb?.l), "player right→screen": f(npb && W - npb.r), "player bottom→screen": f(npb && H - npb.b), height: f(npb?.h) };
    // Card rows: gaps between neighbouring cards on the same row, and the cover's inset inside a card.
    const cards = [...document.querySelectorAll('#main-view [data-encore-id="card"]')].map((c) => ({ c, r: c.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.top < H && x.r.bottom > 0);
    const rows = new Map();
    for (const x of cards) {
        const key = Math.round(x.r.top);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(x);
    }
    out.cardRows = [...rows.entries()].map(([top, list]) => {
        list.sort((a, b) => a.r.left - b.r.left);
        const gaps = list.slice(1).map((x, i) => f(x.r.left - list[i].r.right));
        const first = list[0];
        const img = first.c.querySelector("img")?.getBoundingClientRect();
        const inset = img ? [f(img.left - first.r.left), f(first.r.right - img.right), f(img.top - first.r.top)] : null;
        return { top, n: list.length, w: f(first.r.width), gaps: [...new Set(gaps)], coverInset_l_r_t: inset };
    });
    // Home shortcuts grid: horizontal and vertical gaps.
    const tiles = [...document.querySelectorAll('#main-view div:has(> [data-testid="shortcut-background"])')].map((t) => t.getBoundingClientRect()).filter((r) => r.width);
    if (tiles.length) {
        const byRow = new Map();
        tiles.forEach((r) => { const k = Math.round(r.top); byRow.set(k, [...(byRow.get(k) || []), r]); });
        const rowsT = [...byRow.values()].map((l) => l.sort((a, b) => a.left - b.left));
        out.shortcuts = {
            perRow: rowsT.map((l) => l.length),
            hGaps: [...new Set(rowsT.flatMap((l) => l.slice(1).map((r, i) => f(r.left - l[i].right))))],
            vGap: rowsT.length > 1 ? f(rowsT[1][0].top - rowsT[0][0].bottom) : null,
            tile: [f(rowsT[0][0].width), f(rowsT[0][0].height)],
        };
    }
    // Section headings vs the left edge of their cards.
    const sections = [...document.querySelectorAll("#main-view section")].slice(0, 6).map((s) => {
        const h = s.querySelector("h2, [data-encore-id=text][class*=title], a[href] h2");
        const card = s.querySelector('[data-encore-id="card"]');
        const showAll = [...s.querySelectorAll("a, span")].find((e) => /^show all$/i.test(e.textContent.trim()));
        const hr = h?.getBoundingClientRect(), cr = card?.getBoundingClientRect(), sr = showAll?.getBoundingClientRect();
        const lastCard = [...s.querySelectorAll('[data-encore-id="card"]')].map((c) => c.getBoundingClientRect()).filter((r) => r.right <= (main?.r ?? W)).pop();
        return hr && cr ? { heading: (h.textContent || "").slice(0, 22), "heading.left−card.left": f(hr.left - cr.left), "showAll.right vs last visible card.right": sr && lastCard ? f(sr.right - lastCard.right) : null } : null;
    }).filter(Boolean);
    out.sections = sections;
    return JSON.stringify(out, null, 1);
};
console.log(await evaluate(`(${fn.toString()})()`));
