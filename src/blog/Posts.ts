import React from 'react';

// We will create this component in the next step.
import FindAppIdeasContent from './content/FindAppIdeasContent';

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
    banner: '/blogs/how-to-find-app-ideas.png',
    date: 'May 20, 2024',
    component: FindAppIdeasContent,
  },
  // Future blog posts can be added here
];