import React from 'react';
import './BlogLayout.css';
import { updateMetadata } from '../utils/metadata';

interface BlogLayoutProps {
  title: string;
  description: string;
  keywords: string;
  path: string;
  image?: string;
  children: React.ReactNode;
}

const BlogLayout: React.FC<BlogLayoutProps> = ({ title, description, keywords, path, image, children }) => {
  React.useEffect(() => {
    updateMetadata(title, description, { keywords, canonicalPath: path, image });
  }, [title, description, keywords, path, image]);

  return (
    <main className="blog-container">
      <article>
        {children}
      </article>
    </main>
  );
};

export default BlogLayout;
