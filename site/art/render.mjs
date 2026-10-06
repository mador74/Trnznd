// Renders the brand artwork in scenes.html to WebP files in site/src/assets/img.
// Needs Playwright with Chromium (not a site dependency):
//   NODE_PATH=$(npm root -g) node site/art/render.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'assets', 'img');

// name, scene, width, height, seed
const IMAGES = [
  ['trade-routes', 'globe', 1920, 1200, 7],
  ['trade-routes-wide', 'globe', 2400, 1200, 7],
  ['global-network', 'globe-centre', 1920, 1200, 11],
  ['enso-light', 'enso', 1920, 1200, 5],
  ['stability', 'stability', 1920, 1200, 3],
  ['stability-wide', 'stability', 2400, 1200, 3],
  ['settlement-flow', 'flow', 1920, 1200, 9],
  ['reserve', 'reserve', 1920, 1200, 4],
  ['og-image', 'globe', 1200, 630, 7],
];

const tmp = mkdtempSync(join(tmpdir(), 'trnznd-art-'));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, scene, w, h, seed] of IMAGES) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${pathToFileURL(join(here, 'scenes.html'))}?scene=${scene}&w=${w}&h=${h}&seed=${seed}`);
  await page.waitForFunction(() => document.title === 'done');
  const png = join(tmp, `${name}.png`);
  await page.locator('canvas').screenshot({ path: png });
  // Python/Pillow writes the WebP (or JPEG for the social card)
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
src, out, name = sys.argv[1:4]
im = Image.open(src).convert('RGB')
if name == 'og-image':
    im.save(f'{out}/{name}.jpg', 'JPEG', quality=86)
else:
    im.save(f'{out}/{name}.webp', 'WEBP', quality=82, method=6)
    if name in ('trade-routes', 'enso-light', 'stability', 'settlement-flow', 'reserve', 'global-network'):
        im.resize((960, 600), Image.LANCZOS).save(f'{out}/{name}-sm.webp', 'WEBP', quality=80, method=6)
`, png, OUT, name]);
  console.log('rendered', name);
}
await browser.close();
rmSync(tmp, { recursive: true });
