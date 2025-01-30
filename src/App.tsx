import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LogIn, 
  LogOut, 
  User,
  Send,
  CheckCircle2,
  X,
  Loader2,
  CreditCard,
  ChevronDown,
  Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Configuration for providers and models
const PROVIDERS_CONFIG = {
  ollama: {
    defaultModel: 'deepseek-r1:7b',
    models: ['llama2', 'mistral', 'deepseek-r1:7b']
  },
  openai: {
    defaultModel: 'gpt-3.5-turbo',
    models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
  }
};

// Authentication Component
interface User {
  id: string;
  email: string;
  displayName: string;
}

const AuthSection = ({ 
  isLoggedIn, 
  user, 
  onLogin, 
  onLogout 
}: { 
  isLoggedIn: boolean, 
  user: User | null, 
  onLogin: () => void, 
  onLogout: () => void 
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Insightly</h1>
        </div>
        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-gray-800 font-medium">
                  {user?.displayName || 'User'}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200"
              >
                <LogOut className="w-5 h-5 inline-block mr-2" />
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogin}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <LogIn className="w-6 h-6 inline-block mr-2" />
              Login with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

function App() {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<keyof typeof PROVIDERS_CONFIG>('ollama');
  const [model, setModel] = useState(PROVIDERS_CONFIG.ollama.defaultModel);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const backendUrl = useMemo(() => {
    // Computation happens only once
    const url = import.meta.env.NODE_ENV === 'production'
      ? import.meta.env.VITE_BACKEND_URL
      : import.meta.env.VITE_BACKEND_DEV_URL;
    
    // Log only once in development
    if (import.meta.env.DEV) {
      console.log('Backend URL:', url);
    }
    
    return url;
  }, []); // Empty dependency array

  const frontendUrl = useMemo(() => {
    // Computation happens only once
    const url = import.meta.env.NODE_ENV === 'production'
      ? import.meta.env.VITE_FRONTEND_URL
      : import.meta.env.VITE_FRONTEND_DEV_URL;
    
    // Log only once in development
    if (import.meta.env.DEV) {
      console.log('Frontend URL:', url);
    }
    
    return url;
  }, []); // Empty dependency array

  // Update model when provider changes
  useEffect(() => {
    setModel(PROVIDERS_CONFIG[provider].defaultModel);
  }, [provider]);

  const checkLoginStatus = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        console.log('No token found');
        setIsLoggedIn(false);
        setUser(null);
        return;
      }

      const response = await fetch(`${backendUrl}/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setIsLoggedIn(true);
        setUser({
          id: userData.user.id,
          email: userData.user.email,
          displayName: userData.user.displayName
        });
      } else {
        console.log('Not authenticated');
        localStorage.removeItem('jwt_token');
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to check login status', error);
      localStorage.removeItem('jwt_token');
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  useEffect(() => {
    // Check for token in URL on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
      // Store token in localStorage
      localStorage.setItem('jwt_token', tokenFromUrl);
      // Remove token from URL to prevent reuse
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    checkLoginStatus();
  }, []);

  const handleGoogleLogin = () => {
    // Use full backend URL for Google login
    const backendLoginUrl = `${backendUrl}/auth/google`;
    window.location.href = backendLoginUrl;
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${backendUrl}/logout`, { method: 'GET' });
      if (response.ok) {
        localStorage.removeItem('jwt_token');
        setIsLoggedIn(false);
        setUser(null);
        window.location.href = `${frontendUrl}`; // Redirect to home page
      }
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session_id');
  
    if (sessionId) {
      const verifyPayment = async () => {
        const response = await fetch(`${backendUrl}/api/verify-session/${sessionId}`);
        const result = await response.json();
        
        setPaymentStatus(result.success 
          ? `Added ${result.queryCount} credits` 
          : 'Payment verification failed'
        );

        setShowNotification(true);
        
        // Auto-dismiss notification after 5 seconds
        const timer = setTimeout(() => {
          setShowNotification(false);
        }, 5000);

        return () => clearTimeout(timer);
      };
  
      verifyPayment();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    setReport('');

    try {
      let processUrlEndpoint = '';
      
      // Detect URL type
      const appStoreMatch = url.match(/https?:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^/]+\/id(\d+)/);
      const googlePlayMatch = url.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?id=([^&]+)/);
      
      if (appStoreMatch) {
        processUrlEndpoint = `${backendUrl}/app-store/process-url`;
      } else if (googlePlayMatch) {
        processUrlEndpoint = `${backendUrl}/google-play/process-url`;
      } else {
        throw new Error('Unsupported app store URL');
      }

      // Process URL
      const processResponse = await fetch(processUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url }),
        signal: abortControllerRef.current.signal
      });

      if (!processResponse.ok) {
        throw new Error(`Failed to process URL: ${processUrlEndpoint}`);
      }

      const data = await processResponse.json();
      setAppData(data);

      // Prepare data for analysis
      const analysisResponse = await fetch(`${backendUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          provider,
          model: model || undefined,
          appData: data
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
              //console.log('Updated report:', fullReport);
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError, 'Raw line:', line);
          }
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request canceled');
      } else {
        console.error('Error:', err);
        setError(err.message || 'Failed to analyze the app. Please try again.');
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

  const handleDownload = () => {
    if (!report) return;
    
    try {
      const blob = new Blob([report], { type: 'text/markdown' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'app-review-analysis.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download the report. Please try again.');
    }
  };

  const downloadReviews = () => {
    if (!appData?.reviews?.reviews) {
      setError('No reviews available to download');
      return;
    }

    // Prepare CSV
    const csvHeader = 'Date,Score,User,Review\n';
    const csvContent = appData.reviews.reviews.map(review => 
      `"${review.date || ''}","${review.score || 0}","${(review.userName || 'Anonymous').replace(/"/g, '""')}","${(review.text || '').replace(/"/g, '""')}"`)
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
  };

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

  const PaymentNotification = () => {
    return (
      <div 
        className={`
          fixed top-4 right-4 z-50 
          transition-all duration-300 ease-in-out
          ${showNotification 
            ? 'opacity-100 translate-x-0' 
            : 'opacity-0 translate-x-full'
          }
        `}
      >
        <div className="
          bg-gradient-to-r from-green-400 to-green-600 
          text-white 
          px-6 py-4 
          rounded-lg 
          shadow-2xl 
          flex 
          items-center 
          space-x-4
        ">
          <CheckCircle2 className="w-6 h-6" />
          <div>
            <p className="font-semibold">{paymentStatus}</p>
            <p className="text-sm opacity-75">Your account has been credited successfully</p>
          </div>
          <button 
            onClick={() => setShowNotification(false)}
            className="ml-4 hover:bg-green-500 rounded-full p-1 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const StripeCheckoutButton = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [error, setError] = useState(null);

    // Ensure Stripe key is loaded correctly
    const stripePromise = () => {
      const key = 
      import.meta.env.MODE === 'production'
        ? import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
        : import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY;
    
      return key ? loadStripe(key) : null;
    };

    const creditPackages = [
      { 
        name: 'Starter', 
        queries: 10, 
        price: 5, 
        recommended: false,
        description: 'Perfect for occasional users' 
      },
      { 
        name: 'Pro', 
        queries: 25, 
        price: 10, 
        recommended: true,
        description: 'Best value for regular users' 
      },
      { 
        name: 'Enterprise', 
        queries: 50, 
        price: 20, 
        recommended: false,
        description: 'Ideal for power users' 
      }
    ];

    const handleCheckout = async (packageDetails) => {
      try {
        // Validate Stripe is initialized
        if (!stripePromise()) {
          throw new Error('Stripe is not properly initialized');
        }

        const response = await fetch(`${backendUrl}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ queryCount: packageDetails.queries })
        });

        // Check if response is OK
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${errorText}`);
        }

        const { sessionId } = await response.json();
        const stripe = await stripePromise();
        
        const { error } = await stripe.redirectToCheckout({ sessionId });
        
        if (error) {
          setError(error.message);
          console.error('Checkout failed', error);
        }
      } catch (error) {
        setError(error.message);
        console.error('Purchase failed', error);
      }
    };

    return (
      <div className="w-full max-w-4xl mx-auto mt-6 px-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-600 to-blue-400 
                     p-6 flex items-center justify-between 
                     text-white cursor-pointer hover:opacity-90 
                     transition-opacity duration-300"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center space-x-4">
              <CreditCard className="w-8 h-8" />
              <h2 className="text-xl font-bold">
                Purchase Query Credits
              </h2>
            </div>
            <ChevronDown 
              className={`w-6 h-6 transform transition-transform duration-300 
                          ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </div>

          {isExpanded && (
            <div className="p-6 space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {creditPackages.map((pkg) => (
                  <div 
                    key={pkg.queries}
                    className={`
                      border rounded-xl p-5 transition-all duration-300 
                      hover:shadow-lg cursor-pointer relative
                      ${pkg.recommended 
                        ? 'border-blue-500 bg-blue-50 scale-105 z-10' 
                        : 'border-gray-200 hover:border-blue-300'
                      }
                    `}
                    onClick={() => handleCheckout(pkg)}
                  >
                    {pkg.recommended && (
                      <span className="absolute top-2 right-2 text-xs bg-blue-500 
                                       text-white px-2 py-1 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-gray-800 mb-2">
                        {pkg.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {pkg.description}
                      </p>
                      <div className="mb-4">
                        <p className="text-3xl font-bold text-blue-600">
                          ${pkg.price}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${(pkg.price / pkg.queries).toFixed(2)} per query
                        </p>
                      </div>
                      <div className="text-gray-700">
                        <strong>{pkg.queries}</strong> Query Credits
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-gray-500 mt-4">
                Secure checkout powered by <span className="font-semibold">Stripe</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 relative">
      <AuthSection 
        isLoggedIn={isLoggedIn}
        user={user}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />
      <main className="pt-20 max-w-4xl mx-auto px-4 py-12">
        <PaymentNotification />
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            App Review Analyzer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Gain deep insights into your app's performance and user sentiment
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-12">
          <div className="flex gap-4 mb-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter App Store or Google Play URL"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
            {loading ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                Analyze
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-red-600">{error}</p>
          )}
        </form>

        {report && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <button 
                onClick={handleDownload} 
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
              {appData?.reviews?.reviews && (
                <button 
                  onClick={downloadReviews} 
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
                >
                  <Download className="mr-2" /> Download Reviews
                </button>
              )}
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </div>
        )}
        
        <div className="border-t border-gray-200 my-8"></div>
        
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Try a Demo Report</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {demoApps.map((app) => (
                <button
                  key={app.name}
                  onClick={() => setUrl(app.placeholder)}
                  className="p-4 rounded-lg border transition-all hover:bg-gray-200"
                >
                  <h3 className="font-semibold">{app.name}</h3>
                  <p className="text-sm mt-2">{app.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <StripeCheckoutButton />
      </main>
    </div>
  );
}

export default App;