import crypto from 'crypto';

/**
 * Calculate the average rating from an array of reviews
 * @param {Array} reviews - Array of review objects
 * @returns {number} Average rating
 */
export function calculateAverageRating(reviews) {
  if (reviews.length === 0) return 0;
  
  const totalScore = reviews.reduce((sum, review) => sum + review.score, 0);
  return Number((totalScore / reviews.length).toFixed(1));
}

/**
 * Calculate the score distribution from an array of reviews
 * @param {Array} reviews - Array of review objects
 * @returns {Object} Score distribution object
 */
export function calculateScoreDistribution(reviews) {
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

// Utility function to generate a consistent hash for a URL
export function generateUrlHash(url) {
  return crypto
    .createHash('md5')
    .update(url.toLowerCase().trim())
    .digest('hex');
}