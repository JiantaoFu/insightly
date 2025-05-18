import React, { useState, useEffect } from 'react';
import { BarChart2, RefreshCw, ChevronDown, Link as LinkIcon } from 'lucide-react';
import StyledComparisonCard from './StyledComparisonCard';
import axios from 'axios';
import { SERVER_URL } from './Constants';

const CachedComparisonsList = ({ pageSize, searchTerm }) => {
  const [comparisons, setComparisons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayCount, setDisplayCount] = useState(pageSize); // State to track displayed items

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${SERVER_URL}/api/cached-comparisons`);
        if (Array.isArray(response.data)) {
          setComparisons(response.data);
        } else {
          setComparisons([]);
          setError('Unexpected response format');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [SERVER_URL]);

  const handleLoadMore = () => {
    setDisplayCount(prevCount => prevCount + pageSize);
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

  const filteredComparisons = comparisons.filter(comparison =>
    comparison.competitors.some(competitor => competitor.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 flex items-center justify-center">
        <BarChart2 className="mr-3 text-blue-600" />
        Recently Compared Apps
      </h2>

      {filteredComparisons.length === 0 ? (
        <div className="text-center text-gray-500">
          No cached comparisons found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComparisons.slice(0, displayCount).map((comparison, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-xl font-bold mb-4">Comparison Date: {comparison.comparisonDate}</h3>
              {comparison.competitors.map((competitor, idx) => (
                <StyledComparisonCard key={idx} competitor={competitor} />
              ))}
              <a href={comparison.shareLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                <LinkIcon className="mr-2" size={16} />
                View Report
              </a>
            </div>
          ))}
        </div>
      )}

      {displayCount < filteredComparisons.length && (
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

export default CachedComparisonsList;