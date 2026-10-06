# Shift the gold routes in the supplied globe image to brand Violet (#6C3AED).
# python3 site/art/recolour.py site/art/source/liquidity-globe-original.webp site/src/assets/img/liquidity-globe.webp preview.png
import sys, numpy as np
from PIL import Image
src, out, preview = sys.argv[1:4]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
hsv = np.asarray(Image.open(src).convert('RGB').convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
# weight: gold/amber hues (20-65 deg), fading out by 80 deg; only reasonably saturated pixels
hue_w = np.clip((80 - h) / 15, 0, 1) * np.clip((h - 8) / 12, 0, 1)
sat_w = np.clip((s - 0.07) / 0.10, 0, 1)
w = hue_w * sat_w
# target: brand Violet #6C3AED (hue ~263), lifted slightly so glows stay luminous on Midnight
target = np.array(Image.new('RGB', (1, 1), (108, 58, 237)).convert('HSV')).astype(np.float32).reshape(3)
th = target[0]
new_h = h * (1 - w) + (th * 360 / 255) * w
new_s = np.clip(s * (1 - w) + np.minimum(1, s * 1.5 + 0.05) * w, 0, 1)
new_v = np.clip(v * (1 - w) + np.minimum(1, v * 1.08) * w, 0, 1)
out_hsv = np.stack([new_h * 255 / 360, new_s * 255, new_v * 255], -1).round().clip(0, 255).astype(np.uint8)
im = Image.fromarray(out_hsv, 'HSV').convert('RGB')
im.save(out, 'WEBP', quality=84, method=6)
before = Image.open(src).convert('RGB')
w2 = before.width // 2
sheet = Image.new('RGB', (w2 * 2 + 10, before.height // 2), 'white')
sheet.paste(before.resize((w2, before.height // 2)), (0, 0)); sheet.paste(im.resize((w2, before.height // 2)), (w2 + 10, 0))
sheet.save(preview)
print('pixels shifted (w>0.5):', int((w > 0.5).sum()))
