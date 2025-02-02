import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Download } from 'lucide-react';
import { Search,Zap,TrendingUp,Rocket } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Get math challenge configuration from environment
const ENABLE_MATH_CHALLENGE = import.meta.env.VITE_ENABLE_MATH_CHALLENGE === 'true';

// Get server URL from environment
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
console.log('Resolved SERVER_URL:', SERVER_URL);
console.log('VITE_SERVER_URL from env:', import.meta.env.VITE_SERVER_URL);
console.log('VITE_ENABLE_MATH_CHALLENGE from env:', import.meta.env.VITE_ENABLE_MATH_CHALLENGE);

// Generate a math challenge
const generateMathChallenge = (): { 
  question: string, 
  answer: number, 
  challenge: string 
} => {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let a, b, answer;
  switch (operation) {
    case '+':
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * 10) + 1;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 5) + 2;
      b = Math.floor(Math.random() * 5) + 2;
      answer = a * b;
      break;
  }

  return {
    question: `What is ${a} ${operation} ${b}?`,
    answer,
    challenge: `${a}${operation}${b}`
  };
};

// Configuration for providers and models
const PROVIDERS_CONFIG = {
  ollama: {
    defaultModel: 'deepseek-r1:7b',
    models: ['llama2', 'mistral', 'deepseek-r1:7b']
  },
  openai: {
    defaultModel: 'gpt-3.5-turbo',
    models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
  },
  gemini: {
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-pro', 'gemini-pro-vision']
  }
};

function App() {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<keyof typeof PROVIDERS_CONFIG>('gemini');
  const [model, setModel] = useState(PROVIDERS_CONFIG.gemini.defaultModel);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(new AbortController());

  // Add state for math challenge configuration
  const [mathChallenge, setMathChallenge] = useState<{ 
    question: string, 
    answer: number, 
    challenge: string 
  } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');

  // Update model when provider changes
  useEffect(() => {
    setModel(PROVIDERS_CONFIG[provider].defaultModel);
  }, [provider]);

  const prepareChallengeAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Reset previous states
    setLoading(true);
    setError('');
    setReport('');

    // Math challenge logic (only if enabled)
    if (ENABLE_MATH_CHALLENGE) {
      // Generate math challenge if not already present
      if (!mathChallenge) {
        const newChallenge = generateMathChallenge();
        setMathChallenge(newChallenge);
        setLoading(false);
        return;
      }

      // Verify math challenge
      const challengeAnswer = parseInt(userAnswer, 10);
      if (challengeAnswer !== mathChallenge.answer) {
        setError('Incorrect answer. Please solve the math challenge.');
        setLoading(false);
        // Regenerate challenge
        const newChallenge = generateMathChallenge();
        setMathChallenge(newChallenge);
        setUserAnswer('');
        return;
      }

      // Immediately dismiss math challenge after correct answer
      const currentChallenge = mathChallenge;
      setMathChallenge(null);
      setUserAnswer('');
    }

    try {
      let processUrlEndpoint = '';
      
      // Detect URL type
      if (url.includes('apps.apple.com')) {
        processUrlEndpoint = `${SERVER_URL}/app-store/process-url`;
      } else if (url.includes('play.google.com')) {
        processUrlEndpoint = `${SERVER_URL}/google-play/process-url`;
      } else {
        setError('Unsupported app store URL');
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add math challenge header only if enabled
      if (ENABLE_MATH_CHALLENGE && mathChallenge) {
        headers['X-Math-Challenge'] = mathChallenge.challenge;
      }

      const processResponse = await fetch(processUrlEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
        signal: abortControllerRef.current.signal
      });

      if (!processResponse.ok) {
        throw new Error(`Failed to process URL: ${processUrlEndpoint}`);
      }

      const data = await processResponse.json();
      setAppData(data);

      // Prepare data for analysis
      const analysisResponse = await fetch(`${SERVER_URL}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          provider,
          model: model || undefined,
          appData: data
        }),
        signal: abortControllerRef.current.signal
      });

      if (!analysisResponse.body) {
        throw new Error('No response body');
      }

      const reader = analysisResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          setLoading(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('Received chunk:', chunk);

        // Split chunk into lines and parse
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
          try {
            console.log('Parsing line:', line);
            const parsedChunk = JSON.parse(line);
            
            if (parsedChunk.report) {
              fullReport += parsedChunk.report;
              setReport(fullReport);
              //console.log('Updated report:', fullReport);
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError, 'Raw line:', line);
          }
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('Request was cancelled');
      } else {
        console.error('Error:', error);
        setError(error.message || 'Failed to analyze the app. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleDownload = useCallback(() => {
    if (!report) return;
    
    try {
      const blob = new Blob([report], { type: 'text/markdown' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'app-review-analysis.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download the report. Please try again.');
    }
  }, [report]);

  const downloadReviews = useCallback(() => {
    if (!appData?.reviews?.reviews) {
      setError('No reviews available to download');
      return;
    }

    // Prepare CSV
    const csvHeader = 'Date,Score,User,Review\n';
    const csvContent = appData.reviews.reviews.map(review => 
      `"${review.date || ''}","${review.score || 0}","${(review.userName || 'Anonymous').replace(/"/g, '""')}","${(review.text || '').replace(/"/g, '""')}"`)
      .join('\n');
    const csvBlob = new Blob([csvHeader + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create download link
    const csvLink = document.createElement('a');
    csvLink.href = URL.createObjectURL(csvBlob);
    csvLink.download = `${appData.details?.title || 'app'}_reviews.csv`;

    // Trigger download
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
  }, [appData]);

  const demoApps = [
    {
      name: "Instagram",
      placeholder: "https://apps.apple.com/us/app/instagram/id389801252",
      description: "Social Media Networking App"
    },
    {
      name: "Spotify",
      placeholder: "https://play.google.com/store/apps/details?id=com.spotify.music",
      description: "Music Streaming Platform"
    },
    {
      name: "Duolingo",
      placeholder: "https://apps.apple.com/us/app/duolingo/id570060128",
      description: "Language Learning App"
    }
  ];

  function DemoSelector({ 
    url, 
    setUrl, 
    handleSubmit 
  }: { 
    url: string, 
    setUrl: (url: string) => void, 
    handleSubmit: (e: React.FormEvent) => Promise<void> 
  }) {
    const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

    const handleDemoSelect = (demoApp: typeof demoApps[0]) => {
      setSelectedDemo(demoApp.name);
      setUrl(demoApp.placeholder);
    };

    return (
      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Try a Demo Report</h2>
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {demoApps.map((app) => (
              <button
                key={app.name}
                onClick={() => handleDemoSelect(app)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedDemo === app.name 
                    ? 'bg-blue-500 text-white border-blue-600' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                <h3 className="font-semibold">{app.name}</h3>
                <p className="text-sm mt-2">{app.description}</p>
              </button>
            ))}
          </div>
          
          {selectedDemo && (
            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                App Store / Google Play URL
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Confirm or modify the URL"
                  className="flex-grow p-2 border rounded-l-lg"
                />
                <button
                  onClick={handleSubmit}
                  className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600"
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-800 mb-6 leading-tight">
            Transform App Reviews into Actionable Insights
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Leverage AI to understand your users, improve your product, and drive growth
          </p>
        </div>

        <form onSubmit={prepareChallengeAndSubmit} className="mb-12">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {false && (
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as keyof typeof PROVIDERS_CONFIG)}
                  className="w-full sm:w-auto px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(PROVIDERS_CONFIG).map(providerKey => (
                    <option key={providerKey} value={providerKey}>
                      {providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full sm:w-auto flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  {PROVIDERS_CONFIG[provider].models.map(modelName => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter App Store or Google Play URL"
              className="w-full sm:flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
            {loading ? (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Analyze
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-red-600">{error}</p>
          )}
        </form>

        {report && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <button 
                onClick={() => {
                  const blob = new Blob([report], { type: 'text/markdown' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'analysis_report.md';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
              {console.log('AppData:', appData)}
              {appData?.reviews?.reviews && (
                <button 
                  onClick={downloadReviews} 
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
                >
                  <Download className="mr-2" /> Download Reviews
                </button>
              )}
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="grid md:grid-cols-4 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300">
            <Search className="mx-auto text-indigo-600 mb-4" size={48} />
            <h3 className="text-xl font-semibold mb-3">Deep Analysis</h3>
            <p className="text-gray-600">Comprehensive review insights using advanced AI</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300">
            <Zap className="mx-auto text-indigo-600 mb-4" size={48} />
            <h3 className="text-xl font-semibold mb-3">Instant Results</h3>
            <p className="text-gray-600">Get actionable insights in seconds</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300">
            <TrendingUp className="mx-auto text-indigo-600 mb-4" size={48} />
            <h3 className="text-xl font-semibold mb-3">Growth Insights</h3>
            <p className="text-gray-600">Identify opportunities for product improvement</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300">
            <Rocket className="mx-auto text-indigo-600 mb-4" size={48} />
            <h3 className="text-xl font-semibold mb-3">Scalable</h3>
            <p className="text-gray-600">Works for apps of all sizes and categories</p>
          </div>
        </div>
        
        <DemoSelector 
          url={url} 
          setUrl={setUrl} 
          handleSubmit={prepareChallengeAndSubmit} 
        />
        
        <div className="border-t border-gray-200 my-8"></div>

        {/* Product Hunt Badge */}
        <div className="flex justify-center mb-16">
          <a 
            href="https://www.producthunt.com/posts/insightly-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-insightly&#0045;3" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <img 
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=838886&theme=light&t=1738479256775" 
              alt="Insightly - Get instant insights from your app's reviews" 
              className="w-64 h-14"
            />
          </a>
        </div>
        
        {/* Math Challenge Modal (only render if enabled and challenge exists) */}
        {ENABLE_MATH_CHALLENGE && mathChallenge && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <h2 className="text-xl font-bold mb-4">Human Verification</h2>
              <p className="mb-4">{mathChallenge.question}</p>
              <input 
                type="number" 
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Your answer"
              />
              <button 
                onClick={prepareChallengeAndSubmit}
                className="mt-4 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;