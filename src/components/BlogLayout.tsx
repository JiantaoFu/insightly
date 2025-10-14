import React from 'react';
import './BlogLayout.css';

interface BlogLayoutProps {
  title: string;
  description: string;
  keywords: string;
  children: React.ReactNode;
}

const BlogLayout: React.FC<BlogLayoutProps> = ({ title, description, keywords, children }) => {
  // Set meta tags based on props
  React.useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="keywords"]')?.setAttribute('content', keywords);
  }, [title, description, keywords]);

  return (
    <main className="blog-container">
      <article>
        {children}
      </article>
    </main>
  );
};

export default BlogLayout;