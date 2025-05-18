import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Zap,
  Home as HomeIcon,
  Rocket as RocketIcon,
  Menu,
  X,
  Microscope,
  Scale,
  Chrome,
  Globe,
  MessageCircle as MessageCircleIcon,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import UserMenu from './UserMenu';
import { PROTECTED_ROUTES } from './Constants';

interface NavLink {
  to: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}

const Navigation: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox' | 'other'>('other');
  const [showFeedback, setShowFeedback] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Just navigate, let ProtectedRoute handle protection
  const handleNavigation = (to: string) => {
    navigate(to);
  };

  useEffect(() => {
    // Detect browser type
    const detectBrowser = () => {
      const userAgent = navigator.userAgent.toLowerCase();

      if (userAgent.indexOf('chrome') > -1 && userAgent.indexOf('edge') === -1 && userAgent.indexOf('edg') === -1) {
        setBrowserType('chrome');
      } else if (userAgent.indexOf('firefox') > -1) {
        setBrowserType('firefox');
      } else {
        setBrowserType('other');
      }
    };

    detectBrowser();
  }, []);

  const mainLinks: NavLink[] = [
    {
      to: '/',
      icon: HomeIcon,
      label: 'Home',
    },
    {
      to: PROTECTED_ROUTES.ANALYZE,
      icon: RocketIcon,
      label: 'Start Analyzing',
      primary: true,
    },
    {
      to: '/app-insights',
      icon: Microscope,
      label: 'Insights',
    },
  ];

  const toolsLinks: NavLink[] = [
    {
      to: PROTECTED_ROUTES.COMPETITORS,
      icon: Scale,
      label: 'Competitors',
    },
    {
      to: PROTECTED_ROUTES.CHAT,
      icon: MessageCircleIcon,
      label: 'Chat Assistant',
    },
    ...(browserType === 'chrome' ? [{
      to: 'https://chromewebstore.google.com/detail/insightlytop-chrome-exten/jbhfbkkaffgfgjpipkpmgnbojjoajjka?hl=en',
      icon: Chrome,
      label: 'Chrome Extension',
    }] : browserType === 'firefox' ? [{
      to: 'https://addons.mozilla.org/en-US/firefox/addon/insightly-app-review-insights/',
      icon: Globe,
      label: 'Firefox Addon',
    }] : [])
  ];

  // Filter out current route from tools links
  const filteredToolsLinks = toolsLinks.filter(link => link.to !== location.pathname);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">Insightly</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Main Links */}
              <div className="flex items-center space-x-2">
                {mainLinks.map((link) => (
                  <button
                    key={link.to}
                    onClick={() => handleNavigation(link.to)}
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors duration-300 ${
                      link.primary
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    <link.icon className="w-5 h-5 mr-2" />
                    <span className="font-medium">{link.label}</span>
                  </button>
                ))}
              </div>

              {/* Tools Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  className="flex items-center px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-300"
                >
                  <span className="font-medium mr-1">Tools</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isToolsOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 py-2 bg-white rounded-lg shadow-lg border border-gray-100">
                    {filteredToolsLinks.map((link) => (
                      <button
                        key={link.to}
                        onClick={() => {
                          setIsToolsOpen(false);
                          if (link.to.startsWith('http')) {
                            window.open(link.to, '_blank');
                          } else {
                            handleNavigation(link.to);
                          }
                        }}
                        className="flex items-center px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 w-full"
                      >
                        <link.icon className="w-5 h-5 mr-2" />
                        <span className="font-medium">{link.label}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowFeedback(true);
                        setIsToolsOpen(false);
                      }}
                      className="flex items-center px-4 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 w-full"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      <span className="font-medium">Feedback</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <UserMenu />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-2 space-y-1">
              {[...mainLinks, ...filteredToolsLinks].map((link) => (
                <button
                  key={link.to}
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (link.to.startsWith('http')) {
                      window.open(link.to, '_blank');
                    } else {
                      handleNavigation(link.to);
                    }
                  }}
                  className={`flex items-center px-3 py-2 rounded-lg w-full ${
                    link.primary
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <link.icon className="w-5 h-5 mr-2" />
                  <span className="font-medium">{link.label}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setShowFeedback(true);
                  setIsMenuOpen(false);
                }}
                className="flex items-center px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 w-full"
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                <span className="font-medium">Feedback</span>
              </button>
              <div className="px-3 py-2">
                <UserMenu />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="relative max-h-[90vh] overflow-y-auto">
            <FeedbackForm onClose={() => setShowFeedback(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
