import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render404 } from './build-404.mjs';

test('404 shell has its own title, noindex, and no home canonical', () => {
  const out = render404(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  assert.match(out, /<title>Page Not Found \| Insightly<\/title>/);
  assert.match(out, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(out, /rel="canonical"/);
  assert.doesNotMatch(out, /og:url/);
  assert.doesNotMatch(out, /1-Star Reviews \| Insightly<\/title>/);
});
