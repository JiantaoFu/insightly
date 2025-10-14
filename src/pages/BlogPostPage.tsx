import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import BlogLayout from '../components/BlogLayout';
import { blogPosts } from '../blog/Posts';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  if (!post) {
    // If no post is found for the slug, redirect to the main blog page or a 404 page.
    return <Navigate to="/blog" replace />;
  }

  const ContentComponent = post.component;

  return (
    <BlogLayout
      title={`${post.title} | Insightly Blog`}
      description={post.description}
      keywords={`insightly, blog, ${post.slug}`}
    >
      <ContentComponent />
    </BlogLayout>
  );
};

export default BlogPostPage;