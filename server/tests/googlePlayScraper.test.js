import { 
  extractGooglePlayId, 
  extractCountryCode,
  fetchAppDetails, 
  getAppReviews, 
  processGooglePlayUrl 
} from '../googlePlayScraper.js';

/**
 * Google Play Scraper Integration Tests
 * 
 * These tests perform real API calls to validate the functionality
 * of the Google Play scraper utilities.
 */

// Test URLs for different apps and regions
const TEST_URLS = [
  {
    url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.photos',
    expectedId: 'com.google.android.apps.photos',
    expectedCountry: 'us',
    description: 'Google Photos US'
  },
  {
    url: 'https://play.google.com/store/apps/details?id=com.google.android.gm',
    expectedId: 'com.google.android.gm',
    expectedCountry: 'us',
    description: 'Gmail US'
  },
  {
    url: 'https://play.google.com/store/apps/details?id=com.roblox.client&gl=UK',
    expectedId: 'com.roblox.client',
    expectedCountry: 'uk',
    description: 'Roblox UK'
  }
];

/**
 * Tests URL parsing functions
 */
async function testUrlParsing() {
  console.log('\n📋 TESTING URL PARSING FUNCTIONS');
  console.log('===============================');
  
  for (const test of TEST_URLS) {
    console.log(`\n🔍 Testing ${test.description}:`);
    console.log(`URL: ${test.url}`);
    
    try {
      // Test ID extraction
      const extractedId = extractGooglePlayId(test.url);
      console.log(`Extracted ID: ${extractedId}`);
      console.log(`Expected ID: ${test.expectedId}`);
      console.log(`ID Extraction: ${extractedId === test.expectedId ? 'PASS ✅' : 'FAIL ❌'}`);

      // Test country code extraction
      const extractedCountry = extractCountryCode(test.url);
      console.log(`Extracted Country: ${extractedCountry}`);
      console.log(`Expected Country: ${test.expectedCountry}`);
      console.log(`Country Extraction: ${extractedCountry === test.expectedCountry ? 'PASS ✅' : 'FAIL ❌'}`);
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
  
  for (const test of TEST_URLS) {
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
  const testApp = TEST_URLS[0];
  const testAppWithCountry = TEST_URLS[2]; // Roblox with UK country code
  
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
  const testApp = TEST_URLS[0];
  const testAppWithCountry = TEST_URLS[2]; // Roblox with UK country code
  
  try {
    // Test without country code
    console.log(`\n🔍 Processing full workflow for ${testApp.description} (URL: ${testApp.url})...`);
    
    const result = await processGooglePlayUrl(testApp.url);
    
    console.log(`App Title: ${result.details.title}`);
    console.log(`Total Reviews: ${result.reviews.total}`);
    
    // Verify details and reviews
    const hasDetails = result.details && result.details.id === testApp.expectedId;
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
    const hasDetailsWithCountry = resultWithCountry.details && resultWithCountry.details.id === testAppWithCountry.expectedId;
    const hasReviewsWithCountry = resultWithCountry.reviews && resultWithCountry.reviews.total > 0;
    
    console.log(`Details Check (with country): ${hasDetailsWithCountry ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Reviews Check (with country): ${hasReviewsWithCountry ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Full Workflow (with country): ${(hasDetailsWithCountry && hasReviewsWithCountry) ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error(`❌ Error in full workflow: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 RUNNING GOOGLE PLAY SCRAPER INTEGRATION TESTS');
  console.log('=============================================');
  
  try {
    await testUrlParsing();
    await testAppDetails();
    await testAppReviews();
    await testFullWorkflow();
    
    console.log('\n✅ ALL TESTS COMPLETED');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

// Run all tests
runTests();