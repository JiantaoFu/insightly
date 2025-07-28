import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import Navigation from '../components/Navigation';
import ManageSubscriptionButton from '../components/ManageSubscriptionButton';
import { SERVER_URL } from '../components/Constants';

const AccountPage: React.FC = () => {
  const { user, token } = useAuth();
  const [subscription, setSubscription] = useState<{
    hasActiveSubscription: boolean;
    statuses: string[];
    count: number;
    scheduledForCancellation?: { status: string; periodEnd: string }[];
  }>({ hasActiveSubscription: false, statuses: [], count: 0, scheduledForCancellation: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) {
      setIsLoading(false);
      return;
    }

    const fetchSubscriptionStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${SERVER_URL}/api/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch subscription status');
        }
        const data = await response.json();
        setSubscription({
          hasActiveSubscription: data.hasActiveSubscription,
          statuses: Array.isArray(data.statuses) ? data.statuses : [],
          count: typeof data.count === 'number' ? data.count : 0,
          scheduledForCancellation: Array.isArray(data.scheduledForCancellation) ? data.scheduledForCancellation : [],
        });
      } catch (error) {
        console.error("Error fetching subscription status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [user, token]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto py-12 px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Please log in to view your account.</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="flex items-center space-x-6 mb-8">
            <img
              className="h-24 w-24 rounded-full"
              src={user.photo || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
              alt="User profile"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.displayName}</h1>
              <p className="text-lg text-gray-600">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Subscription</h2>
            {isLoading ? (
              <p className="text-gray-500">Loading subscription details...</p>
            ) : subscription.hasActiveSubscription ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-700">
                        You have <span className="font-bold text-green-700">{subscription.count}</span> active/trialing/scheduled subscription{subscription.count > 1 ? 's' : ''}:
                        <ul className="list-disc ml-6 mt-2">
                          {subscription.statuses.map((status, idx) => (
                            <li key={idx} className={`font-semibold capitalize ${status === 'scheduled_for_cancellation' ? 'text-yellow-600' : 'text-green-600'}`}>{
                              status === 'scheduled_for_cancellation'
                                ? 'Scheduled for cancellation'
                                : status
                            }</li>
                          ))}
                        </ul>
                        {subscription.scheduledForCancellation && subscription.scheduledForCancellation.length > 0 && (
                          <div className="mt-2">
                            {subscription.scheduledForCancellation.map((sub, idx) => (
                              <p key={idx} className="text-sm text-yellow-700">
                                Your subscription is scheduled to end on{' '}
                                <span className="font-semibold">{sub.periodEnd ? new Date(sub.periodEnd).toLocaleString() : 'unknown date'}</span>.
                              </p>
                            ))}
                          </div>
                        )}
                      </p>
                      {subscription.count > 1 && (
                        <p className="text-sm text-yellow-600 mt-2">Note: You have multiple subscriptions. Please contact support if this is unexpected.</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">Manage your billing details and view invoices on Stripe.</p>
                    </div>
                    <ManageSubscriptionButton />
                  </div>
                </div>
              ) : (
                <p className="text-gray-700">You do not have an active subscription.</p>
              )
            }
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountPage;