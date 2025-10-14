import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { AppReportView, CompetitorReportView } from './components/ShareReportView';
import { ChatBox } from './components/ChatBox';  // Change import path
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { CreditsProvider } from './contexts/CreditsContext';


// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const AppInsightsPage = lazy(() => import('./pages/AppInsightsPage'));
const CompetitorAnalysis = lazy(() => import('./components/CompetitorAnalysis'));
const MainAnalysis = lazy(() => import('./components/MainAnalysis'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const BlogListPage = lazy(() => import('./pages/BlogListPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));

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