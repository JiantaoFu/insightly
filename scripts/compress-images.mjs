import sharp from 'sharp';
import { statSync } from 'fs';
import path from 'path';

const targets = [
  { src: 'public/hero-banner.png', out: 'public/hero-banner.webp', quality: 80 },
  { src: 'public/blogs/how-to-find-app-ideas.png', out: 'public/blogs/how-to-find-app-ideas.webp', quality: 80 },
  { src: 'public/blogs/app-review-analysis.png', out: 'public/blogs/app-review-analysis.webp', quality: 80 },
];

for (const { src, out, quality } of targets) {
  const before = statSync(src).size;
  await sharp(src).webp({ quality }).toFile(out);
  const after = statSync(out).size;
  const pct = (100 * (1 - after / before)).toFixed(0);
  console.log(`${path.basename(src)}: ${(before / 1024).toFixed(0)}KB -> ${path.basename(out)}: ${(after / 1024).toFixed(0)}KB (-${pct}%)`);
}
