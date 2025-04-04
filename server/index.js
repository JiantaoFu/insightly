import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  searchApps,
  getAppDetails,
  getAppReviews,
  processAppStoreUrl,
  extractAppStoreId
} from './appStoreScraper.js';
import { processGooglePlayUrl } from './googlePlayScraper.js';
import Markdown from 'react-markdown';
import { promptConfig } from './promptConfig.js';
import rateLimit from 'express-rate-limit';
import { LLM_PROVIDERS } from './llmProviders.js';
import { LRUCache } from 'lru-cache';
import { generateUrlHash } from './utils.js';
import { supabase } from './supabaseClient.js';
import { generateSitemap, initializeSitemap } from './sitemap.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable trust proxy
app.set('trust proxy', 1);

// Get math challenge configuration from environment
const ENABLE_MATH_CHALLENGE = process.env.ENABLE_MATH_CHALLENGE === 'true';

// Get client origin from environment
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Add these constants near the top with other constants
const MAX_DB_QUERY_LIMIT = 50; // Maximum number of records per page
const DEFAULT_DB_QUERY_LIMIT = 10; // Default number of records per page

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow Firefox extensions
    if (origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }

    if (origin.includes('github.com')) {
      return callback(null, true);
    }

    // Allow the specified client origin
    if (origin === CLIENT_ORIGIN) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: false
}));
app.use(express.json({
  limit: '50mb'
}));
app.use(express.urlencoded({
  limit: '50mb',
  extended: true
}));

// Configure rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Middleware to verify math challenge
const verifyMathChallenge = (req, res, next) => {
  // Skip verification if math challenge is disabled
  if (!ENABLE_MATH_CHALLENGE) {
    return next();
  }

  const challenge = req.headers['x-math-challenge'];

  if (!challenge) {
    console.warn('No math challenge provided', {
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: 'No math challenge provided' });
  }

  try {
    // Validate math challenge format
    const challengeRegex = /^(\d+)([+\-*])(\d+)$/;
    const match = challenge.match(challengeRegex);

    if (!match) {
      console.warn('Invalid math challenge format', {
        challenge,
        path: req.path
      });
      return res.status(403).json({ error: 'Invalid math challenge' });
    }

    const [, a, operation, b] = match;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);

    // Verify challenge
    let expectedAnswer;
    switch (operation) {
      case '+':
        expectedAnswer = numA + numB;
        break;
      case '-':
        expectedAnswer = numA - numB;
        break;
      case '*':
        expectedAnswer = numA * numB;
        break;
      default:
        return res.status(403).json({ error: 'Invalid math operation' });
    }

    // Log successful verification
    console.log('Math challenge verified successfully', {
      challenge,
      path: req.path
    });

    next();
  } catch (error) {
    console.error('Math challenge verification failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Math challenge verification failed' });
  }
};

// Apply rate limiter to all routes
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin || '';
  const userAgent = req.headers['user-agent'] || '';

  // Check if request is from GitHub Actions
  if (origin.includes('github.com')) {
    console.log('Bypassing rate limit for GitHub Actions request');
    return next();
  }

  // Apply rate limiter for all other requests
  return apiLimiter(req, res, next);
});

// App Store Routes
app.get('/app-store/search', async (req, res) => {
  try {
    const { query, limit, country } = req.query;
    const results = await searchApps(query, { limit, country });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search apps' });
  }
});

app.get('/app-store/app/:id', async (req, res) => {
  try {
    const appId = req.params.id;
    const details = await getAppDetails(appId);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch app details' });
  }
});

app.get('/app-store/reviews/:id', async (req, res) => {
  try {
    const appId = req.params.id;
    const { page, country } = req.query;
    const reviews = await getAppReviews(appId, { page, country });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch app reviews' });
  }
});

// Google Play Routes
app.post('/google-play/process-url', async (req, res) => {
  const { url } = req.body;

  try {
    const appData = await processGooglePlayUrl(url);
    res.json(appData);
  } catch (error) {
    console.error('Google Play URL processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New route to process full App Store URL
app.post('/app-store/process-url', async (req, res) => {
  try {
  const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await processAppStoreUrl(url);
    res.json(result);
  } catch (error) {
    console.error('Error processing App Store URL:', error);

    if (error.message === 'Invalid App Store URL') {
      return res.status(400).json({ error: 'Invalid App Store URL' });
    }

    res.status(500).json({ error: 'Failed to process App Store URL' });
  }
});

// New route to extract App Store ID from URL
app.post('/app-store/extract-id', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const appId = extractAppStoreId(url);
    res.json({ appId });
  } catch (error) {
    console.error('Error extracting App Store ID:', error);

    if (error.message === 'Invalid App Store URL') {
      return res.status(400).json({ error: 'Invalid App Store URL' });
    }

    res.status(500).json({ error: 'Failed to extract App Store ID' });
  }
});

const ANALYSIS_CACHE_MAX_SIZE = 100;
const COMPARISON_CACHE_MAX_SIZE = 50;  // Separate cache for comparison reports

const analysisCache = new LRUCache({
  max: ANALYSIS_CACHE_MAX_SIZE,
  maxAge: 1000 * 60 * 60 * 24 * 90
});

const comparisonCache = new LRUCache({
  max: COMPARISON_CACHE_MAX_SIZE,
  maxAge: 1000 * 60 * 60 * 24 * 90
});

const RECORD_EXPIRATION_HOURS = process.env.RECORD_EXPIRATION_HOURS
  ? parseInt(process.env.RECORD_EXPIRATION_HOURS, 10)
  : 24 * 7 * 365;

// Function to check if cache entry is expired
const isRecordEntryExpired = (recordEntry) => {
  if (!recordEntry || !recordEntry.timestamp) return true;

  const currentTime = Date.now();
  const entryAge = currentTime - recordEntry.timestamp;
  const expirationMs = RECORD_EXPIRATION_HOURS * 60 * 60 * 1000;

  return entryAge > expirationMs;
};

// Async function to save to Supabase
async function saveToSupabase(cacheEntry, url, hashUrl) {
  try {
    const { data, error } = await supabase
      .from('analysis_reports')
      .insert({
        app_title: cacheEntry.appDetails.title,
        description: cacheEntry.appDetails.description,
        developer: cacheEntry.appDetails.developer,
        version: cacheEntry.appDetails.version,
        app_url: url,
        hash_url: hashUrl,
        app_score: cacheEntry.appDetails.score,
        reviews: cacheEntry.appDetails.reviews.length,
        icon: cacheEntry.appDetails.icon,
        platform: cacheEntry.appDetails.platform,
        total_reviews: cacheEntry.reviewsSummary.totalReviews,
        average_rating: cacheEntry.reviewsSummary.averageRating,
        score_distribution: cacheEntry.reviewsSummary.scoreDistribution,
        timestamp: cacheEntry.timestamp,
        full_report: cacheEntry
      })
      .select();

    if (error) {
      console.error('Error saving to Supabase:', error);
    }
  } catch (dbError) {
    console.error('Database save error:', dbError);
  }
}

async function saveComparisonToSupabase(cacheEntry, hashUrl) {
 try {
   const { data, error } = await supabase
     .from('comparison_reports')
     .insert({
       urls: cacheEntry.urls,
       hash_url: hashUrl,
       competitors: cacheEntry.competitors,
       final_report: cacheEntry.finalReport,
       timestamp: cacheEntry.timestamp
     });

   if (error) {
     console.error('Error saving comparison to Supabase:', error);
   }
 } catch (dbError) {
   console.error('Database save error:', dbError);
 }
}

// Async function to remove expired entries from Supabase
async function removeExpiredEntriesFromSupabase() {
  try {
    const expirationThreshold = Date.now() - (RECORD_EXPIRATION_HOURS * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('analysis_reports')
      .delete()
      .lt('timestamp', expirationThreshold);

    if (error) {
      console.error('Error removing expired entries from Supabase:', error);
    } else {
      console.log(`Removed expired entries from Supabase`);
    }
  } catch (dbError) {
    console.error('Database cleanup error:', dbError);
  }
}

// Async function to remove a specific entry from Supabase by hashUrl
async function removeEntryFromSupabase(hashUrl) {
 try {
   // Remove from analysis_reports table
   const { error: analysisError } = await supabase
     .from('analysis_reports')
     .delete()
     .eq('hash_url', hashUrl);

   if (analysisError) {
     console.error(`Error removing entry with hash_url ${hashUrl} from analysis_reports:`, analysisError);
     return { success: false, message: `Error removing entry from analysis_reports: ${analysisError.message}` };
   } else {
     console.log(`Removed entry with hash_url ${hashUrl} from analysis_reports`);
   }

   // Remove from comparison_reports table
   const { error: comparisonError } = await supabase
     .from('comparison_reports')
     .delete()
     .eq('hash_url', hashUrl);

   if (comparisonError) {
     console.error(`Error removing entry with hash_url ${hashUrl} from comparison_reports:`, comparisonError);
     return { success: false, message: `Error removing entry from comparison_reports: ${comparisonError.message}` };
   } else {
     console.log(`Removed entry with hash_url ${hashUrl} from comparison_reports`);
   }

   return { success: true, message: `Entries with hash_url ${hashUrl} removed from both tables` };
 } catch (dbError) {
   console.error('Database deletion error:', dbError);
   return { success: false, message: `Database deletion error: ${dbError.message}` };
 }
}

// Modify the cache entry structure
const createCacheEntry = (url, hashUrl, finalReport, appData) => {
  const cacheEntry = {
    finalReport,
    timestamp: Date.now(),
    appDetails: {
      title: appData.details.title,
      description: appData.details.description,
      developer: appData.details.developer,
      version: appData.details.version,
      url: url,
      score: appData.details.score,
      reviews: appData.reviews.reviews,
      icon: appData.details.icon,
      platform: appData.details.platform
    },
    reviewsSummary: {
      totalReviews: appData.reviews.total,
      averageRating: appData.reviews.averageRating,
      scoreDistribution: appData.reviews.scoreDistribution
    },
    getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`,
  };

  // Save to Supabase
  saveToSupabase(cacheEntry, url, hashUrl);

  return cacheEntry;
};

const createComparisonCacheEntry = (urls, cacheKey, competitors, finalReport) => {
  const cacheEntry = {
    competitors,
    finalReport,
    timestamp: Date.now(),
    urls,
    getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-competitor-report/${cacheKey}`,
  };

  // Save to Supabase
  saveComparisonToSupabase(cacheEntry, cacheKey);

  return cacheEntry;
};

app.post('/api/analyze',
  ENABLE_MATH_CHALLENGE ? verifyMathChallenge : (req, res, next) => next(),
  async (req, res) => {
  const { url, customPrompt, force = false } = req.body;
  const hashUrl = generateUrlHash(url);

  // Check if report is in cache
  const cachedReport = analysisCache.get(hashUrl);

  // First check in-memory cache
  if (!force && cachedReport && !isRecordEntryExpired(cachedReport)) {
    console.log('Report found in cache:', url);

    // If cached, stream the report
    const chunks = cachedReport.finalReport.match(/[^\n]*\n?/g).filter(chunk => chunk !== '');
    chunks.forEach((chunk, index) => {
      res.write(JSON.stringify({ report: chunk }) + '\n');

      if (index === chunks.length - 1) {
        res.end();
      }
    });
    return;
  } else if (cachedReport) {
    // If cache entry is expired or force refresh, remove it
    console.log('Cache entry expired or force refresh for:', url);
    analysisCache.delete(hashUrl);
    await removeEntryFromSupabase(hashUrl);
  }

  // If not in memory cache, check database
  if (!force) {
    try {
      const { data, error } = await supabase
        .from('analysis_reports')
        .select('*')
        .eq('hash_url', hashUrl)
        .single();

      if (!error && data && !isRecordEntryExpired({ timestamp: data.timestamp })) {
        console.log('Report found in database:', url);

        // Reconstruct cache entry from database
        const dbCacheEntry = {
          ...data.full_report,
          getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`
        };

        // Add to memory cache
        analysisCache.set(hashUrl, dbCacheEntry);

        // Stream the report
        const chunks = data.full_report.finalReport.match(/[^\n]*\n?/g).filter(chunk => chunk !== '');
        chunks.forEach((chunk, index) => {
          res.write(JSON.stringify({ report: chunk }) + '\n');
          if (index === chunks.length - 1) {
            res.end();
          }
        });
        return;
      }
    } catch (dbError) {
      console.error('Error checking database:', dbError);
    }
  }

  try {
    // console.log('Full request body:', JSON.stringify(req.body, null, 2));

    const { provider, model, appData } = req.body;

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    console.log('Received parameters:', { url, model, provider });
    const selectedProvider = LLM_PROVIDERS[provider || process.env.LLM_PROVIDER || 'ollama'];
    console.log('Selected provider:', selectedProvider ? 'Found' : 'Not found');
    if (!selectedProvider) {
      console.error('Invalid provider:', provider);
      return res.status(400).json({
        error: 'Invalid LLM provider',
        availableProviders: Object.keys(LLM_PROVIDERS)
      });
    }

    // Prepare prompt based on whether app data is provided
    let prompt = `You are an expert app review analyzer. Analyze the app at the following URL: ${url}. App information provided below:`;

    if (appData && appData.reviews && appData.reviews.reviews) {
      // If App Store reviews are provided, include them in the prompt
      const reviewsText = appData.reviews.reviews
        .map(review => `Review (Score: ${review.score}): ${review.text}`)
        .join('\n');

      prompt += `\n\nApp Details:
- Title: ${appData.details.title}
- Description: ${appData.details.description}
- Developer: ${appData.details.developer}
- Version: ${appData.details.version}

Reviews Summary:
- Total Reviews: ${appData.reviews.total}
- Score Distribution: ${JSON.stringify(appData.reviews.scoreDistribution)} (Interpret this as the breakdown percentages for each star rating, e.g., percentage of 5-star, 4-star, etc.)

Detailed Reviews:
${reviewsText}

${customPrompt || promptConfig.appReviewAnalysis}

${promptConfig.format}
`;
    } else {
      // Fallback to existing logic if no app data
      prompt += '\n\nPlease analyze this URL and provide insights.';
    }

    // console.log('Prompt:', prompt);
    // console.log('Prompt length:', prompt.length);

    let finalReport = '';
    try {
      await selectedProvider.streamResponse(
        model,
        prompt,
        (chunk) => {
          // Accumulate the report for caching
          finalReport += chunk;

          // Stream the response
          res.write(JSON.stringify({ report: chunk }) + '\n');
        }
      );

      // console.log('Final report:', finalReport);

      // Store in cache with comprehensive metadata
      const cacheEntry = createCacheEntry(url, hashUrl, finalReport, appData);
      analysisCache.set(hashUrl, cacheEntry);

      // Directly end the response after streaming is complete
      res.end();
    } catch (generateError) {
      console.error('Generate Response Error:', {
        message: generateError.message,
        stack: generateError.stack,
        responseData: generateError.response ? generateError.response.data : 'No response data'
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate response',
          details: generateError.message,
          providerDetails: {
            url: selectedProvider.url,
            model: model || selectedProvider.defaultModel
          }
        });
      }
      res.end();
    }
  } catch (error) {
    console.error('Unexpected Error in /api/analyze:', {
      message: error.message,
      stack: error.stack
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Unexpected error analyzing reviews',
        details: error.message
      });
    }
    res.end();
  }
});

app.post('/api/compare-competitors',
  ENABLE_MATH_CHALLENGE ? verifyMathChallenge : (req, res, next) => next(),
  async (req, res) => {
  try {
    const { competitors, provider, model, customComparisonPrompt, force = false } = req.body;

    // Generate a cache key based on sorted URLs
    const sortedUrls = competitors.map(c => c.url).sort();
    const cacheKey = createComparisonCacheKey(sortedUrls);

    // Check if report is in cache
    const cachedReport = comparisonCache.get(cacheKey);
    if (!force && cachedReport) {
      console.log('Returning cached comparison report');
      return res.json({ report: cachedReport.finalReport });
    } else if (cachedReport) {
      // If cache entry is expired or force refresh, remove it
      console.log('Cache entry expired or force refresh for:', sortedUrls);
      comparisonCache.delete(cacheKey);
      await removeEntryFromSupabase(cacheKey);
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const selectedProvider = LLM_PROVIDERS[provider || process.env.LLM_PROVIDER || 'ollama'];
    console.log('Selected provider:', selectedProvider ? 'Found' : 'Not found');
    if (!selectedProvider) {
      console.error('Invalid provider:', provider);
      return res.status(400).json({
        error: 'Invalid LLM provider',
        availableProviders: Object.keys(LLM_PROVIDERS)
      });
    }

    // Validate input
    if (!competitors || !Array.isArray(competitors) || competitors.length < 2) {
      res.status(400).json({ error: 'At least two competitors are required' });
      return;
    }

    // Validate each competitor has required fields
    const validCompetitors = competitors.filter(comp =>
      comp.name && comp.url && comp.platform && comp.description
    );

    if (validCompetitors.length < 2) {
      res.status(400).json({
        error: 'Insufficient valid competitor data',
        details: 'Each competitor must have name, url, platform, and description'
      });
      return;
    }

    // Prepare the comparison prompt with reviews
    const competitorDetails = validCompetitors.map(comp => {
      // Extract top positive and negative reviews
      const positiveReviews = comp.appData?.reviews?.reviews
        ?.filter(review => review.score >= 4)
        ?.map(review => `"${review.text}"`) || [];

      const negativeReviews = comp.appData?.reviews?.reviews
        ?.filter(review => review.score <= 2)
        ?.map(review => `"${review.text}"`) || [];

      return `
App Name: ${comp.name}
Platform: ${comp.platform}
Developer: ${comp.developer || 'N/A'}
Description: ${comp.description}

Positive Reviews:
${positiveReviews.length > 0 ? positiveReviews.join('\n') : 'No notable positive reviews'}

Negative Reviews:
${negativeReviews.length > 0 ? negativeReviews.join('\n') : 'No notable negative reviews'}

Average Rating: ${comp.appData?.reviews?.averageRating || 'N/A'}
Total Reviews: ${comp.appData?.reviews?.totalReviews || 0}
`;
    }).join('\n\n');

    const comparisonPrompt = `
${customComparisonPrompt || promptConfig.appComparison}

${promptConfig.format}

Perform a comprehensive comparative analysis of the following competitor apps:

\`\`\`
${competitorDetails}
\`\`\`
`;

    // console.log(comparisonPrompt);

    let finalReport = '';
    try {
      await selectedProvider.streamResponse(
        model,
        comparisonPrompt,
        (chunk) => {
          // Accumulate the report for caching
          finalReport += chunk;

          // Stream the response
          res.write(JSON.stringify({ report: chunk }) + '\n');
        }
      );

      // console.log('Final report:', finalReport);

      // Cache the comparison report
      const cacheEntry = createComparisonCacheEntry(sortedUrls, cacheKey, validCompetitors, finalReport);
      comparisonCache.set(cacheKey, cacheEntry);

      // Directly end the response after streaming is complete
      res.end();
    } catch (generateError) {
      console.error('Generate Response Error:', {
        message: generateError.message,
        stack: generateError.stack,
        responseData: generateError.response ? generateError.response.data : 'No response data'
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate response',
          details: generateError.message,
          providerDetails: {
            url: selectedProvider.url,
            model: model
          }
        });
      }
      res.end();
    }

  } catch (error) {
    console.error('Competitor comparison error:', error);

    // Ensure headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error during competitor comparison',
        details: error.message,
        stack: error.stack
      });
    }
  }
});

// Utility function to create a consistent cache key
function createComparisonCacheKey(urls) {
  // Create a deterministic key based on sorted URLs
  const urlsString = urls.join('|');
  return generateUrlHash(urlsString);
}

// Update existing routes that fetch cached reports
app.get('/api/check-cache', (req, res) => {
 const { urlHash } = req.query;
 let cachedReport = analysisCache.get(urlHash);

 if (cachedReport) {
   res.json({
     cached: true,
     finalReport: cachedReport.finalReport,
     appDetails: cachedReport.appDetails,
     reviewsSummary: cachedReport.reviewsSummary,
     timestamp: cachedReport.timestamp
   });
 } else {
   cachedReport = comparisonCache.get(urlHash);
   if (cachedReport) {
     res.json({
       cached: true,
       finalReport: cachedReport.finalReport,
       competitors: cachedReport.competitors,
       timestamp: cachedReport.timestamp
     });
   } else {
     res.json({ cached: false });
   }
 }
});

// Update the cached analyses endpoint to return more comprehensive data
app.get('/api/cached-analyses', (req, res) => {
  try {
    // Explicitly clear any existing headers
    res.removeHeader('Content-Type');

    const cachedResults = Array.from(analysisCache.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([hashUrl, entry]) => {
        // Ensure all fields are defined and sanitized
        return {
          shareLink: entry.getShareLink(),
          appDetails: entry.appDetails,
          reviewsSummary: entry.reviewsSummary,
          analysisDate: new Date(entry.timestamp || Date.now()).toLocaleString(),
        };
      });

    // Explicitly set JSON content type
    res.contentType('application/json');

    // console.log('Sending cached results:', cachedResults);

    // Send JSON response
    res.json(cachedResults);
  } catch (error) {
    console.error('Error retrieving cached analyses:', error);
    res.status(500)
       .contentType('application/json')
       .json({
         error: 'Failed to retrieve cached analyses',
         details: error.message
       });
  }
});

// New endpoint for database queries with pagination
app.get('/api/db-analyses', async (req, res) => {
  try {
    const { page = 1, limit = DEFAULT_DB_QUERY_LIMIT, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    const safeLimit = Math.min(parseInt(limit), MAX_DB_QUERY_LIMIT);
    const offset = (page - 1) * safeLimit;

    // Validate sort parameters
    const validSortFields = ['timestamp', 'app_title', 'developer', 'app_score', 'total_reviews'];
    const validSortOrders = ['asc', 'desc'];

    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    // Fetch from database with pagination and sorting
    const { data, error, count } = await supabase
      .from('analysis_reports')
      .select('*', { count: 'exact' })
      .order(finalSortBy, { ascending: finalSortOrder === 'asc' })
      .range(offset, offset + safeLimit - 1);

    if (error) throw error;

    const results = data.map(entry => ({
      shareLink: `${process.env.CLIENT_ORIGIN}/shared-app-report/${entry.hash_url}`,
      appDetails: entry.full_report.appDetails,
      reviewsSummary: entry.full_report.reviewsSummary,
      analysisDate: new Date(entry.timestamp).toLocaleString(),
      metadata: {
        hashUrl: entry.hash_url,
        appUrl: entry.app_url,
        platform: entry.platform
      }
    }));

    res.json({
      results,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: safeLimit,
        totalPages: Math.ceil(count / safeLimit),
        hasMore: offset + safeLimit < count
      },
      sorting: {
        sortBy: finalSortBy,
        sortOrder: finalSortOrder
      }
    });
  } catch (error) {
    console.error('Error retrieving analyses from database:', error);
    res.status(500).json({
      error: 'Failed to retrieve analyses from database',
      details: error.message
    });
  }
});

app.get('/api/cached-comparisons', (req, res) => {
 try {
   // Explicitly clear any existing headers
   res.removeHeader('Content-Type');

   const cachedResults = Array.from(comparisonCache.entries())
     .sort((a, b) => b[1].timestamp - a[1].timestamp)
     .map(([hashUrl, entry]) => {
       // Ensure all fields are defined and sanitized
       return {
         shareLink: entry.getShareLink(),
         competitors: entry.competitors,
         comparisonDate: new Date(entry.timestamp || Date.now()).toLocaleString(),
       };
     });

   // Explicitly set JSON content type
   res.contentType('application/json');

   // console.log('Sending cached comparison results:', cachedResults);

   // Send JSON response
   res.json(cachedResults);
 } catch (error) {
   console.error('Error retrieving cached comparisons:', error);
   res.status(500)
      .contentType('application/json')
      .json({
        error: 'Failed to retrieve cached comparisons',
        details: error.message
      });
 }
});

// New endpoint for database queries of comparison reports with pagination
app.get('/api/db-comparisons', async (req, res) => {
  try {
    const { page = 1, limit = DEFAULT_DB_QUERY_LIMIT, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    const safeLimit = Math.min(parseInt(limit), MAX_DB_QUERY_LIMIT);
    const offset = (page - 1) * safeLimit;

    // Validate sort parameters
    const validSortFields = ['timestamp', 'hash_url'];
    const validSortOrders = ['asc', 'desc'];

    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    // Fetch from database with pagination and sorting
    const { data, error, count } = await supabase
      .from('comparison_reports')
      .select('*', { count: 'exact' })
      .order(finalSortBy, { ascending: finalSortOrder === 'asc' })
      .range(offset, offset + safeLimit - 1);

    if (error) throw error;

    const results = data.map(entry => ({
      shareLink: `${process.env.CLIENT_ORIGIN}/shared-competitor-report/${entry.hash_url}`,
      competitors: entry.competitors,
      urls: entry.urls,
      comparisonDate: new Date(entry.timestamp).toLocaleString(),
      metadata: {
        hashUrl: entry.hash_url,
        timestamp: entry.timestamp
      }
    }));

    res.json({
      results,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: safeLimit,
        totalPages: Math.ceil(count / safeLimit),
        hasMore: offset + safeLimit < count
      },
      sorting: {
        sortBy: finalSortBy,
        sortOrder: finalSortOrder
      }
    });
  } catch (error) {
    console.error('Error retrieving comparisons from database:', error);
    res.status(500).json({
      error: 'Failed to retrieve comparisons from database',
      details: error.message
    });
  }
});

// Add after existing routes
app.get('/api/share-app-report', (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const hashUrl = generateUrlHash(url);
  const cachedReport = analysisCache.get(hashUrl);

  if (cachedReport && !isRecordEntryExpired(cachedReport)) {
    return res.json({
      shareLink: cachedReport.getShareLink(),
      expiresAt: Date.now() + analysisCache.maxAge
    });
  }

  // Check database if not in cache
  supabase
    .from('analysis_reports')
    .select('*')
    .eq('hash_url', hashUrl)
    .single()
    .then(({ data, error }) => {
      if (error || !data || isRecordEntryExpired({ timestamp: data.timestamp })) {
        return res.status(404).json({
          error: 'Report not found or expired. Please re-run the analysis.',
          shouldReanalyze: true
        });
      }

      // Reconstruct cache entry and add to memory cache
      const cacheEntry = {
        ...data.full_report,
        getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`
      };
      analysisCache.set(hashUrl, cacheEntry);

      res.json({
        shareLink: cacheEntry.getShareLink(),
        expiresAt: Date.now() + analysisCache.maxAge
      });
    });
});

app.get('/api/shared-app-report', (req, res) => {
  const { shareId } = req.query;

  if (!shareId) {
    return res.status(400).json({ error: 'Share ID is required' });
  }

  const cachedReport = analysisCache.get(shareId);

  if (cachedReport && !isRecordEntryExpired(cachedReport)) {
    return res.json({
      appDetails: cachedReport.appDetails,
      report: cachedReport.finalReport
    });
  }

  // Check database if not in cache
  supabase
    .from('analysis_reports')
    .select('*')
    .eq('hash_url', shareId)
    .single()
    .then(({ data, error }) => {
      if (error || !data || isRecordEntryExpired({ timestamp: data.timestamp })) {
        return res.status(404).json({
          error: 'Report expired or not found. Please re-run the analysis.',
          shouldReanalyze: true
        });
      }

      // Reconstruct cache entry and add to memory cache
      const cacheEntry = {
        ...data.full_report,
        getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${shareId}`
      };
      analysisCache.set(shareId, cacheEntry);

      res.json({
        appDetails: cacheEntry.appDetails,
        report: cacheEntry.finalReport
      });
    });
});

app.get('/api/share-competitor-report', (req, res) => {
  const { urls } = req.query;

  if (!urls) {
    return res.status(400).json({ error: 'URLs are required' });
  }

  // Sort and parse URLs
  const sortedUrls = JSON.parse(urls).sort();
  const cacheKey = createComparisonCacheKey(sortedUrls);

  const cachedReport = comparisonCache.get(cacheKey);

  if (!cachedReport) {
    return res.status(404).json({
      error: 'Report not found. Please re-run the comparison.',
      shouldReanalyze: true
    });
  }

  res.json({
    shareLink: cachedReport.getShareLink(),
    expiresAt: Date.now() + comparisonCache.maxAge
  });
});

app.get('/api/shared-competitor-report', (req, res) => {
  const { shareId } = req.query;

  if (!shareId) {
    return res.status(400).json({ error: 'Share ID is required' });
  }

  const sharedReportEntry = comparisonCache.get(shareId);

  if (!sharedReportEntry) {
    return res.status(404).json({
      error: 'Report expired. Please re-run the comparison.',
      shouldReanalyze: true
    });
  }

  // Return the entire report directly
  res.json({ report: sharedReportEntry.finalReport });
});

// Add new endpoint to check if a report already exists
app.get('/api/check-existing-report', async (req, res) => {
  try {
    const { urlHash } = req.query;

    if (!urlHash) {
      return res.status(400).json({ error: 'URL hash is required' });
    }

    // First check the in-memory cache
    const cachedReport = analysisCache.get(urlHash);
    if (cachedReport && !isRecordEntryExpired(cachedReport)) {
      return res.json({
        exists: true,
        source: 'cache',
        report: {
          appDetails: cachedReport.appDetails,
          reviewsSummary: cachedReport.reviewsSummary,
          timestamp: cachedReport.timestamp
        }
      });
    }

    // If not in cache, check the database
    const { data, error } = await supabase
      .from('analysis_reports')
      .select('*')
      .eq('hash_url', urlHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return res.json({ exists: false });
      }
      throw error;
    }

    // If we found a record in the database
    if (data) {
      // Check if the record is expired
      if (isRecordEntryExpired({ timestamp: data.timestamp })) {
        return res.json({
          exists: false,
          reason: 'expired',
          timestamp: data.timestamp
        });
      }

      // If not expired, return the record and add to cache
      const cacheEntry = {
        ...data.full_report,
        getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${urlHash}`
      };

      // Add to cache for future requests
      analysisCache.set(urlHash, cacheEntry);

      return res.json({
        exists: true,
        source: 'database',
        report: {
          appDetails: data.full_report.appDetails,
          reviewsSummary: data.full_report.reviewsSummary,
          timestamp: data.timestamp
        }
      });
    }

    // If we get here, no record was found
    return res.json({ exists: false });
  } catch (error) {
    console.error('Error checking existing report:', error);
    res.status(500).json({
      error: 'Failed to check existing report',
      details: error.message
    });
  }
});

// Optional: Add a route to clear or inspect the cache (for debugging)
app.get('/api/cache-stats', (req, res) => {
 res.json({
   analysisCache: {
     size: analysisCache.size,
     keys: Array.from(analysisCache.keys())
   },
   comparisonCache: {
     size: comparisonCache.size,
     keys: Array.from(comparisonCache.keys())
   }
 });
});

// Function to remove expired cache entries
const removeExpiredCacheEntries = async () => {
 const expirationThreshold = Date.now() - (RECORD_EXPIRATION_HOURS * 60 * 60 * 1000);

 // Remove expired entries from analysisCache
 for (const [key, entry] of analysisCache.entries()) {
   if (entry.timestamp < expirationThreshold) {
     analysisCache.delete(key);
     await removeEntryFromSupabase(key);
   }
 }

 // Remove expired entries from comparisonCache
 for (const [key, entry] of comparisonCache.entries()) {
   if (entry.timestamp < expirationThreshold) {
     comparisonCache.delete(key);
     await removeEntryFromSupabase(key);
   }
 }

 // Remove expired entries from Supabase
 await removeExpiredEntriesFromSupabase();
};

// Schedule periodic cache cleanup
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(removeExpiredCacheEntries, CLEANUP_INTERVAL);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    availableProviders: Object.keys(LLM_PROVIDERS),
    currentProvider: process.env.LLM_PROVIDER || 'ollama'
  });
});

// Sitemap endpoint
app.get('/sitemap.xml', async (req, res) => {
  try {
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const sitemap = await generateSitemap(origin);

    res.header('Content-Type', 'application/xml');
    res.header('Content-Length', Buffer.byteLength(sitemap));
    res.send(sitemap);
  } catch (error) {
    console.error('Error serving sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Function to load existing analyses from database
async function loadCacheFromDatabase() {
  try {
    // Load latest analysis reports up to cache size limit
    const { data: analysisData, error: analysisError } = await supabase
      .from('analysis_reports')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(ANALYSIS_CACHE_MAX_SIZE);

    if (analysisError) {
      console.error('Error loading analysis cache from database:', analysisError);
    } else {
      // Populate the analysis cache with loaded entries
      analysisData.forEach(entry => {
        const hashUrl = entry.hash_url;
        const cacheEntry = {
          ...entry.full_report,
          getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`
        };
        analysisCache.set(hashUrl, cacheEntry);
      });

      console.log(`Loaded ${analysisData.length} analyses from database`);
    }

    // Load latest comparison reports up to cache size limit
    const { data: comparisonData, error: comparisonError } = await supabase
      .from('comparison_reports')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(COMPARISON_CACHE_MAX_SIZE);

    if (comparisonError) {
      console.error('Error loading comparison cache from database:', comparisonError);
    } else {
      comparisonData.forEach(entry => {
        const hashUrl = entry.hash_url;
        const cacheEntry = {
          competitors: JSON.parse(entry.competitors),
          finalReport: entry.final_report,
          timestamp: entry.timestamp,
          urls: entry.urls,
          getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-competitor-report/${hashUrl}`
        };
        comparisonCache.set(hashUrl, cacheEntry);
      });

      console.log(`Loaded ${comparisonData.length} comparison reports from database`);
    }
  } catch (catchError) {
    console.error('Unexpected error loading cache:', catchError);
  }
}

// Modify the server startup to load cache
const startServer = async () => {
  try {
    // Load existing analyses from database
    await loadCacheFromDatabase();

    // Initialize sitemap
    await initializeSitemap();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Call the startup function
startServer();
