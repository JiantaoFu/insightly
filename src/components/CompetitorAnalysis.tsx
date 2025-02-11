import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Globe, 
  Scale, 
  Zap, 
  CheckCircle2,
  Loader2,
  BarChart2,
  AlertCircle,
  X,
  AlertOctagon
} from 'lucide-react';
import Navigation from './Navigation';
import { ProductHuntBadge } from './ProductHuntBadge';

interface CompetitorApp {
  url: string;
  name: string;
  logo: string;
  description: string;
  platform: 'ios' | 'android';
  developer: string;
}

interface CompetitorAnalysisResult {
  name: string;
  url: string;
  logo: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  technicalDetails: {
    technologies: string[];
    performanceMetrics: Record<string, number>;
  };
}

const extractPlatformFromUrl = (url: string): 'ios' | 'android' | null => {
  const appStorePattern = /https:\/\/apps\.apple\.com\//;
  const googlePlayPattern = /https:\/\/play\.google\.com\/store\/apps\/details/;

  if (appStorePattern.test(url)) return 'ios';
  if (googlePlayPattern.test(url)) return 'android';
  
  return null;
};

const fetchCompetitorAppDetails = async (url: string): Promise<CompetitorApp> => {
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
  let processUrlEndpoint = '';

  // Detect URL type
  if (url.includes('apps.apple.com')) {
    processUrlEndpoint = `${SERVER_URL}/app-store/process-url`;
  } else if (url.includes('play.google.com')) {
    processUrlEndpoint = `${SERVER_URL}/google-play/process-url`;
  } else {
    throw new Error('Unsupported app store URL');
  }

  // Abort controller for request cancellation
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10-second timeout

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const response = await fetch(processUrlEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to process URL: ${errorText}`);
    }

    const data = await response.json();

    // Log full response for debugging
    console.log('Fetched App Details:', JSON.stringify(data, null, 2));

    // Normalize the response to our CompetitorApp interface
    const appDetails: CompetitorApp = {
      url,
      name: data.details.title,
      logo: data.details.icon,
      description: data.details.description,
      platform: url.includes('apps.apple.com') ? 'ios' : 'android',
      developer: data.details.developer
    };

    // Log normalized app details
    console.log('Normalized App Details:', JSON.stringify(appDetails, null, 2));

    return appDetails;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }

    console.error('Error fetching competitor app details:', error);
    throw error;
  }
};

// Comprehensive URL validation function
const validateCompetitorUrl = (url: string): boolean => {
  try {
    // Create URL object to validate basic structure
    const parsedUrl = new URL(url);

    // Check for specific app store domains
    const validDomains = [
      'apps.apple.com',
      'play.google.com'
    ];

    // Ensure URL is from a valid app store
    const isValidDomain = validDomains.some(domain => 
      parsedUrl.hostname.includes(domain)
    );

    // Additional checks
    const isHttpOrHttps = ['http:', 'https:'].includes(parsedUrl.protocol);
    const hasPath = parsedUrl.pathname.length > 1; // More than just a slash

    return isValidDomain && isHttpOrHttps && hasPath;
  } catch (error) {
    // Invalid URL format
    return false;
  }
};

export const CompetitorAnalysis: React.FC = () => {
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [competitors, setCompetitors] = useState<CompetitorApp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false); 
  const [analysisResults, setAnalysisResults] = useState<CompetitorAnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAddCompetitor = async () => {
    // Prevent multiple simultaneous additions
    if (isAdding) return;

    // Validate URL
    if (!currentUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!validateCompetitorUrl(currentUrl)) {
      setError('Please provide a valid App Store or Google Play URL');
      return;
    }

    // Check if URL is already added
    if (competitorUrls.includes(currentUrl)) {
      setError('This competitor URL has already been added');
      return;
    }

    try {
      // Set adding state to prevent duplicate submissions
      setIsAdding(true);
      setError(null);

      // Fetch app details
      const competitorDetails = await fetchCompetitorAppDetails(currentUrl);
      
      // Add to competitors list
      setCompetitors(prev => {
        // Ensure URL is still not duplicated (race condition prevention)
        if (!prev.some(comp => comp.url === currentUrl)) {
          return [...prev, competitorDetails];
        }
        return prev;
      });
      
      // Add URL to tracked URLs
      setCompetitorUrls(prev => {
        // Ensure URL is not duplicated
        if (!prev.includes(currentUrl)) {
          return [...prev, currentUrl];
        }
        return prev;
      });
      
      // Reset input
      setCurrentUrl('');
    } catch (error) {
      console.error('Error adding competitor:', error);
      
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      // Always reset adding state
      setIsAdding(false);
    }
  };

  const analyzeCompetitors = async (competitorUrls: string[]) => {
    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      
      const response = await axios.post(`${SERVER_URL}/api/competitor-analysis`, {
        urls: competitorUrls
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setAnalysisResults(response.data);
        return response.data;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Competitor Analysis Error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          setError(`Analysis failed: ${error.response.data.message || 'Server error'}`);
        } else if (error.request) {
          setError('No response from server. Please check your network connection.');
        } else {
          setError('Error setting up the analysis request.');
        }
      } else {
        setError('An unexpected error occurred during competitor analysis.');
      }
      
      throw error;
    }
  };

  const handleAnalyzeCompetitors = async () => {
    if (competitors.length < 2) {
      setError('Please add at least two competitors to perform analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const competitorUrls = competitors.map(competitor => competitor.url);
      
      const analysisResults = await analyzeCompetitors(competitorUrls);
      
      const updatedCompetitors = competitors.map(competitor => {
        const analysisResult = analysisResults.find(result => result.url === competitor.url);
        return analysisResult 
          ? { 
              ...competitor, 
              strengths: analysisResult.strengths,
              weaknesses: analysisResult.weaknesses
            }
          : competitor;
      });

      console.log('Competitor Analysis Results:', analysisResults);
      
    } catch (error) {
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div 
      className="relative bg-cover bg-center bg-no-repeat min-h-screen py-12 md:py-16 px-4"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.95)), 
          url('https://images.unsplash.com/photo-1522252234503-e356532cafd5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1925&q=80')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <Navigation />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
              <Scale className="w-12 h-12 text-indigo-600" />
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-gray-900 
                bg-clip-text text-transparent bg-gradient-to-r 
                from-indigo-600 to-purple-600 leading-tight 
                tracking-tight text-center sm:text-left">
                Competitors
              </h1>
            </div>
          </div>

          {/* Centralized Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <AlertOctagon className="w-5 h-5 text-red-500 mr-3" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* URL Input */}
          <div className="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex-grow">
                <div className="relative">
                  <input 
                    type="url" 
                    value={currentUrl}
                    onChange={(e) => {
                      setCurrentUrl(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter competitor app URL" 
                    className="w-full sm:flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={handleAddCompetitor}
                disabled={isAdding}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 transition-transform" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Competitor Cards */}
          {competitors.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {competitors.map((competitor, index) => (
                  <div 
                    key={index} 
                    className="bg-white shadow-lg rounded-xl p-6 mb-6 transform transition-all duration-300 hover:scale-[1.02]"
                  >
                    {/* Competitor Header */}
                    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
                      <img 
                        src={competitor.logo} 
                        alt={`${competitor.name} Logo`} 
                        className="w-16 h-16 rounded-full border-4 border-indigo-100 object-cover"
                      />
                      <div className="text-center sm:text-left w-full">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center justify-center sm:justify-start">
                          {competitor.name}
                          <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                            {competitor.platform.toUpperCase()}
                          </span>
                        </h3>
                        <div className="flex items-center justify-center sm:justify-start space-x-2 text-sm text-gray-600 mt-1">
                          <span className="font-medium">{competitor.developer}</span>
                        </div>
                        <a 
                          href={competitor.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline flex items-center justify-center sm:justify-start space-x-1 text-sm sm:text-base mt-1"
                        >
                          <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="truncate max-w-[200px]">{competitor.url}</span>
                        </a>
                      </div>
                    </div>

                    {/* Competitor Description */}
                    <p className="text-xs sm:text-sm text-gray-600 mb-4 text-center sm:text-left line-clamp-3">
                      {competitor.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Analysis Button */}
              <div className="flex justify-center mt-6">
                <div className="flex flex-col items-center space-y-4">
                  <button 
                    onClick={handleAnalyzeCompetitors}
                    disabled={isAnalyzing}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white 
                      px-8 py-3 rounded-lg shadow-lg hover:shadow-xl 
                      transition-all duration-300 ease-in-out 
                      flex items-center space-x-3 
                      disabled:opacity-50 disabled:cursor-not-allowed 
                      transform hover:-translate-y-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <BarChart2 className="w-5 h-5" />
                        <span>Analyze Competitors</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {competitors.length === 0 && (
            <div className="text-center py-12 bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-gray-100">
              <Scale className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-indigo-300 mb-6" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
                No Competitors Added Yet
              </h2>
              <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto px-4">
                Start by adding URLs of competitor apps to generate insights and compare their features.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-center mt-12">
        <ProductHuntBadge />
      </div>
    </div>
  );
};

export default CompetitorAnalysis;
