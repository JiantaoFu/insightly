import React, { useEffect } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { updateMetadata } from '../utils/metadata';

// Privacy Policy — concise, plain-language, and accurate about what we collect.
// Last updated: September 29, 2026.
const PrivacyPage: React.FC = () => {
  useEffect(() => {
    updateMetadata(
      'Privacy Policy | Insightly',
      'How Insightly collects, uses, and protects your data — including Google account info, analytics, session replay, and Stripe payments.',
      { canonicalPath: '/privacy' }
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-10">Last updated: September 29, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">What we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account info:</strong> when you sign in with Google, we receive your name,
                email address, and profile photo. We use this to identify your account and credits.
              </li>
              <li>
                <strong>Usage data:</strong> the app links you submit for analysis and the reports
                we generate for you, so we can show your history and enforce credit limits.
              </li>
              <li>
                <strong>Payment info:</strong> processed by Stripe. We never see or store your full
                card number — Stripe handles that directly.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Analytics and session replay</h2>
            <p>
              We use <strong>Google Analytics 4</strong> to understand aggregate usage (page views,
              events). We use <strong>Amplitude</strong>, including its session-replay feature, on a
              sampled basis — currently about <strong>10% of sessions</strong> are recorded to help
              us find and fix usability problems. Replays capture on-page interactions; we do not use
              them for advertising, and we do not sell any data collected this way.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">What we don't do</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>We don't sell your personal data.</li>
              <li>We don't use your data for advertising.</li>
              <li>We don't share your Google account info with third parties except as needed to run the service (hosting, payments, analytics listed above).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your choices</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can request deletion of your account and associated data at any time via the in-app Feedback form.</li>
              <li>You can opt out of analytics by using a tracker blocker; the core product still works.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Contact</h2>
            <p>
              Questions about this policy? Reach us through the <strong>Feedback</strong> form in the
              app navigation menu.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPage;
