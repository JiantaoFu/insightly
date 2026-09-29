import React, { lazy } from 'react';

// Post metadata (title/description/etc.) is used eagerly by the blog list
// and by BlogPostPage before the article renders, so it must stay a plain
// import. The article body itself is lazy so its text/markup doesn't get
// bundled into every page's shared entry chunk -- only /blog/:slug visitors
// pay for it.
const FindAppIdeasContent = lazy(() => import('./content/FindAppIdeasContent'));
const AppReviewAnalysisContent = lazy(() => import('./content/AppReviewAnalysisContent'));
const AppIdeasFromReviewsContent = lazy(() => import('./content/AppIdeasFromReviewsContent'));
const CompetitorResearchContent = lazy(() => import('./content/CompetitorResearchContent'));

export interface BlogPost {
  slug: string;
  title:string;
  description: string;
  banner: string;
  date: string;
  component: React.FC;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'find-app-ideas',
    title: 'How to Find App Ideas That People Actually Want',
    description: 'Discover proven ways to find app ideas fast. Learn how to use app reviews, Reddit, and Insightly’s AI analysis to spot market gaps and validate your startup idea.',
    banner: '/blogs/how-to-find-app-ideas.webp',
    date: 'May 20, 2025',
    component: FindAppIdeasContent,
  },
  // Future blog posts can be added here
  {
    slug: 'app-review-analysis',
    title: 'App Review Analysis: How to Turn User Feedback into Your Next Big App Idea',
    description: 'Learn how to analyze app store reviews to find new ideas, pain points, and feature requests. Use Insightly to turn feedback into growth opportunities.',
    banner: '/blogs/app-review-analysis.webp',
    date: 'May 27, 2025',
    component: AppReviewAnalysisContent,
  },
  {
    slug: 'app-ideas-from-reviews',
    title: '10 App Ideas Hiding in App Store Reviews Right Now',
    description: 'Ten recurring complaint patterns from real app reviews, and the product opportunity hiding behind each one.',
    banner: '/blogs/app-ideas-from-reviews.svg',
    date: 'Aug 6, 2026',
    component: AppIdeasFromReviewsContent,
  },
  {
    slug: 'competitor-research-afternoon',
    title: 'How to Do Competitor Research for Your App in an Afternoon (Not a Week)',
    description: 'A five-step competitor research process for app founders that actually gets finished, instead of dying in a half-filled spreadsheet.',
    banner: '/blogs/competitor-research-afternoon.svg',
    date: 'Aug 6, 2026',
    component: CompetitorResearchContent,
  },
];
