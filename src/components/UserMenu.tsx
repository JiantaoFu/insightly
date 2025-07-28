import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useCredits } from '../contexts/CreditsContext';
import { LogOut, ChevronDown } from 'lucide-react';

const UserMenu: React.FC = () => {
  const { credits, unlimited, loadingCredits } = useCredits();
  console.log('VITE_ENABLE_PROTECTED_ROUTES:', import.meta.env.VITE_ENABLE_PROTECTED_ROUTES, typeof import.meta.env.VITE_ENABLE_PROTECTED_ROUTES);

  // The environment variable might be coming as a string "false" instead of boolean false
  if (!import.meta.env.VITE_ENABLE_PROTECTED_ROUTES || import.meta.env.VITE_ENABLE_PROTECTED_ROUTES === "false") {
    return null;
  }

  const { user, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={login}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-300"
      >
        Login with Google
      </button>
    );
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-300"
        >
          {user.photo && (
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <img
                src={user.photo}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
          {/* Show credits next to avatar */}
          <span className="ml-2 text-sm text-blue-700 font-semibold">
            {loadingCredits
              ? '...'
              : unlimited
                ? 'Unlimited credits'
                : credits !== null && credits !== undefined
                  ? `${credits} credits`
                  : ''}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="font-semibold text-gray-800">{user.displayName || user.email}</div>
              {user.email && (
                <div className="text-xs text-gray-500">{user.email}</div>
              )}
            </div>
            <a
              href="/account"
              className="block px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors duration-200"
            >
              Account settings
            </a>
            <button
              onClick={logout}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 border-t border-gray-100"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default UserMenu;
