import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

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

// Configure CORS
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: false
}));

app.use(express.json());

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
    const { url, model, provider } = req.body;
    
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

    const prompt = `Analyze these app reviews and create a structured markdown report with the following sections:
    1. Summary of Key Insights
    2. Key User Pain Points
    3. Frequently Requested Features
    4. Opportunities for Startup Ideas
    5. Trends and Observations

    Reviews:
    ${mockReviews.join('\n')}

    Format the response in markdown with appropriate headers and bullet points.`;

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

      // Send final report with done flag
      streamResponse({ report: finalReport, done: true });
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});