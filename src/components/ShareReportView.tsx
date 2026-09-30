import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, Download, RefreshCw, Star, Sparkles, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Navigation from './Navigation';
// import ProductHuntBadge from './ProductHuntBadge';
import remarkGfm from 'remark-gfm';
import { ShareComponent } from './ShareButton';
import ReviewPreview from './ReviewPreview';
import { SERVER_URL } from './Constants';
import { updateMetadata } from '../utils/metadata';

interface SharedReportViewProps {
  reportType: 'app' | 'competitor';
}

const SharedReportView: React.FC<SharedReportViewProps> = ({ reportType }) => {
  const { shareId } = useParams<{ shareId: string }>();
  const [report, setReport] = useState<string>('');
  const [appData, setAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (appData && report) {
      const appName = appData.title || 'App';
      const reportTitle = reportType === 'app'
        ? `${appName} Review Analysis Report | Insightly`
        : `${appName} Competitor Analysis Report | Insightly`;

      // Extract summary from report
      const getSummary = (text: string): string => {
        // Remove markdown headers, formatting, and the standard summary header
        const cleanText = text
          .replace(/#{1,6}\s?[^\n]+\n*/g, '') // Remove all headers
          .replace(/\*\*/g, '')               // Remove bold formatting
          .replace(/Summary of Key Insights\s*\n+/g, '') // Remove the summary header
          .trim();

        // Get first 2-3 sentences (up to 155 chars)
        const sentences = cleanText.split(/[.!?]+/);
        let summary = '';
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (trimmedSentence && (summary + trimmedSentence).length < 155) {
            summary += (summary ? ' ' : '') + trimmedSentence + '.';
          } else {
            break;
          }
        }
        return summary.trim();
      };

      const reportDescription = getSummary(report) || (reportType === 'app'
        ? `Detailed AI-powered review analysis for ${appName}. Get insights about user feedback, sentiment analysis, and key improvement areas.`
        : `Comprehensive competitor analysis report comparing ${appName} with similar apps. Understand market positioning and competitive advantages.`);

      const canonicalPath = reportType === 'app'
        ? `/shared-app-report/${shareId}`
        : `/shared-competitor-report/${shareId}`;

      updateMetadata(reportTitle, reportDescription, {
        canonicalPath,
        image: appData.icon || undefined
      });
    }

    // Cleanup function to reset metadata on unmount
    return () => {
      updateMetadata(
        'Insightly: AI-Powered App Review Intelligence',
        'Transform app reviews into actionable insights. Leverage AI to understand user feedback, drive product growth, and enhance user satisfaction.',
        { canonicalPath: '/', image: 'https://insightly.top/og-image.png' }
      );
    };
  }, [appData, reportType, report, shareId]);

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

  // ---- Derived display data (header card, TL;DR, rating bars) ----
  const { tldr, reportBody } = useMemo(() => {
    if (!report) return { tldr: '', reportBody: '' };
    const headerRe = /^#{1,6}\s+Summary of Key Insights\s*$/m;
    const match = headerRe.exec(report);
    if (!match) return { tldr: '', reportBody: report };
    const start = match.index + match[0].length;
    const nextHeader = /^#{1,6}\s+/m.exec(report.slice(start));
    const end = nextHeader ? start + nextHeader.index : report.length;
    const section = report.slice(start, end);
    const firstPara = (section.split(/\n\s*\n/)[0] || '').replace(/\*\*/g, '').trim();
    const rest = (report.slice(0, match.index) + report.slice(end)).trim();
    return { tldr: firstPara, reportBody: rest };
  }, [report]);

  const { scoreCounts, totalReviews, avgRating } = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]; // index 1..5
    const reviews = Array.isArray(appData?.reviews) ? appData.reviews : [];
    reviews.forEach((r: any) => {
      const s = Math.round(Number(r?.score) || 0);
      if (s >= 1 && s <= 5) counts[s] += 1;
    });
    const total = counts.reduce((a, b) => a + b, 0);
    const weighted = counts.reduce((a, c, s) => a + c * s, 0);
    return { scoreCounts: counts, totalReviews: total, avgRating: total ? weighted / total : 0 };
  }, [appData]);

  const sentiment = avgRating >= 4 ? 'Positive' : avgRating >= 3 ? 'Mixed' : avgRating > 0 ? 'Negative' : '';
  const sentimentColor = sentiment === 'Positive'
    ? 'bg-green-100 text-green-800'
    : sentiment === 'Mixed'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';

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
    <div className="container mx-auto p-4 pt-24 max-w-4xl">
      <Navigation />

      {/* App header card */}
      {appData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 flex items-center gap-5">
          {appData.icon ? (
            <img
              src={appData.icon}
              alt={`${appData.title || 'App'} icon`}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-extrabold text-indigo-600">
                {(appData.title || 'A').charAt(0)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-gray-900 truncate">
              {appData.title || 'App Report'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              {totalReviews > 0 && (
                <span className="inline-flex items-center font-semibold text-gray-700">
                  <Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" />
                  {avgRating.toFixed(1)}
                </span>
              )}
              {totalReviews > 0 && <span>{totalReviews} reviews analyzed</span>}
              {sentiment && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sentimentColor}`}>
                  {sentiment} sentiment
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rating distribution */}
      {totalReviews > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            Rating breakdown
          </h2>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((score) => (
              <div key={score} className="flex items-center space-x-2">
                <div className="w-6 text-xs text-gray-600 text-right">{score}★</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${(scoreCounts[score] / totalReviews) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-xs text-gray-600 text-left">{scoreCounts[score]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TL;DR summary card */}
      {tldr && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-6 mb-6">
          <div className="flex items-center mb-2">
            <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
            <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
              TL;DR
            </h2>
          </div>
          <p className="text-gray-800 leading-relaxed">{tldr}</p>
        </div>
      )}

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
        {reportBody ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportBody}</ReactMarkdown>
        ) : (
          <p>No report available</p>
        )}
      </div>

      {/* Bottom conversion CTA */}
      <div className="mt-12 mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white shadow-lg">
        <h2 className="text-2xl font-extrabold mb-2">
          Want the same teardown for your app?
        </h2>
        <p className="text-indigo-100 mb-6 max-w-xl mx-auto">
          Paste any App Store or Google Play link and get an AI report of user pain points,
          requested features, and startup opportunities — in minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/#pricing"
            className="inline-flex items-center bg-white text-indigo-700 font-bold px-6 py-3 rounded-lg hover:bg-indigo-50 transition"
          >
            Start for $1 <ArrowRight className="w-4 h-4 ml-2" />
          </a>
          <a
            href="/app-insights"
            className="inline-flex items-center font-semibold px-6 py-3 rounded-lg border border-white/40 hover:bg-white/10 transition"
          >
            Browse 2,800+ free reports
          </a>
        </div>
      </div>
      {/* <ProductHuntBadge /> */}
    </div>
  );
};

const AppReportView: React.FC = () => <SharedReportView reportType="app" />;
const CompetitorReportView: React.FC = () => <SharedReportView reportType="competitor" />;

export { AppReportView, CompetitorReportView };
