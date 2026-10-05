import React from 'react';

/**
 * Branded login middle page. Google OAuth starts at same-origin /auth/google
 * (Netlify proxies to Render), so the Google consent screen shows insightly.top
 * — never the onrender.com backend host.
 */
interface AuthInterstitialProps {
  /** Page heading; defaults to the /login wording. /app passes its own. */
  heading?: string;
}

const AuthInterstitial: React.FC<AuthInterstitialProps> = ({ heading = 'Continue to Insightly' }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white rounded-2xl shadow-xl border border-gray-200 p-8 md:p-10">
        {/* Left: value + sample thumbnail */}
        <div>
          <a href="/" className="inline-flex items-center mb-4">
            <img src="/logo-small.png" alt="Insightly" className="w-6 h-6 mr-2" />
            <span className="text-xl font-bold text-gray-900">insightly</span>
          </a>
          <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-200">
            <img
              src="/report-preview.webp"
              alt="Sample Insightly report"
              className="w-full"
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-gray-600">
            Turn competitors&apos; 1-star reviews into your next product idea.
          </p>
        </div>
        {/* Right: auth actions — dual path */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
          <p className="mt-2 text-gray-600 text-sm">
            Login saves your credits &amp; report history. Reading public reports never requires login.
          </p>
          <a
            href="/auth/google"
            className="mt-6 block text-center bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Continue with Google
          </a>
          <a
            href="/app-insights"
            className="mt-4 block text-center text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            or browse free sample reports first →
          </a>
          <a
            href="/"
            className="mt-3 block text-center text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to free lookup on home
          </a>
        </div>
      </div>
    </div>
  );
};

export default AuthInterstitial;
