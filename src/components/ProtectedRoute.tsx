import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PROTECTED_ROUTES_ENABLED } from './Constants';
import { lazyPage } from '../utils/lazyPage';

// Shared with App.tsx (the /login route and route preloading).
export const AuthInterstitialPage = lazyPage(() => import('../pages/AuthInterstitial'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthCheckComplete, isLoggingOut } = useAuth();

  const location = useLocation();

  // Debug logging
  console.log('ProtectedRoute:', {
    isProtectionEnabled: PROTECTED_ROUTES_ENABLED,
    user,
    isAuthCheckComplete,
    currentPath: location.pathname
  });

  // Heading for the in-place sign-in view (matches the prerendered /app HTML).
  const signInHeading = location.pathname === '/app' ? 'Analyze my app ($1)' : undefined;

  // Don't make any decisions until we've completed the initial auth check.
  // With no token at all the answer is already known, so show the sign-in
  // view straight away instead of an empty first frame.
  if (!isAuthCheckComplete) {
    const maybeLoggedIn = localStorage.getItem('jwt_token') || new URLSearchParams(location.search).has('token');
    if (PROTECTED_ROUTES_ENABLED && !maybeLoggedIn) {
      if (!localStorage.getItem('redirectAfterLogin')) {
        localStorage.setItem('redirectAfterLogin', location.pathname);
      }
      return <AuthInterstitialPage heading={signInHeading} />;
    }
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

    // Render the sign-in interstitial in place instead of navigating away.
    // Until 2026-10-01 login() sent visitors straight to Google OAuth, so
    // Googlebot rendering /app landed on Google's sign-in page, which carries
    // <meta name="robots" content="noindex, nofollow">: that is the "Excluded
    // by noindex" for /app in Search Console. Since then it redirected to
    // /login, which is still a redirect. Now the URL stays /app and has its
    // own indexable content.
    return <AuthInterstitialPage heading={signInHeading} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
