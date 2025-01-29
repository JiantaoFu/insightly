import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Configuration for providers and models
const PROVIDERS_CONFIG = {
  ollama: {
    defaultModel: 'deepseek-r1:7b',
    models: ['llama2', 'mistral', 'deepseek-r1:7b']
  },
  openai: {
    defaultModel: 'gpt-3.5-turbo',
    models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
  }
};

function App() {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<keyof typeof PROVIDERS_CONFIG>('ollama');
  const [model, setModel] = useState(PROVIDERS_CONFIG.ollama.defaultModel);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update model when provider changes
  useEffect(() => {
    setModel(PROVIDERS_CONFIG[provider].defaultModel);
  }, [provider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    setReport('');

    try {
      let processUrlEndpoint = '';
      
      // Detect URL type
      const appStoreMatch = url.match(/https?:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^/]+\/id(\d+)/);
      const googlePlayMatch = url.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?id=([^&]+)/);
      
      if (appStoreMatch) {
        processUrlEndpoint = 'http://localhost:3000/app-store/process-url';
      } else if (googlePlayMatch) {
        processUrlEndpoint = 'http://localhost:3000/google-play/process-url';
      } else {
        throw new Error('Unsupported app store URL');
      }

      // Process URL
      const processResponse = await fetch(processUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url }),
        signal: abortControllerRef.current.signal
      });

      if (!processResponse.ok) {
        throw new Error(`Failed to process URL: ${processUrlEndpoint}`);
      }

      const data = await processResponse.json();
      setAppData(data);

      // Prepare data for analysis
      const analysisResponse = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request canceled');
      } else {
        console.error('Error:', err);
        setError(err.message || 'Failed to analyze the app. Please try again.');
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
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            App Review Analyzer
          </h1>
          <p className="text-lg text-gray-600">
            Get instant insights from your app's reviews
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-12">
          <div className="flex gap-4 mb-4">
            {false && (
              <div className="flex gap-4 mb-4">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as keyof typeof PROVIDERS_CONFIG)}
                  className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
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
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter App Store or Google Play URL"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
            {loading ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
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
        
        <div className="border-t border-gray-200 my-8"></div>
        
        <DemoSelector 
          url={url} 
          setUrl={setUrl} 
          handleSubmit={handleSubmit} 
        />
      </div>
    </div>
  );
}

export default App;