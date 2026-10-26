// Pull the brand straight from the user's source ad: colours, CTA, and the
// reference frames to read copy, logo and type from. Nothing is assumed.
//
//   node extract-brand.mjs <source.gif|.mp4|.mov> <outDir>
//
// Writes to <outDir>:
//   brand.json        flat colours with roles (ground / cta / other), their share,
//                     and `pin` — the list build-gifs.mjs keeps exact
//   frames/f###.png   every frame, decoded in order (GIF frames are partial
//                     updates, so never seek into a GIF — decode from the start)
//   settled.png       the frame with the most content on screen: read the copy,
//                     the logo and the type from this one
//   cta.png           crop of the detected CTA, to read its label, radius and size
//
// Needs ffmpeg: a system install, or the one Remotion bundles in
// node_modules/@remotion/compositor-<platform>/ (run from the Remotion project).
// Run from inside the project so `pngjs` resolves.
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import path from "node:path";
import fs from "node:fs";

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error("usage: node extract-brand.mjs <source> <outDir>");

function ffmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return { bin: "ffmpeg", env: process.env }; } catch {}
  const base = path.resolve("node_modules/@remotion");
  const dir = fs.existsSync(base) && fs.readdirSync(base).find((d) => d.startsWith("compositor-"));
  if (!dir) throw new Error("no ffmpeg: install one, or run from a Remotion project");
  const d = path.join(base, dir);
  return { bin: path.join(d, "ffmpeg"), env: { ...process.env, DYLD_LIBRARY_PATH: d, LD_LIBRARY_PATH: d } };
}

const fdir = path.join(out, "frames");
fs.rmSync(fdir, { recursive: true, force: true });
fs.mkdirSync(fdir, { recursive: true });
const ff = ffmpeg();
execFileSync(ff.bin, ["-v", "error", "-i", src, "-vsync", "0", path.join(fdir, "f%03d.png")], { env: ff.env });
const files = fs.readdirSync(fdir).filter((f) => f.endsWith(".png")).sort();
const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(fdir, f))));
const { width: W, height: H } = frames[0];
const key = (d, i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
const hexOf = (k) => "#" + k.toString(16).padStart(6, "0");
const rgb = (k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };

// ground = most common colour around the border of the first frame
const border = new Map();
{
  const d = frames[0].data;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const k = key(d, (y * W + x) * 4); border.set(k, (border.get(k) || 0) + 1); }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const k = key(d, (y * W + x) * 4); border.set(k, (border.get(k) || 0) + 1); }
}
const ground = [...border].sort((a, b) => b[1] - a[1])[0][0];

// settled frame = most non-ground pixels
let settledI = 0, most = -1;
frames.forEach((f, i) => {
  let n = 0;
  for (let p = 0; p < f.data.length; p += 4) if (dist(key(f.data, p), ground) > 30) n++;
  if (n > most) (most = n), (settledI = i);
});
const S = frames[settledI];
fs.copyFileSync(path.join(fdir, files[settledI]), path.join(out, "settled.png"));

// flat colours: exact colours that cover a real area in the settled frame
// (fills and the solid cores of type), merged when nearly identical
const hist = new Map();
for (let p = 0; p < S.data.length; p += 4) { const k = key(S.data, p); hist.set(k, (hist.get(k) || 0) + 1); }
const minPx = Math.max(12, Math.round(W * H * 0.0005));
const flat = [];
for (const [k, n] of [...hist].sort((a, b) => b[1] - a[1])) {
  if (n < minPx) break;
  // wide merge: dithered sources scatter one brand colour into many near shades;
  // the most common exact member of each family names it
  const near = flat.find((f) => dist(f.k, k) <= 36);
  if (near) near.n += n; else flat.push({ k, n });
}

// CTA = the largest solid, rectangle-filling block of a non-ground flat colour
function largestBlock(k) {
  const seen = new Uint8Array(W * H);
  let best = null;
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || dist(key(S.data, s * 4), k) > 9) continue;
    const st = [s]; seen[s] = 1;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (st.length) {
      const q = st.pop(), x = q % W, y = (q / W) | 0;
      n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const r of [q - 1, q + 1, q - W, q + W]) {
        if (r < 0 || r >= W * H || seen[r] || Math.abs((r % W) - x) > 1) continue;
        if (dist(key(S.data, r * 4), k) <= 9) { seen[r] = 1; st.push(r); }
      }
    }
    if (!best || n > best.n) best = { n, box: [x0, y0, x1, y1] };
  }
  return best;
}
let cta = null;
for (const f of flat) {
  if (dist(f.k, ground) <= 9) continue;
  const b = largestBlock(f.k);
  const [x0, y0, x1, y1] = b.box, bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const fill = b.n / (bw * bh);
  // a button: mostly filled (label knocks some out), wider than tall, not a hairline
  if (fill > 0.55 && bw > bh && bh >= Math.max(10, H * 0.02) && (!cta || bw * bh > cta.area)) cta = { k: f.k, box: b.box, area: bw * bh };
}
if (cta) {
  const [x0, y0, x1, y1] = cta.box, cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const crop = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y++) S.data.copy(crop.data, y * cw * 4, ((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4);
  fs.writeFileSync(path.join(out, "cta.png"), PNG.sync.write(crop));
}

const total = W * H;
const colours = flat.filter((f) => f.n / total >= 0.001).map((f) => ({
  hex: hexOf(f.k),
  share: +(f.n / total * 100).toFixed(2),
  role: f.k === ground ? "ground" : cta && f.k === cta.k ? "cta" : "other",
}));
const brand = {
  source: path.resolve(src),
  size: `${W}x${H}`,
  frames: files.length,
  settledFrame: files[settledI],
  ground: hexOf(ground),
  cta: cta ? { hex: hexOf(cta.k), box: cta.box, size: `${cta.box[2] - cta.box[0] + 1}x${cta.box[3] - cta.box[1] + 1}` } : null,
  colours,
  pin: colours.map((c) => c.hex),
  note: "Roles other than ground/cta are for you to name (headline, body, accent, logo) by looking at settled.png. Prefer brand-guide hex values over these when the user supplies them; GIF palettes can shift a colour by a few steps.",
};
fs.writeFileSync(path.join(out, "brand.json"), JSON.stringify(brand, null, 2));
console.log(`${files.length} frames ${W}x${H}, settled ${files[settledI]}`);
console.log(`ground ${brand.ground}` + (cta ? `   CTA ${brand.cta.hex} ${brand.cta.size} at ${cta.box[0]},${cta.box[1]}` : "   CTA not found"));
for (const c of colours) console.log(`  ${c.hex}  ${String(c.share).padStart(6)}%  ${c.role}`);
