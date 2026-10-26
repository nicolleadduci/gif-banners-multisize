/* ------------------------------------------------------------------ *
 * Banner kit — layout + motion primitives for a multi-size GIF set.
 * Copy into the Remotion project (e.g. src/Banners.tsx), fill BRAND from
 * the source files and TOK with THIS job's sizes, then write one component
 * per ad that switches layout by size.
 *
 * The primitives encode the house rules so a layout can't break them:
 *  - VFrame: logo top, CTA bottom, groups separated by EQUAL flexible <Gap/>s,
 *    plus a fixed ctaGap buffer nothing can cross;
 *  - HFrame: leaderboard, everything on one centre line with equal gaps;
 *  - Fx: the only entrance — short fade + small rise, whole pixels, no overshoot;
 *  - Num: count-up that reserves the final value's width;
 *  - Seq: two messages in one slot, the first fully gone before the second.
 *
 * Register comps as `${ad}-${size}` (see the end of the file).
 * ------------------------------------------------------------------ */
import React from "react";
import { AbsoluteFill, Composition, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/* ------------------------------ brand: from the user's source ad ------------------------------ *
 * Fill from brand/brand.json (scripts/extract-brand.mjs on the source ad) and from
 * settled.png: name each sampled hex's role by looking at the frame. Brand-guide
 * values the user supplies win over sampled ones. Logo = the vector file; font =
 * what the source names, or identified by measurement against settled.png.
 * ------------------------------------------------------------------------------- */

const BRAND = {
  font: "TODO", // load it the way the source project does (@remotion/google-fonts or local @font-face)
  ground: "#TODO",
  type: "#TODO",
  body: "#TODO", // SOLID body grey: flatten any alpha text to the colour it shows on the ground
  accent: "#TODO",
  cta: "#TODO",
  ctaText: "#TODO",
  logo: "TODO.svg", // in public/
  logoRatio: 1, // height / width of the logo artwork
  med: 500,
};

/* ------------------------------ sizes: per job ------------------------------ */

export type Size = string; // e.g. "300x250" — whatever the spec sheet lists

type Tok = {
  w: number; h: number;
  pad: number;    // safe margin
  logo: number;   // logo width
  ctaH: number; ctaF: number; ctaPx: number; // CTA height, label size, side padding
  ctaGap: number; // fixed buffer above the CTA on stacked sizes
};

/** Fill per job. Work the values out from the size: type as large as fits, then audit. */
export const TOK: Record<Size, Tok> = {
  // "WxH": { w, h, pad, logo, ctaH, ctaF, ctaPx, ctaGap },
};

/* ------------------------------ time ------------------------------ */

const FPS = 25; // match the source
const LOOP = 225; // match the source's loop length, in frames
const EXIT = LOOP - 25; // content eases out before the loop restarts
export const SETTLED = -1000; // `at` value for things on screen from frame 0 (logo, headline, CTA)

const ease = Easing.bezier(0.16, 1, 0.3, 1); // fast out, long settle, no overshoot
const path = (f: number, stops: number[], vals: number[]) =>
  interpolate(f, stops, vals, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const useT = () => useCurrentFrame() % LOOP;

/** The one move: fade + small rise in at `at`, ease out at EXIT. Whole pixels only. */
export const Fx: React.FC<{ at: number; rise?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at, rise = 5, dur = 10, style, children,
}) => {
  const t = useT();
  if (at <= SETTLED) return <div style={style}>{children}</div>;
  const p = path(t - at, [0, dur], [0, 1]);
  const o = path(t, [EXIT, EXIT + 9], [0, 1]);
  return <div style={{ opacity: p * (1 - o), transform: `translateY(${Math.round((1 - p) * rise - o * 4)}px)`, ...style }}>{children}</div>;
};

/* ------------------------------ type ------------------------------ */

/** Lines are broken by hand (pass an array); each line staggers in 3 frames after the last. */
export const Txt: React.FC<{ lines: React.ReactNode[]; size: number; at?: number; lh?: number; weight?: number; color?: string; track?: string }> = ({
  lines, size, at = SETTLED, lh = 1.28, weight = BRAND.med, color = BRAND.type, track = "-0.01em",
}) => (
  <div style={{ fontFamily: BRAND.font, fontSize: size, fontWeight: weight, color, lineHeight: lh, letterSpacing: track, whiteSpace: "nowrap", flexShrink: 0 }}>
    {lines.map((l, i) => (
      <Fx key={i} at={at <= SETTLED ? at : at + i * 3}>{l}</Fx>
    ))}
  </div>
);

export const Head: React.FC<{ lines: React.ReactNode[]; size: number; color?: string; at?: number }> = (p) => (
  <Txt {...p} lh={1.12} track="-0.025em" />
);

/** Count-up; the box is the final value's width so copy beside it never moves. */
export const Num: React.FC<{ to: number; dec?: number; at: number; size: number; color?: string; suffix?: string }> = ({
  to, dec = 0, at, size, color = BRAND.accent, suffix = "%",
}) => {
  const v = path(useT() - at, [0, 30], [0, to]);
  return (
    <Fx at={at} rise={6}>
      <div style={{ position: "relative", fontFamily: BRAND.font, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", color, whiteSpace: "nowrap" }}>
        <span style={{ visibility: "hidden" }}>{to.toFixed(dec)}{suffix}</span>
        <span style={{ position: "absolute", left: 0, top: 0 }}>{v.toFixed(dec)}{suffix}</span>
      </div>
    </Fx>
  );
};

/** Two messages in one slot. `a` leaves completely before `b` (whose own `at` should be `swap`) arrives. */
export const Seq: React.FC<{ swap: number; a: React.ReactNode; b: React.ReactNode }> = ({ swap, a, b }) => {
  const out = path(useT(), [swap - 8, swap], [0, 1]);
  return (
    <div style={{ display: "grid", alignItems: "center" }}>
      <div style={{ gridArea: "1 / 1", opacity: 1 - out, visibility: out >= 1 ? "hidden" : "visible" }}>{a}</div>
      <div style={{ gridArea: "1 / 1" }}>{b}</div>
    </div>
  );
};

/* ------------------------------ furniture ------------------------------ */

const Logo: React.FC<{ w: number }> = ({ w }) => (
  <Img src={staticFile(BRAND.logo)} style={{ width: w, height: Math.round(w * BRAND.logoRatio), display: "block", flexShrink: 0 }} />
);

const Cta: React.FC<{ t: Tok; label: string; full?: boolean }> = ({ t, label, full }) => (
  <div style={{
    background: BRAND.cta, color: BRAND.ctaText, borderRadius: Math.max(4, Math.round(t.ctaH * 0.12)),
    height: t.ctaH, padding: `0 ${t.ctaPx}px`, display: "flex", alignItems: "center", justifyContent: "center",
    alignSelf: full ? "stretch" : "flex-start", fontFamily: BRAND.font, fontWeight: BRAND.med, fontSize: t.ctaF,
    whiteSpace: "nowrap", flexShrink: 0,
  }}>{label}</div>
);

/** Equal flexible gap between groups. */
export const Gap: React.FC<{ min?: number }> = ({ min = 8 }) => <div style={{ flex: 1, minHeight: min }} />;

/** Tall and square sizes: logo, groups between <Gap/>s, fixed buffer, CTA. */
export const VFrame: React.FC<{ t: Tok; cta: string; ctaFull?: boolean; children: React.ReactNode }> = ({ t, cta, ctaFull, children }) => (
  <AbsoluteFill style={{ backgroundColor: BRAND.ground }}>
    <div style={{ position: "absolute", inset: 0, padding: t.pad, display: "flex", flexDirection: "column" }}>
      <Logo w={t.logo} />
      {children}
      <div style={{ height: t.ctaGap, flexShrink: 0 }} />
      <Cta t={t} label={cta} full={ctaFull} />
    </div>
  </AbsoluteFill>
);

/** Leaderboards: logo | divider | headline | message slot | CTA, equal gaps on one centre line. */
export const HFrame: React.FC<{ t: Tok; cta: string; head: React.ReactNode; children: React.ReactNode }> = ({ t, cta, head, children }) => (
  <AbsoluteFill style={{ backgroundColor: BRAND.ground }}>
    <div style={{ position: "absolute", inset: 0, padding: `0 ${t.pad}px`, display: "flex", alignItems: "center" }}>
      <Logo w={t.logo} />
      <div style={{ width: 1, height: Math.round(t.h * 0.47), margin: "0 16px", background: BRAND.body, opacity: 0.35, flexShrink: 0 }} />
      <div style={{ flexShrink: 0 }}>{head}</div>
      <div style={{ flex: 1, minWidth: 16 }} />
      <div style={{ flexShrink: 0 }}>{children}</div>
      <div style={{ flex: 1, minWidth: 16 }} />
      <Cta t={t} label={cta} />
    </div>
  </AbsoluteFill>
);
// (the divider's opacity is fine: it never animates, so it adds one flat colour, not a ramp)

/* ------------------------------ register ------------------------------ */

/** One comp per ad x size, all sharing the source's fps and loop. */
export const BannerCompositions: React.FC<{ ads: [string, React.FC<{ s: Size }>][] }> = ({ ads }) => (
  <>
    {ads.flatMap(([id, C]) =>
      Object.keys(TOK).map((s) => (
        <Composition key={`${id}-${s}`} id={`${id}-${s}`} component={C} defaultProps={{ s }} durationInFrames={LOOP} fps={FPS} width={TOK[s].w} height={TOK[s].h} />
      )),
    )}
  </>
);
