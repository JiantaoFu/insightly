import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Navigation from './Navigation';
import { ProductHuntBadge } from './ProductHuntBadge';
import remarkGfm from 'remark-gfm';

interface SharedReportViewProps {
  reportType: 'app' | 'competitor';
}

const SharedReportView: React.FC<SharedReportViewProps> = ({ reportType }) => {
  const { shareId } = useParams<{ shareId: string }>();
  const [report, setReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchSharedReport = async () => {
      try {
        setIsLoading(true);
        const apiEndpoint = reportType === 'app' 
          ? `/api/shared-app-report?shareId=${shareId}` 
          : `/api/shared-competitor-report?shareId=${shareId}`;

        const analysisResponse = await fetch(`${SERVER_URL}${apiEndpoint}`, {
          method: 'GET'
        });
        const responseData = await analysisResponse.json();
        
        if (responseData.error) {
          setError(responseData.error);
          if (responseData.shouldReanalyze) {
            // Potentially trigger re-analysis
          }
          return;
        }
        
        setReport(responseData.report);
      } catch (error) {
        console.error('Error:', error);
        setError(error instanceof Error ? error.message : `Failed to load shared ${reportType} report`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedReport();
  }, [shareId, reportType]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        <AlertTriangle className="mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pt-24">
      <Navigation />
      <div className="prose prose-sm max-w-none mb-8">
        {report ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        ) : (
          <p>No report available</p>
        )}
      </div>
      <ProductHuntBadge />
    </div>
  );
};

// Create specific report view components using the generic component
const AppReportView: React.FC = () => <SharedReportView reportType="app" />;
const CompetitorReportView: React.FC = () => <SharedReportView reportType="competitor" />;

export { AppReportView, CompetitorReportView };
