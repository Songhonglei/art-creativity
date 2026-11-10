import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd(), coverage = JSON.parse(fs.readFileSync('public/fonts/coverage.json', 'utf8'));
const covered = new Set([...coverage['zh-sans'], ...coverage.title, ...coverage.supplement]);
const missing = new Set();
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (/\.(tsx?|css)$/.test(file) && !file.endsWith('.test.ts')) for (const c of fs.readFileSync(file, 'utf8').match(/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/g) ?? []) if (!covered.has(c.codePointAt(0))) missing.add(c); } }
walk(path.join(root, 'src'));
if (missing.size) throw Error(`包内字体缺字：${[...missing].join('')}`);
const names = ['nightwatch', 'magnolia', 'neon', 'wutong-warden', 'riverside-sentinel', 'shanghai-paragon'];
for (const skin of names) for (const gender of ['male', 'female']) for (const kind of ['portrait', 'outfit']) {
  const file = `public/assets/hero/${kind}-${skin}-${gender}.webp`, bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error(`模型图片无效：${file}`);
}
console.log('字体覆盖和24张模型图片检查通过。');
