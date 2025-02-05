import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Navigation from './Navigation';

interface ShareReportViewProps {
  // Any additional props if needed
}

interface ReportChunk {
  type: string;
  data: any;
}

const ShareReportView: React.FC<ShareReportViewProps> = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [metadata, setMetadata] = useState<any | null>(null);
  const [report, setReport] = useState<string>('');
  const [reportChunks, setReportChunks] = useState<ReportChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchSharedReport = async () => {
      try {
        setIsLoading(true);
        const analysisResponse = await fetch(`${SERVER_URL}/api/shared-report?shareId=${shareId}`, {
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
        setError(error instanceof Error ? error.message : 'Failed to load shared report');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedReport();
  }, [shareId]);

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
      <div className="prose prose-sm max-w-none">
        {report ? (
          <ReactMarkdown>{report}</ReactMarkdown>
        ) : (
          <p>No report available</p>
        )}
      </div>
    </div>
  );
};

export default ShareReportView;
