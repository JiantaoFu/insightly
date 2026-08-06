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
  const canonicalUrl = `https://insightly.top/blog/${post.slug}`;
  const imageUrl = post.banner ? `https://insightly.top${post.banner}` : undefined;
  const publishedDate = new Date(post.date);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    ...(isNaN(publishedDate.getTime()) ? {} : { datePublished: publishedDate.toISOString() }),
    ...(imageUrl ? { image: [imageUrl] } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    author: { '@type': 'Organization', name: 'Insightly' },
    publisher: { '@type': 'Organization', name: 'Insightly', url: 'https://insightly.top' },
  };

  return (
    <BlogLayout
      title={`${post.title} | Insightly Blog`}
      description={post.description}
      keywords={`insightly, blog, ${post.slug}`}
      path={`/blog/${post.slug}`}
      image={imageUrl}
      articleSchema={articleSchema}
    >
      <ContentComponent />
    </BlogLayout>
  );
};

export default BlogPostPage;