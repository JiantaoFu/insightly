import React from 'react';
import {
  Rocket,
  BarChart2,
  Zap,
  Shield,
  TrendingUp,
  Globe,
  Check,
  Search,
  Layers,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import CachedAnalysesList from '../components/CachedAnalysesList';
import ProductHuntBadge from '../components/ProductHuntBadge';

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

// Pricing Card Component
const PricingCard: React.FC<{
  title: string;
  price: string;
  icon: React.ElementType;
  features: string[];
  background?: string;
  isMostPopular?: boolean;
}> = ({
  title,
  price,
  icon: Icon,
  features,
  background = 'bg-white',
  isMostPopular = false
}) => (
  <div className={`
    ${background}
    rounded-xl shadow-lg p-6
    ${isMostPopular
      ? 'border-2 border-blue-500 shadow-xl hover:shadow-2xl'
      : 'hover:shadow-lg'}
    relative flex flex-col
    ${isMostPopular ? 'scale-[1.02]' : ''}
  `}>
    {isMostPopular && (
      <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-bl-xl">
        Most Popular
      </div>
    )}
    <div className="flex items-center mb-4">
      <Icon className="w-10 h-10 text-blue-600 mr-4" />
      <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
    </div>
    <div className="text-4xl font-extrabold text-gray-900 mb-4">{price}</div>
    <ul className="space-y-3 mb-6 flex-grow">
      {features.map((feature, index) => (
        <li key={index} className="flex items-center">
          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
          <span className="text-gray-700">{feature}</span>
        </li>
      ))}
    </ul>
    <Link
      to="/app"
      className={`${isMostPopular ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-600'}
      inline-block w-full py-3 px-6 text-center rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105`}
    >
      Get Started
    </Link>
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

const Home: React.FC = () => {
  const features = [
    {
      icon: Search,
      title: "Market Gap Analysis",
      description: "Identify unmet needs and opportunities in your target market"
    },
    {
      icon: Zap,
      title: "Real-time Insights",
      description: "Monitor market trends and user pain points as they emerge"
    },
    {
      icon: TrendingUp,
      title: "Competitive Intelligence",
      description: "Track market movements and stay ahead of emerging trends"
    },
    {
      icon: Rocket,
      title: "Strategic Validation",
      description: "Validate product ideas with real user feedback data"
    }
  ];

  const pricingPlans = [
    {
      title: "Explorer",
      price: "$0",
      icon: Layers,
      features: [
        "Basic market gap analysis",
        "100 reviews per month",
        "7-day historical data",
        "Basic trend detection"
      ]
    },
    {
      title: "Innovator",
      price: "$49",
      icon: TrendingUp,
      features: [
        "Advanced market research",
        "1,000 reviews per month",
        "30-day historical data",
        "Trend analysis & predictions",
        "Competitive insights"
      ],
      isMostPopular: true
    },
    {
      title: "Enterprise",
      price: "Custom",
      icon: Shield,
      features: [
        "Full market intelligence suite",
        "Unlimited reviews analysis",
        "Full historical data access",
        "Custom integrations",
        "Dedicated research analyst"
      ]
    }
  ];

  const testimonials = [
    {
      quote: 'Helped us identify a $2M market opportunity we would have missed.',
      name: 'Sarah Chen',
      role: 'Founder, TechVentures'
    },
    {
      quote: 'The most comprehensive market research tool for digital products.',
      name: 'Mike Peterson',
      role: 'Product Strategy, InnovateCo'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 text-white pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-16 lg:pb-24">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl">
              Uncover Market Gaps from Online Reviews
            </h1>
            <p className="mt-3 max-w-md mx-auto text-lg text-gray-200 sm:text-xl md:mt-5 md:max-w-3xl">
              AI-Powered Market Research for Entrepreneurs & Innovators
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Market Intelligence for Product Innovation
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Turn user feedback into market opportunities
            </p>
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
            Start Market Research
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Discover untapped opportunities in your target market
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

      {/* Pricing Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
              Pricing Plans
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Flexible plans designed to scale with your app insights needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <PricingCard
                key={index}
                title={plan.title}
                price={plan.price}
                icon={plan.icon}
                features={plan.features}
                isMostPopular={plan.isMostPopular}
              />
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-600 mb-4">
              Need a custom solution? <a href="#" className="text-blue-600 hover:underline">Contact Sales</a>
            </p>
            <div className="flex justify-center space-x-4 text-gray-500">
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                <span>Secure Payments</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                <span>No Hidden Fees</span>
              </div>
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
            Ready to Discover Market Opportunities?
          </h2>
          <p className="text-xl text-blue-200 mb-8">
            Start your journey to data-driven product success today.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/app" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
              Start Free Research
            </Link>
            <button className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors">
              Book Demo
            </button>
          </div>
        </div>
      </div>

      {/* Product Hunt Badge */}
      <div className="flex justify-center my-16">
        <ProductHuntBadge />
      </div>
    </div>
  );
};

export default Home;
