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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Get math challenge configuration from environment
const ENABLE_MATH_CHALLENGE = process.env.ENABLE_MATH_CHALLENGE === 'true';

// Get client origin from environment
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_ORIGIN,
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
app.use('/api', apiLimiter);

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
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
});

const comparisonCache = new LRUCache({
  max: COMPARISON_CACHE_MAX_SIZE,
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
});

const RECORD_EXPIRATION_HOURS = process.env.RECORD_EXPIRATION_HOURS 
  ? parseInt(process.env.RECORD_EXPIRATION_HOURS, 10) 
  : 24; // Default to 24 hours if not specified

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
        reviews: cacheEntry.appDetails.reviews,
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
      reviews: appData.details.reviews,
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
  const { url } = req.body;
  const hashUrl = generateUrlHash(url);
  
  // Check if report is in cache
  const cachedReport = analysisCache.get(hashUrl);
  
  // Check if cache entry is valid and not expired
  if (cachedReport && !isRecordEntryExpired(cachedReport)) {
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
    // If cache entry is expired, remove it
    console.log('Cache entry expired for:', url);
    analysisCache.delete(hashUrl);
    removeEntryFromSupabase(hashUrl);
  }

  try {
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
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

${promptConfig.appReviewAnalysis}
`;
    } else {
      // Fallback to existing logic if no app data
      prompt += '\n\nPlease analyze this URL and provide insights.';
    }

    console.log('Prompt:', prompt);
    console.log('Prompt length:', prompt.length);

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

      console.log('Final report:', finalReport);

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
    const { competitors, provider, model } = req.body;

    // Generate a cache key based on sorted URLs
    const sortedUrls = competitors.map(c => c.url).sort();
    const cacheKey = createComparisonCacheKey(sortedUrls);

    // Check if report is in cache
    const cachedReport = comparisonCache.get(cacheKey);
    if (cachedReport) {
      console.log('Returning cached comparison report');
      return res.json({ report: cachedReport.finalReport });
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
${promptConfig.appComparison}

\`\`\`
${competitorDetails}
\`\`\`
`;

    console.log(comparisonPrompt);

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

      console.log('Final report:', finalReport);

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

    console.log('Sending cached results:', cachedResults);
    
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

   console.log('Sending cached comparison results:', cachedResults);
   
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

// Add after existing routes
app.get('/api/share-app-report', (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const cachedReport = analysisCache.get(generateUrlHash(url));
  
  if (!cachedReport) {
    return res.status(404).json({ 
      error: 'Report not found. Please re-run the analysis.',
      shouldReanalyze: true
    });
  }

  res.json({ 
    shareLink: cachedReport.getShareLink(),
    expiresAt: Date.now() + analysisCache.maxAge
  });
});

app.get('/api/shared-app-report', (req, res) => {
  const { shareId } = req.query;
  
  if (!shareId) {
    return res.status(400).json({ error: 'Share ID is required' });
  }

  const cachedReport = analysisCache.get(shareId);
  
  if (!cachedReport) {
    return res.status(404).json({ 
      error: 'Report expired. Please re-run the analysis.',
      shouldReanalyze: true
    });
  }

  // Return the entire report directly
  res.json({ report: cachedReport.finalReport });
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

// Function to load existing analyses from database
async function loadCacheFromDatabase() {
 try {
   // Fetch recent analyses (e.g., from last 7 days)
   // const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

   removeExpiredEntriesFromSupabase();
   
   // Load analysis reports
   const { data: analysisData, error: analysisError } = await supabase
     .from('analysis_reports')
     .select('*')
     // .gte('timestamp', sevenDaysAgo)
     .order('timestamp', { ascending: false });

   if (analysisError) {
     console.error('Error loading analysis cache from database:', analysisError);
   } else {
     // Populate the analysis cache with loaded entries
     analysisData.forEach(entry => {
       // Use the stored hash_url directly
       const hashUrl = entry.hash_url;
       
       // Reconstruct the cache entry format
       const cacheEntry = {
         ...entry.full_report,
         getShareLink: () => `${process.env.CLIENT_ORIGIN}/share/${hashUrl}`
       };

       // Add to LRU cache
       analysisCache.set(hashUrl, cacheEntry);
     });

     console.log(`Loaded ${analysisData.length} analyses from database`);
   }

   // Load comparison reports
   const { data: comparisonData, error: comparisonError } = await supabase
     .from('comparison_reports')
     .select('*')
     // .gte('timestamp', sevenDaysAgo)
     .order('timestamp', { ascending: false });

   if (comparisonError) {
     console.error('Error loading comparison cache from database:', comparisonError);
   } else {
     // Populate the comparison cache with loaded entries
     comparisonData.forEach(entry => {
       // Use the stored hash_url directly
       const hashUrl = entry.hash_url;
       
       // Reconstruct the cache entry format
       const cacheEntry = {
         competitors: JSON.parse(entry.competitors),
         finalReport: entry.final_report,
         timestamp: entry.timestamp,
         urls: entry.urls,
         getShareLink: () => `${process.env.CLIENT_ORIGIN}/shared-competitor-report/${hashUrl}`
       };

       // Add to LRU cache
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