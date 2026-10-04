import React, { useEffect } from 'react';
import {
  TrendingUp,
  Search,
  Radar,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import CachedAnalysesList from '../components/CachedAnalysesList';
import StarterPackCheckout from '../components/StarterPackCheckout';
import Footer from '../components/Footer';
import { updateMetadata } from '../utils/metadata';

// Feature Card Component
const FeatureCard: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
}> = ({ icon: Icon, title, description }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
    <div className="flex items-center mb-4">
      <Icon className="w-10 h-10 text-blue-600 mr-4" />
      <h3 className="text-xl font-bold text-gray-900">{title}</h3>
    </div>
    <p className="text-gray-600">{description}</p>
  </div>
);

// (Testimonials removed 2026-09-29: the Sarah Chen / Mike Peterson quotes were
// placeholder content with inconsistent titles across pages.)

export type LandingAudience = 'founders' | 'teams';

interface LandingCopy {
  pageTitle: string;
  pageDescription: string;
  canonicalPath: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryCta: { label: string; href: string; external?: boolean };
  heroSecondaryCta: { label: string; href: string; external?: boolean };
  featuresSectionTitle: string;
  startSectionTitle: string;
  startSectionSubtitle: string;
  features: { icon: React.ElementType; title: string; description: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string; external?: boolean };
}

const COPY: Record<LandingAudience, LandingCopy> = {
  founders: {
    pageTitle: 'Insightly: Competitor Feedback Intelligence for Mobile Apps',
    pageDescription: 'Research competitor app feedback with a watchlist, dated review evidence and product research briefs for small mobile teams.',
    canonicalPath: '/',
    heroTitle: 'Competitor Feedback Intelligence',
    heroSubtitle: 'For independent developers and small teams with an app already in market. Investigate competitor feedback and bring review evidence to your next product decision.',
    heroPrimaryCta: { label: 'Track Your Market', href: '/market' },
    // No-login demo path: /app-insights is a public archive of real reports.
    // Visitors must be able to try the product before any Google login.
    heroSecondaryCta: { label: 'See Live Demo', href: '/app-insights' },
    featuresSectionTitle: 'Evidence for your next product decision.',
    startSectionTitle: 'Research Your Market',
    startSectionSubtitle: 'Your product question. Your direct competitors. Traceable review evidence.',
    features: [
      {
        icon: Radar,
        title: 'Competitor Watchlists',
        description: 'Your app and direct competitors, with manually refreshed review samples.'
      },
      {
        icon: TrendingUp,
        title: 'Dated Review Evidence',
        description: 'Topic observations and sample comparisons, with coverage limits kept visible.'
      },
      {
        icon: Bell,
        title: 'Research Briefs',
        description: 'A product question, selected feedback themes, and evidence worth investigating.'
      },
      {
        icon: Search,
        title: 'Focused Questions',
        description: 'Changes, low-rated feedback and feature requests from your watched apps.'
      }
    ],
    ctaTitle: 'Bring Evidence to Your Next Product Decision',
    ctaSubtitle: 'Start with the research preview. Public reports remain available for one-time analysis.',
    ctaPrimary: { label: 'Track Your Market', href: '/market' },
    ctaSecondary: { label: 'Book Demo', href: 'https://calendly.com/jeromyfu-/insightly-top-demo', external: true }
  },
  teams: {
    pageTitle: 'Insightly for Teams: Competitor Feedback Research',
    pageDescription: 'Bring dated competitor review evidence to product planning, with sample coverage and research briefs for mobile teams.',
    canonicalPath: '/for-teams',
    heroTitle: 'Competitor Feedback for Product Teams',
    heroSubtitle: 'Investigate the feedback behind your next product decision, with a focused competitor watchlist and dated review evidence. Manual research preview available now.',
    heroPrimaryCta: { label: 'Track Your Market', href: '/market' },
    heroSecondaryCta: { label: 'Book a Demo', href: 'https://calendly.com/jeromyfu-/insightly-top-demo', external: true },
    featuresSectionTitle: 'Review evidence for your next planning meeting.',
    startSectionTitle: 'Research Your Market',
    startSectionSubtitle: 'A focused question and a small set of direct competitors.',
    features: [
      {
        icon: Radar,
        title: 'Competitor Watchlists',
        description: 'Your own app beside direct competitors, with dated feedback samples.'
      },
      {
        icon: TrendingUp,
        title: 'Sample Comparisons',
        description: 'Topic share comparisons only when the available samples support them.'
      },
      {
        icon: Search,
        title: 'Feature Request Evidence',
        description: 'Requested capabilities to validate with users, not automatic roadmap commitments.'
      },
      {
        icon: Bell,
        title: 'Brief Previews',
        description: 'Research and weekly previews with source evidence and coverage notes.'
      }
    ],
    ctaTitle: 'Bring Evidence to Your Next Planning Meeting',
    ctaSubtitle: 'Explore a watched market or browse existing public reports.',
    ctaPrimary: { label: 'Track Your Market', href: '/market' },
    ctaSecondary: { label: 'Browse Reports', href: '/app-insights' }
  }
};

interface HomeProps {
  audience?: LandingAudience;
}

const Home: React.FC<HomeProps> = ({ audience = 'founders' }) => {
  const copy = COPY[audience];
  const { features } = copy;

  useEffect(() => {
    updateMetadata(copy.pageTitle, copy.pageDescription, { canonicalPath: copy.canonicalPath });
  }, [copy.pageTitle, copy.pageDescription, copy.canonicalPath]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Hero Section */}
      <div
        className="relative text-white min-h-screen flex items-center justify-center pt-24 pb-16"
        style={{ background: "linear-gradient(135deg, #0F1B2D 0%, #1E3A5F 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#93C5FD 1px, transparent 1px), linear-gradient(90deg, #93C5FD 1px, transparent 1px)", backgroundSize: "48px 48px" }}></div> {/* faint grid texture */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl lg:text-6xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-md mx-auto text-xl text-gray-200 sm:text-2xl md:mt-8 md:max-w-3xl">
              {copy.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/market"
                className="inline-flex items-center justify-center px-8 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                <Radar className="w-5 h-5 mr-2" />
                Track Your Market
              </Link>
              <a
                href="/shared-app-report/7638c1a348c0b7764829ce0a76e69807"
                className="inline-flex items-center justify-center px-8 py-3 bg-white/10 border border-white/30 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
              >
                See Live Report
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-300">
              Manual research preview · Browser storage · No automatic delivery
            </p>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <a
                href="/shared-app-report/7638c1a348c0b7764829ce0a76e69807"
                className="text-blue-300 hover:text-blue-200 font-medium"
              >
                See Live Demo →
              </a>
              <a href="/app-insights" className="text-blue-300 hover:text-blue-200 font-medium">
                Browse sample reports →
              </a>
            </div>
            {/* Product preview — real report screenshot */}
            <div className="mt-12 max-w-4xl mx-auto">
              <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20">
                <img
                  src="/report-preview.webp"
                  alt="Sample Insightly AI review analysis report"
                  className="w-full"
                  width={1919}
                  height={902}
                  loading="lazy"
                />
              </div>
              <p className="mt-3 text-sm text-gray-300">
                A public review analysis report from the existing archive.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip — honest, verifiable numbers */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-xl font-semibold text-gray-900">App Store</div>
            <div className="mt-1 text-gray-500">public review samples</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-gray-900">Google Play</div>
            <div className="mt-1 text-gray-500">public review samples</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-gray-900">Public Reports</div>
            <div className="mt-1 text-gray-500">one-time research archive</div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">
              {copy.featuresSectionTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Start Analyzing Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 bg-white">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-6">
            {copy.startSectionTitle}
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            {copy.startSectionSubtitle}
          </p>
          <Link
            to="/market"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
          >
            <Search className="w-6 h-6 mr-3" />
            Track Market
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Not ready to sign in?{' '}
            <Link to="/app-insights" className="text-indigo-600 font-medium hover:underline">
              Browse real sample reports — no sign-up needed →
            </Link>
          </p>
        </div>
      </div>

      {/* Cached Analyses Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 bg-gray-50">
        <CachedAnalysesList />
      </div>

      {/* Monitoring Pricing Section */}
      <div id="pricing" className="py-16 bg-gray-50 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
              Research Preview and Reports
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-4">
              Research preview without a subscription. One-time AI reports use existing credits.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Pack Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center border-2 border-indigo-600 relative">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-xs font-semibold">
                Starter
              </div>
              <h3 className="text-2xl font-bold mb-2 text-blue-700">Starter Report</h3>
              <div className="text-4xl font-extrabold text-gray-900 mb-2">$1</div>
              <div className="text-gray-500 mb-4 text-sm">One-time, no subscription</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>✔ One-time AI review report</li>
                <li>✔ Explore public report quality</li>
                <li>✔ Evaluate insights for your product</li>
                <li>✔ Analyze up to <b>5 datasets</b></li>
              </ul>
              <div className="mb-4">
                <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                One-time evaluation
                </span>
              </div>
              <StarterPackCheckout />
              <a href="/app-insights" className="text-blue-600 hover:text-blue-700 text-sm mt-3 inline-block">
                or browse a free sample first →
              </a>
              <p className="text-gray-500 text-sm mt-6 text-center">
                Limited-time offer. You can easily top up more credits later if you love it!
              </p>
            </div>
            {/* Pro Plan Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
              <h3 className="text-2xl font-bold mb-2 text-indigo-700">Market Research</h3>
              <div className="text-4xl font-extrabold text-gray-900">Free</div>
              <div className="text-gray-500 mb-4 text-sm">Manual research preview</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>✔ Competitor watchlist</li>
                <li>✔ Manually refreshed review samples</li>
                <li>✔ Research brief and source evidence</li>
                <li>✔ Saved in this browser</li>
              </ul>
              <Link to="/market" className="px-5 py-3 bg-blue-600 text-white rounded-lg">Try market preview</Link>
              <a href="/app-insights" className="text-blue-600 hover:text-blue-700 text-sm mt-3 inline-block">
                or browse a free sample first →
              </a>
              <p className="text-gray-500 text-sm mt-6 text-center">No subscription charge during preview.</p>
            </div>
            {/* Unlimited Plan Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
              <h3 className="text-2xl font-bold mb-2 text-indigo-700">Continuous Monitoring</h3>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-2xl font-semibold text-gray-900">Planned</span>
              </div>
              <div className="text-gray-500 mb-4 text-sm">Not yet available for purchase</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>Account-based watchlists</li>
                <li>Background review collection</li>
                <li>Scheduled brief generation</li>
                <li>Watchlist-scoped AI questions</li>
              </ul>
              {/*
                IMPORTANT: Replace 'price_...' with your actual Stripe Price ID for the Unlimited plan.
                You can find this in your Stripe Dashboard under Products.
              */}
              <Link to="/market" className="px-5 py-3 bg-blue-600 text-white rounded-lg">Try current research preview</Link>
              <a href="/app-insights" className="text-blue-600 hover:text-blue-700 text-sm mt-3 inline-block">
                or browse a free sample first →
              </a>
              <p className="text-gray-500 text-sm mt-6 text-center">
                Subscription pricing will follow pilot validation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-6">
            {copy.ctaTitle}
          </h2>
          <p className="text-xl text-blue-200 mb-8">
            {copy.ctaSubtitle}
          </p>
          <div className="flex justify-center space-x-4">
            {/* Hash links (#pricing) use plain anchors so the browser scrolls natively;
                react-router <Link> would swallow the scroll. */}
            {copy.ctaPrimary.href.startsWith('#') ? (
              <a
                href={copy.ctaPrimary.href}
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                {copy.ctaPrimary.label}
              </a>
            ) : copy.ctaPrimary.href.startsWith('http') ? (
              <a
                href={copy.ctaPrimary.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                {copy.ctaPrimary.label}
              </a>
            ) : (
              <Link to={copy.ctaPrimary.href} className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
                {copy.ctaPrimary.label}
              </Link>
            )}
            {copy.ctaSecondary.href.startsWith('#') ? (
              <a
                href={copy.ctaSecondary.href}
                className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
              >
                {copy.ctaSecondary.label}
              </a>
            ) : copy.ctaSecondary.href.startsWith('http') ? (
              <a
                href={copy.ctaSecondary.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
              >
                {copy.ctaSecondary.label}
              </a>
            ) : (
              <Link to={copy.ctaSecondary.href} className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors">
                {copy.ctaSecondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;
