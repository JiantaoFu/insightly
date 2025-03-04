import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

interface ShareComponentProps {
  generateShareLink: () => Promise<string | null>;
  title?: string;
  description?: string;
  shareType: 'app' | 'competitor';
}

const ShareComponent: React.FC<ShareComponentProps> = ({ 
  generateShareLink, 
  title = 'Insightly Analysis', 
  description = 'AI-powered insights', 
  shareType 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Truncate text for Twitter's character limit
  const truncateForTwitter = (text: string, maxLength: number = 280) => {
    const baseText = `${title}: ${description}`;
    const linkLength = (shareLink || '').length + 1; // +1 for space
    const availableLength = maxLength - linkLength - baseText.length;
    
    return availableLength > 0 
      ? `${baseText} ${shareLink || ''}` 
      : `${baseText.slice(0, availableLength)}... ${shareLink || ''}`;
  };

  const handleGenerateShareLink = async () => {
    setIsLoading(true);
    setError(null);
    setShareLink(null);

    try {
      const link = await generateShareLink();
      if (link) {
        setShareLink(link);
      } else {
        throw new Error('No share link generated');
      }
    } catch (err) {
      console.error(`Error generating ${shareType} report share link:`, err);
      setError('Failed to generate share link');
      setShareLink(null);
    } finally {
      setIsLoading(false);
    }
  };

  const socialShareLinks = [
    {
      name: 'Copy Link',
      icon: copied ? Check : Copy,
      action: () => shareLink && copyToClipboard(shareLink),
      color: copied ? '#10B981' : '#6B7280', // Green when copied, gray otherwise
      disabled: !shareLink || isLoading
    },
    {
      name: 'X',
      url: shareLink ? `https://x.com/intent/tweet?text=${encodeURIComponent(truncateForTwitter(description))}` : '',
      svgPath: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H1.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153zm-1.273 19.663h2.034L6.008 3.24H3.792L17.628 20.816z',
      color: '#000000', // X's black color
      disabled: !shareLink || isLoading
    },
    {
      name: 'LinkedIn',
      url: shareLink ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}` : '',
      svgPath: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
      color: '#0077B5',
      disabled: !shareLink || isLoading
    },
    {
      name: 'Facebook',
      url: shareLink ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}` : '',
      svgPath: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
      color: '#1877F2',
      disabled: !shareLink || isLoading
    },
    {
      name: 'WhatsApp',
      url: shareLink ? `https://wa.me/?text=${encodeURIComponent(`${title}: ${description} ${shareLink}`)}` : '',
      svgPath: 'M17.472 14.382c-.297-.15-1.758-.867-2.03-.967-.272-.1-.47-.15-.669.15-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.608.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.075-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.511-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.002 5.45-4.436 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
      color: '#25D366',
      disabled: !shareLink || isLoading
    },
    {
      name: 'Telegram',
      url: shareLink ? `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(`${title}: ${description}`)}` : '',
      svgPath: 'M23.91 3.79L20.3 20.84c-.25 1.21-1.02 1.51-2.07.94l-5.5-4.07-2.66 2.57c-.29.29-.53.54-1.09.54-.71 0-.59-.27-.84-.95L6.3 13.7l-5.45-1.7c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.43 1.9.24 1.53 1.73z',
      color: '#2CA5E0',
      disabled: !shareLink || isLoading
    }
  ];

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!shareLink) handleGenerateShareLink();
        }}
        className="w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
      >
        <Share2 size={20} className="mr-2" />
        Share {shareType === 'app' ? 'Analysis' : 'Comparison'}
      </button>
      
      {isOpen && (
        <div 
          className="absolute top-full left-1/2 mt-2 bg-white shadow-lg rounded-lg p-4 w-screen max-w-xs z-50 
                     transform -translate-x-1/2 sm:translate-x-0 sm:right-auto sm:left-0"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 place-items-center">
            {socialShareLinks.map((link) => {
              // For Copy Link
              if (link.name === 'Copy Link') {
                return (
                  <button
                    key={link.name}
                    onClick={() => link.action()}
                    className={`flex flex-col items-center justify-center hover:bg-gray-100 p-2 rounded-lg transition-colors relative 
                      ${link.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={copied ? 'Copied!' : 'Copy Link'}
                    disabled={link.disabled}
                  >
                    <link.icon className="w-6 h-6" color={link.color} />
                    <span className="text-xs mt-1">
                      {copied ? 'Copied!' : 'Copy Link'}
                    </span>
                  </button>
                );
              }
              
              // For social media links
              return (
                <a 
                  key={link.name}
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center hover:bg-gray-100 p-2 rounded-lg transition-colors 
                    ${link.disabled ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24"
                    fill={link.color}
                    className="w-6 h-6"
                  >
                    <path d={link.svgPath} />
                  </svg>
                  <span className="text-xs mt-1">{link.name}</span>
                </a>
              );
            })}
          </div>
          {isLoading && (
            <div className="text-gray-500 text-xs mt-2 text-center">
              Generating share link...
            </div>
          )}
          {error && (
            <div className="text-red-500 text-xs mt-2 text-center">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Existing ShareButton component
interface ShareButtonProps {
  url: string;
  title?: string;
  description?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ 
  url, 
  title = 'Insightly App Review Analysis', 
  description = 'Discover deep insights from app reviews using AI-powered analysis' 
}) => {
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  const generateAppShareLink = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/share-app-report`, {
        params: { url }
      });

      return response.data.shareLink || null;
    } catch (err) {
      console.error('Error generating app share link:', err);
      return null;
    }
  };

  return (
    <ShareComponent 
      generateShareLink={generateAppShareLink}
      title={title}
      description={description}
      shareType="app"
    />
  );
};

// New ShareCompetitorReportButton component
interface ShareCompetitorReportButtonProps {
  competitors: Array<{ url: string }>;
  title?: string;
  description?: string;
}

export const ShareCompetitorReportButton: React.FC<ShareCompetitorReportButtonProps> = ({ 
  competitors, 
  title = 'Insightly Competitor Analysis', 
  description = 'AI-powered comparative analysis of app competitors' 
}) => {
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  const generateCompetitorShareLink = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/share-competitor-report`, {
        params: { urls: JSON.stringify(competitors.map(c => c.url)) }
      });

      return response.data.shareLink || null;
    } catch (err) {
      console.error('Error generating competitor report share link:', err);
      return null;
    }
  };

  return (
    <ShareComponent
      generateShareLink={generateCompetitorShareLink}
      title={title}
      description={description}
      shareType="competitor"
    />
  );
};

export { ShareComponent };
export default ShareButton;