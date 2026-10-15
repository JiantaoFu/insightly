// Post-build: write dist/404.html = the SPA shell with a 404 head
// ("Page Not Found | Insightly", robots noindex, no canonical/og:url).
// netlify.toml serves it with HTTP 404 for unknown URLs, so crawlers and raw
// HTML clients don't get the home page's title/canonical on a 404.
import { readFileSync, writeFileSync } from 'node:fs';
import { applyHead, NOT_FOUND } from '../netlify/edge-lib/prerender-core.js';

export function render404(indexHtml) {
  return applyHead(indexHtml, { ...NOT_FOUND, canonical: null, robots: 'noindex', jsonLd: null });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist';
  writeFileSync(`${dir}/404.html`, render404(readFileSync(`${dir}/index.html`, 'utf8')));
  console.log(`wrote ${dir}/404.html`);
}
