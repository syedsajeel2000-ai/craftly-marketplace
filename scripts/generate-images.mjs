/**
 * Generates original, license-safe SVG artwork for every seeded product,
 * category and seller avatar. No copyrighted / Etsy assets are used.
 *
 * Output: public/images/...
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'images');

const palettes = [
  ['#F97316', '#7C2D12'],
  ['#0EA5E9', '#0C4A6E'],
  ['#10B981', '#064E3B'],
  ['#F59E0B', '#78350F'],
  ['#8B5CF6', '#3B0764'],
  ['#EC4899', '#831843'],
  ['#14B8A6', '#134E4A'],
  ['#EF4444', '#7F1D1D'],
  ['#6366F1', '#1E1B4B'],
  ['#84CC16', '#365314'],
  ['#F43F5E', '#881337'],
  ['#06B6D4', '#164E63'],
];

/** Decorative craft-inspired glyphs drawn inside the card */
const glyphs = {
  necklace:
    '<circle cx="200" cy="150" r="70" fill="none" stroke="white" stroke-width="8" opacity="0.85"/><circle cx="200" cy="245" r="26" fill="white" opacity="0.9"/>',
  ring:
    '<circle cx="200" cy="210" r="62" fill="none" stroke="white" stroke-width="14" opacity="0.9"/><path d="M170 148 L200 108 L230 148 Z" fill="white" opacity="0.9"/>',
  mug:
    '<rect x="140" y="140" width="100" height="120" rx="16" fill="none" stroke="white" stroke-width="10" opacity="0.9"/><path d="M240 170 h30 a30 30 0 0 1 0 60 h-30" fill="none" stroke="white" stroke-width="10" opacity="0.9"/>',
  vase:
    '<path d="M170 120 q-30 60 0 120 q30 60 60 0 q30 -60 0 -120 q-15 -40 -30 -40 q-15 0 -30 40 Z" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><path d="M200 100 v-40 M200 60 q-30 -20 -40 -50 M200 70 q30 -15 45 -45" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" opacity="0.8"/>',
  frame:
    '<rect x="120" y="110" width="160" height="180" rx="8" fill="none" stroke="white" stroke-width="10" opacity="0.9"/><path d="M145 250 L190 185 L225 235 L250 205 L265 250 Z" fill="white" opacity="0.85"/><circle cx="245" cy="150" r="16" fill="white" opacity="0.85"/>',
  shirt:
    '<path d="M150 130 L120 165 L150 195 L165 180 V280 H235 V180 L250 195 L280 165 L250 130 L225 145 q-25 22 -50 0 Z" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" opacity="0.9"/>',
  gift:
    '<rect x="125" y="160" width="150" height="110" rx="10" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><path d="M200 160 V270 M125 200 H275" stroke="white" stroke-width="9" opacity="0.9"/><path d="M200 160 q-45 -55 -70 -20 q-15 30 70 20 q85 -10 70 -20 q-25 -35 -70 20 Z" fill="white" opacity="0.85"/>',
  crown:
    '<path d="M130 250 L150 140 L185 200 L200 120 L215 200 L250 140 L270 250 Z" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" opacity="0.9"/><circle cx="200" cy="235" r="10" fill="white" opacity="0.9"/>',
  watch:
    '<circle cx="200" cy="205" r="60" fill="none" stroke="white" stroke-width="10" opacity="0.9"/><path d="M200 165 V205 L230 225" fill="none" stroke="white" stroke-width="9" stroke-linecap="round" opacity="0.9"/><path d="M170 150 L165 110 h70 l-5 40 M170 260 l-5 40 h70 l-5 -40" fill="none" stroke="white" stroke-width="9" opacity="0.85"/>',
  download:
    '<path d="M200 110 V215 M160 180 L200 222 L240 180" fill="none" stroke="white" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/><path d="M130 250 V285 H270 V250" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" opacity="0.85"/>',
  print:
    '<rect x="120" y="120" width="160" height="130" rx="10" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><rect x="155" y="265" width="90" height="45" rx="8" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><circle cx="255" cy="150" r="10" fill="white"/><path d="M145 225 L180 180 L205 210 L230 185 L260 225 Z" fill="white" opacity="0.85"/>',
  lamp:
    '<path d="M155 130 L245 130 L270 200 H130 Z" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" opacity="0.9"/><path d="M200 200 V285 M160 290 H240" stroke="white" stroke-width="9" stroke-linecap="round" opacity="0.9"/>',
  camera:
    '<rect x="115" y="155" width="170" height="115" rx="16" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><circle cx="200" cy="212" r="36" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><rect x="160" y="130" width="50" height="28" rx="8" fill="white" opacity="0.85"/>',
  book:
    '<path d="M130 130 h60 q10 0 10 10 v140 q0 -10 -10 -10 h-60 Z M270 130 h-60 q-10 0 -10 10 v140 q0 -10 10 -10 h60 Z" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" opacity="0.9"/>',
  candle:
    '<rect x="165" y="180" width="70" height="100" rx="10" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><path d="M200 175 q-22 -25 0 -55 q22 30 0 55 Z" fill="white" opacity="0.9"/><path d="M200 120 v-30" stroke="white" stroke-width="7" stroke-linecap="round" opacity="0.7"/>',
  basket:
    '<path d="M130 180 H270 L250 285 H150 Z" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" opacity="0.9"/><path d="M160 180 q0 -60 40 -60 q40 0 40 60" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><path d="M165 215 H245 M172 250 H238" stroke="white" stroke-width="7" opacity="0.8"/>',
  hat:
    '<path d="M140 240 q0 -110 60 -110 q60 0 60 110" fill="none" stroke="white" stroke-width="9" opacity="0.9"/><path d="M110 240 H290" stroke="white" stroke-width="12" stroke-linecap="round" opacity="0.9"/><path d="M155 215 q45 -25 90 0" fill="none" stroke="white" stroke-width="7" opacity="0.8"/>',
};

const genericGlyph =
  '<circle cx="200" cy="200" r="80" fill="none" stroke="white" stroke-width="10" opacity="0.9"/><path d="M200 130 L218 182 L272 182 L228 214 L246 266 L200 234 L154 266 L172 214 L128 182 L182 182 Z" fill="white" opacity="0.88"/>';

/** FNV-1a string hash — turns a product title (+variant) into a stable number. */
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) so every render of a seed is identical. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One of 7 background textures, picked and parameterised by hash so every
 * listing gets artwork that no other listing shares.
 */
function backdropPattern(h) {
  const rand = rng(h);
  const op = (0.06 + rand() * 0.06).toFixed(3);
  const kind = h % 7;
  if (kind === 0) {
    const gap = 34 + Math.floor(rand() * 30);
    const lines = Array.from({ length: 14 }, (_, i) =>
      `<line x1="${-200 + i * gap}" y1="400" x2="${i * gap}" y2="0" stroke="white" stroke-width="${6 + Math.floor(rand() * 10)}" opacity="${op}"/>`
    ).join('');
    return `<g>${lines}</g>`;
  }
  if (kind === 1) {
    const cx = 60 + Math.floor(rand() * 280);
    const cy = 60 + Math.floor(rand() * 280);
    return Array.from({ length: 5 }, (_, i) =>
      `<circle cx="${cx}" cy="${cy}" r="${45 + i * (34 + Math.floor(rand() * 20))}" fill="none" stroke="white" stroke-width="${3 + Math.floor(rand() * 5)}" opacity="${op}"/>`
    ).join('');
  }
  if (kind === 2) {
    const gap = 36 + Math.floor(rand() * 24);
    const r = 3 + Math.floor(rand() * 5);
    let dots = '';
    for (let x = gap / 2; x < 400; x += gap) {
      for (let y = gap / 2; y < 400; y += gap) {
        dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="white" opacity="${op}"/>`;
      }
    }
    return dots;
  }
  if (kind === 3) {
    const amp = 16 + Math.floor(rand() * 22);
    const waves = Array.from({ length: 6 }, (_, i) => {
      const y = 40 + i * 64;
      return `<path d="M0 ${y} q50 -${amp} 100 0 t100 0 t100 0 t100 0" fill="none" stroke="white" stroke-width="${4 + Math.floor(rand() * 5)}" opacity="${op}"/>`;
    }).join('');
    return waves;
  }
  if (kind === 4) {
    return Array.from({ length: 9 }, () => {
      const s = 16 + Math.floor(rand() * 54);
      const x = Math.floor(rand() * 380);
      const y = Math.floor(rand() * 380);
      const rot = Math.floor(rand() * 360);
      return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="white" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;
    }).join('');
  }
  if (kind === 5) {
    const ox = Math.floor(rand() * 400);
    const oy = Math.floor(rand() * 400);
    return Array.from({ length: 9 }, (_, i) => {
      const a1 = ((i * 40 + Math.floor(rand() * 20)) * Math.PI) / 180;
      const a2 = (((i + 1) * 40) * Math.PI) / 180;
      const R = 520;
      const x1 = ox + Math.cos(a1) * R; const y1 = oy + Math.sin(a1) * R;
      const x2 = ox + Math.cos(a2) * R; const y2 = oy + Math.sin(a2) * R;
      return `<path d="M${ox} ${oy} L${x1.toFixed(0)} ${y1.toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)} Z" fill="white" opacity="${op}"/>`;
    }).join('');
  }
  // kind === 6: soft bokeh bubbles
  return Array.from({ length: 7 }, () => {
    const r = 20 + Math.floor(rand() * 70);
    const cx = Math.floor(rand() * 400);
    const cy = Math.floor(rand() * 400);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${op}"/>`;
  }).join('');
}

/**
 * Unique product artwork. Every listing (and every one of its gallery
 * variants) hashes its own title + variant seed, which drives the palette
 * pair, gradient angle, background texture, accent bubbles and glyph — so no
 * two listings ever share an image.
 */
export function productSvg(seed, glyphKey = 'necklace', label = '') {
  const h = hashStr(`${label || 'product'}#${seed}`);
  const p1 = palettes[h % palettes.length];
  const p2 = palettes[(h >>> 7) % palettes.length];
  const g = glyphs[glyphKey] || genericGlyph;
  const angle = h % 360;
  const gid = `g${(h % 1e9).toString(36)}`;
  const rand = rng(h ^ 0x9e3779b9);
  const bubbles = Array.from({ length: 6 }, (_, i) => {
    const cx = Math.floor(rand() * 400);
    const cy = Math.floor(rand() * 400);
    const r = 16 + Math.floor(rand() * 46);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="0.06"/>`;
  }).join('');
  // stitched border with a hash-driven dash count — another uniqueness cue
  const dash = 6 + (h % 9);
  const stitch = `<rect x="14" y="14" width="372" height="372" rx="18" fill="none" stroke="white" stroke-width="3" stroke-dasharray="${dash} ${dash + 5}" opacity="0.28"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="${label || 'Product artwork'}">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%" stop-color="${p1[0]}"/>
      <stop offset="100%" stop-color="${p2[1]}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#${gid})"/>
  ${backdropPattern(h)}
  ${bubbles}
  ${stitch}
  ${g}
</svg>`;
}

/** Pick a sensible glyph by reading the product title. */
export function glyphForTitle(title) {
  const t = title.toLowerCase();
  const table = [
    [/ring|band|signet|cuff/, 'ring'],
    [/necklace|pendant|chain|choker|bracelet|anklet|locket/, 'necklace'],
    [/earring|stud|hoop/, 'ring'],
    [/mug|cup|tumbler|pour-over/, 'mug'],
    [/vase|planter|pot\b/, 'vase'],
    [/lamp|light|lantern/, 'lamp'],
    [/print|poster|art|portrait|sketch|drawing/, 'print'],
    [/frame|canvas|wall hanging|throw/, 'frame'],
    [/shirt|jacket|sweater|scarf|apparel|linen/, 'shirt'],
    [/hat|beanie|cap/, 'hat'],
    [/basket|tote|bag|holder|cushion|runner/, 'basket'],
    [/candle|holder|tealight/, 'candle'],
    [/book|planner|journal|sketchbook|wallet|pattern|recipe/, 'book'],
    [/camera|vintage|film/, 'camera'],
    [/gift|box|set|bundle|trio|kit/, 'gift'],
    [/download|icon|template|digital|font|bundle/, 'download'],
    [/watch|belt|bangle|clock/, 'watch'],
    [/pin|brooch|crown|charm/, 'crown'],
  ];
  for (const [re, key] of table) if (re.test(t)) return key;
  return 'frame';
}

export function categorySvg(seed, label) {
  const p = palettes[(seed + 5) % palettes.length];
  const shapes = Array.from({ length: 5 }, (_, i) => {
    const x = 40 + ((seed * 31 + i * 83) % 320);
    const y = 40 + ((seed * 47 + i * 61) % 320);
    const s = 26 + ((seed + i * 17) % 46);
    const rot = (seed * 13 + i * 41) % 360;
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="8" fill="white" opacity="0.12" transform="rotate(${rot} ${x} ${y})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="${label} category">
  <defs><linearGradient id="c${seed}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${p[0]}"/><stop offset="100%" stop-color="${p[1]}"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#c${seed})"/>
  ${shapes}
  <text x="200" y="215" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="700" fill="white" opacity="0.95">${label}</text>
</svg>`;
}

export function avatarSvg(seed, initials) {
  const p = palettes[(seed + 3) % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${initials} avatar">
  <defs><linearGradient id="a${seed}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${p[0]}"/><stop offset="100%" stop-color="${p[1]}"/>
  </linearGradient></defs>
  <rect width="200" height="200" fill="url(#a${seed})"/>
  <text x="100" y="124" text-anchor="middle" font-family="Georgia, serif" font-size="72" font-weight="700" fill="white" opacity="0.95">${initials}</text>
</svg>`;
}

export function writeSvg(relPath, svg) {
  const full = path.join(outDir, relPath);
  // Serverless deployments (Vercel) have a read-only filesystem, so artwork
  // cannot be generated at runtime there. Real photographs are used instead;
  // if a listing somehow still needs generated art, fall back to the static
  // placeholder rather than crashing the request that triggered the write.
  try {
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, svg);
  } catch (err) {
    if (process.env.VERCEL) return '/images/placeholder.svg';
    throw err;
  }
  return `/images/${relPath}`;
}

export { outDir, palettes };

/**
 * CLI: rewrite the artwork for every listing already in the database while
 * keeping the same file paths (so DB rows never need touching).
 *
 *   node scripts/generate-images.mjs --regen
 */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes('--regen')) {
  const { makeClient } = await import('./migrate.js');
  const db = makeClient();
  try {
    const res = await db.execute('SELECT id, title, images FROM products');
    let files = 0;
    for (const row of res.rows) {
      let images;
      try { images = JSON.parse(String(row.images || '[]')); } catch { images = []; }
      const title = String(row.title);
      const id = Number(row.id);
      for (const img of images) {
        if (typeof img !== 'string' || !img.endsWith('.svg')) continue;
        const variantMatch = img.match(/-(\d+)\.svg$/);
        const variant = variantMatch ? Number(variantMatch[1]) : 1;
        const seed = id * 3 + (variant - 1);
        const rel = img.replace(/^\/images\//, '');
        writeSvg(rel, productSvg(seed, glyphForTitle(title), title));
        files++;
      }
    }
    console.log(`Regenerated ${files} product images for ${res.rows.length} listings.`);
  } finally {
    db.close();
  }
}
