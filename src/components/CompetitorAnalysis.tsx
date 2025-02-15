import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Plus, 
  Globe, 
  Scale, 
  Loader2,
  BarChart2,
  AlertOctagon,
  X,
  Download
} from 'lucide-react';
import Navigation from './Navigation';
import ProductHuntBadge from './ProductHuntBadge';
import { MathChallengeComponent, MathChallenge } from './MathChallenge';
import { ProviderModelSelector } from './ProviderModelSelector';
import { useProviderModel } from './ProviderModelSelector';
import { ShareCompetitorReportButton } from './ShareButton';
import StyledComparisonCard from './StyledComparisonCard';

// Enable math challenge based on environment variable
const ENABLE_MATH_CHALLENGE = import.meta.env.VITE_ENABLE_MATH_CHALLENGE === 'true';

interface CompetitorApp {
  url: string;
  name: string;
  logo: string;
  description: string;
  platform: 'ios' | 'android';
  developer: string;
  appData?: {
    reviews?: {
      reviews: Array<{
        text: string;
        score: number;
        date?: string;
        userName?: string;
      }>;
      averageRating?: number;
      totalReviews?: number;
    };
    details?: Record<string, any>;
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
      body: JSON.stringify({ url, includeFullDetails: true }), // Request full details
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
      developer: data.details.developer,
      appData: {
        reviews: {
          reviews: data.reviews?.reviews || [],
          averageRating: data.reviews?.averageRating,
          totalReviews: data.reviews?.totalReviews
        },
        details: data.details
      }
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
  const [comparisonResult, setComparisonResult] = useState<string>('');
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const { provider, model } = useProviderModel();

  const handleAddCompetitor = async () => {
    // Prevent multiple simultaneous additions
    if (isAdding) return;

    // Validate URL
    if (!currentUrl.trim()) {
      setError('Please enter a valid app store URL');
      return;
    }

    // Check for duplicate URLs
    if (competitorUrls.includes(currentUrl)) {
      setError('This app has already been added');
      return;
    }

    try {
      setIsAdding(true);
      setError(null);

      // Fetch competitor details
      const competitorDetails = await fetchCompetitorAppDetails(currentUrl);

      // Update state
      setCompetitors(prev => [...prev, competitorDetails]);
      setCompetitorUrls(prev => [...prev, currentUrl]);
      setCurrentUrl(''); // Reset input
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add competitor';
      setError(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCompetitor = (urlToRemove: string) => {
    setCompetitors(prev => 
      prev.filter(competitor => competitor.url !== urlToRemove)
    );
    setCompetitorUrls(prev => 
      prev.filter(url => url !== urlToRemove)
    );
  };

  const prepareChallengeAndSubmit = async () => {
    if (ENABLE_MATH_CHALLENGE) {
      setShowChallenge(true);
    } else {
      handleFinalSubmit(provider, model);
    }
  }

  const handleFinalSubmit = async (
    currentProvider: keyof typeof PROVIDERS_CONFIG, 
    currentModel: string, 
    mathChallenge?: MathChallenge
  ) => {
    // Ensure at least two competitors
    if (competitors.length < 2) {
      setError('Please add at least two competitors to compare');
      return;
    }

    try {
      setIsComparing(true);
      setComparisonResult('');
      setError(null);

      // Fetch full app details for each competitor before comparison
      const competitorDetailsWithData = await Promise.all(
        competitors.map(async (competitor) => {
          try {
            // Fetch full app details using the existing fetchCompetitorAppDetails function
            const fullDetails = await fetchCompetitorAppDetails(competitor.url);
            return fullDetails;
          } catch (error) {
            console.error(`Failed to fetch details for ${competitor.name}:`, error);
            return competitor; // Return original competitor if fetch fails
          }
        })
      );

      // Validate competitor data before sending
      const validCompetitors = competitorDetailsWithData.filter(comp => 
        comp.name && comp.url && comp.platform && comp.description
      );

      if (validCompetitors.length < 2) {
        setError('Insufficient valid competitor data. Please check your competitors.');
        setIsComparing(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add math challenge header only if enabled and challenge exists
      if (ENABLE_MATH_CHALLENGE && mathChallenge) {
        headers['X-Math-Challenge'] = mathChallenge.challenge;
      }

      console.log('Sending Competitors:', JSON.stringify(validCompetitors, null, 2));

      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/compare-competitors`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
           competitors: validCompetitors,
           provider: currentProvider,
           model: currentModel,
           mathChallenge: mathChallenge
        })
      });

      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setIsComparing(false);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
          try {
            const parsedLine = JSON.parse(line);
            
            if (parsedLine.report) {
              fullReport += parsedLine.report;
              setComparisonResult(fullReport);
            }
          } catch (parseError) {
            console.error('Error parsing stream chunk:', parseError);
          }
        });
      }

      console.log('Final Report:', fullReport);
    } catch (error) {
      console.error('Competitor comparison error:', error);
      
      // Detailed error handling
      if (error instanceof Error) {
        setError(`Comparison failed: ${error.message}`);
      } else {
        setError('An unexpected error occurred during competitor comparison');
      }
      
      setIsComparing(false);
    }
  };

  const downloadCompetitorReport = () => {
    // Create a Blob with the comparison result
    const blob = new Blob([comparisonResult], { type: 'text/markdown' });
    
    // Create a link element and trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `competitor-analysis-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                   <StyledComparisonCard key={index} competitor={competitor} />
                ))}
              </div>

              {/* Comparison Button */}
              {competitors.length >= 2 && (
                <div className="flex justify-center mt-6">
                  <div className="flex flex-col items-center space-y-4">
                    {false && <ProviderModelSelector />}
                    <button 
                      onClick={prepareChallengeAndSubmit}
                      disabled={isComparing}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white 
                        px-8 py-3 rounded-lg shadow-lg hover:shadow-xl 
                        transition-all duration-300 ease-in-out 
                        flex items-center space-x-3 
                        disabled:opacity-50 disabled:cursor-not-allowed 
                        transform hover:-translate-y-1"
                    >
                      {isComparing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          <span>Comparing...</span>
                        </>
                      ) : (
                        <>
                          <BarChart2 className="w-5 h-5" />
                          <span>Compare Competitors</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Comparison Result */}
              {comparisonResult && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                {!isComparing && (
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                  <button 
                    onClick={downloadCompetitorReport}
                    className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                  </button>
                  <div className="w-full sm:w-auto">
                    <ShareCompetitorReportButton 
                      competitors={competitors.map(competitor => ({ url: competitor.url }))}
                      title="Insightly Competitor Analysis"
                      description={`Comparative analysis of ${competitors.map(c => c.name).join(', ')}`}
                    />
                  </div>
                </div>
                )}
                <div className="prose prose-sm max-w-none mb-8 w-full overflow-x-auto">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({node, ...props}) => (
                        <div className="w-full overflow-x-auto">
                          <table 
                            className="w-full border-collapse bg-white text-sm" 
                            {...props} 
                          />
                        </div>
                      ),
                      th: ({node, ...props}) => (
                        <th 
                          className="px-4 py-2 bg-gray-100 border border-gray-200 text-left font-semibold" 
                          {...props} 
                        />
                      ),
                      td: ({node, ...props}) => (
                        <td 
                          className="px-4 py-2 border border-gray-200" 
                          {...props} 
                        />
                      )
                    }}
                  >
                    {comparisonResult}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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

      {ENABLE_MATH_CHALLENGE && showChallenge && (
          <MathChallengeComponent 
            isOpen={showChallenge}
            onClose={() => setShowChallenge(false)}
            onChallengeComplete={(mathChallenge) => {
              // Continue with submission using the completed challenge
              handleFinalSubmit(provider, model, mathChallenge);
            }}
            onChallengeFail={() => {
            }}
          />
        )}

    </div>
  );
};

export default CompetitorAnalysis;
