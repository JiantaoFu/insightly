import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../blog/Posts';
import BlogLayout from '../components/BlogLayout';

const BlogListPage: React.FC = () => {
  const meta = {
    title: 'Insightly Blog | App Development & Growth Insights',
    description: 'Explore articles on app development, finding app ideas, user feedback analysis, and growing your app business.',
    keywords: 'insightly, blog, app development, app growth, user feedback',
  };

  return (
    <BlogLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <h1>Insightly Blog</h1>
      <p className="text-xl text-gray-600 mb-12">Articles on app development, user feedback, and growth strategies.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
          >
            <img src={post.banner} alt={`${post.title} banner`} className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-2">{post.date}</p>
              <h2 className="text-2xl font-bold text-gray-800 mt-0 border-b-0 pb-0 mb-3 group-hover:text-blue-600 transition-colors duration-300">{post.title}</h2>
              <p className="text-gray-600 mb-4">{post.description}</p>
              <span className="font-semibold text-blue-600 group-hover:underline">Read More →</span>
            </div>
          </Link>
        ))}
      </div>
    </BlogLayout>
  );
};

export default BlogListPage;