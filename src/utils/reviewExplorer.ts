import { getReviewAnalysis, type WatchApp } from './marketIntelligence';

export interface ReviewFilters { appId: string; platform: string; days: number; query: string; intent: string }
export function filterReviews(apps: WatchApp[], filters: ReviewFilters, now = Date.now()) {
  const query = filters.query.trim().toLocaleLowerCase();
  return apps.filter(app => !app.sample && (filters.appId === 'all' || app.id === filters.appId) && (filters.platform === 'all' || app.platform === filters.platform))
    .flatMap(app => app.reviews.map((review, index) => ({ app, review, index, analysis: getReviewAnalysis(review) })))
    .filter(({ review, analysis }) => {
      const date = Date.parse(review.date || review.timestamp || '');
      return (!filters.days || (Number.isFinite(date) && date <= now && date >= now - filters.days * 86400000))
        && (!query || review.text.toLocaleLowerCase().includes(query))
        && (filters.intent === 'all' || (filters.intent === 'unclassified' ? !analysis : analysis?.labels.some(label => label.intent === filters.intent)));
    }).sort((a, b) => (Date.parse(b.review.date || b.review.timestamp || '') || 0) - (Date.parse(a.review.date || a.review.timestamp || '') || 0));
}
export function reviewsCsv(rows: ReturnType<typeof filterReviews>): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
  };
  return [['app', 'platform', 'region', 'date', 'rating', 'text', 'source', 'partial', 'app_url'],
    ...rows.map(({ app, review }) => [app.name, app.platform, app.reviewCountry || 'unverified', review.date || review.timestamp || '', review.score || '', review.text, app.reviewSource || 'unverified', !!app.partial, app.url])]
    .map(row => row.map(cell).join(',')).join('\r\n');
}
