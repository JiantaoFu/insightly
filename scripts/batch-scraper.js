#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import store from '@jeromyfu/app-store-scraper';
import gplay from '@jeromyfu/google-play-scraper';
import { processAppStoreUrl } from '../server/appStoreScraper.js';
import { processGooglePlayUrl } from '../server/googlePlayScraper.js';
import { generateUrlHash } from '../server/utils.js';

// Load environment variables
dotenv.config();

/**
 * Create a configured axios instance with headers
 * @returns {Object} Configured axios instance
 */
function createApiClient() {
  const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  
  return axios.create({
    baseURL: apiUrl,
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'github.com'
    }
  });
}

/**
 * Category mapping between generic names and platform-specific identifiers
 * 
 * This mapping allows users to specify generic category names that work across platforms.
 * Each entry maps a generic name to its platform-specific IDs.
 * 
 * Note: Not all categories have direct equivalents across platforms.
 * When a direct equivalent doesn't exist, we've chosen the closest match
 * or left the platform entry undefined.
 */
const CATEGORY_MAPPING = {
  // Main categories with direct equivalents
  'productivity': { ios: '6007', android: 'PRODUCTIVITY' },
  'business': { ios: '6000', android: 'BUSINESS' },
  'education': { ios: '6017', android: 'EDUCATION' },
  'finance': { ios: '6015', android: 'FINANCE' },
  'health': { ios: '6013', android: 'HEALTH_AND_FITNESS' },
  'lifestyle': { ios: '6012', android: 'LIFESTYLE' },
  'social': { ios: '6005', android: 'SOCIAL' },
  'travel': { ios: '6003', android: 'TRAVEL_AND_LOCAL' },
  'utilities': { ios: '6002', android: 'TOOLS' },
  'weather': { ios: '6001', android: 'WEATHER' },
  'books': { ios: '6018', android: 'BOOKS_AND_REFERENCE' },
  'food': { ios: '6023', android: 'FOOD_AND_DRINK' },
  'medical': { ios: '6020', android: 'MEDICAL' },
  'music': { ios: '6011', android: 'MUSIC_AND_AUDIO' },
  'news': { ios: '6009', android: 'NEWS_AND_MAGAZINES' },
  'photo': { ios: '6008', android: 'PHOTOGRAPHY' },
  'shopping': { ios: '6024', android: 'SHOPPING' },
  'sports': { ios: '6004', android: 'SPORTS' },
  
  // Games categories
  'games': { ios: '6014', android: 'GAME' },
  'action_games': { ios: '7001', android: 'GAME_ACTION' },
  'adventure_games': { ios: '7002', android: 'GAME_ADVENTURE' },
  'arcade_games': { ios: '7003', android: 'GAME_ARCADE' },
  'board_games': { ios: '7004', android: 'GAME_BOARD' },
  'card_games': { ios: '7005', android: 'GAME_CARD' },
  'casino_games': { ios: '7006', android: 'GAME_CASINO' },
  'puzzle_games': { ios: '7012', android: 'GAME_PUZZLE' },
  'racing_games': { ios: '7013', android: 'GAME_RACING' },
  'role_playing_games': { ios: '7014', android: 'GAME_ROLE_PLAYING' },
  'simulation_games': { ios: '7015', android: 'GAME_SIMULATION' },
  'sports_games': { ios: '7016', android: 'GAME_SPORTS' },
  'strategy_games': { ios: '7017', android: 'GAME_STRATEGY' },
  'word_games': { ios: '7019', android: 'GAME_WORD' },
  
  // Categories with platform-specific nuances
  'entertainment': { ios: '6016', android: 'ENTERTAINMENT' },
  'navigation': { ios: '6010', android: 'MAPS_AND_NAVIGATION' },
  'reference': { ios: '6006', android: 'BOOKS_AND_REFERENCE' },
  
  // iOS-specific categories (no direct Android equivalent)
  'magazines': { ios: '6021', android: undefined },
  'catalogs': { ios: '6022', android: undefined },
  
  // Android-specific categories (no direct iOS equivalent)
  'personalization': { ios: undefined, android: 'PERSONALIZATION' },
  'dating': { ios: undefined, android: 'DATING' },
  'comics': { ios: undefined, android: 'COMICS' },
  'parenting': { ios: undefined, android: 'PARENTING' },
  'auto': { ios: undefined, android: 'AUTO_AND_VEHICLES' },
  'beauty': { ios: undefined, android: 'BEAUTY' },
  'house_home': { ios: undefined, android: 'HOUSE_AND_HOME' },
  'events': { ios: undefined, android: 'EVENTS' },
  'video_players': { ios: undefined, android: 'VIDEO_PLAYERS' },
  'libraries_demo': { ios: undefined, android: 'LIBRARIES_AND_DEMO' },
  'communication': { ios: undefined, android: 'COMMUNICATION' },
  
  // Additional Android categories
  'application': { ios: undefined, android: 'APPLICATION' },
  'android_wear': { ios: undefined, android: 'ANDROID_WEAR' },
  'art_design': { ios: undefined, android: 'ART_AND_DESIGN' },
  'casual_games': { ios: undefined, android: 'GAME_CASUAL' },
  'educational_games': { ios: undefined, android: 'GAME_EDUCATIONAL' },
  'music_games': { ios: undefined, android: 'GAME_MUSIC' },
  'trivia_games': { ios: undefined, android: 'GAME_TRIVIA' },
  'family': { ios: undefined, android: 'FAMILY' },
  'watch_face': { ios: undefined, android: 'WATCH_FACE' },
};

/**
 * Similarity mapping for finding the closest category match
 * This helps when a user specifies a category that doesn't exactly match
 * our defined categories but is semantically similar.
 */
const SIMILARITY_MAPPING = {
  // Common variations and misspellings
  'productive': 'productivity',
  'work': 'productivity',
  'office': 'productivity',
  'edu': 'education',
  'learning': 'education',
  'school': 'education',
  'money': 'finance',
  'banking': 'finance',
  'fitness': 'health',
  'exercise': 'health',
  'workout': 'health',
  'social_media': 'social',
  'networking': 'social',
  'vacation': 'travel',
  'trips': 'travel',
  'tools': 'utilities',
  'utility': 'utilities',
  'reading': 'books',
  'cookbook': 'food',
  'recipes': 'food',
  'dining': 'food',
  'restaurants': 'food',
  'healthcare': 'medical',
  'doctor': 'medical',
  'audio': 'music',
  'songs': 'music',
  'media': 'entertainment',
  'fun': 'entertainment',
  'pictures': 'photo',
  'camera': 'photo',
  'ecommerce': 'shopping',
  'store': 'shopping',
  'athletics': 'sports',
  
  // Game variations
  'game': 'games',
  'gaming': 'games',
  'action': 'action_games',
  'adventure': 'adventure_games',
  'arcade': 'arcade_games',
  'board': 'board_games',
  'cards': 'card_games',
  'casino': 'casino_games',
  'puzzle': 'puzzle_games',
  'racing': 'racing_games',
  'rpg': 'role_playing_games',
  'simulation': 'simulation_games',
  'sports_game': 'sports_games',
  'strategy': 'strategy_games',
  'word': 'word_games',
  
  // Android category variations
  'apps': 'application',
  'all_apps': 'application',
  'wear': 'android_wear',
  'wearable': 'android_wear',
  'smartwatch': 'android_wear',
  'art': 'art_design',
  'design': 'art_design',
  'drawing': 'art_design',
  'cars': 'auto',
  'vehicles': 'auto',
  'automotive': 'auto',
  'casual': 'casual_games',
  'educational': 'educational_games',
  'learning_games': 'educational_games',
  'music_game': 'music_games',
  'rhythm': 'music_games',
  'trivia': 'trivia_games',
  'quiz': 'trivia_games',
  'kids': 'family',
  'children': 'family',
  'watch': 'watch_face',
  'clock': 'watch_face',
  'faces': 'watch_face',
  'communication_apps': 'communication',
  'chat': 'communication',
  'messaging': 'communication',
  'dating_apps': 'dating',
  'romance': 'dating',
  'comics_apps': 'comics',
  'manga': 'comics',
  'parent': 'parenting',
  'baby': 'parenting',
  'child_care': 'parenting',
  'cosmetics': 'beauty',
  'makeup': 'beauty',
  'home': 'house_home',
  'decoration': 'house_home',
  'interior': 'house_home',
  'event': 'events',
  'calendar': 'events',
  'video': 'video_players',
  'player': 'video_players',
  'streaming': 'video_players',
  'demo': 'libraries_demo',
  'sample': 'libraries_demo',
  'personalize': 'personalization',
  'theme': 'personalization',
  'wallpaper': 'personalization',
};

/**
 * Parse command line arguments and initialize the batch scraper
 * @returns {Object} Configuration object with parsed arguments
 */
function parseCommandLineArgs() {
  const { values } = parseArgs({
    options: {
      collections: {
        type: 'string',
        short: 'c',
        default: 'topfreeapplications,TOP_FREE'
      },
      categories: {
        type: 'string',
        short: 'g',
        default: 'productivity' // Default to productivity apps (will be mapped to platform-specific IDs)
      },
      limit: {
        type: 'string',
        short: 'l',
        default: '10'
      },
      platforms: {
        type: 'string',
        short: 'p',
        default: 'ios,android'
      },
      force: {
        type: 'boolean',
        short: 'f',
        default: false
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        default: false
      }
    }
  });

  // Convert arguments to usable format
  return {
    collectionsInput: values.collections.split(',').map(c => c.trim()),
    categoriesInput: values.categories.split(',').map(c => c.trim()),
    limit: parseInt(values.limit, 10),
    platforms: values.platforms.split(',').map(p => p.trim()),
    forceRefresh: values.force,
    verbose: values.verbose
  };
}

/**
 * Initialize the results tracking object
 * @returns {Object} Results tracking object
 */
function initializeResults() {
  return {
    startTime: new Date().toISOString(),
    endTime: null,
    totalAppsProcessed: 0,
    newReportsGenerated: 0,
    existingReportsFound: 0,
    errors: [],
    categoryMappings: {}, // Track how categories were mapped
    appsByCollection: {}
  };
}

/**
 * Main execution function
 * @param {Object} config - Configuration object with parsed arguments
 * @returns {Promise<Object>} Results of the batch processing
 */
async function main(config = null) {
  // If no config is provided, parse command line arguments
  if (!config) {
    config = parseCommandLineArgs();
  }
  
  const { collectionsInput, categoriesInput, limit, platforms, forceRefresh, verbose } = config;
  
  // Set global verbose flag
  global.verbose = verbose;
  
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  
  // Initialize results tracking
  const results = initializeResults();
  global.results = results;
  
  console.log('Starting batch app scraping and analysis');
  console.log(`Platforms: ${platforms.join(', ')}`);
  console.log(`Categories: ${categoriesInput.join(', ')}`);
  console.log(`Collections: ${collectionsInput.join(', ')}`);
  console.log(`Limit per collection: ${limit}`);
  
  try {
    // Process each platform
    for (const platform of platforms) {
      console.log(`\nProcessing platform: ${platform}`);
      
      // Get the appropriate collection and category for this platform
      const collections = getCollectionsForPlatform(platform, collectionsInput);
      const categories = getCategoriesForPlatform(platform, categoriesInput);
      
      // Log the platform-specific collections and categories
      console.log(`  Collections: ${collections.join(', ') || 'None found'}`);
      console.log(`  Categories: ${categories.join(', ') || 'None found'}`);
      
      if (collections.length === 0) {
        console.warn(`  Warning: No valid collections found for platform ${platform}`);
        continue;
      }
      
      if (categories.length === 0) {
        console.warn(`  Warning: No valid categories found for platform ${platform}`);
        continue;
      }
      
      // Process each collection
      for (const collection of collections) {
        // Process each category
        for (const category of categories) {
          const collectionKey = `${platform}-${collection}-${category}`;
          
          if (!results.appsByCollection[collectionKey]) {
            results.appsByCollection[collectionKey] = {
              processed: 0,
              new: 0,
              existing: 0,
              errors: 0
            };
          }
          
          console.log(`\nProcessing ${platform} collection: ${collection}, category: ${category}`);
          
          try {
            // Get apps for this collection, category and platform
            const apps = await getAppsFromCollection(platform, collection, category, limit);
            console.log(`  Found ${apps.length} apps`);
            
            // Process each app
            for (const app of apps) {
              try {
                await processApp(app, platform, collectionKey, forceRefresh, results);
                results.appsByCollection[collectionKey].processed++;
                results.totalAppsProcessed++;
              } catch (appError) {
                console.error(`  Error processing app ${app.title || app.url}:`, appError.message);
                results.errors.push({
                  platform,
                  collection,
                  category,
                  app: app.title || app.url,
                  error: appError.message
                });
                results.appsByCollection[collectionKey].errors++;
              }
            }
          } catch (collectionError) {
            console.error(`  Error processing collection ${collection} with category ${category}:`, collectionError.message);
            results.errors.push({
              platform,
              collection,
              category,
              error: collectionError.message
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Fatal error in batch processing:', error);
    results.errors.push({
      fatal: true,
      error: error.message
    });
  } finally {
    // Save results
    results.endTime = new Date().toISOString();
    await saveResults(results, reportsDir);
  }
  
  return results;
}

/**
 * Get collections for a specific platform
 * Filters the input collections to only include those valid for the specified platform
 * 
 * @param {string} platform - 'ios' or 'android'
 * @param {string[]} collectionsInput - Array of collection names to filter
 * @returns {string[]} - Array of valid collections for the platform
 */
function getCollectionsForPlatform(platform, collectionsInput) {
  const validCollections = [];
  const invalidCollections = [];
  
  // Define valid collections for each platform
  const iosCollections = [
    'newapplications', 'newfreeapplications', 'newpaidapplications', 
    'topfreeapplications', 'topfreeipadapplications', 'topgrossingapplications', 
    'topgrossingipadapplications', 'toppaidapplications', 'toppaidipadapplications'
  ];
  
  const androidCollections = [
    'TOP_FREE', 'TOP_PAID', 'GROSSING'
  ];
  
  for (const collection of collectionsInput) {
    if (platform === 'ios' && iosCollections.includes(collection)) {
      validCollections.push(collection);
    } else if (platform === 'android' && androidCollections.includes(collection)) {
      validCollections.push(collection);
    } else {
      invalidCollections.push(collection);
    }
  }
  
  // Log invalid collections if any
  if (invalidCollections.length > 0 && global.verbose) {
    console.warn(`  Warning: Skipping invalid ${platform} collections: ${invalidCollections.join(', ')}`);
  }
  
  // If no valid collections found, use defaults
  if (validCollections.length === 0) {
    if (platform === 'ios') {
      console.log(`  Using default iOS collection: topfreeapplications`);
      return ['topfreeapplications'];
    } else if (platform === 'android') {
      console.log(`  Using default Android collection: TOP_FREE`);
      return ['TOP_FREE'];
    }
  }
  
  return validCollections;
}

/**
 * Get categories for a specific platform
 * Maps generic category names to platform-specific category IDs
 * Also handles direct platform-specific category IDs
 * 
 * @param {string} platform - 'ios' or 'android'
 * @param {string[]} categoriesInput - Array of category names or IDs
 * @returns {string[]} - Array of platform-specific category IDs
 */
function getCategoriesForPlatform(platform, categoriesInput) {
  const platformCategories = [];
  const skippedCategories = [];
  const mappedCategories = {};
  
  for (const categoryInput of categoriesInput) {
    const lowerCaseCategory = categoryInput.toLowerCase();
    let mapped = false;
    
    // 1. Check if this is a direct match in our unified category mapping
    if (CATEGORY_MAPPING[lowerCaseCategory] && 
        CATEGORY_MAPPING[lowerCaseCategory][platform]) {
      const mappedCategory = CATEGORY_MAPPING[lowerCaseCategory][platform];
      platformCategories.push(mappedCategory);
      mappedCategories[categoryInput] = mappedCategory;
      mapped = true;
    } 
    // 2. Check if this is a similar match using our similarity mapping
    else if (SIMILARITY_MAPPING[lowerCaseCategory]) {
      const similarCategory = SIMILARITY_MAPPING[lowerCaseCategory];
      if (CATEGORY_MAPPING[similarCategory] && 
          CATEGORY_MAPPING[similarCategory][platform]) {
        const mappedCategory = CATEGORY_MAPPING[similarCategory][platform];
        platformCategories.push(mappedCategory);
        mappedCategories[categoryInput] = `${mappedCategory} (via similarity match to '${similarCategory}')`;
        mapped = true;
        if (global.verbose) {
          console.log(`  Mapped '${categoryInput}' to '${similarCategory}' category: ${mappedCategory}`);
        }
      }
    }
    // 3. Check if this might be a direct platform-specific category ID
    else if ((platform === 'ios' && !isNaN(parseInt(categoryInput, 10))) || 
             (platform === 'android' && isNaN(parseInt(categoryInput, 10)) && categoryInput === categoryInput.toUpperCase())) {
      platformCategories.push(categoryInput);
      mappedCategories[categoryInput] = `${categoryInput} (direct platform ID)`;
      mapped = true;
    }
    
    // If we couldn't map this category for this platform, log it
    if (!mapped) {
      skippedCategories.push(categoryInput);
    }
  }
  
  // Store the category mappings in our results
  global.results.categoryMappings[platform] = mappedCategories;
  
  // Log skipped categories
  if (skippedCategories.length > 0) {
    console.warn(`  Warning: Skipping categories with no ${platform} equivalent: ${skippedCategories.join(', ')}`);
  }
  
  // If no valid categories were found, use a default
  if (platformCategories.length === 0) {
    if (platform === 'ios') {
      console.log(`  Using default iOS category: 6007 (Productivity)`);
      return ['6007']; // Default to Productivity for iOS
    } else {
      console.log(`  Using default Android category: PRODUCTIVITY`);
      return ['PRODUCTIVITY']; // Default to PRODUCTIVITY for Android
    }
  }
  
  return platformCategories;
}

/**
 * Get apps from a specific collection
 * Fetches apps from the app store using the specified collection, category, and limit
 * 
 * @param {string} platform - 'ios' or 'android'
 * @param {string} collection - Collection name
 * @param {string|number} category - Category ID
 * @param {number} limit - Maximum number of apps to fetch
 * @returns {Promise<Array>} - Array of app objects
 */
async function getAppsFromCollection(platform, collection, category, limit) {
  try {
    if (platform === 'ios') {
      // Use App Store list API
      const categoryNum = parseInt(category, 10);
      
      if (global.verbose) {
        console.log(`  Fetching iOS apps from collection '${collection}' with category ${category}`);
      }
      
      const results = await store.list({
        collection,
        category: isNaN(categoryNum) ? undefined : categoryNum,
        num: limit,
        country: 'us',
        fullDetail: false
      });
      
      return results.map(app => ({
        title: app.title,
        url: app.url,
        appId: app.appId,
        icon: app.icon,
        developer: app.developer
      }));
    } else if (platform === 'android') {
      // Use Google Play list API
      if (global.verbose) {
        console.log(`  Fetching Android apps from collection '${collection}' with category ${category}`);
      }
      
      const results = await gplay.list({
        collection,
        category: category,
        num: limit,
        country: 'us',
        fullDetail: false
      });
      
      return results.map(app => ({
        title: app.title,
        url: app.url,
        appId: app.appId,
        icon: app.icon,
        developer: app.developer
      }));
    }
    
    throw new Error(`Unsupported platform: ${platform}`);
  } catch (error) {
    console.error(`Error fetching apps for ${platform} collection ${collection}:`, error);
    throw error;
  }
}

/**
 * Process a single app
 * Checks if a report already exists, and if not, generates a new one
 * 
 * @param {Object} app - App object with title, url, etc.
 * @param {string} platform - 'ios' or 'android'
 * @param {string} collectionKey - Key for tracking results
 * @param {boolean} forceRefresh - Whether to force refresh existing reports
 * @param {Object} results - Results tracking object
 * @returns {Promise<void>}
 */
async function processApp(app, platform, collectionKey, forceRefresh, results) {
  console.log(`    Processing app: ${app.title || app.url}`);
  
  // Generate URL hash
  const urlHash = generateUrlHash(app.url);
  
  // Check if report already exists
  const existingReport = await checkExistingReport(urlHash);
  
  if (existingReport && !forceRefresh) {
    console.log(`    Report already exists for ${app.title || app.url}`);
    results.existingReportsFound++;
    results.appsByCollection[collectionKey].existing++;
    return;
  }
  
  // Process the app URL to get app data
  let appData;
  if (platform === 'ios') {
    appData = await processAppStoreUrl(app.url);
  } else if (platform === 'android') {
    appData = await processGooglePlayUrl(app.url);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  // Generate report
  const report = await generateReport(app.url, appData);
  
  console.log(`    Generated new report for ${app.title || app.url}`);
  results.newReportsGenerated++;
  results.appsByCollection[collectionKey].new++;
  
  // Add a small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Check if a report already exists for this URL
 * Uses the API endpoint instead of direct database access
 * 
 * @param {string} urlHash - MD5 hash of the URL
 * @returns {Promise<Object|null>} - Existing report or null
 */
async function checkExistingReport(urlHash) {
  try {
    const apiClient = createApiClient();
    const response = await apiClient.get('/api/check-existing-report', {
      params: { urlHash }
    });
    
    if (response.data.exists) {
      console.log(`Report exists for hash ${urlHash} (source: ${response.data.source})`);
      return response.data.report;
    }
    
    if (response.data.reason === 'expired') {
      console.log(`Report for hash ${urlHash} exists but is expired (timestamp: ${new Date(response.data.timestamp).toISOString()})`);
    }
    
    return null;
  } catch (error) {
    console.error('Error checking existing report:', error.message);
    // If the API call fails, return null to be safe
    return null;
  }
}

/**
 * Generate a report for an app
 * Calls the analyze API to generate a report
 * 
 * @param {string} url - App URL
 * @param {Object} appData - App data object
 * @returns {Promise<Object>} - Generated report
 */
async function generateReport(url, appData) {
  try {
    const apiClient = createApiClient();
    const response = await apiClient.post('/api/analyze', {
      url,
      appData,
      provider: process.env.LLM_PROVIDER,
      model: process.env.LLM_MODEL
    });
    
    return response.data.report;
  } catch (error) {
    console.error('Error generating report:', error.message);
    throw new Error(`Failed to generate report: ${error.message}`);
  }
}

/**
 * Save results to a file
 * Creates a JSON summary of the batch processing results
 * 
 * @param {Object} results - Results tracking object
 * @param {string} reportsDir - Directory to save results to
 * @returns {Promise<void>}
 */
async function saveResults(results, reportsDir) {
  const summaryPath = path.join(reportsDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${summaryPath}`);
  
  console.log('\nSummary:');
  console.log(`Total apps processed: ${results.totalAppsProcessed}`);
  console.log(`New reports generated: ${results.newReportsGenerated}`);
  console.log(`Existing reports found: ${results.existingReportsFound}`);
  console.log(`Errors encountered: ${results.errors.length}`);
  
  // Log category mappings
  console.log('\nCategory mappings:');
  for (const platform in results.categoryMappings) {
    console.log(`  ${platform}:`);
    for (const [input, mapped] of Object.entries(results.categoryMappings[platform])) {
      console.log(`    ${input} → ${mapped}`);
    }
  }
  
  console.log(`\nDuration: ${new Date(results.endTime) - new Date(results.startTime)}ms`);
}

// Export functions for testing and reuse
export {
  main,
  getCollectionsForPlatform,
  getCategoriesForPlatform,
  getAppsFromCollection,
  parseCommandLineArgs
};
