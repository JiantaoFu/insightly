import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SERVER_URL } from '../components/Constants';

interface CreditsContextType {
  credits: number | null;
  unlimited: boolean;
  loadingCredits: boolean;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credits, setCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);

  const refreshCredits = useCallback(async () => {
    setLoadingCredits(true);
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${SERVER_URL}/api/user-credits`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setUnlimited(!!data.unlimited);
      } else {
        setCredits(null);
        setUnlimited(false);
      }
    } catch (e) {
      setCredits(null);
      setUnlimited(false);
    } finally {
      setLoadingCredits(false);
    }
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  return (
    <CreditsContext.Provider value={{ credits, unlimited, loadingCredits, refreshCredits }}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = () => {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error('useCredits must be used within CreditsProvider');
  return ctx;
};
