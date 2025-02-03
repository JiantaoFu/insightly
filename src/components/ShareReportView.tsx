import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
        const analysisResponse = await fetch(`${SERVER_URL}/api/shared-report?url=${shareId}`, {
          method: 'GET'
        });

        if (!analysisResponse.body) {
          throw new Error('Response body is null');
        }

        const reader = analysisResponse.body.getReader();
        const decoder = new TextDecoder();
        let fullReport = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream completed');
            setIsLoading(false);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('Received chunk:', chunk);

          // Split chunk into lines and parse
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          lines.forEach(line => {
            try {
              console.log('Parsing line:', line);
              const parsedChunk = JSON.parse(line);
              
              if (parsedChunk.report) {
                fullReport += parsedChunk.report;
                setReport(fullReport);
              }
            } catch (parseError) {
              console.error('Error parsing chunk:', parseError, 'Raw line:', line);
            }
          });
        }
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
    <div className="container mx-auto p-4">
      <div className="prose prose-sm max-w-none">
        {report ? (
          <ReactMarkdown>{report}</ReactMarkdown>
        ) : (
          <p>No report content available.</p>
        )}
      </div>
    </div>
  );
};

export default ShareReportView;
