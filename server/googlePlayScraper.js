import gplay from 'google-play-scraper';
import { calculateAverageRating, calculateScoreDistribution } from './utils.js';

export function extractGooglePlayId(url) {
  const match = url.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?.*?id=([^&]+)/);
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

  try {
    const maxReviews = options.maxReviews || 100;
    const reviewsResult = await gplay.reviews({
      appId,
      num: maxReviews,
      sort: gplay.sort.NEWEST,
      country: countryCode,
      lang: options.lang || countryCode // Use country code as language by default
    });

    const reviews = reviewsResult.data || [];

    return {
      total: reviews.length,
      reviews: reviews.map(review => ({
        text: review.text || '',
        score: review.score || 0,
        timestamp: review.date,
        userName: review.userName || ''
      })),
      averageRating: calculateAverageRating(reviews),
      scoreDistribution: calculateScoreDistribution(reviews)
    };
  } catch (error) {
    console.error(`Error fetching reviews for ${appId} from ${countryCode}:`, error);

    // If country-specific fetch fails, try US store as fallback
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

export async function processGooglePlayUrl(url) {
  try {
    const appId = extractGooglePlayId(url);
    const countryCode = extractCountryCode(url);

    console.log(`Processing Google Play URL: ${url}`);
    console.log(`App ID: ${appId}, Country: ${countryCode}`);

    const details = await fetchAppDetails(appId, countryCode);
    const reviews = await getAppReviews(appId, countryCode);

    return {
      details,
      reviews
    };
  } catch (error) {
    console.error('Error processing Google Play URL:', error);
    throw error;
  }
}
