
import React, { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { SERVER_URL } from './Constants';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

const SubscriptionCheckoutButton: React.FC<{ priceId: string }> = ({ priceId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, login, token } = useAuth();
  const location = useLocation();

  const handleCheckout = useCallback(async () => {
    if (!user) {
      // Save current path to redirect back after login
      localStorage.setItem('redirectAfterLogin', location.pathname);
      localStorage.setItem('postLoginAction', 'startSubscriptionCheckout');
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
      const response = await fetch(`${SERVER_URL}/create-subscription-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ priceId }),
      });
      const session = await response.json();
      if (!response.ok || !session.sessionId) {
        throw new Error(session.error || 'Failed to create checkout session.');
      }
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load');
      await stripe.redirectToCheckout({ sessionId: session.sessionId });
    } catch (err: any) {
      setError(err.message || 'An error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  }, [user, token, login, location.pathname, priceId]);

  // Optionally auto-trigger after login
  React.useEffect(() => {
    const postLoginAction = localStorage.getItem('postLoginAction');
    if (postLoginAction === 'startSubscriptionCheckout' && user) {
      localStorage.removeItem('postLoginAction');
      handleCheckout();
    }
  }, [user, handleCheckout]);

  return (
    <>
      <button onClick={handleCheckout} disabled={loading} className="inline-block w-full py-3 px-6 text-center rounded-lg font-semibold shadow-md bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? 'Processing...' : 'Subscribe Now'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
    </>
  );
};

export default SubscriptionCheckoutButton;