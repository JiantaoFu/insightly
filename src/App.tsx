import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute, { AuthInterstitialPage as AuthInterstitial } from './components/ProtectedRoute';
import { CreditsProvider } from './contexts/CreditsContext';
// Only the home page ships in the main bundle. Every other route is a
// lazyPage() chunk; main.tsx preloads the current route's chunk before the
// first render (see preloadRoute below), so prerendered HTML from
// netlify/edge-functions/prerender.ts is replaced in one step with no
// Suspense spinner in between.
import Home from './pages/Home';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import { Link, matchPath } from 'react-router-dom';
import { lazyPage } from './utils/lazyPage';

const TeamsLandingPage = lazyPage(() => import('./pages/TeamsLandingPage'));
const AppReportView = lazyPage(() => import('./components/ShareReportView').then(m => ({ default: m.AppReportView })));
const CompetitorReportView = lazyPage(() => import('./components/ShareReportView').then(m => ({ default: m.CompetitorReportView })));
const AppInsightsPage = lazyPage(() => import('./pages/AppInsightsPage'));
const BlogListPage = lazyPage(() => import('./pages/BlogListPage'));
const BlogPostPage = lazyPage(() => import('./pages/BlogPostPage'));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'));
const ExtensionPage = lazyPage(() => import('./pages/ExtensionPage'));
const TermsPage = lazyPage(() => import('./pages/TermsPage'));
const RefundPage = lazyPage(() => import('./pages/RefundPage'));
const CompetitorAnalysis = lazyPage(() => import('./components/CompetitorAnalysis'));
const MainAnalysis = lazyPage(() => import('./components/MainAnalysis'));
const PaymentSuccess = lazyPage(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazyPage(() => import('./pages/PaymentCancel'));
const AccountPage = lazyPage(() => import('./pages/AccountPage'));
// ChatBox has a named (not default) export, so wrap the dynamic import.
const ChatBox = lazyPage(() => import('./components/ChatBox').then(m => ({ default: m.ChatBox })));

// path -> page chunk(s) to preload before the first render. Keep in sync with <Routes>.
const PRELOAD: [string, { preload: () => Promise<unknown> }[]][] = [
  ['/for-teams', [TeamsLandingPage]],
  ['/app', [MainAnalysis, AuthInterstitial]],
  ['/shared-app-report/:shareId', [AppReportView]],
  ['/share/:shareId', [AppReportView]],
  ['/shared-competitor-report/:shareId', [CompetitorReportView]],
  ['/app-insights', [AppInsightsPage]],
  ['/competitor-insights', [CompetitorAnalysis, AuthInterstitial]],
  ['/chat', [ChatBox, AuthInterstitial]],
  ['/payment-success', [PaymentSuccess]],
  ['/payment-cancel', [PaymentCancel]],
  ['/account', [AccountPage]],
  ['/blog', [BlogListPage]],
  ['/blog/:slug', [BlogPostPage]],
  ['/privacy', [PrivacyPage]],
  ['/login', [AuthInterstitial]],
  ['/extension', [ExtensionPage]],
  ['/terms', [TermsPage]],
  ['/refund', [RefundPage]],
];

/** Resolve once the chunk(s) for `pathname` are loaded (never rejects). */
export function preloadRoute(pathname: string): Promise<unknown> {
  const hit = PRELOAD.find(([pattern]) => matchPath(pattern, pathname));
  if (!hit) return Promise.resolve();
  return Promise.all(hit[1].map(p => p.preload())).catch(() => undefined);
}

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

// Friendly client-side 404. Netlify serves the app shell with HTTP 404 for
// unknown URLs (see netlify.toml); this renders something useful in it.
const NotFound: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <Navigation />
    <div className="flex flex-col items-center justify-center px-4 pt-32 pb-16 text-center">
      <h1 className="text-6xl font-extrabold text-gray-900 mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">
        This page doesn't exist. Let's get you back on track.
      </p>
      <Link
        to="/"
        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Back to Home
      </Link>
    </div>
    <Footer />
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CreditsProvider>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/for-teams" element={<TeamsLandingPage />} />
              <Route path="/app" element={
                <ProtectedRoute>
                  <MainAnalysis />
                </ProtectedRoute>
              } />
              <Route path="/shared-app-report/:shareId" element={<AppReportView/>} />
              {/* Legacy (pre-Feb-2025) app report URL; still in Google's index. */}
              <Route path="/share/:shareId" element={<AppReportView/>} />
              <Route path="/shared-competitor-report/:shareId" element={<CompetitorReportView/>} />
              <Route path="/app-insights" element={<AppInsightsPage />} />
              <Route path="/competitor-insights" element={
                <ProtectedRoute>
                  <CompetitorAnalysis />
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <ChatBox />
                </ProtectedRoute>
              } />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/payment-cancel" element={<PaymentCancel />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/login" element={<AuthInterstitial />} />
              <Route path="/extension" element={<ExtensionPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refund" element={<RefundPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </CreditsProvider>
    </AuthProvider>
  );
};

export default App;