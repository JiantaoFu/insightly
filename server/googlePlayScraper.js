import gplay from 'google-play-scraper';
import { calculateAverageRating, calculateScoreDistribution } from './utils.js';

export function extractGooglePlayId(url) {
  const match = url.match(/https?:\/\/play\.google\.com\/(?:store|work)\/apps\/details\?.*?id=([^&]+)/);
  if (!match) {
    throw new Error('Invalid Google Play URL');
  }
  return match[1];
}

export function extractCountryCode(url) {
  // Try to extract country code from URL (gl parameter)
  const match = url.match(/[?&]gl=([a-z]{2})/i);
  return match ? match[1].toLowerCase() : 'us';
}

export async function fetchAppDetails(appId, countryCode = 'us') {
  console.log(`Fetching Google Play app details for ${appId} from ${countryCode}`);

  try {
    const details = await gplay.app({
      appId,
      country: countryCode
    });

    return unifyGooglePlayAppData(details);
  } catch (error) {
    console.error(`Error fetching app details for ${appId} from ${countryCode}:`, error);

    // If country-specific fetch fails, try US store as fallback
    if (countryCode !== 'us') {
      console.log(`Retrying with US store for ${appId}`);
      return fetchAppDetails(appId, 'us');
    }

    throw error;
  }
}

export async function getAppReviews(appId, countryCode = 'us', options = {}) {
  console.log(`Fetching Google Play reviews for ${appId} from ${countryCode}`);
  console.log(`[getAppReviews] options:`, options);

  try {
    const months = options.months !== undefined ? options.months : 3;
    const maxReviews = options.maxReviews !== undefined ? options.maxReviews : Infinity;

    let allReviews = [];
    let nextPaginationToken = null;
    let loopCount = 0;

    while (allReviews.length < maxReviews) {
      loopCount++;
      if (loopCount > 10) {
        console.warn(`[getAppReviews] Breaking loop for ${appId} after 10 iterations to prevent infinite loop. allReviews.length=${allReviews.length}`);
        break;
      }
      const batchSize = Math.min(100, maxReviews - allReviews.length);
      let params = {
        appId,
        num: batchSize,
        sort: gplay.sort.NEWEST,
        country: countryCode,
        lang: options.lang || countryCode,
        paginate: true,
        nextPaginationToken
      };
      console.debug(`[getAppReviews] Fetching page ${loopCount} with params:`, params);
      const reviewsResult = await gplay.reviews(params);

      let reviews = reviewsResult.data || [];
      console.log('page review IDs:', reviews.map(r => r.id));

      // Filter by months as we fetch
      let cutoff = null;
      if (months && Number.isFinite(months)) {
        const now = new Date();
        cutoff = new Date(now.setMonth(now.getMonth() - months));
        reviews = reviews.filter(r => new Date(r.date) >= cutoff);
      }

      allReviews.push(...reviews);

      // Debug log for each loop, show nextPaginationToken value and allReviews count
      console.debug(`[getAppReviews] appId=${appId} page=${loopCount} fetched=${reviews.length} total=${allReviews.length} nextToken=${reviewsResult.nextPaginationToken ? reviewsResult.nextPaginationToken : 'absent'} allReviews.length=${allReviews.length}`);

      if (allReviews.length >= maxReviews || !reviewsResult.nextPaginationToken || reviews.length === 0) {
        break;
      }

      nextPaginationToken = reviewsResult.nextPaginationToken;
    }

    // Map to output format and sort
    let filteredReviews = allReviews
      .slice(0, maxReviews)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(review => ({
        text: review.text || '',
        score: review.score || 0,
        timestamp: review.date,
        userName: review.userName || ''
      }));

    return {
      total: filteredReviews.length,
      reviews: filteredReviews,
      averageRating: calculateAverageRating(filteredReviews),
      scoreDistribution: calculateScoreDistribution(filteredReviews)
    };
  } catch (error) {
    console.error(`Error fetching reviews for ${appId} from ${countryCode}:`, error);

    if (countryCode !== 'us') {
      console.log(`Retrying reviews with US store for ${appId}`);
      return getAppReviews(appId, 'us', options);
    }

    throw error;
  }
}

function unifyGooglePlayAppData(app) {
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
    genre: app.genre,
    id: app.appId,
    version: app.version,
    platform: 'android'
  };
}

export async function searchApps(term, options = {}) {
  try {
    const results = await gplay.search({
      term,
      num: options.num || 20,
      lang: options.lang || 'en',
      country: options.country || 'us',
      fullDetail: options.fullDetail || false,
      price: options.price || 'all'
    });
    return results.map(unifyGooglePlayAppData);
  } catch (error) {
    console.error('Error searching Google Play:', error);
    throw error;
  }
}

export async function getSimilarApps(appId, options = {}) {
  try {
    const results = await gplay.similar({
      appId,
      lang: options.lang || 'en',
      country: options.country || 'us',
      fullDetail: options.fullDetail || false
    });
    return results.map(unifyGooglePlayAppData);
  } catch (error) {
    console.error('Error fetching similar apps:', error);
    throw error;
  }
}

export async function processGooglePlayUrl(url, options = {}) {
  try {
    const appId = extractGooglePlayId(url);
    const countryCode = extractCountryCode(url);

    console.log(`Processing Google Play URL: ${url}`);
    console.log(`App ID: ${appId}, Country: ${countryCode}`);

    const details = await fetchAppDetails(appId, countryCode);
    const reviews = await getAppReviews(appId, countryCode, options);

    return {
      details,
      reviews
    };
  } catch (error) {
    console.error('Error processing Google Play URL:', error);
    throw error;
  }
}