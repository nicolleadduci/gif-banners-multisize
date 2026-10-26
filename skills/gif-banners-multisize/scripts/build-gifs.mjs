// Encode Remotion banner comps to GIF with one clean global palette.
//
//   node _resize/build-gifs.mjs <outDir> [idFilter]
//   env: PIN="#111111,#ffffff,#ff5a1f"   brand colours kept exact (CTA, ground, type, logo)
//        NTH=2                           every 2nd frame (halves fps) for a size over its KB cap
//        SCALE=1                         keep 1 for display banners (ad servers need exact pixels)
//        ENTRY=src/index.ts              Remotion entry point
//        IDS="^C\\d"                     regex the comp id must match (default: everything)
//
// Run from inside the Remotion project (copy this file to its _resize/ folder)
// so @remotion/*, gifenc and pngjs resolve. Needs gifsicle on PATH.
//
// Why this encoder: a per-frame or count-weighted palette spends its 256 slots
// on flat ground and leaves type edges crunchy. Here:
//   - one palette for the whole loop, so unchanged pixels stay identical frame
//     to frame and gifsicle's frame differencing keeps the file small;
//   - brand colours pinned exact;
//   - the rest is k-means over every distinct colour, weighted by sqrt(count)
//     so the rare antialiasing shades still get entries;
//   - exact nearest mapping, no dither, no lossy (even --lossy=8 specks type).
import { bundle } from "@remotion/bundler";
import { getCompositions, renderFrames } from "@remotion/renderer";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const { GIFEncoder } = gifenc;
const [out, filter = ""] = process.argv.slice(2);
if (!out) throw new Error("usage: node build-gifs.mjs <outDir> [idFilter]");
const NTH = Number(process.env.NTH || 1);
const SCALE = Number(process.env.SCALE || 1);
const ENTRY = process.env.ENTRY || "src/index.ts";
const IDS = new RegExp(process.env.IDS || ".");
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.trim().slice(i, i + 2), 16));
const PINNED = (process.env.PIN || "").split(",").filter(Boolean).map(hex);
fs.mkdirSync(out, { recursive: true });

function buildPalette(hist) {
  const keys = [...hist.keys()];
  const cols = keys.map((k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
  if (cols.length <= 256) return cols;
  const wts = keys.map((k) => Math.sqrt(hist.get(k)));
  const present = PINNED.filter((p) => hist.has((p[0] << 16) | (p[1] << 8) | p[2]));
  const K = 256;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // deterministic farthest-point seeding after the pinned colours
  const cent = present.map((p) => p.slice());
  const nearest = cols.map((c) => (cent.length ? Math.min(...cent.map((p) => d2(c, p))) : Infinity));
  while (cent.length < K) {
    let bi = 0, bv = -1;
    for (let i = 0; i < cols.length; i++) {
      const v = nearest[i] * wts[i];
      if (v > bv) (bv = v), (bi = i);
    }
    if (bv <= 0) break;
    const c = cols[bi].slice();
    cent.push(c);
    for (let i = 0; i < cols.length; i++) nearest[i] = Math.min(nearest[i], d2(cols[i], c));
  }
  const fixed = present.length;
  for (let it = 0; it < 14; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < cols.length; i++) {
      let bj = 0, bd = Infinity;
      for (let j = 0; j < cent.length; j++) {
        const d = d2(cols[i], cent[j]);
        if (d < bd) (bd = d), (bj = j);
      }
      const a = acc[bj], w = wts[i];
      a[0] += cols[i][0] * w; a[1] += cols[i][1] * w; a[2] += cols[i][2] * w; a[3] += w;
    }
    for (let j = fixed; j < cent.length; j++) if (acc[j][3] > 0) cent[j] = [0, 1, 2].map((c) => Math.round(acc[j][c] / acc[j][3]));
  }
  return cent;
}

const serveUrl = await bundle({ entryPoint: path.resolve(ENTRY) });
const comps = (await getCompositions(serveUrl)).filter((c) => IDS.test(c.id) && c.id.includes(filter));
if (!comps.length) throw new Error(`no compositions match "${filter}"`);

for (const c of comps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gifb-"));
  await renderFrames({ composition: c, serveUrl, outputDir: dir, imageFormat: "png", everyNthFrame: NTH, scale: SCALE, concurrency: 8, onStart: () => {}, onFrameUpdate: () => {} });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))).data);
  const w = c.width * SCALE, h = c.height * SCALE;
  const hist = new Map();
  for (const f of frames)
    for (let i = 0; i < f.length; i += 4) {
      const k = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  const palette = buildPalette(hist);
  const map = new Map();
  let err = 0, n = 0;
  for (const k of hist.keys()) {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    let bj = 0, bd = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const p = palette[j];
      const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
      if (d < bd) (bd = d), (bj = j);
    }
    map.set(k, bj);
    err += Math.sqrt(bd) * hist.get(k); n += hist.get(k);
  }
  const delay = Math.round((1000 / c.fps) * NTH);
  const gif = GIFEncoder();
  frames.forEach((f, i) => {
    const index = new Uint8Array(w * h);
    for (let p = 0, q = 0; p < f.length; p += 4, q++) index[q] = map.get((f[p] << 16) | (f[p + 1] << 8) | f[p + 2]);
    gif.writeFrame(index, w, h, i === 0 ? { palette, delay, repeat: 0 } : { delay });
  });
  gif.finish();
  const raw = path.join(dir, "raw.gif");
  fs.writeFileSync(raw, gif.bytes());
  const dst = path.join(out, `${c.id}${SCALE > 1 ? `@${SCALE}x` : ""}.gif`);
  execFileSync("gifsicle", ["-O3", raw, "-o", dst]);
  const kb = (fs.statSync(dst).size / 1024).toFixed(1);
  console.log(c.id.padEnd(16), `${kb} KB`.padStart(10), `${(1000 / delay).toFixed(1)}fps`, `colours ${hist.size}`, `meanErr ${(err / n).toFixed(2)}/255`);
  fs.rmSync(dir, { recursive: true, force: true });
}
