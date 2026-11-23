// SVG charts in the style of the presentation (slides 2 and 6).
export const COL = {
  green: "#0b6e4f", grey: "#9aa0a6", orange: "#e4572e", gold: "#d89b1f",
  ink: "#222222", body: "#6b6b6b", grid: "#ececec", axis: "#dddddd", shade: "#f4f4f2",
};

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const txt = (parent, x, y, s, attrs = {}) => { const t = el("text", Object.assign({ x, y }, attrs), parent); t.textContent = s; return t; };
export const clock = (m) => { const t = 9 * 60 + 30 + m; return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
const fmtBps = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

function niceDomain(values, step) {
  let lo = Math.min(...values), hi = Math.max(...values);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  return [lo, hi];
}

// Price chart: both legs, change from the previous close in bps.
// opts: {w, h, upto (last minute shown), reveal (bool: draw trade markers), animate}
export function priceChart(svg, c, opts) {
  const { w, h } = opts;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const m = { l: 48, r: 56, t: 70, b: 28 };
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const all = c.a.concat(c.b);
  const span = Math.max(...all) - Math.min(...all);
  const step = span > 400 ? 100 : 50;
  const [lo, hi] = niceDomain(all, step);
  const X = (i) => m.l + (i / 389) * iw;
  const Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih;
  const g = el("g", {}, svg);

  // future area, hidden before the reveal
  if (!opts.reveal) {
    el("rect", { x: X(opts.upto) + 1, y: m.t, width: X(389) - X(opts.upto) - 1, height: ih, fill: COL.shade }, g);
    txt(g, (X(opts.upto) + X(389)) / 2, m.t + ih / 2, "what happens next?", { "text-anchor": "middle", fill: "#b8b8b8", "font-size": 18, "font-style": "italic" });
  }
  // grid and y labels
  for (let v = lo; v <= hi + 1e-9; v += step) {
    el("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: v === 0 ? "#c4c4c4" : COL.grid, "stroke-width": 1 }, g);
    txt(g, m.l - 8, Y(v) + 4, String(v), { "text-anchor": "end", fill: COL.body, "font-size": 12 });
  }
  // x labels: clock times
  for (let i = 0; i <= 360; i += 60) txt(g, X(i), h - 8, clock(i), { "text-anchor": "middle", fill: COL.body, "font-size": 12 });

  const upto = opts.reveal ? 389 : opts.upto;
  const path = (arr, n) => arr.slice(0, n + 1).map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const lines = [];
  for (const [arr, col, name, wdt] of [[c.b, COL.grey, c.B, 2], [c.a, COL.green, c.A, 2.5]]) {
    const p = el("path", { d: path(arr, upto), fill: "none", stroke: col, "stroke-width": wdt, "stroke-linejoin": "round" }, g);
    lines.push(p);
  }
  // direct labels at the end of each line, nudged apart
  let ya = Y(c.a[upto]), yb = Y(c.b[upto]);
  if (Math.abs(ya - yb) < 16) { const mid = (ya + yb) / 2; const s = ya <= yb ? -1 : 1; ya = mid + s * 9; yb = mid - s * 9; }
  const lx = X(upto) + 6;
  const la = txt(g, lx, ya + 4, c.A, { fill: COL.green, "font-size": 14, "font-weight": 700 });
  const lb = txt(g, lx, yb + 4, c.B, { fill: COL.body, "font-size": 14, "font-weight": 700 });

  if (!opts.reveal) {
    // signal marker
    el("line", { x1: X(c.sig), x2: X(c.sig), y1: m.t - 6, y2: m.t + ih, stroke: COL.orange, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, g);
    const lab = el("g", {}, g);
    txt(lab, X(c.sig) + 8, m.t - 42, c.sigTime + "  signal", { fill: COL.orange, "font-size": 15, "font-weight": 700 });
    txt(lab, X(c.sig) + 8, m.t - 24, `${c.A} lags: buy ${c.A}, sell ${c.B}?`, { fill: COL.body, "font-size": 14 });
    el("circle", { cx: X(c.sig), cy: Y(c.a[c.sig]), r: 4.5, fill: COL.green, stroke: "#fff", "stroke-width": 2 }, g);
    el("circle", { cx: X(c.sig), cy: Y(c.b[c.sig]), r: 4.5, fill: COL.grey, stroke: "#fff", "stroke-width": 2 }, g);
  } else {
    const profit = c.gross_bps > 0;
    const exitCol = profit ? COL.green : COL.ink;
    el("line", { x1: X(c.entry), x2: X(c.entry), y1: m.t - 64, y2: m.t + ih, stroke: COL.orange, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, g);
    el("line", { x1: X(c.exit), x2: X(c.exit), y1: m.t - 40, y2: m.t + ih, stroke: exitCol, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, g);
    const e1 = txt(g, X(c.entry) + 8, m.t - 50, c.entryTime + "  enter", { fill: COL.orange, "font-size": 15, "font-weight": 700 });
    const e2 = el("tspan", { fill: COL.body, "font-weight": 400, "font-size": 14 }, e1); e2.textContent = `   buy ${c.A}, sell ${c.B}`;
    const head = c.exit_reason === "reversion" ? "the gap has closed" : "90 minutes, gap still open";
    txt(g, X(c.exit) + 8, m.t - 26, c.exitTime + "  " + head, { fill: exitCol, "font-size": 15, "font-weight": 700 });
    txt(g, X(c.exit) + 8, m.t - 9, "trade closed: " + fmtBps(c.gross_bps) + " bps", { fill: COL.body, "font-size": 14 });
    if (opts.animate) {
      // draw the rest of the day progressively
      for (const p of lines) {
        const L = p.getTotalLength();
        const fracSig = c.sig / 389;
        p.style.strokeDasharray = L + " " + L;
        p.style.strokeDashoffset = L * (1 - fracSig);
        p.getBoundingClientRect();
        p.style.transition = "stroke-dashoffset 2.6s ease-in-out";
        p.style.strokeDashoffset = 0;
      }
      for (const t of [la, lb]) { t.style.opacity = 0; t.style.transition = "opacity .4s 2.5s"; requestAnimationFrame(() => (t.style.opacity = 1)); }
    }
  }
  addHover(svg, g, { X, Y, m, iw, ih, upto, c, toIndex: (px) => Math.round(((px - m.l) / iw) * 389) });
}

// z-score chart (slide 6 style)
export function zChart(svg, c, opts) {
  const { w, h } = opts;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const m = { l: 48, r: 56, t: 10, b: 22 };
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const upto = opts.reveal ? 389 : opts.upto;
  const lim = 4;
  const X = (i) => m.l + (i / 389) * iw;
  const Y = (v) => m.t + (1 - (v + lim) / (2 * lim)) * ih;
  const g = el("g", {}, svg);
  if (!opts.reveal) el("rect", { x: X(opts.upto) + 1, y: m.t, width: X(389) - X(opts.upto) - 1, height: ih, fill: COL.shade }, g);
  for (const v of [-2, 0, 2]) {
    el("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: v === 0 ? COL.axis : COL.orange, "stroke-width": 1, "stroke-dasharray": v ? "5 4" : "" }, g);
    txt(g, m.l - 8, Y(v) + 4, v > 0 ? "+" + v : String(v).replace("-", "−"), { "text-anchor": "end", fill: COL.body, "font-size": 12 });
  }
  const d = c.z.slice(0, upto + 1).map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(Math.max(-lim, Math.min(lim, v))).toFixed(1)).join(" ");
  const p = el("path", { d, fill: "none", stroke: COL.ink, "stroke-width": 1.5, "stroke-linejoin": "round" }, g);
  if (opts.reveal && opts.animate) {
    const L = p.getTotalLength();
    p.style.strokeDasharray = L + " " + L; p.style.strokeDashoffset = L * (1 - c.sig / 389);
    p.getBoundingClientRect(); p.style.transition = "stroke-dashoffset 2.6s ease-in-out"; p.style.strokeDashoffset = 0;
  }
  el("circle", { cx: X(c.sig), cy: Y(c.z[c.sig]), r: 5, fill: COL.orange, stroke: "#fff", "stroke-width": 2 }, g);
  const below = c.z[c.sig] < 0;
  txt(g, X(c.sig) + 10, Y(c.z[c.sig]) + (below ? 16 : -8), "z = " + c.z_signal.toFixed(2).replace("-", "−"), { fill: COL.orange, "font-size": 14, "font-weight": 700, stroke: "#fff", "stroke-width": 4, "paint-order": "stroke" });
  if (opts.reveal) {
    el("circle", { cx: X(c.exit - 1), cy: Y(Math.max(-lim, Math.min(lim, c.z[c.exit - 1]))), r: 5, fill: c.gross_bps > 0 ? COL.green : COL.ink, stroke: "#fff", "stroke-width": 2 }, g);
  }
}

// Crosshair + tooltip on the price chart
function addHover(svg, g, k) {
  const tip = el("g", { "pointer-events": "none", opacity: 0 }, svg);
  const vline = el("line", { y1: k.m.t, y2: k.m.t + k.ih, stroke: "#b8b8b8", "stroke-width": 1 }, tip);
  const dA = el("circle", { r: 4, fill: COL.green, stroke: "#fff", "stroke-width": 2 }, tip);
  const dB = el("circle", { r: 4, fill: COL.grey, stroke: "#fff", "stroke-width": 2 }, tip);
  const box = el("rect", { width: 150, height: 58, rx: 4, fill: "#fff", stroke: COL.axis }, tip);
  const t1 = txt(tip, 0, 0, "", { "font-size": 12, fill: COL.body });
  const t2 = txt(tip, 0, 0, "", { "font-size": 13, fill: COL.ink, "font-weight": 700 });
  const t3 = txt(tip, 0, 0, "", { "font-size": 13, fill: COL.ink, "font-weight": 700 });
  const hit = el("rect", { x: k.m.l, y: k.m.t, width: k.iw, height: k.ih, fill: "transparent" }, svg);
  hit.addEventListener("mousemove", (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const i = Math.max(0, Math.min(k.upto, k.toIndex(p.x)));
    const x = k.X(i);
    vline.setAttribute("x1", x); vline.setAttribute("x2", x);
    dA.setAttribute("cx", x); dA.setAttribute("cy", k.Y(k.c.a[i]));
    dB.setAttribute("cx", x); dB.setAttribute("cy", k.Y(k.c.b[i]));
    const bx = x + 160 > k.m.l + k.iw ? x - 160 : x + 10, by = k.m.t + 6;
    box.setAttribute("x", bx); box.setAttribute("y", by);
    t1.setAttribute("x", bx + 10); t1.setAttribute("y", by + 17); t1.textContent = clock(i) + ", vs previous close";
    t2.setAttribute("x", bx + 10); t2.setAttribute("y", by + 35); t2.textContent = k.c.A + "  " + fmtBps(k.c.a[i]) + " bps";
    t3.setAttribute("x", bx + 10); t3.setAttribute("y", by + 51); t3.textContent = k.c.B + "  " + fmtBps(k.c.b[i]) + " bps";
    tip.setAttribute("opacity", 1);
  });
  hit.addEventListener("mouseleave", () => tip.setAttribute("opacity", 0));
}
