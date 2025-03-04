import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Review {
  id: string;
  text: string;
  score: number;
  userName: string;
  timestamp: string;
}

interface ReviewPreviewProps {
  reviews: Review[];
}

const ReviewPreview: React.FC<ReviewPreviewProps> = ({ reviews }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayReviews = isExpanded ? reviews : reviews.slice(0, 3);

  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star 
        key={index} 
        className={`h-4 w-4 ${index < score ? 'text-yellow-500' : 'text-gray-300'}`} 
        fill={index < score ? 'currentColor' : 'none'}
      />
    ));
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Customer Reviews ({reviews.length})
        </h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          {isExpanded ? (
            <>Collapse <ChevronUp className="ml-2" /></>
          ) : (
            <>View All <ChevronDown className="ml-2" /></>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {displayReviews.map((review) => (
          <div 
            key={review.id} 
            className="border-b pb-4 last:border-b-0"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex">
                {renderStars(review.score)}
              </div>
              <span className="text-sm text-gray-500">
                {review.userName} • {review.timestamp}
              </span>
            </div>
            <p className="text-gray-700">{review.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewPreview;