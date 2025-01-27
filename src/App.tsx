import React, { useState } from 'react';
import { Send, Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('http://localhost:3000/api/analyze', { 
        url 
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const reportText = response.data?.report;
      if (typeof reportText === 'string') {
        setReport(reportText);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError('Failed to analyze the app. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
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
  };

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
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter App Store or Google Play URL"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Analyze
                </>
              )}
            </button>
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