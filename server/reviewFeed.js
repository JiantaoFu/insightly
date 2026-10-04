import { load } from 'cheerio';

export function parseAppleReviewFeed(data) {
  const entries = data?.feed?.entry;
  return (Array.isArray(entries) ? entries : entries ? [entries] : [])
    .filter(entry => entry['im:rating'] && entry.content)
    .map(entry => ({
      id: entry.id?.label, userName: entry.author?.name?.label,
      userUrl: entry.author?.uri?.label, version: entry['im:version']?.label,
      score: Number(entry['im:rating'].label), title: entry.title?.label,
      text: entry.content.label, updated: entry.updated?.label,
      url: entry.link?.attributes?.href,
    }));
}

export function parseApplePageReviews(html) {
  const serialized = load(html)('#serialized-server-data').text();
  if (!serialized) throw new Error('Apple page review data is unavailable.');
  const payload = JSON.parse(serialized);
  const reviews = (payload.data || []).flatMap(page =>
    page.data?.shelfMapping?.allProductReviews?.items || []
  ).map(item => item.review).filter(review =>
    review && typeof review.contents === 'string' && review.id
  ).map(review => ({
    id: review.id, userName: review.reviewerName, title: review.title,
    text: review.contents, score: Number(review.rating), updated: review.date,
  }));
  return [...new Map(reviews.map(review => [review.id, review])).values()];
}
