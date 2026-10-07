import { supabase } from './supabaseClient.js';
import { createSitemapService } from './utils/sitemap.js';
import { recordExpirationHours } from './utils/reportLookup.js';

// Logic lives in ./utils/sitemap.js (unit-tested in server/tests/sitemap.test.js).
const service = createSitemapService({
  supabase,
  expirationMs: () => recordExpirationHours() * 60 * 60 * 1000,
});

const defaultOrigin = () => process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export function generateSitemap(origin = defaultOrigin()) {
  return service.generate(origin);
}

export function getSitemapMeta() {
  return service.getMeta();
}

// Runs in the background after the server starts listening (server/index.js).
export async function initializeSitemap() {
  await service.refresh(defaultOrigin());
}
