import React, { useEffect } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { updateMetadata } from '../utils/metadata';

// Refund Policy — matches how the product actually behaves: one-time Starter
// Pack credits, monthly subscriptions that can be canceled anytime.
// Last updated: September 29, 2026.
const RefundPage: React.FC = () => {
  useEffect(() => {
    updateMetadata(
      'Refund Policy | Insightly',
      'How refunds work at Insightly: Starter Pack credits and monthly subscriptions.',
      { canonicalPath: '/refund' }
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-gray-500 mb-10">Last updated: September 29, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Starter Pack (one-time purchase)</h2>
            <p>
              The $1 Starter Pack gives you one-time analysis credits. If you haven't used any of
              your credits, contact us within <strong>14 days of purchase</strong> and we'll refund
              you in full. Once credits have been consumed to generate reports, the purchase is
              non-refundable — but if a report failed to generate due to our error, we'll restore
              the credits or refund you, your choice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Subscriptions (Pro / Unlimited)</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can cancel anytime from your account page. Cancellation takes effect at the end of the current billing period — you keep full access until then.</li>
              <li>We don't offer prorated refunds for partial months, except where required by law.</li>
              <li>If you were charged after canceling, or charged twice by mistake, contact us and we'll fix it promptly.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">How to request a refund</h2>
            <p>
              Use the <strong>Feedback</strong> form in the app navigation menu and include the email
              address on your account. We aim to respond within 3 business days. Approved refunds go
              back to your original payment method via Stripe.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RefundPage;
