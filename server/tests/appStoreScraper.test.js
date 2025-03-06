import { 
  extractAppStoreId, 
  extractCountryCode, 
  fetchBundleId, 
  searchApps,
  getAppDetails, 
  getAppReviews, 
  processAppStoreUrl,
  getSimilarApps
} from '../appStoreScraper.js';

/**
 * App Store Scraper Integration Tests
 * 
 * These tests perform real API calls to validate the functionality
 * of the App Store scraper utilities.
 */

const TEST_CONFIG = {
  urls: [
    {
      url: 'https://apps.apple.com/us/app/instagram/id389801252',
      appId: '389801252',
      countryCode: 'us',
      description: 'Instagram US',
      searchTerm: 'instagram' // Add search term for this app
    },
    {
      url: 'https://apps.apple.com/cn/app/shopee-3-3-mega-shopping-party/id959840394',
      appId: '959840394',
      countryCode: 'cn',
      description: 'Shopee CN'
    },
    {
      url: 'https://apps.apple.com/jp/app/line/id443904275',
      appId: '443904275',
      countryCode: 'jp',
      description: 'LINE JP'
    }
  ],
  searchTerms: ['instagram', 'spotify', 'netflix']
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
      const extractedId = extractAppStoreId(test.url);
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
}

/**
 * Tests bundle ID fetching
 */
async function testBundleIdFetching() {
  console.log('\n📋 TESTING BUNDLE ID FETCHING');
  console.log('============================');
  
  for (const test of TEST_CONFIG.urls) {
    try {
      const appId = extractAppStoreId(test.url);
      console.log(`\n🔍 Fetching bundle ID for ${test.description} (ID: ${appId})...`);
      
      const bundleId = await fetchBundleId(appId);
      console.log(`Bundle ID: ${bundleId}`);
      console.log(`Bundle ID Fetch: ${bundleId ? 'PASS ✅' : 'FAIL ❌'}`);
    } catch (error) {
      console.error(`❌ Error fetching bundle ID: ${error.message}`);
    }
  }
}

/**
 * Tests app search functionality
 */
async function testAppSearch() {
  console.log('\n📋 TESTING APP SEARCH');
  console.log('====================');
  
  for (const term of TEST_CONFIG.searchTerms) {
    try {
      console.log(`\n🔍 Searching for "${term}"...`);
      
      // Test with default options
      const defaultResults = await searchApps(term);
      console.log(`Found ${defaultResults.length} results with default options`);
      console.log(`First result: ${defaultResults[0]?.title}`);
      console.log(`Default search: ${defaultResults.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
      
      // Test with custom options
      const customResults = await searchApps(term, { limit: 5, country: 'gb' });
      console.log(`Found ${customResults.length} results with custom options (GB, limit 5)`);
      console.log(`First result: ${customResults[0]?.title}`);
      console.log(`Custom search: ${customResults.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
    } catch (error) {
      console.error(`❌ Error searching for apps: ${error.message}`);
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
      const appId = extractAppStoreId(test.url);
      const countryCode = extractCountryCode(test.url);
      
      console.log(`\n🔍 Fetching details for ${test.description} (ID: ${appId}, Country: ${countryCode})...`);
      
      const details = await getAppDetails(appId, countryCode);
      console.log(`App Title: ${details.title}`);
      console.log(`Developer: ${details.developer}`);
      console.log(`Version: ${details.version}`);
      console.log(`Rating: ${details.score}`);
      console.log(`Reviews: ${details.reviews}`);
      console.log(`Details Fetch: ${details.title ? 'PASS ✅' : 'FAIL ❌'}`);
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
  
  try {
    const appId = extractAppStoreId(testApp.url);
    const countryCode = extractCountryCode(testApp.url);
    
    console.log(`\n🔍 Fetching reviews for ${testApp.description} (ID: ${appId}, Country: ${countryCode})...`);
    
    const reviewsData = await getAppReviews(appId, countryCode);
    console.log(`Total reviews fetched: ${reviewsData.total}`);
    console.log(`Average rating: ${reviewsData.averageRating}`);
    console.log(`Score distribution: ${JSON.stringify(reviewsData.scoreDistribution)}`);
    
    if (reviewsData.reviews.length > 0) {
      const firstReview = reviewsData.reviews[0];
      console.log(`\nSample review:`);
      console.log(`User: ${firstReview.userName}`);
      console.log(`Rating: ${firstReview.score}`);
      console.log(`Timestamp: ${firstReview.timestamp}`);
      console.log(`Title: ${firstReview.title}`);
      console.log(`Text: ${firstReview.text.substring(0, 100)}...`);
    }
    
    console.log(`Reviews Fetch: ${reviewsData.total > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
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
  
  // Only test one app to avoid rate limiting
  const testApp = TEST_CONFIG.urls[0];
  
  try {
    console.log(`\n🔍 Processing full workflow for ${testApp.description} (URL: ${testApp.url})...`);
    
    const result = await processAppStoreUrl(testApp.url);
    
    console.log(`App Title: ${result.details.title}`);
    console.log(`Total Reviews: ${result.reviews.total}`);
    console.log(`Full Workflow: ${result.details && result.reviews ? 'PASS ✅' : 'FAIL ❌'}`);
  } catch (error) {
    console.error(`❌ Error in full workflow: ${error.message}`);
  }
}

/**
 * Tests search functionality
 */
async function testSearch() {
  console.log('\n📱 TESTING APP STORE SEARCH');
  console.log('=========================');
  
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

// Update the test runner to include new test
async function runTests() {
  console.log('🚀 RUNNING APP STORE SCRAPER INTEGRATION TESTS');
  console.log('============================================');
  
  try {
    await testUrlParsing();
    await testBundleIdFetching();
    await testAppSearch();
    await testAppDetails();
    await testAppReviews();
    await testFullWorkflow();
    await testSearch();
    await testSimilarApps();
    
    console.log('\n✅ ALL TESTS COMPLETED');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

// Run all tests
runTests();