# GIF Banners Multisize

A [Claude Code](https://claude.com/claude-code) skill for designers: hand Claude
**one animated ad** and a **list of banner sizes**, and it rebuilds the ad as a full
set of animated GIF display banners, each one art-directed for its size, built in
[Remotion](https://www.remotion.dev) and encoded under the platform's file-size cap.

It works for any brand, any sizes and any platform: The Trade Desk, Google Ads,
DV360, direct buys, or a custom list.

> "Here's our square social ad. Resize it to 728x90, 300x250, 300x600 and 160x600, under 150 KB each."

---

## What it does

| Step | What happens |
|---|---|
| Intake | Takes the source ad, the sizes, the KB cap, the folder and the naming pattern. Asks once whether revisions overwrite files or save new versions |
| Copy and brand | Decodes the source frame by frame and pulls every message word for word. Takes colours, fonts and logo from the source files, never from a screenshot |
| Layout | One system per size. Tall and square sizes get the logo at the top, the CTA at the bottom and equal gaps between. Leaderboards put everything on one centre line. Type is fitted by measurement to be as large as each size allows |
| Motion | Frame 0 = logo + headline + CTA. Everything else builds in with a short fade and a small rise, on whole pixels. Messages that don't fit together share one slot in sequence, never overlapping |
| Encode | One global palette per banner, brand colours pinned exactly, no dither, no lossy compression, gifsicle `-O3`. Over the cap? Lower that size's frame rate, never its quality |
| Audit | Checks every frame of the loop for content inside the safe margin and for the closest approach to the CTA, including mid-animation |
| Deliver | Files named as asked, size against the cap, and anything that needs a decision. Nothing else |

## The rules it follows

These came out of real art-direction feedback on a production banner set:

- **Type as large as the size allows.** Sharper banners come from bigger type, not @2x. Ad servers need exact pixels.
- **The CTA gets a fixed buffer** that copy can't cross, checked across the whole loop.
- **Every message survives every size.** If a leaderboard can't hold them all, they take turns in one slot.
- **Graphic devices** (timelines, dot lines, charts) stay in, scaled to the text they belong to.
- **Count-ups reserve their final width**, so the copy beside them never jitters.
- **No cross-fades, masks, overshoot, sub-pixel motion, semi-transparent text or blurred shadows.** Each one makes a GIF look glitchy or soft.
- **Copy word for word from the source**, even when a request paraphrases it.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js 18+
- A Remotion project (or let Claude create one: `npx create-video@latest`)
- `npm i -D gifenc pngjs` in that project
- [gifsicle](https://www.lcdf.org/gifsicle/) on your PATH (`brew install gifsicle`)

## Install

**As a plugin (recommended):** in Claude Code run

```
/plugin marketplace add nicolleadduci/gif-banners-multisize
/plugin install gif-banners-multisize@gif-banners-multisize
```

**As a personal skill:**

```bash
git clone https://github.com/nicolleadduci/gif-banners-multisize.git
cp -R gif-banners-multisize/skills/gif-banners-multisize ~/.claude/skills/
```

**For one project only:** copy it into `<project>/.claude/skills/` instead.

Restart Claude Code. The skill loads on its own when you ask for banner resizes,
or call it directly with `/gif-banners-multisize`.

## Use it

```
/gif-banners-multisize
Source: ./ads/spring-offer.gif
Sizes: 728x90, 300x250, 300x600, 160x600, 320x50
Cap: 150 KB each
Save to: ./banners/  as  spring-offer_<WxH>.gif
```

Give feedback per size in plain language ("on the 728, bring the timeline back under
the stat"). Claude changes only that size.

## What's inside

```
skills/gif-banners-multisize/
├── SKILL.md              the rules and the workflow Claude follows
├── scripts/
│   ├── build-gifs.mjs    render comps → GIF: global sqrt-weighted palette, pinned brand colours, no dither/lossy, gifsicle -O3
│   └── audit.mjs         whole-loop audit: safe margins, CTA clearance, ink-box measurement for fitting type
└── references/
    └── kit.tsx           Remotion primitives: VFrame, HFrame, Fx, Txt, Num, Seq, Gap (fill BRAND and TOK per job)
```

The scripts run from inside your Remotion project:

```bash
cp ~/.claude/skills/gif-banners-multisize/scripts/*.mjs _resize/
PIN="#111111,#ffffff,#ff5a1f" node _resize/build-gifs.mjs out/ spring-
node _resize/audit.mjs tmp/ spring- --pad 16 --cta "#ff5a1f" --buffer 16
```

## Limits

- GIF holds 256 colours. Moving photography will band. For photo-heavy ads, ask whether the platform takes MP4/WebM.
- Claude checks layouts by measuring rendered pixels and reading frames. Still watch the finished set at 100% before trafficking.
- Use fonts, logos and imagery you have the rights to.

## Contributing

Issues and pull requests are welcome, especially new rules from real client feedback.
Keep examples free of client names and confidential material.

## License

[MIT](LICENSE)
