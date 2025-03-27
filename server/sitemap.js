import { create } from 'xmlbuilder2';
import { supabase } from './supabaseClient.js';

// Replace Set with sorted array
const sitemapState = {
  urls: [],  // Changed from Set to Array
  lastUpdateTimestamp: 0,
  xml: null,
  lastGenerated: 0
};

const SITEMAP_CACHE_DURATION = 3600000; // 1 hour in milliseconds

async function fetchNewRecords(since) {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('app_title, hash_url, timestamp')  // Removed description
    .gt('timestamp', since)
    .order('timestamp', { ascending: true });

  if (error) throw error;
  return data;
}

async function updateSitemapUrls() {
  try {
    const newRecords = await fetchNewRecords(sitemapState.lastUpdateTimestamp);

    if (newRecords.length > 0) {
      // Simplified record format
      const formattedRecords = newRecords.map(record => ({
        hash_url: record.hash_url,
        timestamp: record.timestamp,
        title: record.app_title
      }));

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
      sitemapState.xml = null;
    }

    return sitemapState.urls.length;
  } catch (error) {
    console.error('Error updating sitemap URLs:', error);
    throw error;
  }
}

export async function generateSitemap(origin) {
  // Return cached version if still valid
  if (sitemapState.xml && (Date.now() - sitemapState.lastGenerated) < SITEMAP_CACHE_DURATION) {
    return sitemapState.xml;
  }

  try {
    // Update our URL set with any new records
    await updateSitemapUrls();

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('urlset', {
        xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
        'xmlns:meta': 'http://www.google.com/schemas/sitemap-meta/1.0'
      });

    // No need to sort, array is already sorted
    sitemapState.urls.forEach(record => {
      const url = root.ele('url');
      url.ele('loc').txt(`${origin}/shared-app-report/${record.hash_url}`);
      url.ele('lastmod').txt(new Date(record.timestamp).toISOString());
      url.ele('changefreq').txt('hourly');
      url.ele('priority').txt('0.8');

      // Simplified metadata
      if (record.title) {
        const metaInfo = url.ele('meta:data');
        metaInfo.ele('meta:title').txt(record.title);
      }
    });

    const xml = root.end({ prettyPrint: true });

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
export async function initializeSitemap() {
  try {
    let allRecords = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error, count } = await supabase
        .from('analysis_reports')
        .select('app_title, hash_url, timestamp', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRecords = allRecords.concat(data);
      console.log(`Loaded page ${page + 1} with ${data.length} records`);

      if (data.length < pageSize) break;
      page++;
    }

    // Initialize the sorted array directly (no need to sort again as records are already sorted)
    sitemapState.urls = allRecords.map(record => ({
      hash_url: record.hash_url,
      timestamp: record.timestamp,
      title: record.app_title
    }));

    // Set the last update timestamp
    sitemapState.lastUpdateTimestamp = allRecords.length > 0
      ? Math.max(...allRecords.map(r => r.timestamp))
      : Date.now();

    // Generate initial XML
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('urlset', {
        xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
        'xmlns:meta': 'http://www.google.com/schemas/sitemap-meta/1.0'
      });

    // No need to sort, array is already sorted
    sitemapState.urls.forEach(record => {
      const url = root.ele('url');
      url.ele('loc').txt(`${origin}/shared-app-report/${record.hash_url}`);
      url.ele('lastmod').txt(new Date(record.timestamp).toISOString());
      url.ele('changefreq').txt('hourly');
      url.ele('priority').txt('0.8');

      if (record.title) {
        const metaInfo = url.ele('meta:data');
        metaInfo.ele('meta:title').txt(record.title);
      }
    });

    sitemapState.xml = root.end({ prettyPrint: true });
    sitemapState.lastGenerated = Date.now();

    console.log(`Initialized sitemap with ${sitemapState.urls.length} URLs (${page + 1} pages)`);
  } catch (error) {
    console.error('Error initializing sitemap:', error);
    throw error;
  }
}
