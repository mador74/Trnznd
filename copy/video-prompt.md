# TRNZND — Scroll-Driven Hero Video Prompt

> For Adobe Firefly video (or any image-to-video / text-to-video tool).
> Output target: `assets/videos/BRAND-scroll-background.mp4`
> 16:9 · 12–16 s · one continuous cinematic product film · scroll-scrub friendly.
>
> **Reference images (attach as visual references / keyframes):**
> 1. `assets/references/BRAND_hero_reference.png` — hero composition + product design
> 2. `assets/references/BRAND_material_reference.png` — material / texture / accent ring
> 3. `assets/references/BRAND_workspace_reference.png` — environment / mood
>
> Motion is **linear and constant** (no ease-in/out), so scrubbing feels even at every scroll position.

---

## A. Master prompt — single continuous shot (long-form tools)

```
One continuous premium cinematic product film, 16:9, about 14 seconds, no cuts, seamless.

Subject: a sculptural open-ring desk artifact — an incomplete ensō circle machined from a single piece of dark brushed gunmetal titanium with a fine matte grain, one clean tapered gap where the ends narrow to points, and a recessed frosted-glass inner channel glowing soft teal (#00D4AA), brightest near the gap. It stands slightly tilted in a minimal machined base of the same dark metal. The artifact is identical to the reference images and stays perfectly consistent in shape, finish, and proportion throughout.

The camera performs a single unbroken, very slow move in three seamless phases:

Phase 1 — HERO (approx first third): a slow macro push-in through a deep midnight-blue void toward the standing ring resting on polished dark stone. A faint architectural grid and orbital dot pattern sit far behind in shadow; a soft teal rim light traces the ring's edge; a low teal-to-electric-blue gradient bloom glows near the floor. Its teal channel reflects gently on the stone.

Phase 2 — MATERIAL (approx middle third): the push-in continues until the frame glides across the ring's surface in extreme macro — brushed-metal grain, crisp micro-bevels catching a hard raking light, and the frosted glass glowing from within in teal with soft internal caustics. A gentle orbital slide travels along the glowing channel.

Phase 3 — ENVIRONMENT (approx final third): the camera eases back and racks focus to reveal the artifact resting as the sharp-focus hero on a dark glass treasury desk in a global trading floor after hours — no people. Deeply out-of-focus monitors emit a faint teal and electric-blue data glow, and a night-city skyline sits behind as soft bokeh. The move settles on a calm, wide establishing frame with the ring offset to the right.

Motion: constant, smooth, linear velocity throughout; slow macro camera; subtle orbital drift with a gentle push-in then pull-back only. Lighting: low-key cinematic with teal rim light, high contrast, slightly desaturated with a subtle teal color grade. Composition: keep generous empty negative space on the left and center-left across all phases for website headlines and buttons. Atmosphere: institutional, premium, minimal, quietly powerful.

Palette: Midnight #0A0F1E background, teal #00D4AA primary accent, electric-blue #0088FF secondary used sparingly. Photorealistic, ultra-detailed.
```

**Negative prompt / avoid:**
```
people, hands, faces, text, letters, numbers, readable glyphs, UI, logos, watermark, brand marks, fast motion, quick zoom, camera shake, handheld, whip pan, jump cuts, hard cuts, flicker, strobing, heavy particles, smoke, lens flare overload, bokeh spam, distorted or morphing geometry, changing product shape, extra rings, oversaturation, neon overload, cluttered background, busy composition
```

---

## B. Fallback — 3 chained segments (for ~5 s-capped tools like Firefly video)

Generate three image-to-video clips, each anchored to one reference as the **start frame**, then hand them to me and I'll stitch + encode the final MP4. Keep motion slow and linear in each.

**Segment 1 — from `BRAND_hero_reference.png` (≈5 s)**
```
Image-to-video. Very slow macro push-in toward the standing brushed-gunmetal open ring with the teal-glowing inner channel, on polished dark stone in a midnight void. Faint grid and orbital dots far behind; soft teal rim light; low teal-to-blue gradient bloom. Constant slow linear motion, no shake, no cuts. Keep empty negative space on the left. End slightly closer to the ring.
```

**Segment 2 — from `BRAND_material_reference.png` (≈5 s)**
```
Image-to-video. Extreme macro drift across the brushed-metal surface and the frosted glass channel glowing teal from within, micro-bevels catching a hard raking light, soft internal caustics. Gentle orbital slide along the channel. Slow constant linear motion, low-key lighting, no shake, no cuts.
```

**Segment 3 — from `BRAND_workspace_reference.png` (≈5 s)**
```
Image-to-video. Slow pull-back with a gentle rack focus revealing the ring artifact as hero on a dark glass treasury desk in a trading floor after hours — no people. Out-of-focus data-glow monitors and a night-city skyline bokeh behind. Settle on a wide calm frame with the ring offset right and empty negative space on the left. Slow constant linear motion, no shake, no cuts.
```

Transitions between segments: soft ~0.5 s cross-dissolves (never hard cuts), so it reads as one film.

---

## C. Settings

- Aspect ratio: **16:9** (1920×1080 delivery; 3840×2160 if available)
- Duration: **12–16 s** total (≈14 s ideal; or 3 × ~5 s chained)
- Frame rate: **30 fps** (24 fps acceptable)
- Motion strength: **low** — slow macro only
- Camera: push-in → macro → pull-back reveal; subtle orbital; linear velocity
- Seed: lock/reuse a seed across regenerations for consistency
- Reference/keyframe images: attach the three files above in phase order

---

## D. Scroll-scrub encoding (I can do this here with ffmpeg once clips exist)

For frame-accurate scrubbing, the final MP4 should be encoded with **dense keyframes** and web fast-start, e.g.:

```
ffmpeg -i input.mov -an -c:v libx264 -pix_fmt yuv420p -profile:v high \
  -g 1 -keyint_min 1 -sc_threshold 0 -crf 18 -movflags +faststart \
  assets/videos/BRAND-scroll-background.mp4
```

(`-g 1` = every frame is a keyframe → smooth scrub in both directions. Also export a `.webm`/poster frame if the site needs fallbacks.) Hand me the raw clip(s) and I'll stitch, grade for consistency, strip audio, and produce the final `assets/videos/BRAND-scroll-background.mp4`.
```
