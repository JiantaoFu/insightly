import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Navigation from './Navigation';
import ProductHuntBadge from './ProductHuntBadge';
import remarkGfm from 'remark-gfm';
import { ShareComponent } from './ShareButton';
import ReviewPreview from './ReviewPreview';

interface SharedReportViewProps {
  reportType: 'app' | 'competitor';
}

const SharedReportView: React.FC<SharedReportViewProps> = ({ reportType }) => {
  const { shareId } = useParams<{ shareId: string }>();
  const [report, setReport] = useState<string>('');
  const [appData, setAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

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
      setAppData(responseData.appDetails);
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : `Failed to load shared ${reportType} report`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedReport();
  }, [shareId, reportType]);

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${appData?.title || 'app'}-review-analysis.md`;
    link.click();
  };

  const downloadReviews = () => {
    if (!appData?.reviews) return;

    const csvHeader = 'Timestamp,Score,User,Review\n';
    const csvContent = appData.reviews.map(review =>
      `"${review.timestamp || ''}","${review.score || 0}","${(review.userName || 'Anonymous').replace(/"/g, '""')}","${(review.text || '').replace(/"/g, '""')}"`)
      .join('\n');
    const blob = new Blob([csvHeader + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${appData?.title || 'app'}_reviews.csv`;
    link.click();
  };

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

      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
        <button
          onClick={downloadReport}
          className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </button>
        {Array.isArray(appData?.reviews) && appData.reviews.length > 0 && (
          <button
            onClick={downloadReviews}
            className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
          >
            <Download className="w-4 h-4 mr-2" /> Download Reviews
          </button>
        )}
        <div className="w-full sm:w-auto">
        {appData && (
          <ShareComponent
            generateShareLink={() => window.location.href}
            title={appData.title || 'App Report'}
            description={appData.description || 'Detailed app analysis report'}
            shareType={reportType}
          />
          )}
        </div>
      </div>


      {appData?.reviews && appData?.reviews?.length > 0 && (
        <ReviewPreview
          reviews={appData?.reviews.map(review => ({
            id: review.id,
            text: review.text,
            score: review.score,
            userName: review.userName,
            timestamp: review.timestamp
          }))}
        />
      )}
      <div className="border-t border-gray-200 my-8"></div>

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

const AppReportView: React.FC = () => <SharedReportView reportType="app" />;
const CompetitorReportView: React.FC = () => <SharedReportView reportType="competitor" />;

export { AppReportView, CompetitorReportView };
