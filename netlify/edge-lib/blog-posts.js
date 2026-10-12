// Edge copy of the blog post metadata in src/blog/Posts.ts (that file imports
// React components, so the edge cannot import it). prerender-core.test.mjs
// fails if the two drift apart (slugs / titles / descriptions).
export const BLOG_LIST = {
  title: 'Insightly Blog | App Development & Growth Insights',
  description: 'Explore articles on app development, finding app ideas, user feedback analysis, and growing your app business.',
  heading: 'Insightly Blog',
  intro: 'Articles on app development, user feedback, and growth strategies.',
};

export const BLOG_POSTS = [
  {
    slug: 'find-app-ideas',
    title: 'How to Find App Ideas That People Actually Want',
    description: 'Discover proven ways to find app ideas fast. Learn how to use app reviews, Reddit, and Insightly’s AI analysis to spot market gaps and validate your startup idea.',
    banner: '/blogs/how-to-find-app-ideas.webp',
    date: 'May 20, 2025',
  },
  {
    slug: 'app-review-analysis',
    title: 'App Review Analysis: How to Turn User Feedback into Your Next Big App Idea',
    description: 'Learn how to analyze app store reviews to find new ideas, pain points, and feature requests. Use Insightly to turn feedback into growth opportunities.',
    banner: '/blogs/app-review-analysis.webp',
    date: 'May 27, 2025',
  },
  {
    slug: 'app-ideas-from-reviews',
    title: '10 App Ideas Hiding in App Store Reviews Right Now',
    description: 'Ten recurring complaint patterns from real app reviews, and the product opportunity hiding behind each one.',
    banner: '/blogs/app-ideas-from-reviews.svg',
    date: 'Aug 6, 2026',
  },
  {
    slug: 'competitor-research-afternoon',
    title: 'How to Do Competitor Research for Your App in an Afternoon (Not a Week)',
    description: 'A five-step competitor research process for app founders that actually gets finished, instead of dying in a half-filled spreadsheet.',
    banner: '/blogs/competitor-research-afternoon.svg',
    date: 'Aug 6, 2026',
  },
];
