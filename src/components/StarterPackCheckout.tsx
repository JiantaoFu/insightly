import React, { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { SERVER_URL, PROTECTED_ROUTES_ENABLED } from './Constants';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

// You should set this in your .env file and expose it as VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

const StarterPackCheckout: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, login, token } = useAuth();
  const location = useLocation();

  const handleCheckout = useCallback(async () => {
    if (PROTECTED_ROUTES_ENABLED && !user) {
      // Save current path to redirect back after login
      localStorage.setItem('redirectAfterLogin', location.pathname);
      localStorage.setItem('postLoginAction', 'startCheckout');
      login();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Call your backend to create a checkout session
      const res = await fetch(`${SERVER_URL}/create-checkout-session`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!data.sessionId) throw new Error(data.error || 'No session ID returned');

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load');
      // Redirect to Stripe Checkout
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [user, token, login, location.pathname]);

  useEffect(() => {
    const postLoginAction = localStorage.getItem('postLoginAction');
    if (postLoginAction === 'startCheckout' && user) {
      // Clean up the flag to prevent re-triggering
      localStorage.removeItem('postLoginAction');
      handleCheckout(); // Automatically trigger checkout
    }
  }, [user, handleCheckout]);

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{ padding: '1em 2em', fontSize: '1.2em', borderRadius: 8, background: '#4f46e5', color: 'white', fontWeight: 600 }}
      >
        {loading ? 'Redirecting…' : 'Buy Starter Pack'}
      </button>
      {error && <div style={{ color: 'red', marginTop: '1em' }}>{error}</div>}
    </div>
  );
};

export default StarterPackCheckout;
