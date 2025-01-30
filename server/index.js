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
import Stripe from 'stripe';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Ensure environment variables are loaded
dotenv.config();

console.log('Webhook secret loaded:', process.env.STRIPE_WEBHOOK_SECRET ? 'Present' : 'Missing');

// Log environment variables for debugging
console.log('Environment Variables:', {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY 
    ? '[REDACTED]' 
    : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV
});

// Determine which key to use based on environment
const stripeSecretKey = 
  process.env.NODE_ENV === 'production' 
    ? process.env.STRIPE_SECRET_KEY 
    : process.env.STRIPE_TEST_SECRET_KEY;

// Defensive initialization with error logging
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true
    })
  : null;

// Add error handling if Stripe is not initialized
if (!stripe) {
  console.error('CRITICAL: Stripe cannot be initialized. Check Stripe keys in .env file.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const frontendUrl = 
  process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : process.env.FRONTEND_DEV_URL;
const backendUrl = 
  process.env.NODE_ENV === 'production' 
    ? process.env.BACKEND_URL 
    : process.env.BACKEND_DEV_URL;

app.set('trust proxy', 1);  // Required when using HTTPS via ngrok

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

// Debugging middleware
app.use((req, res, next) => {
  console.log('Middleware Debug:');
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user);
  next();
});

// Add CORS configuration
app.use(cors({
  origin: [
    frontendUrl,  // Allow frontend URL
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Add cookie parser middleware
app.use(cookieParser());

// Webhook endpoint
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  console.log('Webhook received at:', new Date().toISOString());
  console.log('Request headers:', req.headers);

  // Log the content type
  console.log('Content-Type:', req.headers['content-type']);

  // Verify we have a raw body
  console.log('Body type:', typeof req.body);
  console.log('Is Buffer?', Buffer.isBuffer(req.body));

  const sig = req.headers['stripe-signature'];
  
  // Log signature details
  console.log('Stripe signature components:');
  if (sig) {
    const components = sig.split(',');
    components.forEach(component => {
      const [key, value] = component.split('=');
      console.log(`  ${key}: ${value}`);
    });
  }
  // console.log('Webhook body:', req.body instanceof Buffer ? req.body.toString() : req.body);

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('Webhook event type:', event.type);
    // console.log('Event data:', JSON.stringify(event.data, null, 2));

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        
        // Log session details
        console.log('Session metadata:', session.metadata);
        console.log('Customer email:', session.customer_email);
        console.log('Payment status:', session.payment_status);

        // Optional: Process payment
        if (session.payment_status === 'paid') {
          console.log('Payment processed successfully');
          const session = event.data.object;
          const queryCount = parseInt(session.metadata.queryCount, 10);
          
          // Here you can implement your logic to grant query credits
          console.log(`Granted ${queryCount} Query Credits`);
        }
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(express.json({
  limit: '50mb'
}));
app.use(express.urlencoded({
  limit: '50mb',
  extended: true
}));

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

// Stripe checkout route with enhanced error handling
app.post('/create-checkout-session', async (req, res) => {
  // Detailed logging of incoming request
  console.log('Stripe Checkout Request Received:', {
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  // Validate Stripe initialization
  if (!stripe) {
    console.error('Stripe is not properly initialized');
    return res.status(500).json({ 
      error: 'Payment service is currently unavailable',
      details: 'Stripe initialization failed'
    });
  }

  try {
    // Validate request body
    const { queryCount } = req.body;
    if (!queryCount || typeof queryCount !== 'number' || queryCount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid query count',
        details: 'Query count must be a positive number'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${queryCount} Query Credits`,
            description: 'Insightly Query Credits Package'
          },
          unit_amount: queryCount * 100, // $1 per query credit
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/cancel`,
      metadata: {
        queryCount: queryCount,
        timestamp: new Date().toISOString()
      }
    });

    // Log successful session creation
    console.log('Stripe Checkout Session Created:', {
      sessionId: session.id,
      queryCount: queryCount
    });

    res.json({ 
      sessionId: session.id,
      message: 'Checkout session created successfully'
    });

  } catch (err) {
    // Comprehensive error logging
    console.error('Stripe Checkout Session Error:', {
      message: err.message,
      type: err.type,
      code: err.code,
      param: err.param,
      stack: err.stack
    });

    // Send detailed error response
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: err.message,
      type: err.type
    });
  }
});

// Verify Stripe checkout session
app.get('/api/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Extract query credits from metadata
      const queryCount = session.metadata?.queryCount;
      
      // TODO: Update user's query credits in your database
      // await updateUserCredits(session.customer_email, queryCount);
      
      res.json({ 
        success: true, 
        queryCount: queryCount 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Payment not completed' 
      });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying session' 
    });
  }
});

const rawBody = (req, res, next) => {
  req.setEncoding('utf8');
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

// LLM Configuration
const LLM_PROVIDERS = {
  ollama: {
    url: process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'deepseek-r1:7b',
    async generateResponse(model, prompt, options = {}) {
      const selectedModel = model || this.defaultModel;
      const onChunk = options.onChunk || (() => {});
      
      console.log('Ollama generateResponse called with:', { 
        url: this.url, 
        model: selectedModel, 
        promptLength: prompt.length,
        options: JSON.stringify(options)
      });

      return new Promise((resolve, reject) => {
        let fullResponse = '';

        try {
          const request = axios.post(this.url, {
            model: selectedModel,
            prompt: prompt,
            stream: true,
            options: {
              temperature: options.temperature || 0.7,
              max_tokens: options.max_tokens || 1000
            }
          }, {
            timeout: 300000,  // 5-minute timeout
            responseType: 'stream'
          });

          request.then(response => {
            response.data.on('data', (chunk) => {
              try {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                lines.forEach(line => {
                  try {
                    const parsedChunk = JSON.parse(line);
                    if (parsedChunk.response) {
                      fullResponse += parsedChunk.response;
                      onChunk(parsedChunk.response);
                      console.log('Streaming chunk:', parsedChunk.response);
                    }
                    
                    if (parsedChunk.done) {
                      console.log('Stream completed. Total response length:', fullResponse.length);
                      resolve(fullResponse);
                    }
                  } catch (parseError) {
                    console.error('Error parsing chunk:', parseError);
                  }
                });
              } catch (chunkError) {
                console.error('Error processing chunk:', chunkError);
              }
            });

            response.data.on('error', (error) => {
              console.error('Stream error:', error);
              reject(error);
            });

            response.data.on('end', () => {
              if (fullResponse) {
                resolve(fullResponse);
              } else {
                reject(new Error('No response generated'));
              }
            });
          }).catch(error => {
            console.error('Axios request error:', error);
            reject(error);
          });
        } catch (error) {
          console.error('Ollama API error:', {
            message: error.message,
            stack: error.stack
          });
          reject(error);
        }
      });
    }
  },
  openai: {
    url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    async generateResponse(model, prompt, options = {}) {
      const response = await axios.post(
        this.url, 
        {
          model: model || this.defaultModel,
          messages: [
            { role: "system", content: "You are an expert app review analyzer." },
            { role: "user", content: prompt }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.choices[0].message.content;
    }
  }
};

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

app.post('/api/analyze', async (req, res) => {
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
      console.time('generateResponse');
      
      // Create a streaming response
      const streamResponse = (data) => {
        console.log('Streaming:', JSON.stringify(data)); // Log each streamed chunk
        res.write(JSON.stringify(data) + '\n');
      };

      const finalReport = await selectedProvider.generateResponse(model, prompt, {
        onChunk: (chunk) => {
          streamResponse({ report: chunk });
        }
      });

      console.timeEnd('generateResponse');
      console.log('Final report:', finalReport);

      // Directly end the response after streaming is complete
      res.end();
    } catch (generateError) {
      console.error('Generate Response Error:', {
        message: generateError.message,
        stack: generateError.stack,
        responseData: generateError.response ? generateError.response.data : 'No response data'
      });

      res.status(500).json({ 
        error: 'Failed to generate response', 
        details: generateError.message,
        providerDetails: {
          url: selectedProvider.url,
          model: model || selectedProvider.defaultModel
        }
      });
    }
  } catch (error) {
    console.error('Unexpected Error in /api/analyze:', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({ 
      error: 'Unexpected error analyzing reviews', 
      details: error.message 
    });
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

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${backendUrl}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, done) => {
    console.log('Google OAuth Profile:', profile);
    
    // Minimal user handling - pass the full profile
    return done(null, profile);
  }
));

// Serialize and deserialize user for passport session
passport.serializeUser((user, done) => {
  console.log('Serializing full user:', user);
  
  // Explicitly create a minimal user object
  const userData = {
    id: user.id || user.sub,
    displayName: user.displayName,
    email: (user.emails && user.emails.length > 0) 
      ? user.emails[0].value 
      : null,
    photo: (user.photos && user.photos.length > 0) 
      ? user.photos[0].value 
      : null,
    provider: user.provider
  };

  console.log('Serialized user data:', userData);
  done(null, userData);
});

passport.deserializeUser((userData, done) => {
  console.log('Deserializing user data:', userData);
  
  // Simply pass back the stored user data
  if (userData) {
    done(null, userData);
  } else {
    console.error('No user data found during deserialization');
    done(new Error('User not found in session'));
  }
});

// JWT secret
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
app.get('/auth/google',
  (req, res, next) => {
    // Log the request for debugging
    console.log('Google OAuth Request Received');
    console.log('Frontend URL:', frontendUrl);
    console.log('Backend URL:', backendUrl);

    // Create a state parameter to prevent CSRF
    const state = Math.random().toString(36).substring(7);
    
    // Store state in a cookie with more explicit settings
    res.cookie('oauth_state', state, { 
      httpOnly: true,
      secure: true,
      sameSite: 'none', // Allows cross-site requests from same site
      domain: new URL(backendUrl).hostname, // Use backend hostname
      path: '/', // Ensure cookie is available across routes
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    console.log('State cookie set:', state);

    // Authenticate with additional options
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      state: state,
      prompt: 'select_account' // Force account selection
    })(req, res, next);
  }
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        email: req.user.emails[0].value,
        displayName: req.user.displayName
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token in query parameter
    res.redirect(`${frontendUrl}?token=${token}`);
  }
);

// Add a route to validate the token
app.get('/auth/validate', verifyToken, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName
    }
  });
});

// Update logout route
app.get('/logout', (req, res) => {
  // Invalidate token on client-side
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/check-login', (req, res) => {
  console.log('Check Login Request Received');
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('Session:', req.session);
  console.log('User:', req.user);

  if (req.isAuthenticated()) {
    // Extract relevant user information
    const userInfo = {
      id: req.user.id,
      displayName: req.user.displayName || 'User',
      email: req.user.emails && req.user.emails.length > 0 
        ? req.user.emails[0].value 
        : null,
      photo: req.user.photos && req.user.photos.length > 0
        ? req.user.photos[0].value
        : null,
      provider: req.user.provider
    };

    res.json(userInfo);
  } else {
    res.status(401).json({ 
      message: 'Not authenticated', 
      isLoggedIn: false 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});