import React, { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { SERVER_URL } from './Constants';

// Add URL configuration using environment variables

interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  photo: string;
  provider: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthCheckComplete: boolean;
  isLoggingOut: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  // Combined token processing and user setup
  useEffect(() => {
    console.log('AuthContext: Starting auth check...');
    setIsLoggingOut(false);
    setIsAuthCheckComplete(false);

    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get('token');
    const storedToken = localStorage.getItem('jwt_token');

    // Process token and set up user
    const processToken = async (tokenToUse: string) => {
      try {
        const decoded: any = jwtDecode(tokenToUse);
        const photoUrl = decoded.photo || (decoded.photos?.[0]?.value);

        setToken(tokenToUse);
        setUser({
          id: decoded.id || decoded.sub,
          displayName: decoded.displayName,
          email: decoded.email,
          photo: photoUrl,
          provider: decoded.provider,
        });
      } catch (error) {
        console.error('Failed to process token:', error);
        localStorage.removeItem('jwt_token');
        setToken(null);
        setUser(null);
      }
      setIsAuthCheckComplete(true);
    };

    if (tokenParam) {
      // New login
      console.log('AuthContext: Processing new token from URL');
      localStorage.setItem('jwt_token', tokenParam);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + url.search);
      processToken(tokenParam);
    } else if (storedToken) {
      // Existing session
      console.log('AuthContext: Processing stored token');
      processToken(storedToken);
    } else {
      // No auth
      console.log('AuthContext: No token found');
      setToken(null);
      setUser(null);
      setIsAuthCheckComplete(true);
    }
  }, []);

  // Handle redirect after auth is complete
  useEffect(() => {
    if (isAuthCheckComplete && user) {
      const redirectPath = localStorage.getItem('redirectAfterLogin');
      if (redirectPath && window.location.pathname !== redirectPath) {
        console.log('AuthContext: Auth complete, redirecting to:', redirectPath);
        localStorage.removeItem('redirectAfterLogin');
        window.location.replace(redirectPath);
      } else if (redirectPath) {
        localStorage.removeItem('redirectAfterLogin');
      }
    }
  }, [isAuthCheckComplete, user]);

  const login = () => {
    console.log('AuthContext: Initiating Google login...');
    const currentRedirect = localStorage.getItem('redirectAfterLogin');
    console.log('AuthContext: Current redirect path:', currentRedirect);
    window.location.href = `${SERVER_URL}/auth/google`;
  };

  const logout = async () => {
    try {
      // 1. Mark logout in progress first
      setIsLoggingOut(true);
      setIsAuthCheckComplete(false);  // Reset auth check state

      // 2. Clear all state
      localStorage.removeItem('jwt_token');
      setToken(null);
      setUser(null);

      // 3. Call server logout
      const response = await fetch(`${SERVER_URL}/auth/logout`, {
        method: 'GET',
        credentials: 'include'  // Add this to ensure cookies are sent
      });

      // 4. Navigate to home
      if (response.ok) {
        window.location.replace("/");
      } else {
        console.error('Logout failed:', response.statusText);
        window.location.replace("/");
      }
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.replace("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthCheckComplete, isLoggingOut, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
