import { create } from 'xmlbuilder2';
import { supabase } from './supabaseClient.js';

// Static marketing/content routes that don't come from the database.
// Keep this in sync with src/App.tsx routes and src/blog/Posts.ts slugs.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/for-teams', changefreq: 'weekly', priority: '0.9' },
  { path: '/app-insights', changefreq: 'daily', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog/find-app-ideas', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/app-review-analysis', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/app-ideas-from-reviews', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/competitor-research-afternoon', changefreq: 'monthly', priority: '0.7' },
];

function addStaticUrls(root, origin) {
  const lastmod = new Date().toISOString();
  STATIC_ROUTES.forEach(route => {
    const url = root.ele('url');
    url.ele('loc').txt(`${origin}${route.path}`);
    url.ele('lastmod').txt(lastmod);
    url.ele('changefreq').txt(route.changefreq);
    url.ele('priority').txt(route.priority);
  });
}

// Cap the number of report URLs in the sitemap. The sitemap protocol allows
// max 50,000 URLs / 50MB per file, but pulling the entire analysis_reports
// table on every deploy made startup (and first requests) time out on Render.
// 20k recent reports is plenty for discovery; older reports stay reachable
// via /app-insights search.
const SITEMAP_MAX_URLS = 20000;

// Replace Set with sorted array
const sitemapState = {
  urls: [],  // Changed from Set to Array
  lastUpdateTimestamp: 0,
  initialized: false, // set true once a full unfiltered fetch has succeeded
  xml: null,
  lastGenerated: 0
};

const SITEMAP_CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Legacy rows (~1.8k imported reports) have NULL hash_url/timestamp but DO
// have a valid shareLink like https://insightly.top/shared-app-report/<hash>.
// Derive the hash from shareLink so those public pages aren't dropped from
// the sitemap. Returns null when no usable hash exists.
function toSitemapRecord(row) {
  const hash =
    row.hash_url ||
    (row.shareLink ? String(row.shareLink).split('/').filter(Boolean).pop() : null);
  if (!hash || hash === 'null' || hash === 'undefined') return null;
  return { hash_url: hash, timestamp: row.timestamp || 0 };
}

function toSitemapRecords(rows) {
  const out = [];
  for (const row of rows || []) {
    const rec = toSitemapRecord(row);
    if (rec) out.push(rec);
  }
  return out;
}

// lastmod for legacy rows without a timestamp: use a fixed old date so the
// XML stays valid; Google treats it as a hint only.
const LEGACY_LASTMOD = '2025-01-01T00:00:00.000Z';

async function fetchNewRecords(since) {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('hash_url, shareLink, timestamp')
    .gt('timestamp', since)
    .order('timestamp', { ascending: true })
    // Safety cap: on a cold start the first /sitemap.xml request can race
    // the background initializeSitemap(); without a limit this would scan
    // the whole table. 20k is plenty per hourly refresh; any remainder is
    // picked up on the next refresh since lastUpdateTimestamp only advances
    // to the max timestamp actually fetched.
    .limit(SITEMAP_MAX_URLS);

  if (error) throw error;
  return toSitemapRecords(data);
}

// Full unfiltered fetch (no timestamp filter) used by initializeSitemap and
// as a self-heal path when background init never succeeded: the incremental
// .gt('timestamp', since) query permanently excludes legacy rows whose
// timestamp is NULL, so an init failure used to leave them out forever.
async function fetchAllRecords() {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('hash_url, shareLink, timestamp')
    .order('timestamp', { ascending: false, nullsFirst: false })
    .limit(SITEMAP_MAX_URLS);

  if (error) throw error;
  return toSitemapRecords(data);
}

async function updateSitemapUrls() {
  try {
    let newRecords;
    if (!sitemapState.initialized) {
      // Background init never succeeded (or hasn't run yet): do the full
      // unfiltered fetch so legacy NULL-timestamp rows aren't lost. This
      // runs lazily on a sitemap request, never blocking server startup.
      const all = await fetchAllRecords();
      sitemapState.urls = all.sort((a, b) => b.timestamp - a.timestamp);
      let maxTimestamp = 0;
      for (const record of all) {
        if (record.timestamp > maxTimestamp) maxTimestamp = record.timestamp;
      }
      sitemapState.lastUpdateTimestamp = all.length > 0 ? maxTimestamp : Date.now();
      sitemapState.initialized = true;
      sitemapState.xml = null;
      console.log(`Sitemap self-heal: loaded ${all.length} URLs without background init`);
      return sitemapState.urls.length;
    }

    newRecords = await fetchNewRecords(sitemapState.lastUpdateTimestamp);

    if (newRecords.length > 0) {
      // Records are already in { hash_url, timestamp } shape
      const formattedRecords = newRecords;

      // If urls array is empty, just assign sorted new records
      if (sitemapState.urls.length === 0) {
        sitemapState.urls = formattedRecords.sort((a, b) => b.timestamp - a.timestamp);
      } else {
        // Merge new records maintaining sort order
        let i = 0;
        for (const record of formattedRecords) {
          while (i < sitemapState.urls.length && sitemapState.urls[i].timestamp > record.timestamp) {
            i++;
          }
          sitemapState.urls.splice(i, 0, record);
        }
      }

      // Update timestamp and invalidate cache
      sitemapState.lastUpdateTimestamp = Math.max(
        ...newRecords.map(r => r.timestamp),
        sitemapState.lastUpdateTimestamp
      );
      // Keep the sitemap capped: drop the oldest entries beyond the limit.
      if (sitemapState.urls.length > SITEMAP_MAX_URLS) {
        sitemapState.urls.length = SITEMAP_MAX_URLS;
      }
      sitemapState.xml = null;
    }

    return sitemapState.urls.length;
  } catch (error) {
    console.error('Error updating sitemap URLs:', error);
    throw error;
  }
}

function buildSitemapXml(origin) {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('urlset', {
      xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'xmlns:meta': 'http://www.google.com/schemas/sitemap-meta/1.0'
    });

  addStaticUrls(root, origin);

  // No need to sort, array is already sorted
  sitemapState.urls.forEach(record => {
    const url = root.ele('url');
    url.ele('loc').txt(`${origin}/shared-app-report/${record.hash_url}`);
    url.ele('lastmod').txt(
      record.timestamp ? new Date(record.timestamp).toISOString() : LEGACY_LASTMOD
    );
    url.ele('changefreq').txt('hourly');
    url.ele('priority').txt('0.8');
  });

  return root.end({ prettyPrint: true });
}

export async function generateSitemap(origin) {
  // Return cached version if still valid
  if (sitemapState.xml && (Date.now() - sitemapState.lastGenerated) < SITEMAP_CACHE_DURATION) {
    return sitemapState.xml;
  }

  try {
    // Update our URL set with any new records
    await updateSitemapUrls();

    const xml = buildSitemapXml(origin);

    // Update cache
    sitemapState.xml = xml;
    sitemapState.lastGenerated = Date.now();

    return xml;
  } catch (error) {
    console.error('Error generating sitemap:', error);
    throw error;
  }
}

// Update initialization to use sorted array
// Single capped query: newest reports first. Runs in the background after the
// server starts listening (see server/index.js), so a slow DB never blocks
// startup or makes the first /sitemap.xml request time out.
export async function initializeSitemap() {
  try {
    const allRecords = await fetchAllRecords();

    // Initialize the sorted array directly (already sorted desc by fetchAllRecords)
    sitemapState.urls = allRecords.sort((a, b) => b.timestamp - a.timestamp);

    // Set the last update timestamp (loop instead of Math.max(...hugeArray)
    // to avoid stack overflow on large tables)
    let maxTimestamp = 0;
    for (const record of allRecords) {
      if (record.timestamp > maxTimestamp) maxTimestamp = record.timestamp;
    }
    sitemapState.lastUpdateTimestamp = allRecords.length > 0 ? maxTimestamp : Date.now();
    sitemapState.initialized = true;

    // Generate initial XML
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    sitemapState.xml = buildSitemapXml(origin);
    sitemapState.lastGenerated = Date.now();

    console.log(`Initialized sitemap with ${sitemapState.urls.length} URLs`);
  } catch (error) {
    console.error('Error initializing sitemap:', error);
    throw error;
  }
}
