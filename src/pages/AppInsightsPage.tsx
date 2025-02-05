import React, { useState } from 'react';
import { BarChart2, Search } from 'lucide-react';
import CachedAnalysesList from '../components/CachedAnalysesList';
import { ProductHuntBadge } from '../components/ProductHuntBadge';
import Navigation from '../components/Navigation';

const AppInsightsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="container mx-auto px-4 py-12 pt-24">
      <Navigation />
      <div className="max-w-4xl mx-auto">
        {/* SEO-Friendly Title */}
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          Comprehensive App Analysis Archive
        </h1>

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

        {/* Analyses List */}
        <CachedAnalysesList 
          pageSize={12}
          searchTerm={searchTerm}
        />

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
    </div>
  );
};

export default AppInsightsPage;
