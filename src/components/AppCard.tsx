import React, { useState } from 'react';
import { Clock, Link as LinkIcon, Star, AlertCircle } from 'lucide-react';

interface AppCardProps {
  title: string;
  description: string;
  developer: string;
  icon: string;
  url: string;
  shareLink: string;
  platform: string;
  reviewsSummary: {
    totalReviews: number;
    averageRating: number;
    scoreDistribution: Record<string, number>;
  };
  analysisDate: string;
}

const AppCard: React.FC<AppCardProps> = ({
  title,
  description,
  developer,
  icon,
  shareLink,
  platform,
  reviewsSummary,
  analysisDate,
}) => {
  const [hasImageError, setHasImageError] = useState(false);

  const handleImageError = () => {
    setHasImageError(true);
  };

  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl transform hover:-translate-y-2">
      <div className="p-6">
        <div className="flex items-center mb-4">
          {hasImageError ? (
            <div className="w-12 h-12 rounded-lg mr-4 flex items-center justify-center bg-gray-100">
              <AlertCircle className="text-gray-500" />
            </div>
          ) : (
            <img
              src={icon || 'https://via.placeholder.com/50'}
              alt={`${title} icon`}
              className="w-12 h-12 rounded-lg mr-4 object-cover"
              onError={handleImageError}
              loading="lazy"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="text-xl font-semibold text-gray-800 mr-2">
                {title}
              </h3>
            </div>
            <p className="text-sm text-gray-500">
              {developer}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Clock className="mr-2 text-blue-500" size={16} />
            {new Date(analysisDate).toLocaleDateString()}
          </div>
          <div className="flex items-center">
            <Star className="mr-2 text-yellow-500" size={16} />
            {reviewsSummary.averageRating.toFixed(1)}
          </div>
          <span className="px-2 py-1 rounded-full text-xs font-semibold uppercase bg-gray-200 text-gray-800 ml-2">
            {platform}
          </span>
        </div>

        <div className="mt-4 space-y-1">
          {Object.entries(reviewsSummary.scoreDistribution || {})
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
            .map(([score, count]) => (
              <div key={score} className="flex items-center space-x-2">
                <div className="w-6 text-xs text-gray-600 text-right">{score}★</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      parseInt(score) >= 4
                        ? 'bg-green-500'
                        : parseInt(score) >= 2
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${count > 0
                        ? Math.min((count / (reviewsSummary.totalReviews || 1)) * 100, 100)
                        : 0}%`
                    }}
                  />
                </div>
                <div className="w-8 text-xs text-gray-600 text-left">{count}</div>
              </div>
            ))
          }
        </div>

        <div className="mt-4 flex items-center">
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <LinkIcon className="mr-2" size={16} />
            View Report
          </a>
        </div>
      </div>
    </div>
  );
};

export default AppCard;
