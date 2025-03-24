import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Download, RefreshCw } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import ShareButton from './ShareButton';
import Navigation from './Navigation';
import ReviewPreview from './ReviewPreview';
import ProductHuntBadge from './ProductHuntBadge';
import { MathChallengeComponent, MathChallenge } from './MathChallenge';
import { ProviderModelSelector, useProviderModel } from './ProviderModelSelector';
import { DEFAULT_APP_ANALYZE_PROMPT, ENABLE_MATH_CHALLENGE, SERVER_URL } from './Constants';

const MainAnalysis: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_APP_ANALYZE_PROMPT);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(new AbortController());

  const [showChallenge, setShowChallenge] = useState(false);
  const [isRefresh, setIsRefresh] = useState(false);

  const { provider, model } = useProviderModel();

  // Handle textarea changes without refreshing
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.target.value);
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [url]);

  const textAreaRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [customPrompt]);

  const prepareChallengeAndSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setIsRefresh(force);
    if (ENABLE_MATH_CHALLENGE) {
      setShowChallenge(true);
    } else {
      handleFinalSubmit(provider, model, undefined, force);
    }
  };

  const handleFinalSubmit = async (
    currentProvider: keyof typeof PROVIDERS_CONFIG,
    currentModel: string,
    mathChallenge?: MathChallenge,
    force: boolean = false
  ) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Reset previous states
    setLoading(true);
    setError('');
    setReport('');
    setShowChallenge(false);

    try {
      let processUrlEndpoint = '';

      // Detect URL type
      if (url.includes('apps.apple.com')) {
        processUrlEndpoint = `${SERVER_URL}/app-store/process-url`;
      } else if (url.includes('play.google.com')) {
        processUrlEndpoint = `${SERVER_URL}/google-play/process-url`;
      } else {
        setError('Unsupported app store URL');
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add math challenge header only if enabled and challenge exists
      if (ENABLE_MATH_CHALLENGE && mathChallenge) {
        headers['X-Math-Challenge'] = mathChallenge.challenge;
      }

      const processResponse = await fetch(processUrlEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
        signal: abortControllerRef.current.signal
      });

      if (!processResponse.ok) {
        throw new Error(`Failed to process URL: ${processUrlEndpoint}`);
      }

      const data = await processResponse.json();
      setAppData(data);

      // Prepare data for analysis
      const analysisResponse = await fetch(`${SERVER_URL}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          provider: currentProvider,
          model: currentModel,
          appData: data,
          customPrompt,
          mathChallenge,
          force
        }),
        signal: abortControllerRef.current.signal
      });

      if (!analysisResponse.body) {
        throw new Error('No response body');
      }

      const reader = analysisResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('Stream completed');
          setLoading(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        // console.log('Received chunk:', chunk);

        // Split chunk into lines and parse
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        lines.forEach(line => {
          try {
            // console.log('Parsing line:', line);
            const parsedChunk = JSON.parse(line);

            if (parsedChunk.report) {
              fullReport += parsedChunk.report;
              setReport(fullReport);
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError, 'Raw line:', line);
          }
        });

        console.log('full report:', fullReport);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('Request was cancelled');
      } else {
        console.error('Error:', error);
        setError(error.message || 'Failed to analyze the app. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleRefresh = (e: React.FormEvent) => {
    prepareChallengeAndSubmit(e, true);
  };

  const downloadReport = useCallback(() => {
    if (!report) return;

    try {
      const blob = new Blob([report], { type: 'text/markdown' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${appData.details?.title || 'app'}-review-analysis.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download the report. Please try again.');
    }
  }, [report]);

  const downloadReviews = useCallback(() => {
    if (!appData?.reviews?.reviews) {
      setError('No reviews available to download');
      return;
    }

    // Prepare CSV
    const csvHeader = 'Timestamp,Score,User,Review\n';
    const csvContent = appData.reviews.reviews.map(review =>
      `"${review.timestamp || ''}","${review.score || 0}","${(review.userName || 'Anonymous').replace(/"/g, '""')}","${(review.text || '').replace(/"/g, '""')}"`)
      .join('\n');
    const csvBlob = new Blob([csvHeader + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create download link
    const csvLink = document.createElement('a');
    csvLink.href = URL.createObjectURL(csvBlob);
    csvLink.download = `${appData.details?.title || 'app'}_reviews.csv`;

    // Trigger download
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
  }, [appData]);

  const demoApps = [
    {
      name: "Instagram",
      placeholder: "https://apps.apple.com/us/app/instagram/id389801252",
      description: "Social Media Networking App"
    },
    {
      name: "Spotify",
      placeholder: "https://play.google.com/store/apps/details?id=com.spotify.music",
      description: "Music Streaming Platform"
    },
    {
      name: "Duolingo",
      placeholder: "https://apps.apple.com/us/app/duolingo/id570060128",
      description: "Language Learning App"
    }
  ];

  function DemoSelector({
    url,
    setUrl,
    handleSubmit
  }: {
    url: string,
    setUrl: (url: string) => void,
    handleSubmit: (e: React.FormEvent) => Promise<void>
  }) {
    const handleDemoSelect = (demoApp: typeof demoApps[0]) => {
      // Ensure the URL is always set and the component re-renders
      setUrl(demoApp.placeholder);
    };

    return (
      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Try a Demo Report</h2>
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {demoApps.map((app) => (
              <button
                key={app.name}
                onClick={() => handleDemoSelect(app)}
                className={`p-4 rounded-lg border transition-all duration-300 ${
                  url === app.placeholder
                    ? 'bg-blue-500 text-white border-blue-600 shadow-lg'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                <h3 className="font-semibold">{app.name}</h3>
                <p className="text-sm mt-2">{app.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-20">
      <Navigation />
      <div
        className="relative bg-cover bg-center bg-no-repeat
          py-8 md:py-16 px-4"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.95)),
            url('https://images.unsplash.com/photo-1522252234503-e356532cafd5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1925&q=80')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4
              bg-clip-text text-transparent bg-gradient-to-r
              from-indigo-600 to-purple-600 leading-tight
              tracking-tight">
              Uncover Deep Insights from App Reviews
            </h1>
            <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto
              leading-relaxed tracking-wide">
              Leverage AI to Drive Product Growth
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">

          {/* Demo Selector */}
        <DemoSelector
          url={url}
          setUrl={setUrl}
          handleSubmit={prepareChallengeAndSubmit}
        />

          <form onSubmit={(e) => prepareChallengeAndSubmit(e, false)} className="mb-12">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              {false && <ProviderModelSelector />}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter App Store or Google Play URL"
                className="w-full sm:flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
              {loading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cancel
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Analyze
                  </button>
                </div>
              )}
            </div>
            {error && (
              <p className="mt-2 text-red-600">{error}</p>
            )}
          </form>

          {/* Advanced Options */}
          <div className="mb-12">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center gap-2"
            >
              {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
            </button>
            {showAdvancedOptions && (
              <div className="mt-4">
                <label className="block text-gray-700 font-bold mb-2" htmlFor="customPrompt">
                  Customized Prompt
                </label>
                <div className="relative w-full">
                  <TextareaAutosize
                    value={customPrompt}
                    onChange={handleTextareaChange}
                    placeholder={DEFAULT_APP_ANALYZE_PROMPT}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      outline-none placeholder-gray-400 resize-none"
                    minRows={20}
                    maxRows={40}
                    spellCheck={false}
                    style={{ lineHeight: '1.5' }}
                  />
                </div>
              </div>
            )}
          </div>

          {appData?.reviews?.reviews && appData?.reviews?.reviews.length > 0 && (
            <ReviewPreview
              reviews={appData?.reviews?.reviews.map(review => ({
                id: review.id || crypto.randomUUID(),
                text: review.text,
                score: review.score,
                userName: review.userName,
                timestamp: review.timestamp
              }))}
            />
          )}
          <div className="border-t border-gray-200 my-8"></div>

          {report && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              {!loading && (
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                <button
                  onClick={downloadReport}
                  className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </button>
                {appData?.reviews?.reviews && (
                  <button
                    onClick={downloadReviews}
                    className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download Reviews
                  </button>
                )}
                <div className="w-full sm:w-auto">
                  <ShareButton url={url} />
                </div>
                <button
                  onClick={handleRefresh}
                  className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
              )}

              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>

            </div>
          )}
        </div>

        {ENABLE_MATH_CHALLENGE && showChallenge && (
          <MathChallengeComponent
            isOpen={showChallenge}
            onClose={() => setShowChallenge(false)}
            onChallengeComplete={(mathChallenge) => {
              // Continue with submission using the completed challenge
              handleFinalSubmit(provider, model, mathChallenge, isRefresh);
            }}
            onChallengeFail={() => {
            }}
          />
        )}

        <div className="border-t border-gray-200 my-8"></div>

        {/* Product Hunt Badge */}
        <ProductHuntBadge />
      </div>
    </div>
  );
};

export default MainAnalysis;