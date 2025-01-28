import { expect } from 'chai';
import { 
  extractGooglePlayId, 
  fetchAppDetails, 
  getAppReviews, 
  processGooglePlayUrl 
} from './googlePlayScraper.js';

describe('Google Play Scraper Integration Tests', function() {
  // Increase timeout for network requests
  this.timeout(30000);

  // Test URLs and IDs
  const testUrls = {
    photos: {
      url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.photos',
      id: 'com.google.android.apps.photos'
    },
    gmail: {
      url: 'https://play.google.com/store/apps/details?id=com.google.android.gm',
      id: 'com.google.android.gm'
    }
  };

  // Detailed logging function
  const logTestDetails = (testName, details) => {
    console.log(`\n--- ${testName} Test Details ---`);
    console.log(JSON.stringify(details, null, 2));
    console.log('----------------------------\n');
  };

  describe('extractGooglePlayId', () => {
    it('should extract app ID from valid URL', () => {
      const { url, id } = testUrls.photos;
      const extractedId = extractGooglePlayId(url);
      
      logTestDetails('extractGooglePlayId', { 
        input: url, 
        expectedId: id, 
        extractedId: extractedId 
      });

      expect(extractedId).to.equal(id);
    });

    it('should throw error for invalid URL', () => {
      const invalidUrls = [
        'https://invalid.url',
        'http://play.google.com/wrong/path',
        ''
      ];

      invalidUrls.forEach(invalidUrl => {
        logTestDetails('Invalid URL Test', { 
          input: invalidUrl 
        });

        expect(() => extractGooglePlayId(invalidUrl))
          .to.throw('Invalid Google Play URL');
      });
    });
  });

  describe('fetchAppDetails', () => {
    it('should fetch app details successfully', async () => {
      const { id } = testUrls.photos;
      const details = await fetchAppDetails(id);
      
      logTestDetails('fetchAppDetails', { 
        appId: id, 
        details: details 
      });

      expect(details).to.include.all.keys(
        'id', 'title', 'description', 
        'developer', 'version', 'icon'
      );
      expect(details.id).to.equal(id);
    });
  });

  describe('getAppReviews', () => {
    it('should get reviews with score distribution', async () => {
      const { id } = testUrls.photos;
      const reviewResults = await getAppReviews(id);
      
      logTestDetails('getAppReviews', { 
        appId: id, 
        totalReviews: reviewResults.total,
        scoreDistribution: reviewResults.scoreDistribution 
      });

      expect(reviewResults).to.have.property('total');
      expect(reviewResults).to.have.property('reviews');
      expect(reviewResults).to.have.property('scoreDistribution');
      
      expect(reviewResults.reviews).to.be.an('array');
      
      const distribution = reviewResults.scoreDistribution;
      expect(distribution).to.be.an('object');
      expect(Object.keys(distribution)).to.have.lengthOf(5);
      
      // Verify score distribution keys
      expect(distribution).to.have.all.keys('1', '2', '3', '4', '5');
    });
  });

  describe('processGooglePlayUrl', () => {
    it('should process full Google Play URL', async () => {
      const { url, id } = testUrls.photos;
      const result = await processGooglePlayUrl(url);
      
      logTestDetails('processGooglePlayUrl', { 
        input: url, 
        appId: id, 
        details: result.details,
        reviewsTotal: result.reviews.total 
      });

      expect(result).to.have.property('details');
      expect(result).to.have.property('reviews');
      
      expect(result.details.id).to.equal(id);
      expect(result.reviews.total).to.be.greaterThan(0);
    });
  });
});