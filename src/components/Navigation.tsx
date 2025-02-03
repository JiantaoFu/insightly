import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Zap, 
  Home as HomeIcon, 
  BarChart2, 
  Rocket as RocketIcon,
  Menu,
  X
} from 'lucide-react';

// Define navigation item type
export interface NavigationItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

// Navigation component props
interface NavigationProps {
  items?: NavigationItem[];
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
  const renderDesktopLinks = () => {
    if (location.pathname === '/') {
      return (
        <Link 
          to={ctaButton.to} 
          className="
            bg-blue-600 text-white px-4 py-2 rounded-lg 
            hover:bg-blue-700 transition-colors duration-300
            flex items-center space-x-2 shadow-md hover:shadow-lg
          "
        >
          {ctaButton.icon && <ctaButton.icon className="w-5 h-5" />}
          <span>{ctaButton.label}</span>
        </Link>
      );
    } else if (location.pathname === '/app') {
      return (
        <Link 
          to="/" 
          className="
            group relative px-3 py-2 rounded-lg transition-colors duration-300
            text-gray-700 hover:text-blue-600 hover:bg-blue-50
            flex items-center space-x-2
          "
        >
          <HomeIcon className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span className="font-medium">Home</span>
        </Link>
      );
    }
    return null;
  };

  // Determine which links to show in mobile menu
  const renderMobileLinks = () => {
    if (location.pathname === '/') {
      return (
        <Link
          to={ctaButton.to}
          className="
            bg-blue-600 text-white px-4 py-2 rounded-lg 
            hover:bg-blue-700 transition-colors duration-300
            flex items-center justify-center space-x-2 w-full
          "
          onClick={toggleMenu}
        >
          {ctaButton.icon && <ctaButton.icon className="w-5 h-5" />}
          <span>{ctaButton.label}</span>
        </Link>
      );
    } else if (location.pathname === '/app') {
      return (
        <Link
          to="/"
          className="
            text-gray-700 hover:bg-blue-50 hover:text-blue-600
            block px-3 py-2 rounded-md text-base font-medium
            flex items-center space-x-2
          "
          onClick={toggleMenu}
        >
          <HomeIcon className="w-5 h-5 mr-2" />
          Home
        </Link>
      );
    }
    return null;
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
