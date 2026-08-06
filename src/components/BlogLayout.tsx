import React from 'react';
import './BlogLayout.css';
import { updateMetadata, setStructuredData, clearStructuredData } from '../utils/metadata';

interface BlogLayoutProps {
  title: string;
  description: string;
  keywords: string;
  path: string;
  image?: string;
  articleSchema?: Record<string, unknown>;
  children: React.ReactNode;
}

const BlogLayout: React.FC<BlogLayoutProps> = ({ title, description, keywords, path, image, articleSchema, children }) => {
  React.useEffect(() => {
    updateMetadata(title, description, { keywords, canonicalPath: path, image });

    if (articleSchema) {
      setStructuredData(articleSchema);
    }

    return () => {
      clearStructuredData();
    };
  }, [title, description, keywords, path, image, articleSchema]);

  return (
    <main className="blog-container">
      <article>
        {children}
      </article>
    </main>
  );
};

export default BlogLayout;
