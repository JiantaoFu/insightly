import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: false
}));

app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    const prompt = `Analyze these app reviews and create a structured markdown report with the following sections:
    1. Summary of Key Insights
    2. Key User Pain Points
    3. Frequently Requested Features
    4. Opportunities for Startup Ideas
    5. Trends and Observations

    Reviews:
    ${mockReviews.join('\n')}

    Format the response in markdown with appropriate headers and bullet points.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert app review analyzer. Create concise, actionable insights from app reviews."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const report = completion.choices[0].message.content;
    res.json({ report: report || '' });
  } catch (error) {
    console.error('Error analyzing reviews:', error);
    res.status(500).json({ error: 'Failed to analyze reviews', details: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});