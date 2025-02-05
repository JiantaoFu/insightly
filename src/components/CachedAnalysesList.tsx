import React, { useState, useEffect } from 'react';
import { Clock, Link as LinkIcon, BarChart2, Star, RefreshCw, ChevronDown, AlertCircle } from 'lucide-react';

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

interface CachedAnalysesListProps {
  pageSize?: number;
  searchTerm?: string;
}

const CachedAnalysesList: React.FC<CachedAnalysesListProps> = ({ 
  pageSize = 6, 
  searchTerm = '' 
}) => {
  const [cachedAnalyses, setCachedAnalyses] = useState<CachedAnalysis[]>([]);
  const [displayedAnalyses, setDisplayedAnalyses] = useState<CachedAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<CachedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [iconErrors, setIconErrors] = useState<{[key: string]: boolean}>({});

  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchCachedAnalyses = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/cached-analyses`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
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
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchCachedAnalyses();
  }, []);

  useEffect(() => {
    // Filter logic
    const filtered = cachedAnalyses.filter(analysis => 
      analysis.appDetails.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analysis.appDetails.developer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredAnalyses(filtered);
    setDisplayedAnalyses(filtered.slice(0, pageSize));
    setPage(1);
  }, [cachedAnalyses, searchTerm, pageSize]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    const startIndex = displayedAnalyses.length;
    const endIndex = startIndex + pageSize;
    
    const newDisplayedAnalyses = [
      ...displayedAnalyses, 
      ...filteredAnalyses.slice(startIndex, endIndex)
    ];
    
    setDisplayedAnalyses(newDisplayedAnalyses);
    setPage(nextPage);
  };

  const handleImageError = (shareLink: string) => {
    console.error(`Failed to load icon for app with share link: ${shareLink}`);
    setIconErrors(prev => ({
      ...prev,
      [shareLink]: true
    }));
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <RefreshCw className="animate-spin text-blue-500" size={48} />
    </div>
  );

  if (error) return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      {error}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 flex items-center justify-center">
        <BarChart2 className="mr-3 text-blue-600" />
        Recently Analyzed Apps
      </h2>
      
      {displayedAnalyses.length === 0 ? (
        <div className="text-center text-gray-500">
          No cached analyses found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedAnalyses.map((analysis, index) => (
            <div 
              key={index} 
              className="bg-white shadow-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl transform hover:-translate-y-2"
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  {iconErrors[analysis.shareLink] ? (
                    <div className="w-12 h-12 rounded-lg mr-4 flex items-center justify-center bg-gray-100">
                      <AlertCircle className="text-gray-500" />
                    </div>
                  ) : (
                    <img 
                      src={analysis.appDetails.icon || 'https://via.placeholder.com/50'}
                      alt={`${analysis.appDetails.title} icon`}
                      className="w-12 h-12 rounded-lg mr-4 object-cover"
                      onError={() => handleImageError(analysis.shareLink)}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {analysis.appDetails.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {analysis.appDetails.developer}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Clock className="mr-2 text-blue-500" size={16} />
                    {new Date(analysis.analysisDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Star className="mr-2 text-yellow-500" size={16} />
                    {analysis.reviewsSummary.averageRating.toFixed(1)}
                  </div>
                </div>

                {/* Rating Histogram */}
                <div className="mt-4 space-y-1">
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
                
                <div className="mt-4 flex items-center">
                  <a 
                    href={analysis.shareLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <LinkIcon className="mr-2" size={16} />
                    View Shared Report
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {displayedAnalyses.length < filteredAnalyses.length && (
        <div className="flex justify-center mt-8">
          <button 
            onClick={handleLoadMore}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            <ChevronDown className="mr-2" />
            Load More Analyses
          </button>
        </div>
      )}
    </div>
  );
};

export default CachedAnalysesList;