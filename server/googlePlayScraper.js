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

    return {
      id: details.appId,
      title: details.title,
      description: details.description,
      developer: details.developer,
      version: details.version,
      price: details.price,
      score: details.score,
      reviews: details.reviews,
      icon: details.icon,
      platform: 'android'
    };
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
