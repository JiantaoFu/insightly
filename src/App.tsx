import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { AppReportView, CompetitorReportView } from './components/ShareReportView';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { CreditsProvider } from './contexts/CreditsContext';
// Loaded eagerly (not lazy): Netlify's prerender crawler snapshots the page
// before async route chunks finish loading, so these SEO-critical blog
// pages were being captured with an empty #root and stale meta tags.
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';


// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const TeamsLandingPage = lazy(() => import('./pages/TeamsLandingPage'));
const AppInsightsPage = lazy(() => import('./pages/AppInsightsPage'));
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
            </Routes>
          </Suspense>
        </Router>
      </CreditsProvider>
    </AuthProvider>
  );
};

export default App;