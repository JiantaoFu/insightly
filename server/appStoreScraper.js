import store from '@jeromyfu/app-store-scraper';
import axios from 'axios';
import { parseAppleReviewFeed, parseApplePageReviews } from './reviewFeed.js';
import { calculateAverageRating, calculateScoreDistribution } from './utils.js';

// Function to extract App Store app ID from a URL
export function extractAppStoreId(url) {
  // Regex to match App Store URL patterns
  const appStoreRegex = /https?:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^/]+\/id(\d+)/;
  const match = url.match(appStoreRegex);

  if (match && match[1]) {
    return match[1];
  }

  throw new Error('Invalid App Store URL');
}

// Function to extract country code from App Store URL
export function extractCountryCode(url) {
  const countryCodeRegex = /https?:\/\/apps\.apple\.com\/([a-z]{2})\//;
  const match = url.match(countryCodeRegex);

  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  return 'us'; // Default to US if no country code found
}

// Function to fetch bundle ID using iTunes Lookup API
export async function fetchBundleId(appId) {
  try {
    const response = await axios.get(`https://itunes.apple.com/lookup?id=${appId}`);
    const results = response.data.results;

    if (results && results.length > 0) {
      return results[0].bundleId;
    }

    console.error('Bundle ID not found');
    return '';
  } catch (error) {
    console.error('Error fetching bundle ID:', error);
    throw error;
  }
}

export async function getAppDetails(appId, countryCode) {
  if (!countryCode) {
    throw new Error('Country code is required');
  }

  try {
    const app = await store.app({
      id: appId,
      country: countryCode,
      // ratings: true
    });

    return unifyAppStoreAppData(app);
  } catch (error) {
    console.error('Error fetching app details:', error);
    throw error;
  }
}

export async function getAppReviews(appId, country, options = {}) {
  const months = options.months !== undefined ? options.months : 3;
  const maxReviews = options.maxReviews !== undefined ? options.maxReviews : Infinity;

  try {
    const allReviews = [];
    let page = 1;
    let successfulPages = 0;
    let failedPages = 0;
    let webpageSample = false;
    let cutoff = null;
    if (months && Number.isFinite(months)) {
      const now = new Date();
      cutoff = new Date(now.setMonth(now.getMonth() - months));
    }

    while (allReviews.length < maxReviews && page < 10) {
      try {
        // Apple review RSS is flaky (2026-10-01): sometimes returns an empty
        // feed even when reviews exist. Retry empty page-1 a few times.
        let reviews = [];
        const maxAttempts = page === 1 ? 3 : 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          let primaryError;
          try { reviews = await store.reviews({
            id: appId,
            page: page,
            country: country,
            requestOptions: { timeout: 15000 }
          }); } catch (error) { primaryError = error; }
          let fallbackSucceeded = false;
          if (reviews.length === 0) {
            const paths = page === 1
              ? [`id=${appId}/sortby=mostrecent/json`, `id=${appId}/json`, `id=${appId}/sortBy=mostRecent/json`]
              : [`page=${page}/id=${appId}/sortBy=mostRecent/json`];
            for (const path of paths) {
              try {
                const fallback = await axios.get(`https://itunes.apple.com/${country}/rss/customerreviews/${path}`, { timeout: 10000 });
                fallbackSucceeded = true;
                reviews = parseAppleReviewFeed(fallback.data);
                if (reviews.length) break;
              } catch { /* Try another official feed path. */ }
            }
          }
          if (reviews.length === 0 && page === 1) {
            try {
              const webpage = await axios.get(`https://apps.apple.com/${country}/app/id${appId}`, { timeout: 15000 });
              reviews = parseApplePageReviews(webpage.data);
              fallbackSucceeded = true;
              webpageSample = reviews.length > 0;
            } catch { /* Keep feed errors available for the caller. */ }
          }
          if (primaryError && !fallbackSucceeded) throw primaryError;
          if (reviews.length > 0 || attempt === maxAttempts) break;
          console.log(`[getAppReviews] page ${page} empty, retry ${attempt}/${maxAttempts - 1} after ${(attempt * 2)}s`);
          await new Promise(r => setTimeout(r, attempt * 2000));
        }

        successfulPages++;
        if (reviews.length === 0) {
          break;
        }

        // Filter reviews by cutoff date as we fetch
        const mappedReviews = reviews
          .map(review => ({
            id: review.id,
            userName: review.userName,
            userUrl: review.userUrl,
            version: review.version,
            score: review.score,
            title: review.title,
            text: review.text,
            url: review.url,
            timestamp: review.updated
          }))
          .filter(r => !cutoff || new Date(r.timestamp) >= cutoff);

        allReviews.push(...mappedReviews);

        // Stop if we've reached the maxReviews after filtering
        if (allReviews.length >= maxReviews || webpageSample) {
          break;
        }

        page++;
      } catch (pageError) {
        failedPages++;
        console.error(`Error fetching reviews for page ${page}:`, pageError);
        if (page === 1) throw pageError;
        page++;
        continue;
      }
    }
    if (!successfulPages && failedPages) throw new Error('Apple review feeds could not be reached. Please retry.');

    const filteredReviews = [...new Map(allReviews.map(review => [review.id, review])).values()].slice(0, maxReviews);
    // Remove redundant slice, filtering is already handled in the loop

    filteredReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      total: filteredReviews.length,
      partial: failedPages > 0 || webpageSample,
      source: webpageSample ? 'store-page-sample' : 'review-feed',
      reviews: filteredReviews,
      averageRating: calculateAverageRating(filteredReviews),
      scoreDistribution: calculateScoreDistribution(filteredReviews)
    };
  } catch (error) {
    console.error('Error fetching app reviews:', error);
    throw error;
  }
}

function unifyAppStoreAppData(app) {
  return {
    url: app.url,
    appId: app.appId,
    title: app.title,
    description: app.description,
    developer: app.developer,
    developerId: app.developerId,
    icon: app.icon,
    score: app.score,
    price: app.price,
    free: app.free,
    reviews: app.reviews,
    genre: app.primaryGenre,
    id: app.id,
    version: app.version,
    platform: 'ios'
  };
}

export async function searchApps(term, options = {}) {
  try {
    const results = await store.search({
      term,
      num: options.num || 50,
      page: options.page || 1,
      country: options.country || 'us',
      lang: options.lang || 'en-us',
      idsOnly: options.idsOnly || false
    });
    return results.map(unifyAppStoreAppData);
  } catch (error) {
    console.error('Error searching App Store:', error);
    throw error;
  }
}

export async function getSimilarApps(appId) {
  try {
    const results = await store.similar({
      id: appId
    })
    return results.map(unifyAppStoreAppData);
  } catch (error) {
    console.error('Error fetching similar apps:', error);
    throw error;
  }
}

// Convenience function to handle full workflow from URL
export async function processAppStoreUrl(url, options = {}) {
  try {
    const appId = extractAppStoreId(url);
    const countryCode = extractCountryCode(url);

    if (!countryCode) {
      throw new Error('Country code is required');
    }

    console.log(`Processing app ID ${appId} from country ${countryCode}`);

    const details = await getAppDetails(appId, countryCode);
    const reviews = await getAppReviews(appId, countryCode, options);

    console.log('App Details:', details);

    return {
      details,
      reviews
    };
  } catch (error) {
    console.error('Error processing App Store URL:', error);
    throw error;
  }
}
