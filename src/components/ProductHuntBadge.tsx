import React, { memo } from 'react';

const ProductHuntBadge: React.FC = memo(() => (
  <div className="flex justify-center mb-16">
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
));

export default ProductHuntBadge;