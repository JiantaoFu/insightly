import store from 'app-store-scraper';
import axios from 'axios';
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

export async function getAppReviews(appId, country) {
  try {
    const maxPages = 10;
    const allReviews = [];

    // Collect reviews from pages 1 to 10
    for (let page = 1; page <= maxPages; page++) {
      try {
        const reviews = await store.reviews({
          id: appId,
          page: page,
          country: country
        });

        // If no reviews are returned, break the loop
        if (reviews.length === 0) {
          break;
        }

        // Map and aggregate reviews
        const mappedReviews = reviews.map(review => ({
          id: review.id,
          userName: review.userName,
          userUrl: review.userUrl,
          version: review.version,
          score: review.score,
          title: review.title,
          text: review.text,
          url: review.url,
          timestamp: review.updated
        }));

        allReviews.push(...mappedReviews);
      } catch (pageError) {
        console.error(`Error fetching reviews for page ${page}:`, pageError);
        // Continue to next page even if one fails
        continue;
      }
    }

    // Optional: Sort reviews by date (most recent first)
    allReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      total: allReviews.length,
      reviews: allReviews,
      // Additional metadata
      averageRating: calculateAverageRating(allReviews),
      scoreDistribution: calculateScoreDistribution(allReviews)
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
export async function processAppStoreUrl(url) {
  try {
    const appId = extractAppStoreId(url);
    const countryCode = extractCountryCode(url);

    if (!countryCode) {
      throw new Error('Country code is required');
    }

    console.log(`Processing app ID ${appId} from country ${countryCode}`);

    const details = await getAppDetails(appId, countryCode);
    const reviews = await getAppReviews(appId, countryCode);

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
