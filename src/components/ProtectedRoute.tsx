import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PROTECTED_ROUTES_ENABLED } from './Constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthCheckComplete, isLoggingOut, login } = useAuth();

  const location = useLocation();

  // Debug logging
  console.log('ProtectedRoute:', {
    isProtectionEnabled: PROTECTED_ROUTES_ENABLED,
    user,
    isAuthCheckComplete,
    currentPath: location.pathname
  });

  // Don't make any decisions until we've completed the initial auth check
  if (!isAuthCheckComplete) {
    console.log('ProtectedRoute: Waiting for auth check to complete...');
    return null;
  }

  if (isLoggingOut) {
    return null;
  }

  if (PROTECTED_ROUTES_ENABLED && !user) {
    console.log('ProtectedRoute: Route needs protection, current path:', location.pathname);

    // Only set redirect path if it's not already set
    if (!localStorage.getItem('redirectAfterLogin')) {
      console.log('ProtectedRoute: Setting redirect path:', location.pathname);
      localStorage.setItem('redirectAfterLogin', location.pathname);
    }

    // Trigger login without Navigate component
    login();
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
