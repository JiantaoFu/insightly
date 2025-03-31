import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, BarChart2 } from 'lucide-react';
import AppCard from './AppCard';

interface CachedAnalysis {
  shareLink: string;
  appDetails: {
    title: string;
    description: string;
    developer: string;
    version: string;
    url: string;
    icon: string;
    platform?: 'ios' | 'android';
  };
  reviewsSummary: {
    totalReviews: number;
    averageRating: number;
    scoreDistribution: Record<string, number>;
  };
  analysisDate: string;
}

interface CachedAnalysesListProps {
  pageSize?: number;
  searchTerm?: string;
}

const CachedAnalysesList: React.FC<CachedAnalysesListProps> = ({
  pageSize = 3,
  searchTerm = ''
}) => {
  const [cachedAnalyses, setCachedAnalyses] = useState<CachedAnalysis[]>([]);
  const [displayedAnalyses, setDisplayedAnalyses] = useState<CachedAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<CachedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchCachedAnalyses = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/cached-analyses`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCachedAnalyses(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchCachedAnalyses();
  }, []);

  useEffect(() => {
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedAnalyses.map((analysis, index) => (
              <AppCard
                key={index}
                title={analysis.appDetails.title}
                description={analysis.appDetails.description}
                developer={analysis.appDetails.developer}
                icon={analysis.appDetails.icon}
                url={analysis.appDetails.url}
                shareLink={analysis.shareLink}
                platform={analysis.appDetails.platform || 'unknown'}
                reviewsSummary={analysis.reviewsSummary}
                analysisDate={analysis.analysisDate}
              />
            ))}
          </div>

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
        </>
      )}
    </div>
  );
};

export default CachedAnalysesList;