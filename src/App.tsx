import React, { useState, useRef, useCallback } from 'react';
import { Send, Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

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
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          provider,
          model: model || undefined
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
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
              console.log('Updated report:', fullReport);
            }

            if (parsedChunk.done) {
              console.log('Streaming fully completed');
              setLoading(false);
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
        setError('Failed to analyze the app. Please try again.');
      }
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
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
            </select>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Optional: Specify model (e.g. deepseek-r1:7b)"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
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
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;