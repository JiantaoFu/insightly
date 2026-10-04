export interface MarketReview {
  id?: string;
  text: string;
  score?: number;
  date?: string;
  timestamp?: string;
  userName?: string;
}

export interface TopicTrend {
  topic: string;
  currentMentions: number;
  previousMentions: number;
  delta: number;
  sentiment: 'positive' | 'mixed' | 'negative';
  example?: string;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Pricing complaints': ['price', 'pricing', 'expensive', 'subscription', 'paywall', 'cost', 'refund', 'trial'],
  'Performance issues': ['slow', 'lag', 'crash', 'bug', 'freeze', 'loading', 'performance', 'stuck'],
  'Feature requests': ['feature', 'wish', 'please add', 'missing', 'need', 'would like', 'request'],
  'UX friction': ['confusing', 'hard to use', 'interface', 'ui', 'ux', 'navigation', 'design'],
  'Support gaps': ['support', 'customer service', 'help', 'response', 'contact', 'ticket'],
  'Reliability': ['sync', 'lost', 'backup', 'data', 'restore', 'login', 'account'],
  'Ads and monetization': ['ad', 'ads', 'advertisement', 'premium', 'upgrade', 'purchase'],
};

const NEGATIVE_WORDS = ['bad', 'broken', 'hate', 'terrible', 'awful', 'crash', 'bug', 'slow', 'expensive', 'missing', 'worse', 'annoying'];
const POSITIVE_WORDS = ['love', 'great', 'easy', 'helpful', 'excellent', 'best', 'fast', 'useful', 'beautiful'];

const normalizeDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mentionsTopic = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword));
};

const getSentiment = (reviews: MarketReview[]): TopicTrend['sentiment'] => {
  let positive = 0;
  let negative = 0;

  reviews.forEach(review => {
    const text = (review.text || '').toLowerCase();
    if (typeof review.score === 'number') {
      if (review.score <= 2) negative += 2;
      if (review.score >= 4) positive += 2;
    }
    if (NEGATIVE_WORDS.some(word => text.includes(word))) negative += 1;
    if (POSITIVE_WORDS.some(word => text.includes(word))) positive += 1;
  });

  if (negative > positive * 1.4) return 'negative';
  if (positive > negative * 1.4) return 'positive';
  return 'mixed';
};

export const splitReviewWindows = (reviews: MarketReview[], days = 30, now = new Date()) => {
  const datedReviews = reviews
    .map(review => ({ review, parsedDate: normalizeDate(review.date || review.timestamp) }))
    .filter(item => item.parsedDate);

  const latestDate = datedReviews.reduce<Date | null>((latest, item) => {
    if (!item.parsedDate) return latest;
    return !latest || item.parsedDate > latest ? item.parsedDate : latest;
  }, null);

  if (!latestDate) {
    return {
      current: [],
      previous: [],
      latestDate: null,
    };
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const previousCutoff = new Date(cutoff);
  previousCutoff.setDate(previousCutoff.getDate() - days);

  return {
    current: datedReviews.filter(item => item.parsedDate && item.parsedDate >= cutoff && item.parsedDate <= now).map(item => item.review),
    previous: datedReviews.filter(item => item.parsedDate && item.parsedDate < cutoff && item.parsedDate >= previousCutoff).map(item => item.review),
    latestDate,
  };
};

export const calculateTopicTrends = (reviews: MarketReview[], days = 30): TopicTrend[] => {
  const { current, previous } = splitReviewWindows(reviews, days);

  return Object.entries(TOPIC_KEYWORDS)
    .map(([topic, keywords]) => {
      const currentMatches = current.filter(review => mentionsTopic(review.text || '', keywords));
      const previousMatches = previous.filter(review => mentionsTopic(review.text || '', keywords));

      return {
        topic,
        currentMentions: currentMatches.length,
        previousMentions: previousMatches.length,
        delta: currentMatches.length - previousMatches.length,
        sentiment: getSentiment([...currentMatches, ...previousMatches]),
        example: currentMatches[0]?.text || previousMatches[0]?.text,
      };
    })
    .filter(trend => trend.currentMentions > 0 || trend.previousMentions > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.currentMentions - a.currentMentions);
};

export const summarizeReviewDelta = (reviews: MarketReview[]) => {
  const { current, previous, latestDate } = splitReviewWindows(reviews);
  const currentAverage = averageScore(current);
  const previousAverage = averageScore(previous);

  return {
    currentReviews: current.length,
    previousReviews: previous.length,
    ratingDelta: currentAverage !== null && previousAverage !== null
      ? Number((currentAverage - previousAverage).toFixed(2))
      : null,
    latestReviewDate: latestDate?.toISOString() || null,
  };
};

const averageScore = (reviews: MarketReview[]) => {
  const scored = reviews.filter(review => typeof review.score === 'number');
  if (!scored.length) return null;
  return scored.reduce((sum, review) => sum + (review.score || 0), 0) / scored.length;
};
