/** One-off: report the upload size after applying .vercelignore. */
import fs from 'node:fs';
import path from 'node:path';

const root = '.';
const ign = fs.readFileSync('.vercelignore', 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('#'));

const ignored = (rel) => ign.some((p) => rel === p || rel.startsWith(p.replace(/\/$/, '') + '/'));
const skip = new Set(['node_modules', '.git', '.vercel', 'data']);

let total = 0;
let files = 0;
const big = [];
const byTop = {};

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dir, e.name).split(path.sep).join('/');
    if (ignored(rel)) continue;
    if (e.isDirectory()) {
      if (skip.has(e.name)) continue;
      walk(rel);
    } else {
      const size = fs.statSync(rel).size;
      total += size;
      files += 1;
      byTop[rel.split('/')[0]] = (byTop[rel.split('/')[0]] || 0) + 1;
      if (size > 1e6) big.push([rel, `${(size / 1e6).toFixed(1)}MB`]);
    }
  }
})(root);

console.log('files:', files, ' size:', `${(total / 1e6).toFixed(1)}MB`);
console.log('by area:', Object.entries(byTop).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('largest:', big.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])).slice(0, 5).map((b) => b.join(' ')).join(', '));
console.log('under Vercel 100MB limit:', total < 100e6 ? 'YES' : 'NO');
