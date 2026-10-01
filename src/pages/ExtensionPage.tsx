import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const ExtensionPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-extrabold text-gray-900 text-center">
          Insightly Browser Extension
        </h1>
        <p className="mt-4 text-lg text-gray-600 text-center">
          Analyze App Store &amp; Google Play reviews without leaving the store page.
        </p>
        <div className="mt-10 bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900">What it does</h2>
          <ul className="mt-4 space-y-3 text-gray-600">
            <li>✔ One-click review analysis on any app store page</li>
            <li>✔ AI summary of complaints, feature requests &amp; sentiment</li>
            <li>✔ Free for public reports — no login required to browse</li>
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://chromewebstore.google.com/detail/insightlytop-chrome-exten/jbhfbkkaffgfgjpipkpmgnbojjoajjka?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
            >
              Install for Chrome
            </a>
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/insightly-app-review-insights/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition text-center"
            >
              Install for Firefox
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-gray-500">
          Prefer the web app? <a href="/app-insights" className="text-blue-600 hover:underline">Browse free sample reports →</a>
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default ExtensionPage;
