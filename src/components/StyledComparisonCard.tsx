import React from 'react';
import { Globe } from 'lucide-react';

const StyledComparisonCard = ({ competitor, index }) => {
  return (
    <div 
    key={index} 
    className="bg-white shadow-lg rounded-xl p-6 mb-6 transform transition-all duration-300 hover:scale-[1.02]"
  >
    {/* Competitor Header */}
    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
      <img 
        src={competitor.logo} 
        className="w-16 h-16 rounded-full border-4 border-indigo-100 object-cover"
      />
      <div className="text-center sm:text-left w-full">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center justify-center sm:justify-start">
          {competitor.name}
          <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
            {competitor.platform.toUpperCase()}
          </span>
        </h3>
        <div className="flex items-center justify-center sm:justify-start space-x-2 text-sm text-gray-600 mt-1">
          <span className="font-medium">{competitor.developer}</span>
        </div>
        <a 
          href={competitor.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline flex items-center justify-center sm:justify-start space-x-1 text-sm sm:text-base mt-1"
        >
          <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="truncate max-w-[200px]">{competitor.url}</span>
        </a>
      </div>
    </div>

    {/* Competitor Description */}
    <p className="text-xs sm:text-sm text-gray-600 mb-4 text-center sm:text-left line-clamp-3">
      {competitor.description}
    </p>
  </div>
  );
};

export default StyledComparisonCard;