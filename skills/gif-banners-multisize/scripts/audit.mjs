// Audit banner comps over the WHOLE loop, not just the end frame.
//
//   node _resize/audit.mjs <tmpDir> [idFilter] [--nth 2] [--pad 16] [--cta <CTA hex from brand.json>] [--buffer 16] [--box x0,y0,x1,y1]
//
// Per comp it reports:
//   - ink extents across the loop, and anything inside the safe margin (--pad);
//   - CTA clearance: the CTA is found by its exact fill colour (--cta). The
//     closest any other ink gets to it (from above on tall/square sizes, from
//     the left on leaderboards) is reported, with the frame it happens on, and
//     flagged when under --buffer;
//   - with --box: the ink box inside that region on every frame, for fitting
//     type size by measurement (render, read the width/height, adjust, repeat).
//
// The background is read from the top-right corner pixel; pass --bg #hex if
// that corner isn't flat ground. Run from inside the Remotion project.
import { bundle } from "@remotion/bundler";
import { getCompositions, renderFrames } from "@remotion/renderer";
import { PNG } from "pngjs";
import path from "node:path";
import fs from "node:fs";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const [tmp, filter = ""] = pos;
if (!tmp) throw new Error("usage: node audit.mjs <tmpDir> [idFilter] [--nth 2] [--pad N] [--cta #hex] [--buffer N] [--box x0,y0,x1,y1]");
const NTH = +opt("nth", 2), PAD = +opt("pad", 0), BUF = +opt("buffer", 0);
const hex = (h) => h && [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const CTA = hex(opt("cta")), BG = hex(opt("bg"));
const BOX = opt("box") && opt("box").split(",").map(Number);
const ENTRY = process.env.ENTRY || "src/index.ts";

const serveUrl = await bundle({ entryPoint: path.resolve(ENTRY) });
const comps = (await getCompositions(serveUrl)).filter((c) => c.id.includes(filter));

for (const c of comps) {
  const dir = path.join(tmp, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await renderFrames({ composition: c, serveUrl, outputDir: dir, imageFormat: "png", everyNthFrame: NTH, concurrency: 8, onStart: () => {}, onFrameUpdate: () => {} });
  const wide = c.width > c.height * 2;
  let ext = [1e9, 1e9, -1, -1], minClr = 1e9, clrF = "", boxes = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png")).sort()) {
    const { width: w, height: h, data } = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
    const bg = BG || [data[(w - 2) * 4], data[(w - 2) * 4 + 1], data[(w - 2) * 4 + 2]];
    const near = (i, c3, t) => Math.abs(data[i] - c3[0]) + Math.abs(data[i + 1] - c3[1]) + Math.abs(data[i + 2] - c3[2]) <= t;
    // CTA box: the LARGEST connected run of CTA-coloured pixels (the button),
    // because the same accent usually appears in the logo, figures and dots too
    let cta = null;
    if (CTA) {
      const seen = new Uint8Array(w * h);
      let best = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let s = 0; s < w * h; s++) {
        if (seen[s] || !near(s * 4, CTA, 6)) continue;
        const stack = [s]; seen[s] = 1;
        let n = 0, a = 1e9, b = 1e9, c2 = -1, d = -1;
        while (stack.length) {
          const q = stack.pop(), x = q % w, y = (q / w) | 0;
          n++; a = Math.min(a, x); b = Math.min(b, y); c2 = Math.max(c2, x); d = Math.max(d, y);
          for (const r of [q - 1, q + 1, q - w, q + w]) {
            if (r < 0 || r >= w * h || seen[r] || (Math.abs((r % w) - x) > 1)) continue;
            if (near(r * 4, CTA, 6)) { seen[r] = 1; stack.push(r); }
          }
        }
        if (n > best) (best = n), (x0 = a), (y0 = b), (x1 = c2), (y1 = d);
      }
      // grow by 2px so the CTA's own antialiased edge and rounded corners don't count as copy
      if (x1 >= 0) cta = [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
    }
    let low = -1, right = -1, bx = [1e9, 1e9, -1, -1];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (near(i, bg, 40)) continue;
      ext = [Math.min(ext[0], x), Math.min(ext[1], y), Math.max(ext[2], x), Math.max(ext[3], y)];
      if (BOX && x >= BOX[0] && x < BOX[2] && y >= BOX[1] && y < BOX[3]) bx = [Math.min(bx[0], x), Math.min(bx[1], y), Math.max(bx[2], x), Math.max(bx[3], y)];
      if (cta) {
        const inCta = x >= cta[0] && x <= cta[2] && y >= cta[1] && y <= cta[3];
        if (inCta) continue;
        if (!wide && y < cta[1] && y > low) low = y;
        if (wide && x < cta[0] && y >= cta[1] && y <= cta[3] && x > right) right = x;
      }
    }
    if (cta) {
      const clr = wide ? (right < 0 ? null : cta[0] + 2 - right - 1) : low < 0 ? null : cta[1] + 2 - low - 1;
      if (clr !== null && clr < minClr) (minClr = clr), (clrF = f);
    }
    if (BOX && bx[2] >= 0) boxes.push(`${f}: x ${bx[0]}-${bx[2]} (w ${bx[2] - bx[0] + 1}) y ${bx[1]}-${bx[3]} (h ${bx[3] - bx[1] + 1})`);
  }
  const iss = [];
  if (PAD) {
    if (ext[0] < PAD) iss.push(`LEFT x=${ext[0]}`);
    if (ext[1] < PAD) iss.push(`TOP y=${ext[1]}`);
    if (ext[2] > c.width - 1 - PAD) iss.push(`RIGHT x=${ext[2]}`);
    if (ext[3] > c.height - 1 - PAD) iss.push(`BOTTOM y=${ext[3]}`);
  }
  if (BUF && minClr < BUF) iss.push(`CTA clearance ${minClr}px at ${clrF}`);
  console.log(
    c.id.padEnd(16),
    `ink x ${ext[0]}-${ext[2]} y ${ext[1]}-${ext[3]}`,
    CTA ? `| CTA clearance min ${minClr === 1e9 ? "n/a" : minClr + "px"} (${wide ? "left" : "above"})` : "",
    iss.length ? " !! " + iss.join("; ") : "",
  );
  if (BOX) boxes.forEach((b) => console.log("   ", b));
  fs.rmSync(dir, { recursive: true, force: true });
}
