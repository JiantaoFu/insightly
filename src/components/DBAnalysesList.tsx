import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import AppCard from './AppCard';

interface DBAnalysesListProps {
  pageSize?: number;
  searchTerm?: string;
}

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const DBAnalysesList: React.FC<DBAnalysesListProps> = ({
  pageSize = 10,
  searchTerm = ''
}) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
    hasMore: false
  });
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  const fetchAnalyses = async (page: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${SERVER_URL}/api/db-analyses?page=${page}&limit=${pageSize}&sortBy=timestamp&sortOrder=desc`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analyses');
      }

      const data = await response.json();
      setAnalyses(data.results);
      setPagination({
        total: data.pagination.total,
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        hasMore: data.pagination.hasMore
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analyses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses(1);
  }, [pageSize]);

  const handlePageChange = (newPage: number) => {
    fetchAnalyses(newPage);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        Error: {error}
      </div>
    );
  }

  const filteredAnalyses = analyses.filter(analysis => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      analysis.appDetails.title.toLowerCase().includes(searchLower) ||
      analysis.appDetails.developer.toLowerCase().includes(searchLower) ||
      analysis.appDetails.description.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAnalyses.map((analysis, index) => (
          <AppCard
            key={index}
            title={analysis.appDetails.title}
            description={analysis.appDetails.description}
            developer={analysis.appDetails.developer}
            icon={analysis.appDetails.icon}
            url={analysis.appDetails.url}
            shareLink={analysis.shareLink}
            platform={analysis.appDetails.platform}
            reviewsSummary={analysis.reviewsSummary}
            analysisDate={analysis.analysisDate}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
          className="px-4 py-2 bg-gray-200 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={!pagination.hasMore}
          className="px-4 py-2 bg-gray-200 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default DBAnalysesList;
