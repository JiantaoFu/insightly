import { expect } from 'chai';
import { 
  extractAppStoreId, 
  fetchBundleId, 
  searchApps, 
  getAppDetails, 
  getAppReviews,
  processAppStoreUrl 
} from './appStoreScraper.js';

describe('App Store Scraper Integration Tests', function() {
  // Increase timeout for network requests
  this.timeout(30000);

  const testAppUrl = 'https://apps.apple.com/bj/app/photos/id1584215428';
  const testAppId = '1584215428';

  describe('extractAppStoreId', () => {
    it('should extract app ID from valid URL', () => {
      const appId = extractAppStoreId(testAppUrl);
      expect(appId).to.equal(testAppId);
    });

    it('should throw error for invalid URL', () => {
      expect(() => extractAppStoreId('https://invalid.url'))
        .to.throw('Invalid App Store URL');
    });
  });

  describe('fetchBundleId', () => {
    it('should fetch bundle ID successfully', async () => {
      const bundleId = await fetchBundleId(testAppId);
      expect(bundleId).to.be.a('string');
      expect(bundleId).to.not.be.empty;
    });
  });

  describe('searchApps', () => {
    it('should search apps successfully', async () => {
      const results = await searchApps('photos');
      expect(results).to.be.an('array');
      expect(results.length).to.be.greaterThan(0);
      
      const firstResult = results[0];
      expect(firstResult).to.have.property('id');
      expect(firstResult).to.have.property('title');
      expect(firstResult).to.have.property('icon');
    });
  });

  describe('getAppDetails', () => {
    it('should get app details with bundle ID', async () => {
      const details = await getAppDetails(testAppId);
      
      expect(details).to.have.property('id');
      expect(String(details.id)).to.equal(testAppId);
      expect(details).to.have.property('title');
      expect(details).to.have.property('description');
      expect(details).to.have.property('bundleId');
      expect(details.bundleId).to.be.a('string');
    });
  });

  describe('getAppReviews', () => {
    it('should get reviews with score distribution', async () => {
      const reviewResults = await getAppReviews(testAppId);
      
      expect(reviewResults).to.have.property('total');
      expect(reviewResults).to.have.property('reviews');
      expect(reviewResults).to.have.property('scoreDistribution');
      
      expect(reviewResults.reviews).to.be.an('array');
      
      const distribution = reviewResults.scoreDistribution;
      expect(distribution).to.be.an('object');
      expect(Object.keys(distribution)).to.have.lengthOf(5);
    });
  });

  describe('processAppStoreUrl', () => {
    it('should process full app store URL', async () => {
      const result = await processAppStoreUrl(testAppUrl);
      
      expect(result).to.have.property('details');
      expect(result).to.have.property('reviews');
      
      expect(String(result.details.id)).to.equal(testAppId);
      expect(result.reviews.total).to.be.greaterThan(0);
    });
  });
});