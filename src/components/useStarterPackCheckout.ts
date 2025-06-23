import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PROTECTED_ROUTES_ENABLED } from './Constants';

export function useStarterPackCheckout() {
  const { user, login } = useAuth();
  const location = useLocation();
  return useCallback(() => {
    if (PROTECTED_ROUTES_ENABLED && !user) {
      localStorage.setItem('redirectAfterLogin', location.pathname);
      localStorage.setItem('postLoginAction', 'startCheckout');
      login();
      return;
    }
    // Try to find the checkout button on the page and click it
    const btn = document.querySelector('button[data-starterpack-checkout]') as HTMLButtonElement | null;
    if (btn) {
      btn.click();
    } else {
      // fallback: set flag and redirect to home where StarterPackCheckout is mounted
      localStorage.setItem('startCheckoutOnLoad', 'true');
      window.location.href = '/';
    }
  }, [user, login, location.pathname]);
}
