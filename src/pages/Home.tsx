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
      title: "Deep Analysis",
      description: "Comprehensive review insights using advanced AI algorithms"
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Get actionable insights in seconds, not hours"
    },
    {
      icon: TrendingUp,
      title: "Growth Insights",
      description: "Uncover hidden opportunities for product enhancement"
    },
    {
      icon: Rocket,
      title: "Performance Intelligence",
      description: "AI that turns user feedback into actionable strategy"
    }
  ];

  const pricingPlans = [
    {
      title: "Starter",
      price: "$0",
      icon: Layers,
      features: [
        "Up to 50 app reviews per month",
        "Basic sentiment analysis",
        "Limited historical data"
      ]
    },
    {
      title: "Pro",
      price: "$10",
      icon: TrendingUp,
      features: [
        "Up to 500 app reviews per month",
        "Advanced sentiment analysis",
        "Detailed trend insights",
        "Priority support"
      ],
      isMostPopular: true
    },
    {
      title: "Enterprise",
      price: "Custom",
      icon: Shield,
      features: [
        "Unlimited app reviews",
        "Full sentiment analysis",
        "Comprehensive trend reports",
        "Dedicated account manager",
        "Custom integrations"
      ]
    }
  ];

  const testimonials = [
    {
      quote: 'Transformed our app development strategy with actionable insights.',
      name: 'Sarah Johnson',
      role: 'CTO, TechInnovate'
    },
    {
      quote: 'The most powerful app analysis tool I\'ve ever used.',
      name: 'Mike Rodriguez',
      role: 'Founder, AppGenius'
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
              Uncover Deep Insights from App Reviews
            </h1>
            <p className="mt-3 max-w-md mx-auto text-lg text-gray-200 sm:text-xl md:mt-5 md:max-w-3xl">
              Leverage AI to Drive Product Growth
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Powerful Features for App Developers
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Designed to give you the competitive edge
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
            Start Analyzing Your App
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Gain deep insights into your app's performance and user feedback
          </p>
          <Link 
            to="/app" 
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
          >
            <Rocket className="w-6 h-6 mr-3" />
            Start Analysis
          </Link>
        </div>
      </div>

      {/* Cached Analyses Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Recent Analyses
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Your latest app review insights
          </p>
        </div>
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
            Ready to Transform Your App Strategy?
          </h2>
          <p className="text-xl text-blue-200 mb-8">
            Start your journey to data-driven app success today.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/app" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
              Start Free Trial
            </Link>
            <button className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Product Hunt Badge */}
      <div className="flex justify-center my-16">
        <a 
          href="https://www.producthunt.com/posts/insightly-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-insightly&#0045;3" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <img 
            src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=838886&theme=light&t=1738479256775" 
            alt="Insightly - Get instant insights from your app's reviews" 
            className="w-64 h-14"
          />
        </a>
      </div>
    </div>
  );
};

export default Home;
