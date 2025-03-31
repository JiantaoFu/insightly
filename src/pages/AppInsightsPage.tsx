import React, { useState } from 'react';
import { Search } from 'lucide-react';
import DBAnalysesList from '../components/DBAnalysesList';
import CachedComparisonsList from '../components/CachedComparisonsList';
import Navigation from '../components/Navigation';
import ProductHuntBadge from '../components/ProductHuntBadge';

const AppInsightsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('analyses');

  return (
    <div className="container mx-auto px-4 py-12 pt-24">
      <Navigation />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">
          Comprehensive App Analysis Archive
        </h1>
      </div>

      {/* Tab Switcher */}
      <div className="mb-8 flex justify-center">
        <button
          className={`px-4 py-2 mx-2 ${activeTab === 'analyses' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => setActiveTab('analyses')}
        >
          Individual App Analyses
        </button>
        <button
          className={`px-4 py-2 mx-2 ${activeTab === 'comparisons' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => setActiveTab('comparisons')}
        >
          App Comparisons
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-8 flex items-center">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search analyzed apps by name, developer, or category"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
        </div>
      </div>

      {/* Content Sections */}
        {activeTab === 'analyses' ? (
          <DBAnalysesList
            pageSize={15} // Increased for better user experience while maintaining performance
            searchTerm={searchTerm}
          />
        ) : (
          <CachedComparisonsList
            pageSize={8} // Slightly increased for a balanced view and performance
            searchTerm={searchTerm}
          />
        )}

        {/* SEO Description */}
      <div className="mt-12 text-center text-gray-600 mb-16">
        <p>
          Explore our comprehensive database of app analyses.
          We provide in-depth insights into app performance,
          user reviews, and developer reputation.
        </p>
      </div>
      <ProductHuntBadge />
    </div>
  );
};

export default AppInsightsPage;