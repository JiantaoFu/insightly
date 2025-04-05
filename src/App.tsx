import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { AppReportView, CompetitorReportView } from './components/ShareReportView';
import { ChatBox } from './components/ChatBox';  // Change import path

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const AppInsightsPage = lazy(() => import('./pages/AppInsightsPage'));
const CompetitorAnalysis = lazy(() => import('./components/CompetitorAnalysis'));
const MainAnalysis = lazy(() => import('./components/MainAnalysis'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/app" element={<MainAnalysis />} />
          <Route path="/shared-app-report/:shareId" element={<AppReportView/>} />
          <Route path="/shared-competitor-report/:shareId" element={<CompetitorReportView/>} />
          <Route path="/app-insights" element={<AppInsightsPage />} />
          <Route path="/competitor-insights" element={<CompetitorAnalysis />} />
          <Route path="/chat" element={<ChatBox />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;