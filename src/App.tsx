import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { AppReportView, CompetitorReportView } from './components/ShareReportView';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { CreditsProvider } from './contexts/CreditsContext';
// Loaded eagerly (not lazy): Netlify's prerender crawler snapshots the page
// before async route chunks finish loading, so these SEO-critical pages were
// being captured with an empty #root and stale meta tags. Eager imports make
// the crawler see real content on /, /for-teams, /app-insights and /blog/*.
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';
import Home from './pages/Home';
import TeamsLandingPage from './pages/TeamsLandingPage';
import AppInsightsPage from './pages/AppInsightsPage';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import { Link } from 'react-router-dom';


// Lazy load pages
const CompetitorAnalysis = lazy(() => import('./components/CompetitorAnalysis'));
const MainAnalysis = lazy(() => import('./components/MainAnalysis'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
// ChatBox has a named (not default) export, so wrap the dynamic import.
const ChatBox = lazy(() => import('./components/ChatBox').then(m => ({ default: m.ChatBox })));

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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </CreditsProvider>
    </AuthProvider>
  );
};

export default App;