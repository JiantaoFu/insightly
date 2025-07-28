import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { SERVER_URL } from './Constants';

const ManageSubscriptionButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const handleManageSubscription = async () => {
    if (!token) {
      alert('You must be logged in to manage your subscription.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session.');
      }

      // Redirect the user to the Stripe Customer Portal
      window.location.href = data.url;
    } catch (error: any) {
      alert(`Error: ${error.message}`); // Simple error handling for demonstration
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleManageSubscription}
      disabled={loading}
      className="inline-block px-6 py-2 text-sm font-semibold text-white bg-gray-600 rounded-lg shadow-md hover:bg-gray-700 transition duration-300 ease-in-out disabled:opacity-50"
    >
      {loading ? 'Redirecting...' : 'Manage Subscription'}
    </button>
  );
};

export default ManageSubscriptionButton;