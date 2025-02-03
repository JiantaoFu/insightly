// src/components/CachedAnalysesList.tsx
import React, { useState, useEffect } from 'react';
import { Clock, Link as LinkIcon, BarChart2, Star } from 'lucide-react';

interface CachedAnalysis {
  shareLink: string;
  appDetails: {
    title: string;
    description: string;
    developer: string;
    version: string;
    url: string;
    icon: string;
  };
  reviewsSummary: {
    totalReviews: number;
    averageRating: number;
    scoreDistribution: Record<string, number>;
  };
  analysisDate: string;
  finalReport?: string;
}

const CachedAnalysesList: React.FC = () => {
  const [cachedAnalyses, setCachedAnalyses] = useState<CachedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const CACHE_EXPIRATION_TIME = 1 * 60 * 1000;
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchCachedAnalyses = async () => {
      const currentTime = Date.now();

      try {
        const response = await fetch(`${SERVER_URL}/api/cached-analyses`);
        
        // Log full response details
        console.log('Response details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Comprehensive error handling
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response not OK:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);

        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error(`Expected JSON, got ${contentType}. Body:`, text);
          throw new Error(`Expected JSON, got ${contentType}`);
        }

        const data = await response.json();
        
        // Validate data structure
        if (!Array.isArray(data)) {
          console.error('Unexpected data format:', data);
          throw new Error('Invalid data format');
        }

        // Additional data validation
        const validatedData = data.map(entry => ({
          shareLink: entry.shareLink || '',
          appDetails: {
            title: entry.appDetails?.title || 'Unknown App',
            description: entry.appDetails?.description || '',
            developer: entry.appDetails?.developer || 'Unknown Developer',
            version: entry.appDetails?.version || 'N/A',
            url: entry.appDetails?.url || '',
            icon: entry.appDetails?.icon || ''
          },
          reviewsSummary: {
            totalReviews: entry.reviewsSummary?.totalReviews,
            averageRating: entry.reviewsSummary?.averageRating,
            scoreDistribution: entry.reviewsSummary?.scoreDistribution || {}
          },
          analysisDate: entry.analysisDate || new Date().toLocaleString(),
          finalReport: entry.finalReport || ''
        }));

        setCachedAnalyses(validatedData);
        setIsLoading(false);
      } catch (err) {
        console.error('Fetch error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          name: err instanceof Error ? err.name : 'Unknown error type'
        });
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchCachedAnalyses();
  }, []);

  if (isLoading) return <div className="text-center py-8">Loading cached analyses...</div>;
  if (error) return <div className="text-center text-red-500 py-8">{error}</div>;
  if (cachedAnalyses.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6 flex items-center justify-center">
        <Clock className="mr-2 text-blue-500 w-5 h-5 sm:w-6 sm:h-6" /> Recently Analyzed Apps
      </h2>
      <div className="space-y-4">
        {cachedAnalyses.map((analysis, index) => (
          <div 
            key={index} 
            className="border-b pb-4 last:border-b-0 hover:bg-gray-50 transition-colors rounded-lg p-3"
          >
            {/* Mobile-first grid layout */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
              <div className="flex items-center">
                {analysis.appDetails.icon && (
                  <img 
                    src={analysis.appDetails.icon} 
                    alt={`${analysis.appDetails.title} icon`} 
                    className="w-8 h-8 mr-2 rounded-lg object-cover"
                  />
                )}
                <h3 className="text-base sm:text-lg font-semibold">
                  {analysis.appDetails.title}
                </h3>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 flex items-center">
                <Clock className="mr-1 w-3 h-3 sm:w-4 sm:h-4" /> {analysis.analysisDate}
              </span>
            </div>
            
            {/* Responsive grid for app details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-2">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">
                  <strong>Developer:</strong> {analysis.appDetails.developer}
                </p>
              </div>
              <div className="flex flex-wrap items-center space-x-2 sm:space-x-4">
                <div className="flex items-center">
                  <Star className="mr-1 sm:mr-2 text-yellow-500 w-4 h-4" />
                  <span className="text-xs sm:text-sm">{analysis.reviewsSummary.averageRating}/5</span>
                </div>
                <div className="flex items-center">
                  <BarChart2 className="mr-1 sm:mr-2 text-green-500 w-4 h-4" />
                  <span className="text-xs sm:text-sm">{analysis.reviewsSummary.totalReviews} Reviews</span>
                </div>
              </div>
            </div>
  
            {/* Score Distribution Visualization */}
            <div className="mt-2 space-y-1">
              {Object.entries(analysis.reviewsSummary.scoreDistribution || {})
                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                .map(([score, count]) => (
                  <div key={score} className="flex items-center space-x-2">
                    <div className="w-6 text-xs text-gray-600 text-right">{score}★</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full ${
                          parseInt(score) >= 4 
                            ? 'bg-green-500' 
                            : parseInt(score) >= 2 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`} 
                        style={{ 
                          width: `${count > 0 
                            ? Math.min((count / (analysis.reviewsSummary.totalReviews || 1)) * 100, 100) 
                            : 0}%` 
                        }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-600 text-left">{count}</div>
                  </div>
                ))
              }
            </div>

            {/* URL with truncation and mobile-friendly styling */}
            <div className="flex items-center mb-2">
              <LinkIcon className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              <a 
                href={analysis.shareLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs sm:text-sm text-blue-600 hover:underline truncate max-w-full block"
              >
                Shared Analysis Report
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CachedAnalysesList;