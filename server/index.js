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
import { promptConfig } from './promptConfig.js';
import rateLimit from 'express-rate-limit';
import { LLM_PROVIDERS } from './llmProviders.js';
import { LRUCache } from 'lru-cache';
import { generateUrlHash } from './utils.js';
import { supabase } from './supabaseClient.js';
import { generateSitemap, initializeSitemap } from './sitemap.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { embeddingService } from './services/EmbeddingService.js'
import { availableFunctions, functionDeclarations } from './functions.js';
import { calculateCosineSimilarity } from './utils.js';
import JSZip from 'jszip';
import { rankSearchResults } from './utils/search.js';
import { SearchTrie } from './utils/SearchTrie.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

dotenv.config();

const backendUrl = process.env.NODE_ENV === 'production' ? process.env.API_BASE_URL : 'http://localhost:3000';

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

// Add near the top with other constants
const RAG_INITIAL_LIMIT = 30;
const RAG_SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.75;

// Add after other const declarations
const searchCache = {
  'google-play': new SearchTrie(30), // 30 minutes TTL
  'app-store': new SearchTrie(30)
};

// Schedule cache cleanup every hour
setInterval(() => {
  Object.values(searchCache).forEach(trie => trie.cleanup());
}, 60 * 60 * 1000);

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
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
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
  if (!recordEntry || !recordEntry.timestamp) {
    console.log('Record entry is missing or timestamp is undefined:', recordEntry);
    return true;
  }

  const currentTime = Date.now();
  const entryAge = currentTime - recordEntry.timestamp;
  const expirationMs = RECORD_EXPIRATION_HOURS * 60 * 60 * 1000;

  // console.log('Checking record expiration:', {
  //   currentTime,
  //   recordTimestamp: recordEntry.timestamp,
  //   entryAge,
  //   expirationMs,
  //   isExpired: entryAge > expirationMs
  // });

  return entryAge > expirationMs;
};

// Async function to save to Supabase
async function saveToSupabase(cacheEntry, url, hashUrl) {
  try {
    // Save metadata to database
    const { data, error } = await supabase
      .from('analysis_reports')
      .insert({
        app_title: cacheEntry.appDetails.title,
        description: cacheEntry.appDetails.description,
        developer: cacheEntry.appDetails.developer,
        app_url: url,
        hash_url: hashUrl,
        app_score: cacheEntry.appDetails.score,
        icon: cacheEntry.appDetails.icon,
        platform: cacheEntry.appDetails.platform,
        total_reviews: cacheEntry.reviewsSummary.totalReviews,
        average_rating: cacheEntry.reviewsSummary.averageRating,
        timestamp: cacheEntry.timestamp
      })
      .select();

    if (error) {
      console.error('Error saving to database:', error);
      return;
    }

    // Compress and save full report to storage
    try {
      const zip = new JSZip();
      zip.file('report.txt', JSON.stringify(cacheEntry));
      const compressedData = await zip.generateAsync({ type: "uint8array" });

      const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
      const fileName = `${folderStructure}${hashUrl}.zip`;

      const { error: storageError } = await supabase.storage
        .from('reports')
        .upload(fileName, compressedData, {
          contentType: 'application/zip',
          upsert: true // Overwrite if exists
        });

      if (storageError) {
        console.error('Error saving to storage:', storageError);
      } else {
        console.log(`✅ Saved report to storage: ${fileName}`);
      }
    } catch (storageError) {
      console.error('Error compressing/uploading report:', storageError);
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
        .select('hash_url, timestamp')
        .eq('hash_url', hashUrl)
        .single();

      if (!error && data && !isRecordEntryExpired({ timestamp: data.timestamp })) {
        console.log('Report found in database:', url);

        // Reconstruct cache entry from database
        const fullReport = await getReportFromStorage(hashUrl);
        const dbCacheEntry = {
          ...fullReport,
          getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`
        };

        // Add to memory cache
        analysisCache.set(hashUrl, dbCacheEntry);

        // Stream the report
        const chunks = fullReport.finalReport.match(/[^\n]*\n?/g).filter(chunk => chunk !== '');
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
// Helper function for traditional search
async function performTraditionalSearch(search, sortBy, sortOrder, offset, limit) {
  const { data, count, error } = await supabase.from('analysis_reports')
    .select('*', { count: 'exact' })
    .or(`app_title.ilike.%${search}%,developer.ilike.%${search}%`)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Apply BM25 ranking only for traditional search
  const rankedData = rankSearchResults(data, search);
  return { data: rankedData, count, error };
}

app.get('/api/db-analyses', async (req, res) => {
  try {
    const { page = 1, limit = DEFAULT_DB_QUERY_LIMIT, sortBy = 'timestamp', sortOrder = 'desc', search = '' } = req.query;
    const safeLimit = Math.min(parseInt(limit), MAX_DB_QUERY_LIMIT);
    const offset = (page - 1) * safeLimit;

    // Validate sort parameters
    const validSortFields = ['timestamp', 'app_title', 'developer', 'app_score', 'total_reviews'];
    const validSortOrders = ['asc', 'desc'];

    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    let processedData;
    let count;

    if (search) {
      if (process.env.ENABLE_RAG === 'true') {
        // Use RAG search first
        const { citations } = await performRagSearch(search, { write: () => {} });

        if (citations && citations.length > 0) {
          // Get hashUrls from citations
          const hashUrls = citations.map(citation => citation.shareLink.split('/').pop());

          // Get total count first
          const { count: totalCount } = await supabase
            .from('analysis_reports')
            .select('id', { count: 'exact' })
            .in('hash_url', hashUrls);

          // Then fetch paginated data
          const { data, error } = await supabase
            .from('analysis_reports')
            .select('*')
            .in('hash_url', hashUrls)
            .range(offset, offset + safeLimit - 1);

          if (error) throw error;

          // Use semantic scores directly - no need for BM25
          processedData = data.map(item => {
            const citation = citations.find(c => c.shareLink.includes(item.hash_url));
            return {
              ...item,
              searchScore: citation ? citation.descriptionSimilarity : 0
            };
          }).sort((a, b) => b.searchScore - a.searchScore);

          count = totalCount;
        } else {
          // Fallback to traditional search if no RAG results
          const { data, count: totalCount } = await performTraditionalSearch(search, finalSortBy, finalSortOrder, offset, safeLimit);
          processedData = data;
          count = totalCount;
        }
      } else {
        // Use traditional search only
        const { data, count: totalCount } = await performTraditionalSearch(search, finalSortBy, finalSortOrder, offset, safeLimit);
        processedData = data;
        count = totalCount;
      }
    } else {
      // No search term, use normal sorting with pagination
      const { data, error, count: totalCount } = await supabase
        .from('analysis_reports')
        .select('*', { count: 'exact' })
        .order(finalSortBy, { ascending: finalSortOrder === 'asc' })
        .range(offset, offset + safeLimit - 1);

      if (error) throw error;
      processedData = data;
      count = totalCount;
    }

    const results = await Promise.all(processedData.map(async entry => {
      try {
        const fullReport = await getReportFromStorage(entry.hash_url);
        return {
          shareLink: `${process.env.CLIENT_ORIGIN}/shared-app-report/${entry.hash_url}`,
          appDetails: fullReport.appDetails,
          reviewsSummary: fullReport.reviewsSummary,
          analysisDate: new Date(entry.timestamp).toLocaleString(),
          metadata: {
            hashUrl: entry.hash_url,
            appUrl: entry.app_url,
            platform: entry.platform
          },
          ...(search && { searchScore: entry.searchScore })
        };
      } catch (error) {
        if (error.message === 'Report file not found in storage') return null;
        console.error(`Error fetching report for ${entry.hash_url}:`, error);
        return null;
      }
    }));

    const validResults = results.filter(result => result !== null);

    res.json({
      results: validResults,
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
      },
      search: search || null
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
app.get('/api/share-app-report', async (req, res) => {
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

    try {
        // Check database for metadata
        const { data, error } = await supabase
            .from('analysis_reports')
            .select('hash_url, timestamp')
            .eq('hash_url', hashUrl)
            .single();

        if (error || !data || isRecordEntryExpired({ timestamp: data.timestamp })) {
            return res.status(404).json({
                error: 'Report not found or expired. Please re-run the analysis.',
                shouldReanalyze: true
            });
        }

        // Get full report from storage
        const fullReport = await getReportFromStorage(hashUrl);
        const cacheEntry = {
            ...fullReport,
            getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${hashUrl}`
        };

        // Add to memory cache
        analysisCache.set(hashUrl, cacheEntry);

        return res.json({
            shareLink: cacheEntry.getShareLink(),
            expiresAt: Date.now() + analysisCache.maxAge
        });
    } catch (error) {
        console.error('Error processing share request:', error);
        return res.status(500).json({ error: 'Failed to process share request' });
    }
});

app.get('/api/shared-app-report', async (req, res) => {
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

  try {
    // Get the full report from storage
    const fullReport = await getReportFromStorage(shareId);

    // Get minimal metadata from database if needed
    const { data: metadata } = await supabase
        .from('analysis_reports')
        .select('timestamp')
        .eq('hash_url', shareId)
        .single();

    if (metadata && isRecordEntryExpired({ timestamp: metadata.timestamp })) {
        return res.status(410).json({
            error: 'Report expired. Please re-run the analysis.',
            shouldReanalyze: true
        });
    }

    res.json({
        appDetails: fullReport.appDetails,
        report: fullReport.finalReport
    });
  } catch (error) {
    console.error('Error fetching shared report:', error);
    res.status(404).json({
        error: 'Report not found or inaccessible',
        shouldReanalyze: true
    });
  }
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
      .select('hash_url, timestamp')
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

      try {
        // Get full report from storage
        const fullReport = await getReportFromStorage(urlHash);
        const cacheEntry = {
          ...fullReport,
          getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${urlHash}`
        };

        // Add to cache for future requests
        analysisCache.set(urlHash, cacheEntry);

        return res.json({
          exists: true,
          source: 'database',
          report: {
            appDetails: fullReport.appDetails,
            reviewsSummary: fullReport.reviewsSummary,
            timestamp: data.timestamp
          }
        });
      } catch (storageError) {
        console.error('Error fetching report from storage:', storageError);
        return res.json({ exists: false, reason: 'storage_error' });
      }
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

// Modify server startup to load cache
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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({
  model: process.env.VITE_GEMINI_DEFAULT_MODEL,
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
  }
})

// Helper function to handle function calls
async function handleFunctionCalls(functionCalls, chat, res) {
  // Use Promise.all to handle multiple function calls concurrently
  const responsePromises = functionCalls.map(async (functionCall) => {
    const functionName = functionCall.name;

    // Send status update for each tool call
    res.write(JSON.stringify({
      status: { type: 'tool', message: `Executing ${functionName}...` }
    }) + '\n');

    const functionArgs = functionCall.args;

    console.log(`Function call detected: ${functionName} with args:`, functionArgs);

    // Execute the function
    const functionToCall = availableFunctions[functionName];
    if (functionToCall) {
      try {
        const functionResult = await functionToCall(functionArgs);

        console.log(`Function result:`, functionResult);

        // Send function response back to the model
        return {
          functionResponse: {
            name: functionName,
            response: {
              content: JSON.stringify(functionResult),
            },
          },
        };
      } catch (error) {
        console.error(`Error executing function ${functionName}:`, error);
        // Send an error response back to the model
        return {
          functionResponse: {
            name: functionName,
            response: {
              content: JSON.stringify({ error: `Error executing function ${functionName}: ${error.message}` }),
            },
          },
        };
      }
    } else {
      console.error(`Function not found: ${functionName}`);
      // Send an error response back to the model
      return {
        functionResponse: {
          name: functionName,
          response: {
            content: JSON.stringify({ error: `Function not found: ${functionName}` }),
          },
        },
      };
    }
  });

  // Wait for all function calls to complete
  const functionResponses = await Promise.all(responsePromises);

  // Send all function responses back to the model in one go
  const nextResult = await chat.sendMessage(functionResponses);
  const nextResponse = await nextResult.response;

  const nextText = nextResponse.text();

  console.log('Generated response text:', nextText.slice(0, 100), '...');

  // Stream response in chunks without citations
  const chunkSize = 100;
  for (let i = 0; i < nextText.length; i += chunkSize) {
    const chunk = nextText.slice(i, i + chunkSize);
    if (chunk.trim()) { // Ensure the chunk is not empty
      res.write(JSON.stringify({ chunk }) + '\n');
    }
  }
}

// Add near other helper functions
async function performRagSearch(query, res) {
  try {
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    console.log('Generated embedding for query');

    const matches = await embeddingService.searchSimilar(
      queryEmbedding,
      RAG_SIMILARITY_THRESHOLD,
      RAG_INITIAL_LIMIT
    );

    res.write(JSON.stringify({
      status: { type: 'rag', message: `Found ${matches.length} relevant matches...` }
    }) + '\n');
    console.log('Found matches:', matches.length);

    if (matches.length === 0) {
      return { contextMessages: [], citations: [] };
    }

    const reportIds = matches.map(match => match.report_id);
    const { data: apps, error: appsError } = await supabase
      .from('analysis_reports')
      .select('id, app_title, description, hash_url')
      .in('id', reportIds);

    if (appsError) {
      throw new Error('Failed to fetch app details for citations');
    }

    const appsWithSimilarity = await Promise.all(apps.map(async app => {
      if (!app.description) return { ...app, descriptionSimilarity: 0 };
      const descriptionEmbedding = await embeddingService.generateEmbedding(app.description);
      const similarity = calculateCosineSimilarity(queryEmbedding, descriptionEmbedding);
      return { ...app, descriptionSimilarity: similarity };
    }));

    const relevantApps = appsWithSimilarity
      .filter(app => app.descriptionSimilarity > RAG_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.descriptionSimilarity - a.descriptionSimilarity);

    const appDetailsMap = relevantApps.reduce((map, app) => {
      map[app.id] = {
        appTitle: app.app_title,
        description: app.description,
        shareLink: `${process.env.CLIENT_ORIGIN}/shared-app-report/${app.hash_url}`,
        descriptionSimilarity: app.descriptionSimilarity,
        matches: [],
      };
      return map;
    }, {});

    matches.forEach(match => {
      const app = appDetailsMap[match.report_id];
      if (app) {
        const combinedSimilarity = (match.similarity + app.descriptionSimilarity) / 2;
        app.matches.push({
          content: match.content,
          similarity: combinedSimilarity,
        });
      }
    });

    const citations = Object.values(appDetailsMap)
      .sort((a, b) => {
        const aMaxSim = Math.max(...(a.matches?.map(m => m.similarity) || [0]));
        const bMaxSim = Math.max(...(b.matches?.map(m => m.similarity) || [0]));
        return bMaxSim - aMaxSim;
      })
      .map(app => ({ ...app, matches: app.matches || [] }));

    const contextMessages = matches.map(match => ({
      role: 'user',
      parts: [{ text: `[Source ${appDetailsMap[match.report_id]?.appTitle || 'Unknown App'}]: ${match.content}` }],
    }));

    return { contextMessages, citations };
  } catch (error) {
    console.error('RAG search failed:', error);
    return { contextMessages: [], citations: [] };
  }
}

// Update chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, promptId, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    console.log('Received message:', message);

    let contextMessages = [];
    let citations = [];

    const ENABLE_RAG = process.env.ENABLE_RAG === 'true';

    if (ENABLE_RAG) {
      res.write(JSON.stringify({
        status: { type: 'rag', message: 'Searching knowledge base...' }
      }) + '\n');

      const combinedContext = history.map(msg => msg.content).join('\n') + '\n' + message;
      const { contextMessages: ragContext, citations: ragCitations } =
        await performRagSearch(combinedContext, res);

      contextMessages = ragContext;
      citations = ragCitations;

      if (citations.length > 0) {
        res.write(JSON.stringify({ citations }) + '\n');
      }
    }

    // Format history for Gemini API
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: String(msg.content || '') }],
    }));

    // Add RAG context to history
    const fullHistory = [...contextMessages, ...formattedHistory];

    // Format context with template if promptId is provided
    let promptTemplate;
    if (promptId && promptConfig.chatPrompts[promptId]) {
      promptTemplate = promptConfig.chatPrompts[promptId].template;
    }

    // Format the prompt with context and query if template exists
    const formattedPrompt = promptTemplate
      ? promptTemplate
          .replace('{context}', contextMessages.map(msg => msg.parts[0].text).join('\n\n'))
          .replace('{query}', message)
      : message;

    // Initialize chat with context and history
    const chat = model.startChat({
      history: fullHistory,
      systemInstruction: {
        parts: [
          { text: "You are a helpful AI assistant that analyzes app reviews and provides insights. When using tools, think step-by-step and explain your reasoning before calling a tool. If a tool requires an ID, and you only have the name, use the appropriate search tool first to find the ID." },
        ],
      },
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE, // Example: Default or adjust as needed
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE, // Example: Default or adjust as needed
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          // Adjust this threshold to be less strict if needed for your use case
          // Options: BLOCK_NONE, BLOCK_LOW_AND_ABOVE, BLOCK_MEDIUM_AND_ABOVE, BLOCK_ONLY_HIGH
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE, // Example: Default or adjust as needed
        },
      ],
      tools: [
        {
          functionDeclarations: functionDeclarations,
        },
      ],
    });

    // Send message and get response
    const result = await chat.sendMessage(formattedPrompt);
    const response = await result.response;

    console.log('Received response:', response);

    // Before function calls, update status
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      res.write(JSON.stringify({
        status: { type: 'tool', message: 'Calling external tools to gather information...' }
      }) + '\n');
      await handleFunctionCalls(functionCalls, chat, res);
    } else {
      // Processing response
      res.write(JSON.stringify({
        status: { type: 'thinking', message: 'Generating response...' }
      }) + '\n');
      const text = response.text();

      // console.log('Generated response text:', text.slice(0, 100), '...');
      console.log('Generated response text:', text);

      // Stream response in chunks without citations
      const chunkSize = 100;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        if (chunk.trim()) { // Ensure the chunk is not empty
          res.write(JSON.stringify({ chunk }) + '\n');
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write(JSON.stringify({
      status: { type: 'thinking', message: 'An error occurred. Please try again.' }
    }) + '\n');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing chat message', details: error.message });
    }
    res.end();
  }
});

// Endpoint to fetch predefined prompts
app.get('/api/prompts', (req, res) => {
  const prompts = Object.values(promptConfig.chatPrompts)
  console.log('Sending prompts:', prompts) // Debug log
  res.json({ prompts })
})

// Function to get report from storage with retries
async function getReportFromStorage(hashUrl, retries = 3) {
    const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
    const fileName = `${folderStructure}${hashUrl}.zip`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`📥 Fetching report for ${hashUrl} (attempt ${attempt}/${retries})`, {
                path: fileName,
                bucket: 'reports'
            });

            const { data, error } = await supabase.storage
                .from('reports')
                .download(fileName);

            if (error) {
                console.error(`❌ Storage error for ${hashUrl}:`, error);

                // Check if we should retry
                if (attempt < retries && (error.statusCode === 503 || error.statusCode === 429)) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (error.statusCode === 400 || error.status === 400) {
                    console.warn(`⚠️ File not found in storage: ${fileName}`);
                    throw new Error('FILE_NOT_FOUND');
                }

                throw error;
            }

            if (!data) {
                throw new Error('NO_DATA_RETURNED');
            }

            // Convert blob to ArrayBuffer
            let arrayBuffer;
            if (data instanceof Blob) {
                arrayBuffer = await data.arrayBuffer();
            } else if (data instanceof ArrayBuffer) {
                arrayBuffer = data;
            } else if (data.buffer instanceof ArrayBuffer) {
                arrayBuffer = data.buffer;
            } else {
                console.error(`❌ Unexpected data type for ${hashUrl}:`, typeof data);
                throw new Error('INVALID_DATA_TYPE');
            }

            // Load zip from ArrayBuffer
            const zip = await JSZip.loadAsync(arrayBuffer);
            const reportFile = zip.file('report.txt');

            if (!reportFile) {
                throw new Error('REPORT_NOT_IN_ZIP');
            }

            // Get content as text
            const content = await reportFile.async('string');

            try {
                const parsed = JSON.parse(content);
                console.log(`✅ Successfully loaded report for ${hashUrl}`);
                return parsed;
            } catch (parseError) {
                console.error(`❌ Invalid JSON in report for ${hashUrl}:`, parseError);
                throw new Error('INVALID_JSON');
            }
        } catch (error) {
            const finalAttempt = attempt === retries;
            const isFatal = error.message === 'FILE_NOT_FOUND';

            console.warn(`⚠️ ${finalAttempt ? 'Final attempt' : `Attempt ${attempt}`} failed for ${hashUrl}:`, {
                error: error.message,
                fatal: isFatal
            });

            if (finalAttempt || isFatal) {
                throw error;
            }
        }
    }
}

// Update loadCacheFromDatabase to handle missing files gracefully
async function loadCacheFromDatabase() {
    try {
        const { data: analysisData, error: analysisError } = await supabase
            .from('analysis_reports')
            .select('hash_url, timestamp')
            .order('timestamp', { ascending: false })
            .limit(ANALYSIS_CACHE_MAX_SIZE);

        if (analysisError) {
            console.error('Error loading analysis cache from database:', analysisError);
        } else {
            let loadedCount = 0;
            let storageErrorCount = 0;

            // Populate the analysis cache with loaded entries
            for (const entry of analysisData) {
                try {
                    const fullReport = await getReportFromStorage(entry.hash_url);
                    const cacheEntry = {
                        ...fullReport,
                        getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-app-report/${entry.hash_url}`
                    };
                    analysisCache.set(entry.hash_url, cacheEntry);
                    loadedCount++;
                } catch (error) {
                    storageErrorCount++;
                    console.warn(`⚠️ Storage error for ${entry.hash_url}:`, {
                        error: error.message,
                        shouldCleanup: process.env.AUTO_CLEANUP_MISSING_REPORTS === 'true'
                    });

                    // Only cleanup if explicitly enabled
                    if (process.env.AUTO_CLEANUP_MISSING_REPORTS === 'true') {
                        console.log(`🧹 Cleaning up database record for ${entry.hash_url}`);
                        await removeEntryFromSupabase(entry.hash_url);
                    }
                }
            }

            console.log(`📊 Cache loading summary:`, {
                total: analysisData.length,
                loaded: loadedCount,
                storageErrors: storageErrorCount
            });
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

// Add after existing routes
app.get('/api/search-apps', async (req, res) => {
  try {
    const { query, platform } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let results = [];

    if (platform === 'google-play' || !platform) {
      try {
        // Check cache first
        let playResults = searchCache['google-play'].search(query);

        if (!playResults) {
          playResults = await availableFunctions.google_play_search({
            term: query,
            num: 5,
            lang: 'en',
            country: 'us'
          });

          if (!playResults.error) {
            // Cache the results
            searchCache['google-play'].insert(query, playResults);
          }
        }

        if (!playResults.error) {
          results.push(...playResults.map(app => ({
            title: app.title,
            appUrl: app.url,
            icon: app.icon,
            developer: app.developer,
            platform: 'google-play',
            score: app.score
          })));
        }
      } catch (error) {
        console.error('Google Play search error:', error);
      }
    }

    if (platform === 'app-store' || !platform) {
      try {
        // Check cache first
        let appStoreResults = searchCache['app-store'].search(query);

        if (!appStoreResults) {
          appStoreResults = await availableFunctions.app_store_search({
            term: query,
            num: 5,
            country: 'us'
          });

          if (!appStoreResults.error) {
            // Cache the results
            searchCache['app-store'].insert(query, appStoreResults);
          }
        }

        if (!appStoreResults.error) {
          results.push(...appStoreResults.map(app => ({
            title: app.title,
            appUrl: app.url,
            icon: app.icon,
            developer: app.developer,
            platform: 'app-store',
            score: app.score
          })));
        }
      } catch (error) {
        console.error('App Store search error:', error);
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('App search error:', error);
    res.status(500).json({ error: 'Failed to search apps' });
  }
});

// Configure session middleware BEFORE other middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: true,
  saveUninitialized: true, // Changed to true for debugging
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: new URL(backendUrl).hostname // Use backend hostname
  },
  store: new session.MemoryStore() // Explicitly use memory store for testing
});

// Apply session middleware
app.use(sessionMiddleware);

// Initialize Passport and restore authentication state, if any
app.use(passport.initialize());
app.use(passport.session());

// Add cookie parser middleware
app.use(cookieParser());

// Passport Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${backendUrl}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  // Minimal user object
  const userData = {
    id: user.id || user.sub,
    displayName: user.displayName,
    email: (user.emails && user.emails.length > 0) ? user.emails[0].value : null,
    photo: (user.photos && user.photos.length > 0) ? user.photos[0].value : null,
    provider: user.provider
  };
  done(null, userData);
});

passport.deserializeUser((userData, done) => {
  if (userData) {
    done(null, userData);
  } else {
    done(new Error('User not found in session'));
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Google OAuth routes
app.get('/auth/google', (req, res, next) => {
  // Create a state parameter to prevent CSRF
  const state = Math.random().toString(36).substring(7);
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: new URL(backendUrl).hostname,
    path: '/',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state,
    prompt: 'select_account'
  })(req, res, next);
});

app.get('/auth/google/callback', async (req, res, next) => {
  passport.authenticate('google', { failureRedirect: '/' }, async (err, user) => {
    if (err || !user) {
      return res.redirect('/?error=auth_failed');
    }

    req.logIn(user, async (err) => {
      if (err) {
        return res.redirect('/?error=login_failed');
      }

      try {
        const { supabase } = await import('./supabaseClient.js');
        const photoUrl = (user.photos && user.photos.length > 0) ? user.photos[0].value : null;

        // Create JWT token payload
        const tokenPayload = {
          id: user.id,
          sub: user.id,
          displayName: user.displayName,
          email: user.emails?.[0]?.value,
          photo: photoUrl,
          provider: user.provider
        };

        console.log('Creating JWT token with payload:', tokenPayload);

        // Issue JWT
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Also update user in database
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            google_id: user.id,
            email: user.emails?.[0]?.value,
            display_name: user.displayName,
            photo_url: photoUrl,
            provider: user.provider,
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: ['google_id'] });

        if (upsertError) {
          console.error('Supabase user upsert error:', upsertError);
        }

        // Redirect to frontend with token
        res.redirect(`${CLIENT_ORIGIN}/?token=${token}`);
      } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/?error=server_error');
      }
    });
  })(req, res, next);
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    // Clear session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }
      // Clear auth cookies
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: new URL(backendUrl).hostname,
        path: '/'
      });
      res.json({ success: true });
    });
  });
});
