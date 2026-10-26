---
name: gif-banners-multisize
description: Resize one animated ad (a GIF, a Remotion comp, a Figma frame or a square social ad) into a full set of animated GIF display banners at ANY sizes the user lists (leaderboards, skyscrapers, half-pages, MPUs, mobile banners, programmatic/DSP specs like The Trade Desk, Google Ads, DV360), keeping senior-art-director rules on type size, layout, CTA spacing, motion and GIF encoding. Use whenever the user says "resize this gif", "make the banner sizes", "TTD sizes", "display ad resizes", "do this in 728x90 / 300x250 / 160x600 ...", "rebuild this ad for these specs", shares a list of banner dimensions or a file-size cap, or asks to fix/adjust one size of an existing banner set — even if they don't say "skill" or "banner".
---

# GIF banners, any set of sizes

One ad in, a set of animated GIF banners out, one per size the user lists. The sizes, the file-size cap and the frame rate always come from the user or the platform's spec sheet for *this* job — never assume a set. What stays constant across jobs is how the work is judged, which is the user's own feedback, collected below.

The standard is a senior art director's: every size should look designed for that size, not shrunk into it.

## Before you build

1. **Get the source and the spec.** Source ad (GIF/MP4/Remotion comp/Figma), the list of sizes, the platform's KB cap, where to save and how to name files. If a size list arrives as a screenshot of file names, copy the naming pattern exactly (usually `<original name>_<WxH>.gif`).
2. **Ask about versions once per job.** Banner jobs usually overwrite the same file names when revising (the ad server/trafficker expects stable names), unlike the user's design work, which saves new versions. Ask; don't guess.
3. **Pull the exact copy and brand from the source.** Decode the source frame by frame and read every message it shows over the whole loop: headline(s), stat, body, payoff line, CTA. Use the copy word for word from the source, even if the user paraphrases it in chat (point out the difference in one line). Get the brand colours, fonts and logo from the source project or brand files. Never estimate them from a screenshot.
4. **If you can't open something** (a link, a locked drive, a font), say so up front instead of working around it silently.

## Layout rules (apply at every size)

- **Type as large as the size allows.** Fit each text block to the space it has: measure the rendered ink width and height, then step the size up until it hits the limiting edge. Don't settle on a "safe" small size. When the user asks for something to be "as large as possible", fit to the constraint they name (e.g. "keep it the width of the line above").
- **Bigger, not denser.** "Higher resolution" on display banners means bigger type. Banners stay at exact 1x pixel dimensions, because ad servers reject anything else. Don't make @2x unless the user asks for it.
- **The CTA always has breathing room.** Leave a fixed buffer above the CTA (or beside it on a leaderboard) that copy can never cross, including partway through the animation. Check the closest approach across the whole loop, not just the final frame.
- **One layout system per size.** Vertical sizes: logo top, CTA bottom, groups between them separated by equal flexible gaps, so spacing is even and nothing can drift into the CTA. Leaderboards: logo | divider | headline | message slot | CTA on one centre line, with equal flexible gaps.
- **Keep all the messages.** Every message in the source must appear at every size. If a size can't hold them all at once (leaderboards, small MPUs), show them **in sequence in the same slot**, never by dropping one. Don't remove a key element (a photo, a stat, the payoff line) without asking.
- **Keep the source's graphic devices** (timelines, dot lines, charts, icons) at sizes where they fit, scaled to the width of the text block they belong to. When the user asks for one, it usually means a size lost it. Place it where they say (e.g. under the stat, not over it).
- **Numbers line up.** Figure columns align, and a count-up reserves the final value's width so the copy beside it never shifts while the digits change.
- **Narrow sizes:** break lines by hand where the words read naturally. Let the CTA go full width if its label would otherwise squeeze.
- **No all-caps, no italics, no eyebrow labels** unless the source uses them.

## Motion rules

- **Frame 0 = logo + headline + CTA only.** The rest builds in. Don't rotate the loop to start on the finished ad; the user rejected that.
- **One simple move per element:** a short fade with a small rise, landing on whole pixels. No overshoot or bounce easing, no masks (masked type reads as cut off mid-move).
- **Never two states on screen at once.** When one slot holds two messages, the first leaves completely before the second arrives. Give each message enough hold time to be read. A stat plus a sentence needs about 2.5s or more.
- **Whole pixels only.** Round every translate and size. Sub-pixel motion re-antialiases edges every frame, which reads as shimmer.
- **Solid colours.** Don't use semi-transparent text: flatten it to the solid colour it shows on the background. No blurred box-shadows. Both create in-between colours the GIF palette can't hold.
- **Small sizes end on a complete static frame** that reads as a finished ad.
- Keep the source's loop length and timing beats unless the user asks otherwise, so the set feels like one campaign.

## Build pipeline

Build the set in Remotion: one composition per `<ad>-<size>`, all sharing the source's fps and duration. `references/kit.tsx` has the layout and motion primitives that encode the rules above (equal-gap vertical frame, leaderboard frame, CTA, fade-and-rise, count-up with reserved width, two-message slot). Copy it into the project and fill its `TOK` table with this job's sizes. The token values are worked out per job, not copied from an old one.

1. **Lay out** each size with the kit. Render stills at the key beats (first frame, mid-build, each message settled, end of the loop) and look at them before encoding.
2. **Fit type by measurement.** Render, measure the ink box (`scripts/audit.mjs` prints it), adjust, repeat. Never adjust by eye alone.
3. **Encode** with `scripts/build-gifs.mjs`. It renders the frames and builds one global 256-colour palette over the whole loop, weighted toward rare edge shades, with brand colours pinned exactly. It maps every pixel to its nearest palette colour with no dither and no lossy compression, then runs gifsicle `-O3`. Even gifsicle `--lossy` at low settings leaves specks on type, so don't use it on banners.
4. **Hit the KB cap** by lowering that size's frame rate (`NTH=2` renders every 2nd frame). Never use lossy compression, dithering or a smaller palette.
5. **Audit** every size with `scripts/audit.mjs` before delivering. It checks the whole loop for anything past the safe margins and reports the closest approach to the CTA.
6. **Check the encoded GIFs, not just the stills.** Decode every frame in order (see "Reading GIFs" below) and look at the key beats.

## Delivering

Save to the folder and names the user gave. Report briefly: where the files are, each file's KB size against the cap, and anything the user should decide (a paraphrase you didn't use, an element that couldn't fit). Skip a long recap. If a revision touches only one size, change only that size and leave the other files alone.

## Reading GIFs (gotchas)

- GIF frames are partial updates, so **seeking into a GIF (`ffmpeg -ss`) shows wrong, washed-out frames**. Decode from the start with `ffmpeg -i in.gif -vsync 0 frames/f%03d.png` and pick the frames you need.
- The Remotion project ships an ffmpeg/ffprobe in `node_modules/@remotion/compositor-<platform>/` (set `DYLD_LIBRARY_PATH` to that folder on macOS). It has almost no filters, so use plain decoding only.
- Frames near the end of the loop are mid-outro and look faded on purpose. Judge the settled state from the middle of each message's hold.
- gifsicle merges identical frames, so the frame count is lower than rendered. The total duration is still correct.
- Run Node scripts from inside the Remotion project (copy them to its `_resize/` folder) so `@remotion/*`, `gifenc` and `pngjs` resolve.
- Remotion only passes environment variables into the bundle through its own config. For quick size sweeps, edit a constant and re-render instead.

## Dependencies

Remotion project with `@remotion/bundler`, `@remotion/renderer`, `gifenc`, `pngjs` (`npm i -D gifenc pngjs`), and `gifsicle` on PATH (`brew install gifsicle`). Use Node for scripting, not Python.
