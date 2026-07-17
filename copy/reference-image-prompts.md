# TRNZND — Reference Image Generation Prompts

> Staged for Adobe Firefly (GPT Image 2), high quality, 16:9.
> Three cinematic reference stills for the landing page + video reference.
> Hero subject: the **TRNZND Enso Artifact** — kept identical across all three images.
> Constraints (every image): no people · no text baked in · no real logos or third-party marks · 16:9 · high quality.

---

## Canonical hero object — "The TRNZND Enso Artifact"

Use this exact description in every prompt so the product stays consistent:

> A sculptural open-ring desk object — an incomplete circle (ensō form) roughly 120 mm across, machined from a single piece of dark brushed titanium / gunmetal with a fine matte grain. The ring is **not closed**: one clean gap where the two ends taper to points, echoing a single deliberate brush stroke. A recessed channel of frosted dark glass runs along the inner circumference and glows with soft teal light (`#00D4AA`) — brightest near the open gap, fading gently around the arc. The ring stands slightly tilted in a minimal machined base of the same dark metal. Surfaces: brushed-metal grain, dark glass, subtle micro-bevels. Absolutely no text, engraving, symbols, or logos.

**Shared style suffix (append to each prompt):**
Premium product photography, cinematic, photorealistic, ultra-detailed. Dark low-key lighting, high contrast, slightly desaturated with a subtle teal color grade. Midnight background palette (`#0A0F1E`), teal accent (`#00D4AA`), electric-blue secondary (`#0088FF`) used sparingly. Generous negative space, institutional and understated mood. No people, no text, no logos, no brand marks. 16:9 aspect ratio, high quality.

---

## 1. Product Hero Reference → `assets/references/BRAND-hero-reference.png`

A stunning cinematic hero shot of the TRNZND Enso Artifact [canonical description above] standing upright, slightly tilted, on a polished dark stone surface in a deep Midnight studio void. Shallow depth of field with the ring's open gap in sharpest focus; the teal-lit inner channel casts a soft glow and a faint reflection on the stone. Minimal background with a barely-visible architectural grid and orbital dot pattern receding into darkness, and a soft teal→electric-blue gradient bloom low in the frame. Subtle atmospheric haze, gentle volumetric light. Keep the upper-left and center-left low-detail for later headline text. [shared style suffix]

## 2. Material Detail Reference → `assets/references/BRAND-material-reference.png`

An ultra-premium macro close-up of the TRNZND Enso Artifact [canonical description above], framed on the junction where the brushed titanium body meets the frosted dark-glass channel. Extreme material realism: fine brushed-metal grain, micro-bevels catching a hard raking light, the frosted glass glowing from within in teal (`#00D4AA`) with soft internal depth and tiny caustic highlights. Dramatic single-source low-key lighting from the side, deep shadows, high contrast. Tactile, jewel-like, cinematic. Background dissolves into Midnight black bokeh. [shared style suffix]

## 3. Environment / Mood Reference → `assets/references/BRAND-workspace-reference.png`

A cinematic institutional environment scene: the TRNZND Enso Artifact [canonical description above] resting as the sharp-focus hero on a dark glass treasury desk, in a premium global trading floor after hours — no people. Behind it, deeply out-of-focus, a wall of dark monitors with faint teal and electric-blue data glow, and a floor-to-ceiling window revealing a night-city skyline as soft bokeh. Low-key lighting, subtle teal color grade, calm and powerful atmosphere, generous negative space. The artifact's teal channel glows softly, echoed by the background lights. [shared style suffix]

---

## Generation settings (when Firefly is enabled)

- Model: GPT Image 2
- Quality: high
- Aspect ratio: 16:9
- Count: 1 per prompt (regenerate/select best)
- Save to the exact paths listed above.
