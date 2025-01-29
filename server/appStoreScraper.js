import store from 'app-store-scraper';
import axios from 'axios';

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

// Function to fetch bundle ID using iTunes Lookup API
export async function fetchBundleId(appId) {
  try {
    const response = await axios.get(`https://itunes.apple.com/lookup?id=${appId}`);
    const results = response.data.results;
    
    if (results && results.length > 0) {
      return results[0].bundleId;
    }
    
    throw new Error('Bundle ID not found');
  } catch (error) {
    console.error('Error fetching bundle ID:', error);
    throw error;
  }
}

export async function searchApps(query, options = {}) {
  try {
    const results = await store.search({
      term: query,
      num: options.limit || 10,
      country: options.country || 'us'
    });
    return results.map(app => ({
      id: app.id,
      title: app.title,
      icon: app.icon,
      developer: app.developer,
      price: app.price,
      score: app.score
    }));
  } catch (error) {
    console.error('Error searching App Store:', error);
    throw error;
  }
}

export async function getAppDetails(appId) {
  try {
    const app = await store.app({id: appId});
    return {
      id: app.id,
      title: app.title,
      description: app.description,
      icon: app.icon,
      developer: app.developer,
      price: app.price,
      score: app.score,
      reviews: app.reviews,
      version: app.version,
      size: app.size,
      genre: app.genre,
      bundleId: await fetchBundleId(appId)
    };
  } catch (error) {
    console.error('Error fetching app details:', error);
    throw error;
  }
}

export async function getAppReviews(appId, options = {}) {
  try {
    const maxPages = 10;
    const allReviews = [];

    // Collect reviews from pages 1 to 10
    for (let page = 1; page <= maxPages; page++) {
      try {
        const reviews = await store.reviews({
          id: appId,
          page: page,
          country: options.country || 'us'
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
          date: review.date // Add date for additional context
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
      scoreDistribution: calculateScoreDistribution(allReviews)
    };
  } catch (error) {
    console.error('Error fetching app reviews:', error);
    throw error;
  }
}

// Helper function to calculate score distribution
function calculateScoreDistribution(reviews) {
  const distribution = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
  };

  reviews.forEach(review => {
    if (review.score >= 1 && review.score <= 5) {
      distribution[review.score]++;
    }
  });

  return distribution;
}

// Convenience function to handle full workflow from URL
export async function processAppStoreUrl(url) {
  try {
    const appId = extractAppStoreId(url);
    const details = await getAppDetails(appId);
    const reviews = await getAppReviews(appId);
    
    return {
      details,
      reviews
    };
  } catch (error) {
    console.error('Error processing App Store URL:', error);
    throw error;
  }
}
