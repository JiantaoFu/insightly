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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLM_PROVIDERS } from './llmProviders.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

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

// Mock reviews data
const mockReviews = [
  "Great app but crashes frequently on my iPhone 12",
  "Love the interface but needs dark mode",
  "Customer support is amazing and responsive",
  "App is slow on older devices",
  "Would be great to have offline functionality",
  "Dark mode please!",
  "Keeps crashing after the latest update",
];

app.post('/api/analyze', 
  ENABLE_MATH_CHALLENGE ? verifyMathChallenge : (req, res, next) => next(), 
  async (req, res) => {
  console.log('Full request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { url, provider, model, appData } = req.body;
    
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

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      console.time('streamResponse');
      
      // Create a streaming response
      const streamResponse = (data) => {
        console.log('Streaming:', JSON.stringify(data)); // Log each streamed chunk
        res.write(JSON.stringify(data) + '\n');
      };

      const finalReport = await selectedProvider.streamResponse(
        model, 
        prompt, 
        (chunk) => {
          streamResponse({ report: chunk });
        },
        {}
      );

      console.timeEnd('streamResponse');
      console.log('Final report:', finalReport);

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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    availableProviders: Object.keys(LLM_PROVIDERS),
    currentProvider: process.env.LLM_PROVIDER || 'ollama'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});