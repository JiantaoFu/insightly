import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Zap, 
  Home as HomeIcon, 
  BarChart2, 
  Rocket as RocketIcon,
  Menu,
  X,
  Microscope,
  Scale,
  Chrome
} from 'lucide-react';

// Navigation component props
interface NavigationProps {
  ctaButton?: {
    to: string;
    label: string;
    icon?: React.ElementType;
  };
}

const Navigation: React.FC<NavigationProps> = ({ 
  ctaButton = {
    to: '/app',
    label: 'Start Analyzing',
    icon: RocketIcon
  }
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Determine which links to show based on current route
  const renderDefaultLinks = () => {
    const links = [
      {
        to: '/',
        icon: HomeIcon,
        label: 'Home',
        className: 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-2'
      },
      {
        to: '/app',
        icon: RocketIcon,
        label: 'Start Analyzing',
        className: 'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300 flex items-center justify-center space-x-2 w-full'
      },
      {
        to: '/app-insights',
        icon: Microscope,
        label: 'Insights',
        className: 'group flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-300 ease-in-out'
      },
      {
        to: '/competitor-insights',
        icon: Scale,
        label: 'Competitors',
        className: 'group flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-300 ease-in-out'
      },
      {
        to: 'https://chromewebstore.google.com/detail/insightlytop-chrome-exten/jbhfbkkaffgfgjpipkpmgnbojjoajjka?hl=en',
        icon: Chrome,
        label: 'ChromeExtension',
        className: 'group flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-300 ease-in-out'
      }
    ];

    // Filter out the link matching the current route
    const filteredLinks = links.filter(link => link.to !== location.pathname);

    return filteredLinks.map((link, index) => (
      <Link 
        key={index}
        to={link.to}
        className={link.className}
      >
        {link.icon && <link.icon className="w-5 h-5 mr-2 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />}
        <span className="font-medium group-hover:text-blue-600">{link.label}</span>
      </Link>
    ));
  };

  const renderDesktopLinks = () => {
    if (location.pathname === '/analyzed-apps') return null;

    return (
      <>
        {renderDefaultLinks()}
      </>
    );
  };

  const renderMobileLinks = () => {
    if (location.pathname === '/analyzed-apps') return null;

    return (
      <>
        {renderDefaultLinks()}
      </>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Zap className="w-8 h-8 text-blue-600 mr-2" />
            <span className="text-xl font-bold text-gray-900">Insightly</span>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button 
              onClick={toggleMenu}
              className="text-gray-600 hover:text-blue-600 focus:outline-none"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {renderDesktopLinks()}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {renderMobileLinks()}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
