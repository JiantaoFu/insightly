import React, { useEffect } from 'react';
import {
  Rocket,
  BarChart2,
  Zap,
  Shield,
  TrendingUp,
  Search,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import CachedAnalysesList from '../components/CachedAnalysesList';
import StarterPackCheckout from '../components/StarterPackCheckout';
import Footer from '../components/Footer';
import SubscriptionCheckoutButton from '../components/SubscriptionCheckoutButton';
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

// Testimonial Component
const Testimonial: React.FC<{
  quote: string;
  name: string;
  role: string;
}> = ({ quote, name, role }) => (
  <div className="bg-white rounded-xl shadow-lg p-6">
    <p className="italic text-gray-600 mb-4">"{quote}"</p>
    <div className="flex items-center">
      <div>
        <h4 className="font-semibold text-gray-900">{name}</h4>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
  </div>
);

export type LandingAudience = 'founders' | 'teams';

interface LandingCopy {
  pageTitle: string;
  pageDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryCta: { label: string; href: string; external?: boolean };
  heroSecondaryCta: { label: string; href: string; external?: boolean };
  featuresSectionTitle: string;
  startSectionTitle: string;
  startSectionSubtitle: string;
  features: { icon: React.ElementType; title: string; description: string }[];
  testimonials: { quote: string; name: string; role: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string; external?: boolean };
}

const COPY: Record<LandingAudience, LandingCopy> = {
  founders: {
    pageTitle: 'Insightly: Find Your Next Product Idea in App Reviews',
    pageDescription: 'Paste any App Store or Google Play link and get an AI report of user pain points, requested features, and startup opportunities in minutes.',
    heroTitle: 'Find Your Next Product Idea in Competitors’ 1-Star Reviews',
    heroSubtitle: 'Paste any App Store or Google Play link. Get an AI report of what users hate, what they wish existed, and the feature gaps you can build into a business — in minutes, not weeks of manual review reading.',
    heroPrimaryCta: { label: 'Try for $1', href: '#pricing' },
    heroSecondaryCta: { label: 'Learn More', href: '#features' },
    featuresSectionTitle: 'See exactly what to build next — before you write a line of code.',
    startSectionTitle: 'Start Market Research',
    startSectionSubtitle: 'Discover untapped opportunities in your target market',
    features: [
      {
        icon: Search,
        title: 'Save Research Time',
        description: 'AI scans thousands of reviews and delivers clear insights in minutes.'
      },
      {
        icon: Zap,
        title: 'Validate Your Ideas',
        description: 'Check if your feature solves real user problems before investing.'
      },
      {
        icon: TrendingUp,
        title: 'Stay Ahead of Competitors',
        description: 'Track emerging trends and unmet needs in your niche.'
      },
      {
        icon: Rocket,
        title: 'Spot Market Gaps',
        description: 'See what users complain about and what they wish existed.'
      }
    ],
    testimonials: [
      {
        quote: 'Helped us identify a $2M market opportunity we would have missed.',
        name: 'Sarah Chen',
        role: 'Founder, TechVentures'
      },
      {
        quote: 'I found my last three product ideas by reading Insightly reports instead of scrolling reviews manually.',
        name: 'Mike Peterson',
        role: 'Indie Hacker'
      }
    ],
    ctaTitle: 'Ready to Discover Your Next Product Idea?',
    ctaSubtitle: 'Start your journey to data-driven product success today.',
    ctaPrimary: { label: 'Start Free Research', href: '/app' },
    ctaSecondary: { label: 'Book Demo', href: 'https://calendly.com/jeromyfu-/insightly-top-demo', external: true }
  },
  teams: {
    pageTitle: 'Insightly for Teams: Competitive Intelligence from App Reviews',
    pageDescription: 'Give your product and ASO team sentiment trends, feature-gap analysis, and SWOT comparisons built from real competitor app reviews.',
    heroTitle: 'Turn Competitor App Reviews Into Your Team’s Competitive Intelligence',
    heroSubtitle: 'Track what users love and hate about competing apps — sentiment trends, feature-request themes, and SWOT comparisons your product and ASO team can act on every sprint.',
    heroPrimaryCta: { label: 'Book a Demo', href: 'https://calendly.com/jeromyfu-/insightly-top-demo', external: true },
    heroSecondaryCta: { label: 'Try for $1', href: '#pricing' },
    featuresSectionTitle: 'See what your competitors’ users are really saying — before your roadmap meeting.',
    startSectionTitle: 'Start Competitive Analysis',
    startSectionSubtitle: 'Benchmark your app against competitors in minutes, not analyst-days',
    features: [
      {
        icon: Layers,
        title: 'Competitive Benchmarking',
        description: 'SWOT-style comparisons across competitor apps, built from real user reviews.'
      },
      {
        icon: BarChart2,
        title: 'Sentiment & Trend Tracking',
        description: 'Monitor how competitor sentiment shifts release over release.'
      },
      {
        icon: Search,
        title: 'Feature Gap Analysis',
        description: 'Surface the features users beg competitors for — feed it straight into your roadmap.'
      },
      {
        icon: Shield,
        title: 'Save Analyst Hours',
        description: 'Skip the manual review-reading. Get a shareable report your whole team can act on.'
      }
    ],
    testimonials: [
      {
        quote: 'The most comprehensive competitive research tool for digital products we’ve tried.',
        name: 'Mike Peterson',
        role: 'Product Strategy, InnovateCo'
      },
      {
        quote: 'We used to spend a full day before each roadmap review just reading competitor reviews. Now it’s minutes.',
        name: 'Sarah Chen',
        role: 'Head of Product, TechVentures'
      }
    ],
    ctaTitle: 'Ready to Bring Competitive Intelligence Into Your Roadmap?',
    ctaSubtitle: 'See a live walkthrough, or start a self-serve analysis today.',
    ctaPrimary: { label: 'Book Demo', href: 'https://calendly.com/jeromyfu-/insightly-top-demo' },
    ctaSecondary: { label: 'Start Free Research', href: '/app' }
  }
};

interface HomeProps {
  audience?: LandingAudience;
}

const Home: React.FC<HomeProps> = ({ audience = 'founders' }) => {
  const copy = COPY[audience];
  const { features, testimonials } = copy;

  useEffect(() => {
    updateMetadata(copy.pageTitle, copy.pageDescription);
  }, [copy.pageTitle, copy.pageDescription]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Hero Section */}
      <div
        className="relative bg-cover bg-center text-white min-h-screen flex items-center justify-center"
        style={{ backgroundImage: "url('/hero-banner.png')" }}
      >
        <div className="absolute inset-0 bg-black/30"></div> {/* Subtle overlay for text readability */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-center">
            <h1 className="text-5xl tracking-tight font-extrabold sm:text-6xl lg:text-7xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-md mx-auto text-xl text-gray-200 sm:text-2xl md:mt-8 md:max-w-3xl">
              {copy.heroSubtitle}
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <a
                href={copy.heroPrimaryCta.href}
                {...(copy.heroPrimaryCta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
              >
                {copy.heroPrimaryCta.label}
              </a>
              <a
                href={copy.heroSecondaryCta.href}
                {...(copy.heroSecondaryCta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
              >
                {copy.heroSecondaryCta.label}
              </a>
            </div>
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
            to="/app"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
          >
            <Search className="w-6 h-6 mr-3" />
            Start Research
          </Link>
        </div>
      </div>

      {/* Cached Analyses Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 bg-gray-50">
        <CachedAnalysesList />
      </div>

      {/* Starter Pack Section (replaces Pricing Plans) */}
      <div id="pricing" className="py-16 bg-gray-50 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-4">
              Get started with the <b>Starter Pack</b> or unlock unlimited research with <b>Unlimited</b>.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Pack Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
              <h3 className="text-2xl font-bold mb-2 text-blue-700">🚀 Starter Pack</h3>
              <div className="text-4xl font-extrabold text-gray-900 mb-2">$1</div>
              <div className="text-gray-500 mb-4 text-sm">One-time, no subscription</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>✔ AI-generated market gaps</li>
                <li>✔ Real user pain points</li>
                <li>✔ Instantly actionable opportunities</li>
                <li>✔ Analyze up to <b>5 datasets</b></li>
              </ul>
              <div className="mb-4">
                <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                  🎁 Beta pricing — help shape the product
                </span>
              </div>
              <StarterPackCheckout />
              <p className="text-gray-500 text-sm mt-6 text-center">
                Limited-time offer. You can easily top up more credits later if you love it!
              </p>
            </div>
            {/* Pro Plan Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center border-2 border-indigo-600 relative">
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-bl-xl text-xs font-semibold">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2 text-indigo-700">🏆 Pro Plan</h3>
              <div className="text-4xl font-extrabold text-gray-900">$11.99</div>
              <div className="text-gray-500 mb-4 text-sm">per month</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>✔ Up to <b>25 analyses</b> per month</li>
                <li>✔ Priority support</li>
                <li>✔ Early access to new features</li>
              </ul>
              <SubscriptionCheckoutButton priceId={import.meta.env.VITE_STRIPE_PRO_PRICE_ID || "price_1PqHqULBIjw2TCwN1234abcd"} />
              <p className="text-gray-500 text-sm mt-6 text-center">Ideal for frequent analysis and faster insights.</p>
            </div>
            {/* Unlimited Plan Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center border-2 border-indigo-600 relative">
              <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-bl-xl text-xs font-semibold">
                Limited Time Offer
              </div>
              <h3 className="text-2xl font-bold mb-2 text-indigo-700">💎 Unlimited</h3>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-2xl font-semibold text-gray-500 line-through mr-2">$79</span>
                <span className="text-4xl font-extrabold text-gray-900">$39</span>
              </div>
              <div className="text-gray-500 mb-4 text-sm">per month</div>
              <ul className="text-lg text-gray-700 mb-6 space-y-2 text-left">
                <li>✔ Unlimited datasets</li>
                <li>✔ Unlimited AI-generated insights</li>
                <li>✔ Priority support</li>
                <li>✔ Early access to new features</li>
              </ul>
              {/*
                IMPORTANT: Replace 'price_...' with your actual Stripe Price ID for the Unlimited plan.
                You can find this in your Stripe Dashboard under Products.
              */}
              <SubscriptionCheckoutButton priceId={import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID || "price_1RpKtULBIjw2TCwNvyahls62"} />
              <p className="text-gray-500 text-sm mt-6 text-center">
                Cancel anytime. Perfect for power users & teams.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">
              What Our Users Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <Testimonial
                key={index}
                quote={testimonial.quote}
                name={testimonial.name}
                role={testimonial.role}
              />
            ))}
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
            {copy.ctaPrimary.href.startsWith('http') ? (
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
            {copy.ctaSecondary.href.startsWith('http') ? (
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
