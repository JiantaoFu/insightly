import React, { useEffect } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { updateMetadata } from '../utils/metadata';

// Terms of Service — standard SaaS terms, plain language.
// Last updated: September 29, 2026.
const TermsPage: React.FC = () => {
  useEffect(() => {
    updateMetadata(
      'Terms of Service | Insightly',
      'The terms governing your use of Insightly: accounts, credits, subscriptions, acceptable use, and liability.',
      { canonicalPath: '/terms' }
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-10">Last updated: September 29, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">1. The service</h2>
            <p>
              Insightly ("we", "us") provides AI-generated analyses of public app-store reviews.
              Reports are generated automatically and are provided for informational purposes — they
              are not professional business, legal, or investment advice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">2. Accounts</h2>
            <p>
              You sign in with a Google account. You are responsible for activity under your account.
              You must be at least 13 years old (or the minimum age in your jurisdiction) to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">3. Credits and subscriptions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Analyses consume credits. The Starter Pack is a one-time purchase; plans are billed monthly.</li>
              <li>Prices are shown at checkout in USD. You can cancel a subscription at any time from your account page; you keep access until the end of the current billing period.</li>
              <li>Refunds are handled under our <a href="/refund" className="text-blue-600 hover:underline">Refund Policy</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">4. Acceptable use</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Don't abuse the service: no scraping at abusive rates, no attempts to bypass credit limits, no interfering with other users.</li>
              <li>Don't submit app links in a way that violates the app stores' terms, and don't use reports to harass developers or reviewers.</li>
              <li>We may suspend accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">5. Intellectual property</h2>
            <p>
              The reports we generate for you are yours to use, including commercially. The
              Insightly site, branding, and underlying software remain ours. Review excerpts shown in
              reports belong to their original authors and the respective app stores.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">6. Disclaimer and liability</h2>
            <p>
              The service is provided "as is", without warranties of any kind. AI-generated content
              can be inaccurate or incomplete — verify important findings independently. To the maximum
              extent permitted by law, our liability is limited to the amount you paid us in the 12
              months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">7. Changes</h2>
            <p>
              We may update these terms; material changes will be noted here with a new "last updated"
              date. Continued use after changes means you accept them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">8. Contact</h2>
            <p>
              Questions? Reach us through the <strong>Feedback</strong> form in the app navigation menu.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsPage;
