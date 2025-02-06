import gplay from 'google-play-scraper';
import { calculateAverageRating, calculateScoreDistribution } from './utils.js';

export function extractGooglePlayId(url) {
  const match = url.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?.*?id=([^&]+)/);
  if (!match) {
    throw new Error('Invalid Google Play URL');
  }
  return match[1];
}

export async function fetchAppDetails(appId) {
  try {
    const details = await gplay.app({ appId });
    return {
      id: details.appId,
      title: details.title,
      description: details.description,
      developer: details.developer,
      version: details.version,
      icon: details.icon,
      platform: 'android'  // Add platform for Google Play
    };
  } catch (error) {
    console.error('Error fetching app details:', error);
    throw error;
  }
}

export async function getAppReviews(appId, options = {}) {
  try {
    const maxReviews = options.maxReviews || 100;
    const reviewsResult = await gplay.reviews({
      appId,
      num: maxReviews,
      sort: gplay.sort.NEWEST,
      lang: 'en',
      country: 'us'
    });

    // Extract the reviews from the data property
    const reviews = reviewsResult.data || [];

    return {
      total: reviews.length,
      reviews: reviews.map(review => ({
        text: review.text || '',
        score: review.score || 0,
        date: review.date,
        userName: review.userName || ''
      })),
      averageRating: calculateAverageRating(reviews),
      scoreDistribution: calculateScoreDistribution(reviews)
    };
  } catch (error) {
    console.error('Error fetching app reviews:', error);
    
    // Log additional details to help diagnose the issue
    console.error('Review fetch details:', {
      appId,
      maxReviews: options.maxReviews || 100
    });

    throw error;
  }
}

export async function processGooglePlayUrl(url) {
  try {
    const appId = extractGooglePlayId(url);
    const details = await fetchAppDetails(appId);
    const reviews = await getAppReviews(appId);

    return {
      details,
      reviews
    };
  } catch (error) {
    console.error('Error processing Google Play URL:', error);
    throw error;
  }
}
