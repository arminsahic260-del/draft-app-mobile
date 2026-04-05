// Generates DraftDiff app icon, adaptive icon, splash icon, and favicon.
// Run: node scripts/generate-icons.mjs

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

const DARK = '#0a0a13';
const GOLD = '#c89b3c';
const GOLD_LIGHT = '#f0e6d2';
const CARD = '#13132b';

// App icon — 1024x1024
// Gold "DD" monogram on dark bg with subtle gold border
const iconSvg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e0e1a"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="50%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="#8a6a1e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>

  <!-- Subtle inner glow -->
  <rect x="40" y="40" width="944" height="944" rx="185" fill="url(#accent)"/>

  <!-- Gold border -->
  <rect x="32" y="32" width="960" height="960" rx="190" fill="none" stroke="${GOLD}" stroke-width="6" stroke-opacity="0.5"/>

  <!-- Decorative diamond above text -->
  <polygon points="512,200 540,240 512,280 484,240" fill="url(#gold)" opacity="0.8"/>

  <!-- "DD" monogram -->
  <text x="512" y="600" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="380" fill="url(#gold)" letter-spacing="-20">DD</text>

  <!-- "DRAFTDIFF" subtitle -->
  <text x="512" y="740" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="72" fill="${GOLD}" letter-spacing="18" opacity="0.7">DRAFTDIFF</text>

  <!-- Thin decorative line below subtitle -->
  <line x1="300" y1="780" x2="724" y2="780" stroke="${GOLD}" stroke-width="2" stroke-opacity="0.3"/>
</svg>`;

// Adaptive icon foreground — 1024x1024, transparent bg, content in safe zone (center 66%)
const adaptiveSvg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="50%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="#8a6a1e"/>
    </linearGradient>
  </defs>

  <!-- Diamond -->
  <polygon points="512,250 534,282 512,314 490,282" fill="url(#gold2)" opacity="0.8"/>

  <!-- "DD" monogram — centered in safe zone -->
  <text x="512" y="560" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="300" fill="url(#gold2)" letter-spacing="-16">DD</text>

  <!-- Subtitle -->
  <text x="512" y="680" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="60" fill="${GOLD}" letter-spacing="14" opacity="0.7">DRAFTDIFF</text>
</svg>`;

// Splash icon — 200x200 simple mark
const splashSvg = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="50%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="#8a6a1e"/>
    </linearGradient>
  </defs>
  <polygon points="100,22 108,38 100,54 92,38" fill="url(#gold3)" opacity="0.8"/>
  <text x="100" y="126" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="76" fill="url(#gold3)" letter-spacing="-4">DD</text>
  <text x="100" y="164" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="16" fill="${GOLD}" letter-spacing="6" opacity="0.7">DRAFTDIFF</text>
</svg>`;

// Favicon — 48x48
const faviconSvg = `
<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="${DARK}"/>
  <rect x="2" y="2" width="44" height="44" rx="9" fill="none" stroke="${GOLD}" stroke-width="1.5" stroke-opacity="0.5"/>
  <text x="24" y="33" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="24" fill="${GOLD}">DD</text>
</svg>`;

async function generate() {
  // icon.png — 1024x1024
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(ASSETS, 'icon.png'));
  console.log('  icon.png (1024x1024)');

  // adaptive-icon.png — 1024x1024
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(ASSETS, 'adaptive-icon.png'));
  console.log('  adaptive-icon.png (1024x1024)');

  // splash-icon.png — 200x200
  await sharp(Buffer.from(splashSvg))
    .resize(200, 200)
    .png()
    .toFile(join(ASSETS, 'splash-icon.png'));
  console.log('  splash-icon.png (200x200)');

  // favicon.png — 48x48
  await sharp(Buffer.from(faviconSvg))
    .resize(48, 48)
    .png()
    .toFile(join(ASSETS, 'favicon.png'));
  console.log('  favicon.png (48x48)');

  console.log('Done!');
}

generate().catch((err) => { console.error(err); process.exit(1); });
