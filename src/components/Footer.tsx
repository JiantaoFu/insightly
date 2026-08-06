import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-center items-center gap-8">
          <a href="https://twelve.tools" target="_blank" rel="noopener noreferrer">
            <img src="https://twelve.tools/badge0-white.svg" alt="Featured on Twelve Tools" className="h-14 w-auto" />
          </a>
          <a href="https://www.superlaun.ch/products/987" target="_blank" rel="noopener noreferrer">
            <img src="https://www.superlaun.ch/badge.png" alt="Featured on Super Launch" className="h-14 w-auto" />
          </a>
          <a href="https://submitmysaas.com/projects/insightly" target="_blank" title="SubmitMySaas Top 2 Daily Winner">
            <img src="https://submitmysaas.com/images/badges/top2-light.png" alt="SubmitMySaas Top 2 Daily Winner" className="h-14 w-auto"/>
          </a>
        </div>
        <div className="flex justify-center mt-6">
          <Link to="/for-teams" className="text-gray-400 text-sm hover:text-white transition-colors">
            Insightly for Teams &amp; ASO
          </Link>
        </div>
        <p className="text-center text-gray-400 text-sm mt-4">&copy; {new Date().getFullYear()} Insightly. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;