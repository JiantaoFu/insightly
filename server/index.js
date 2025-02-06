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
const analysisCache = new LRUCache({
  max: ANALYSIS_CACHE_MAX_SIZE,
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
});

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
    getShareLink: () => `${process.env.CLIENT_ORIGIN}/share/${hashUrl}`,
  };

  // Save to Supabase
  saveToSupabase(cacheEntry, url, hashUrl);

  return cacheEntry;
};

app.post('/api/analyze', 
  ENABLE_MATH_CHALLENGE ? verifyMathChallenge : (req, res, next) => next(), 
  async (req, res) => {
  const { url } = req.body;
  
  // Check if report is in cache
  const cachedReport = analysisCache.get(url);
  if (cachedReport) {
    // If cached, stream the report
    const chunks = cachedReport.finalReport.match(/[^\n]*\n?/g).filter(chunk => chunk !== '');
    chunks.forEach((chunk, index) => {
      res.write(JSON.stringify({ report: chunk }) + '\n');
      
      if (index === chunks.length - 1) {
        res.end();
      }
    });
    return;
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
    let prompt = `Analyze the following URL: ${url}`;
    
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
- Score Distribution: ${JSON.stringify(appData.reviews.scoreDistribution)}

Detailed Reviews:
${reviewsText}

${promptConfig.appReviewAnalysis}

Format the response in markdown with appropriate headers and bullet points.
But do NOT wrap it inside triple backticks.

Expect something like this:

# This is a title

NOT something like this:

\`\`\`Markdown
# This is a title
\`\`\`
`;
    } else {
      // Fallback to existing logic if no app data
      prompt += '\n\nPlease analyze this URL and provide insights.';
    }

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
      const hashUrl = generateUrlHash(url);
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

// Update existing routes that fetch cached reports
app.get('/api/check-cache', (req, res) => {
  const { urlHash } = req.query;
  const cachedReport = analysisCache.get(urlHash);
  
  if (cachedReport) {
    res.json({
      cached: true,
      finalReport: cachedReport.finalReport,
      appDetails: cachedReport.appDetails,
      reviewsSummary: cachedReport.reviewsSummary,
      timestamp: cachedReport.timestamp
    });
  } else {
    res.json({ cached: false });
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
          finalReport: entry.finalReport || ''
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

// Add after existing routes
app.get('/api/share', (req, res) => {
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

app.get('/api/shared-report', (req, res) => {
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

// Optional: Add a route to clear or inspect the cache (for debugging)
app.get('/api/cache-stats', (req, res) => {
  res.json({
    size: analysisCache.size,
    keys: Array.from(analysisCache.keys())
  });
});

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
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('analysis_reports')
      .select('*')
      .gte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error loading cache from database:', error);
      return;
    }

    // Populate the cache with loaded entries
    data.forEach(entry => {
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

    console.log(`Loaded ${data.length} analyses from database`);
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