# Reading of the TRNZND Brand Guide V2.0 (June 2026)

This is my read-back of the guide (23 pages) before building, plus every conflict and gap I found. Page numbers refer to the PDF.

## Confirmed values

**Primary colours (p.9)**

| Name | Hex | Guide usage | Use on this site |
|---|---|---|---|
| Midnight | `#0A0F1E` | Backgrounds, text | Headings, body text, dark sections, footer |
| Teal | `#00D4AA` | Primary accent, CTA | Primary buttons, accent rules, check marks, status |
| Electric Blue | `#0088FF` | Links, data viz | Logo symbol, link underlines, focus ring, charts |
| Violet | `#6C3AED` | Premium, innovation | Only inside the brand gradient |
| Cyan | `#06B6D4` | Data, clarity | Not used (two-accent rule) |
| Deep Navy | `#111827` | Secondary dark | Cards on dark sections |

**Neutrals (p.9):** Cloud `#F9FAFB`, Mist `#E5E7EB`, Ash `#9CA3AF`, Steel `#6B7280`, Graphite `#374151`, Slate `#1F2937`.

**Brand gradient (p.9, p.22 rule 01):** Teal → Electric Blue → Violet, left to right. Used only for the 4px top rule, the footer and CTA top edges, and a faint hero wash.

**Usage ratios (p.10):** Teal 15%, Electric Blue 10%, Violet 8%, neutrals 7%.

**Typefaces (p.12):** Helvetica is primary (Bold for headings). Inter is secondary, for data and figures (the guide's sample is set in a monospaced face; see gap 6).

**Print type scale (p.12):** Display 42, H1 32, H2 24, H3 18, Body Large 14, Body 12, Caption 10, Overline 8 (uppercase).

**Buttons (p.18):** Primary has a Teal fill, Midnight text and an 18px radius. Secondary has a Teal border, Teal text and a transparent fill. The ghost link has no border, a Teal underline and text only.

**Icons (p.14):** Geometric, rounded, consistent, purposeful. **Graphics:** arc patterns derived from the logo, gradient washes for heroes, orbital dot patterns for backgrounds, generous whitespace, and no busy compositions.

**Tone (p.16):** Authoritative not arrogant, innovative not hype-driven, purposeful not preachy, precise not cold. Avoid "To the moon", "Guaranteed returns and zero risk", "game-changer" and "Disrupting the entire financial system".

**Logo rules (p.6–7, p.22):** Approved brand colours only. Keep clear space. Use supplied files. Scale proportionally. Use the icon mark at small sizes. Never stretch, recolour arbitrarily, add effects, rotate or flip, or recreate the logo in a font. Minimum size is 80px wide digitally and 20mm in print; below that, use the icon only.

**Tagline (p.22 rule 04):** All external communications must include "Purpose Beyond Payment" or the full descriptor. It appears in every footer.

## Conflicts

| # | Conflict | What I did |
|---|---|---|
| C1 | **Light or dark first?** p.10 labels Dark Mode "Primary interface mode" and Light Mode "Secondary". p.18 (Web & App Design) says "Light-First Design", and your brief also asks for light-first. | Followed p.18 and the brief, since that page governs web specifically. **Please confirm which page wins.** |
| C2 | **Secondary button text.** p.18 specifies Teal text, but Teal on white is **1.91:1**, which fails WCAG AA (4.5:1 for text). | On light backgrounds the secondary button has a Teal border and **Midnight text**. On dark backgrounds it uses Teal text as specified (10:1). |
| C3 | **Electric Blue for links.** p.9 assigns links to Electric Blue, but `#0088FF` on white is **3.52:1**, which fails for body text. | Links use Midnight text with a 2px Electric Blue underline. Blue is kept for the logo, the focus ring (non-text, 3:1 passes) and data viz. |
| C4 | **Logo colour.** The guide's Enso is the gradient, and p.22 says don't change logo colours arbitrarily. The brief asks for a solid Electric Blue Enso for Trnzit. | Treated as a deliberate sub-brand decision rather than an arbitrary change, and followed the brief. Electric Blue is an approved brand colour. **Please confirm this is sanctioned as the sub-brand rule.** |
| C5 | **Big teal numerals.** The guide's contents page uses Teal numerals on white, which fails contrast (axe-core flagged them). | Capability numerals are Midnight with a 4px Teal underline on light, and Teal on Midnight in dark sections. |
| C6 | **Gradient use.** p.9 says use the gradient "for hero elements, CTAs, and accents". The brief says use it sparingly. | Used it sparingly as the brief asks, and never on buttons. |

## Gaps (the guide is silent or incomplete)

1. **Clear space.** p.7 has a "Clear Space" heading with no content. Assumption: clear space equals the wordmark's x-height.
2. **Stacked logo proportions are inconsistent.** The Enso-to-wordmark ratio is about 0.44 on p.7, about 0.72 on p.20 and about 0.75 on p.23. I kept the horizontal lockup's exact Enso-to-wordmark scale and put a gap of 0.4 × x-height below the Enso.
3. **No sub-brand architecture.** The guide doesn't say how product names such as Trnzit relate to the TRNZND parent (lockup, endorsement line, colour).
4. **No web type scale, line heights or spacing system.** I derived them (see `tokens/design-tokens.json` and the scale below).
5. **No state colours** (error, warning, success). I added `#B91C1C` for form errors only, as an extension. Success and pending states use Teal and Electric Blue.
6. **Inter vs monospace.** p.12 calls Inter the secondary typeface, but the sample is rendered in a monospaced face. I used Inter with tabular figures.
7. **Helvetica on the web.** Helvetica isn't a free web font. The site uses the system stack ("Helvetica Neue", Helvetica, Arial), so Windows and Android will show Arial. Consistent rendering needs a web licence (e.g. Helvetica Now from Monotype). **Licensing decision needed.**
8. **Card radius, shadow, grid and breakpoints** aren't defined. I used a 16px card radius, subtle shadows, a 1200px container and breakpoints at 1080, 960, 640 and 560px.
9. **Icon set.** The guide shows principles, not a library. I drew a custom 24px set with a 1.75 stroke and round caps (`src/partials/icons.mjs`).
10. **The p.4 mission text includes a statistic** ("crush volatility by up to 70%"). It isn't used anywhere on the Trnzit site.

## Web type scale used

| Token | Guide (print) | Web | Font |
|---|---|---|---|
| Display | 42px | 44 → 72px fluid, Bold, −0.025em | Helvetica |
| H1 | 32px | 36 → 52px, Bold | Helvetica |
| H2 | 24px | 28 → 40px, Bold | Helvetica |
| H3 | 18px | 20 → 24px, Bold | Helvetica |
| H4 | n/a | 18px, Bold | Helvetica |
| Lead | 14px (Body Large) | 18 → 21px | Helvetica |
| Body | 12px | **17px**, line height 1.6 | Helvetica |
| Small / UI | 10px (Caption) | 15px | Inter |
| Label / overline | 8px uppercase | 13px uppercase, +0.08em | Inter |

Figures are tabular across body copy and every data context. Inter UI labels have `tnum` switched off, because Inter's tabular feature also fixes the width of hyphens and spaces out words like "M-of-N".

## Contrast checks (computed)

| Pair | Ratio | Result |
|---|---|---|
| Midnight on Teal (primary button) | 10.00 | AA |
| Teal on white | 1.91 | Fails, so never used for text |
| Electric Blue on white | 3.52 | Non-text and large text only |
| Electric Blue on Midnight | 5.42 | AA |
| Steel on white | 4.83 | AA (secondary text) |
| Ash on white | 2.54 | Fails, so Ash is used on dark only |
| Ash on Midnight | 7.52 | AA |
| Teal on Midnight | 10.00 | AA |
