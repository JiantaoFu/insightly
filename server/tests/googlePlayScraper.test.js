import { expect } from 'chai';
import { 
  extractGooglePlayId, 
  extractCountryCode,
  fetchAppDetails, 
  getAppReviews, 
  processGooglePlayUrl,
  searchApps,
  getSimilarApps
} from '../googlePlayScraper.js';

/**
 * Google Play Scraper Integration Tests
 * 
 * These tests perform real API calls to validate the functionality
 * of the Google Play scraper utilities.
 */

const TEST_CONFIG = {
  urls: [
    {
      url: 'https://play.google.com/store/apps/details?id=com.instagram.android&gl=us',
      appId: 'com.instagram.android',
      countryCode: 'us',
      description: 'Instagram Android',
      searchTerm: 'instagram'
    },
    {
      url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.photos',
      appId: 'com.google.android.apps.photos',
      countryCode: 'us',
      description: 'Google Photos US'
    },
    {
      url: 'https://play.google.com/store/apps/details?id=com.roblox.client&gl=UK',
      appId: 'com.roblox.client',
      countryCode: 'uk',
      description: 'Roblox UK'
    }
  ],
  searchTerms: ['instagram', 'gmail', 'maps']
};

/**
 * Tests URL parsing functions
 */
async function testUrlParsing() {
  console.log('\n📋 TESTING URL PARSING FUNCTIONS');
  console.log('===============================');
  
  for (const test of TEST_CONFIG.urls) {
    console.log(`\n🔍 Testing ${test.description}:`);
    console.log(`URL: ${test.url}`);
    
    try {
      // Test ID extraction
      const extractedId = extractGooglePlayId(test.url);
      console.log(`Extracted ID: ${extractedId}`);
      console.log(`Expected ID: ${test.appId}`);
      console.log(`ID Extraction: ${extractedId === test.appId ? 'PASS ✅' : 'FAIL ❌'}`);

      // Test country code extraction
      const extractedCountry = extractCountryCode(test.url);
      console.log(`Extracted Country: ${extractedCountry}`);
      console.log(`Expected Country: ${test.countryCode}`);
      console.log(`Country Extraction: ${extractedCountry === test.countryCode ? 'PASS ✅' : 'FAIL ❌'}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  // Test invalid URLs
  console.log('\n🔍 Testing Invalid URLs:');
  const invalidUrls = [
    'https://invalid.url',
    'http://play.google.com/wrong/path',
    ''
  ];
  
  for (const url of invalidUrls) {
    console.log(`URL: ${url}`);
    try {
      extractGooglePlayId(url);
      console.log('Invalid URL Test: FAIL ❌ (should have thrown an error)');
    } catch (error) {
      console.log(`Error message: ${error.message}`);
      console.log('Invalid URL Test: PASS ✅ (correctly threw an error)');
    }
  }
}

/**
 * Tests app details fetching
 */
async function testAppDetails() {
  console.log('\n📋 TESTING APP DETAILS FETCHING');
  console.log('=============================');
  
  for (const test of TEST_CONFIG.urls) {
    try {
      const appId = extractGooglePlayId(test.url);
      const countryCode = extractCountryCode(test.url);
      
      console.log(`\n🔍 Fetching details for ${test.description} (ID: ${appId}, Country: ${countryCode})...`);
      
      const details = await fetchAppDetails(appId, countryCode);
      console.log(`App Title: ${details.title}`);
      console.log(`Developer: ${details.developer}`);
      console.log(`Version: ${details.version}`);
      console.log(`Rating: ${details.score}`);
      console.log(`Price: ${details.price}`);
      console.log(`Reviews: ${details.reviews}`);
      
      // Verify required fields
      const requiredFields = ['id', 'title', 'description', 'developer', 'version', 'icon'];
      const missingFields = requiredFields.filter(field => !details[field]);
      
      if (missingFields.length === 0) {
        console.log(`Details Fetch: PASS ✅ (all required fields present)`);
      } else {
        console.log(`Details Fetch: FAIL ❌ (missing fields: ${missingFields.join(', ')})`);
      }
      
      // Verify ID matches
      if (details.id === appId) {
        console.log(`ID Verification: PASS ✅ (ID matches)`);
      } else {
        console.log(`ID Verification: FAIL ❌ (expected ${appId}, got ${details.id})`);
      }
    } catch (error) {
      console.error(`❌ Error fetching app details: ${error.message}`);
    }
  }
}

/**
 * Tests app reviews fetching
 */
async function testAppReviews() {
  console.log('\n📋 TESTING APP REVIEWS FETCHING');
  console.log('=============================');
  
  // Only test one app to avoid rate limiting
  const testApp = TEST_CONFIG.urls[0];
  const testAppWithCountry = TEST_CONFIG.urls[2]; // Roblox with UK country code
  
  try {
    // Test without country code
    const appId = extractGooglePlayId(testApp.url);
    console.log(`\n🔍 Fetching reviews for ${testApp.description} (ID: ${appId})...`);
    
    const reviewsData = await getAppReviews(appId);
    console.log(`Total reviews fetched: ${reviewsData.total}`);
    console.log(`Reviews count: ${reviewsData.reviews.length}`);
    console.log(`Score distribution: ${JSON.stringify(reviewsData.scoreDistribution)}`);
    
    // Verify score distribution
    const distribution = reviewsData.scoreDistribution;
    const hasAllScores = ['1', '2', '3', '4', '5'].every(score => score in distribution);
    console.log(`Score Distribution: ${hasAllScores ? 'PASS ✅' : 'FAIL ❌'}`);
    
    // Verify reviews array
    console.log(`Reviews Array: ${Array.isArray(reviewsData.reviews) ? 'PASS ✅' : 'FAIL ❌'}`);
    
    if (reviewsData.reviews.length > 0) {
      const firstReview = reviewsData.reviews[0];
      console.log(`\nSample review:`);
      console.log(`User: ${firstReview.userName}`);
      console.log(`Rating: ${firstReview.score}`);
      console.log(`Timestamp: ${firstReview.timestamp}`);
      console.log(`Text: ${firstReview.text.substring(0, 100)}...`);
    }
    
    // Test with country code
    const appIdWithCountry = extractGooglePlayId(testAppWithCountry.url);
    const countryCode = extractCountryCode(testAppWithCountry.url);
    console.log(`\n🔍 Fetching reviews for ${testAppWithCountry.description} (ID: ${appIdWithCountry}, Country: ${countryCode})...`);
    
    const reviewsDataWithCountry = await getAppReviews(appIdWithCountry, countryCode);
    console.log(`Total reviews fetched: ${reviewsDataWithCountry.total}`);
    console.log(`Reviews count: ${reviewsDataWithCountry.reviews.length}`);
    console.log(`Score distribution: ${JSON.stringify(reviewsDataWithCountry.scoreDistribution)}`);
    
    // Verify score distribution
    const distributionWithCountry = reviewsDataWithCountry.scoreDistribution;
    const hasAllScoresWithCountry = ['1', '2', '3', '4', '5'].every(score => score in distributionWithCountry);
    console.log(`Score Distribution (with country): ${hasAllScoresWithCountry ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error(`❌ Error fetching app reviews: ${error.message}`);
  }
}

/**
 * Tests the full workflow from URL
 */
async function testFullWorkflow() {
  console.log('\n📋 TESTING FULL WORKFLOW');
  console.log('======================');
  
  // Test one app without country code and one with country code
  const testApp = TEST_CONFIG.urls[0];
  const testAppWithCountry = TEST_CONFIG.urls[2]; // Roblox with UK country code
  
  try {
    // Test without country code
    console.log(`\n🔍 Processing full workflow for ${testApp.description} (URL: ${testApp.url})...`);
    
    const result = await processGooglePlayUrl(testApp.url);
    
    console.log(`App Title: ${result.details.title}`);
    console.log(`Total Reviews: ${result.reviews.total}`);
    
    // Verify details and reviews
    const hasDetails = result.details && result.details.id === testApp.appId;
    const hasReviews = result.reviews && result.reviews.total > 0;
    
    console.log(`Details Check: ${hasDetails ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Reviews Check: ${hasReviews ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Full Workflow: ${(hasDetails && hasReviews) ? 'PASS ✅' : 'FAIL ❌'}`);
    
    // Test with country code
    console.log(`\n🔍 Processing full workflow for ${testAppWithCountry.description} (URL: ${testAppWithCountry.url})...`);
    
    const resultWithCountry = await processGooglePlayUrl(testAppWithCountry.url);
    
    console.log(`App Title: ${resultWithCountry.details.title}`);
    console.log(`Total Reviews: ${resultWithCountry.reviews.total}`);
    
    // Verify details and reviews
    const hasDetailsWithCountry = resultWithCountry.details && resultWithCountry.details.id === testAppWithCountry.appId;
    const hasReviewsWithCountry = resultWithCountry.reviews && resultWithCountry.reviews.total > 0;
    
    console.log(`Details Check (with country): ${hasDetailsWithCountry ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Reviews Check (with country): ${hasReviewsWithCountry ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Full Workflow (with country): ${(hasDetailsWithCountry && hasReviewsWithCountry) ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error(`❌ Error in full workflow: ${error.message}`);
  }
}

/**
 * Tests app search and similar apps functionality
 */
async function testAppSearchAndSimilar() {
  console.log('\n📋 TESTING APP SEARCH AND SIMILAR APPS');
  console.log('=====================================');

  const testApp = TEST_CONFIG.urls[0]; // Use Instagram as the test app

  try {
    // Test app search
    console.log(`\n🔍 Testing app search for "${testApp.searchTerm}"...`);
    const searchResults = await searchApps(testApp.searchTerm, {
      country: testApp.countryCode,
      num: 5
    });

    console.log(`Found ${searchResults.length} search results`);
    if (searchResults.length > 0) {
      console.log('Sample search result:', {
        title: searchResults[0].title,
        developer: searchResults[0].developer,
        score: searchResults[0].score
      });
    }
    console.log(`App Search: ${searchResults.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);

    // Test similar apps
    console.log(`\n🔍 Testing similar apps for ${testApp.description}...`);
    const similarApps = await getSimilarApps(testApp.appId, {
      country: testApp.countryCode
    });

    console.log(`Found ${similarApps.length} similar apps`);
    if (similarApps.length > 0) {
      console.log('Sample similar app:', {
        title: similarApps[0].title,
        developer: similarApps[0].developer,
        score: similarApps[0].score
      });
    }
    console.log(`Similar Apps: ${similarApps.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error('❌ Error testing search and similar:', error.message);
  }
}

/**
 * Tests search functionality
 */
async function testSearch() {
  console.log('\n📱 TESTING GOOGLE PLAY SEARCH');
  console.log('============================');
  
  const testApp = TEST_CONFIG.urls[0]; // Use Instagram as test case

  try {
    console.log(`\n🔍 Testing search for "${testApp.searchTerm}"`);
    const results = await searchApps(testApp.searchTerm, {
      country: testApp.countryCode,
      num: 5
    });

    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
      console.log('Sample result:', {
        title: results[0].title,
        developer: results[0].developer,
        score: results[0].score
      });
    }
    console.log(`Search Test: ${results.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error('❌ Search Error:', error.message);
  }
}

/**
 * Tests similar apps functionality
 */
async function testSimilarApps() {
  console.log('\n📱 TESTING SIMILAR APPS');
  console.log('======================');

  const testApp = TEST_CONFIG.urls[0]; // Use Instagram as test case

  try {
    console.log(`\n🔍 Testing similar apps for ${testApp.description}`);
    const results = await getSimilarApps(testApp.appId, {
      country: testApp.countryCode
    });

    console.log(`Found ${results.length} similar apps`);
    if (results.length > 0) {
      console.log('Sample similar app:', {
        title: results[0].title,
        developer: results[0].developer,
        score: results[0].score
      });
    }
    console.log(`Similar Apps Test: ${results.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error('❌ Similar Apps Error:', error.message);
  }
}

// Update main test runner to include new test
async function runTests() {
  console.log('🚀 RUNNING GOOGLE PLAY SCRAPER INTEGRATION TESTS');
  console.log('=============================================');
  
  try {
    await testUrlParsing();
    await testAppDetails();
    await testAppReviews();
    await testFullWorkflow();
    await testAppSearchAndSimilar(); // Add new test function
    await testSearch(); // Add new test
    await testSimilarApps(); // Add new test
    
    console.log('\n✅ ALL TESTS COMPLETED');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

// Remove describe blocks and just run tests
runTests();