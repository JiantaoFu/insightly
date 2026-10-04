export interface MarketReview {
  id?: string;
  text: string;
  score?: number;
  date?: string;
  timestamp?: string;
  userName?: string;
  url?: string;
  firstSeenAt?: string;
}

export interface SyncObservation {
  startedAt: string;
  finishedAt: string;
  kind: 'baseline' | 'refresh';
  status: 'success' | 'failed';
  requestedCountry: string;
  country?: string;
  source?: string;
  fetched: number;
  discovered: number;
  updated: number;
  undated: number;
  futureDated: number;
  oldestDate: string | null;
  newestDate: string | null;
  partial: boolean;
  limitReached: boolean;
  error?: string;
}

export interface WatchApp {
  id: string;
  role: 'my-app' | 'competitor';
  url: string;
  name: string;
  icon?: string;
  developer?: string;
  platform: 'ios' | 'android';
  reviews: MarketReview[];
  syncedAt: string;
  sample?: boolean;
  reviewSource?: string;
  lastFetchedCount?: number;
  lastAddedCount?: number;
  partial?: boolean;
  reviewCountry?: string;
  syncHistory?: SyncObservation[];
}

export interface TopicTrend {
  topic: string;
  currentMentions: number;
  previousMentions: number;
  delta: number;
  currentShare: number;
  previousShare: number;
  sentiment: 'positive' | 'mixed' | 'negative';
  example?: string;
  evidence: { review: MarketReview; period: 'current' | 'previous' }[];
}

export interface MarketSignal extends TopicTrend {
  key: string;
  appId: string;
  appName: string;
  appUrl: string;
  comparable: boolean;
  comparisonReason: string;
  changePp: number | null;
  nextStep: string;
}

const TOPICS: Record<string, { keywords: string[]; nextStep: string }> = {
  'Pricing and subscriptions': { keywords: ['price', 'pricing', 'expensive', 'subscription', 'subscriptions', 'paywall', 'cost', 'refund', 'trial'], nextStep: 'Check whether users misunderstand the price, trial terms, or paid feature boundaries.' },
  'Stability and performance': { keywords: ['slow', 'lag', 'crash', 'crashes', 'crashing', 'bug', 'bugs', 'freeze', 'loading', 'performance', 'stuck'], nextStep: 'Group reports by device and release, then compare them with crash and performance telemetry.' },
  'Feature requests': { keywords: ['wish', 'please add', 'missing', 'would like', 'request', 'requests'], nextStep: 'Validate the requested capability with users before making it a roadmap commitment.' },
  'Usability': { keywords: ['confusing', 'hard to use', 'interface', 'ui', 'ux', 'navigation', 'design'], nextStep: 'Inspect the reported workflow and test the confusing step with users.' },
  'Support': { keywords: ['support', 'customer service', 'response', 'contact', 'ticket'], nextStep: 'Compare response delays and unresolved cases with your support queue.' },
  'Accounts and sync': { keywords: ['sync', 'lost', 'backup', 'restore', 'login', 'account'], nextStep: 'Reproduce the account or sync workflow and check recovery behavior.' },
  'Advertising': { keywords: ['ad', 'ads', 'advertisement', 'advertisements'], nextStep: 'Review ad placement and interruption frequency in the affected workflow.' },
};

export const MARKET_TOPICS = Object.keys(TOPICS);

export interface ResearchContext {
  product: string;
  question: string;
  focusTopic: string;
}

export const normalizeResearchContext = (value: unknown): ResearchContext => {
  const candidate = value && typeof value === 'object' ? value as Partial<ResearchContext> : {};
  return {
    product: typeof candidate.product === 'string' ? candidate.product.trim().slice(0, 600) : '',
    question: typeof candidate.question === 'string' ? candidate.question.trim().slice(0, 400) : '',
    focusTopic: typeof candidate.focusTopic === 'string' && MARKET_TOPICS.includes(candidate.focusTopic) ? candidate.focusTopic : 'all',
  };
};

export const requestedCountry = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'apps.apple.com' ? parsed.pathname.split('/')[1].toLowerCase() : (parsed.searchParams.get('gl') || 'us').toLowerCase();
  } catch { return 'unknown'; }
};

const dateOf = (review: MarketReview) => {
  const value = review.date || review.timestamp;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const matches = (text: string, keywords: string[]) => keywords.some(keyword =>
  new RegExp('\\b' + keyword + '\\b', 'i').test(text)
);

const sentiment = (reviews: MarketReview[]): TopicTrend['sentiment'] => {
  const scored = reviews.filter(review => Number.isFinite(review.score) && review.score! >= 1 && review.score! <= 5);
  if (!scored.length) return 'mixed';
  const negative = scored.filter(review => review.score! <= 2).length;
  const positive = scored.filter(review => review.score! >= 4).length;
  if (negative > scored.length / 2) return 'negative';
  if (positive > scored.length / 2) return 'positive';
  return 'mixed';
};

export const splitReviewWindows = (reviews: MarketReview[], days = 30, now = new Date()) => {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const previousCutoff = new Date(cutoff.getTime() - days * 86400000);
  const dated = reviews.map(review => ({ review, date: dateOf(review) })).filter(item => item.date && item.date <= now);
  return {
    current: dated.filter(item => item.date! >= cutoff).map(item => item.review),
    previous: dated.filter(item => item.date! < cutoff && item.date! >= previousCutoff).map(item => item.review),
    latestDate: dated.reduce<Date | null>((latest, item) => !latest || item.date! > latest ? item.date : latest, null),
  };
};

export const calculateTopicTrends = (reviews: MarketReview[], days = 30, now = new Date()): TopicTrend[] => {
  const { current, previous } = splitReviewWindows(reviews, days, now);
  return Object.entries(TOPICS).map(([topic, { keywords }]) => {
    const currentMatches = current.filter(review => matches(review.text || '', keywords));
    const previousMatches = previous.filter(review => matches(review.text || '', keywords));
    return {
      topic, currentMentions: currentMatches.length, previousMentions: previousMatches.length,
      delta: currentMatches.length - previousMatches.length,
      currentShare: current.length ? currentMatches.length / current.length * 100 : 0,
      previousShare: previous.length ? previousMatches.length / previous.length * 100 : 0,
      sentiment: sentiment(currentMatches), example: currentMatches[0]?.text || previousMatches[0]?.text,
      evidence: [...currentMatches.map(review => ({ review, period: 'current' as const })), ...previousMatches.map(review => ({ review, period: 'previous' as const }))],
    };
  }).filter(trend => trend.evidence.length > 0)
    .sort((a, b) => b.currentMentions - a.currentMentions);
};

export const getAppCoverage = (app: WatchApp, days = 30, now = new Date()) => {
  const windows = splitReviewWindows(app.reviews, days, now);
  let reason = '';
  if (app.syncHistory?.[app.syncHistory.length - 1]?.status === 'failed') reason = 'Latest sync failed; retained evidence only';
  else if (app.reviewCountry && app.reviewCountry !== requestedCountry(app.url)) reason = 'Reviews came from a different region';
  else if (app.reviewSource === 'store-page-sample') reason = 'Limited webpage sample';
  else if (app.partial) reason = 'Incomplete sync';
  else if (!app.sample && app.lastFetchedCount === 0) reason = 'No reviews returned on last sync';
  else if (!app.sample && (!Number.isFinite(new Date(app.syncedAt).getTime()) || now.getTime() - new Date(app.syncedAt).getTime() > 48 * 3600000)) reason = 'Sync older than 48 hours';
  else if (!app.sample && app.reviewSource !== 'review-feed') reason = 'Source not verified; sync to update';
  else if (windows.current.length < 5 || windows.previous.length < 5) reason = 'Fewer than 5 dated reviews in one or both periods';
  return { ...windows, comparable: !reason, reason };
};

export const buildMarketSignals = (apps: WatchApp[], days = 30, now = new Date()): MarketSignal[] =>
  apps.flatMap(app => {
    const coverage = getAppCoverage(app, days, now);
    return calculateTopicTrends(app.reviews, days, now).map(trend => ({
      ...trend, key: app.id + ':' + trend.topic, appId: app.id, appName: app.name, appUrl: app.url,
      comparable: coverage.comparable, comparisonReason: coverage.reason,
      changePp: coverage.comparable ? Number((trend.currentShare - trend.previousShare).toFixed(1)) : null,
      nextStep: trend.sentiment === 'positive' ? 'Check which aspects users value and whether they also matter to your audience.' : TOPICS[trend.topic].nextStep,
    }));
  }).sort((a, b) => Number(b.comparable) - Number(a.comparable)
    || (b.changePp || 0) - (a.changePp || 0) || b.currentMentions - a.currentMentions);

export const summarizeReviewDelta = (reviews: MarketReview[], days = 30, now = new Date()) => {
  const { current, previous, latestDate } = splitReviewWindows(reviews, days, now);
  const average = (items: MarketReview[]) => {
    const scored = items.filter(review => Number.isFinite(review.score) && review.score! >= 1 && review.score! <= 5);
    return scored.length ? scored.reduce((sum, review) => sum + review.score!, 0) / scored.length : null;
  };
  const currentAverage = average(current), previousAverage = average(previous);
  return { currentReviews: current.length, previousReviews: previous.length, currentAverage,
    ratingDelta: currentAverage !== null && previousAverage !== null ? Number((currentAverage - previousAverage).toFixed(2)) : null,
    latestReviewDate: latestDate?.toISOString() || null };
};

export const mergeMarketReviews = (existing: MarketReview[], incoming: MarketReview[]) => {
  const merged = new Map<string, MarketReview>();
  const signatures = new Map<string, string>();
  for (const review of [...existing, ...incoming]) {
    const signature = (review.userName || '') + '|' + (dateOf(review)?.toISOString() || '') + '|' + review.text;
    const key = review.id ? 'id:' + review.id : signatures.get(signature) || signature;
    const previousKey = signatures.get(signature);
    if (previousKey && previousKey !== key && !previousKey.startsWith('id:')) merged.delete(previousKey);
    merged.set(key, { ...merged.get(key), ...review, id: review.id || merged.get(key)?.id });
    signatures.set(signature, key);
  }
  return [...merged.values()].sort((a, b) => (dateOf(b)?.getTime() || 0) - (dateOf(a)?.getTime() || 0)).slice(0, 2000);
};

// Keep observation time separate from the date the store attached to a review.
export const observeReviewSync = (existing: MarketReview[], incoming: MarketReview[], options: {
  startedAt: string; finishedAt: string; url: string; kind: SyncObservation['kind'];
  country?: string; source?: string; partial?: boolean; limitReached?: boolean;
}) => {
  const signature = (review: MarketReview) => `${review.userName || ''}|${dateOf(review)?.toISOString() || ''}|${review.text}`;
  const byId = new Map(existing.filter(review => review.id).map(review => [review.id, review]));
  const bySignature = new Map(existing.map(review => [signature(review), review]));
  let discovered = 0, updated = 0;
  const unique = mergeMarketReviews([], incoming);
  const observed = unique.map(review => {
    const legacy = bySignature.get(signature(review));
    const match = (review.id ? byId.get(review.id) : undefined) || (review.id && legacy?.id ? undefined : legacy);
    if (!match) discovered++;
    else if (review.text !== match.text || review.score !== match.score || dateOf(review)?.getTime() !== dateOf(match)?.getTime()) updated++;
    return { ...review, firstSeenAt: match ? match.firstSeenAt : options.finishedAt };
  });
  const dates = unique.map(dateOf).filter((date): date is Date => date !== null).sort((a, b) => a.getTime() - b.getTime());
  const observation: SyncObservation = {
    startedAt: options.startedAt, finishedAt: options.finishedAt, kind: options.kind, status: 'success',
    requestedCountry: requestedCountry(options.url), country: options.country, source: options.source,
    fetched: incoming.length, discovered, updated, undated: unique.length - dates.length,
    futureDated: dates.filter(date => date.getTime() > new Date(options.finishedAt).getTime()).length,
    oldestDate: dates[0]?.toISOString() || null, newestDate: dates[dates.length - 1]?.toISOString() || null,
    partial: !!options.partial, limitReached: !!options.limitReached,
  };
  return { reviews: mergeMarketReviews(existing, observed), observation };
};

export const appendSyncObservation = (history: SyncObservation[] | undefined, observation: SyncObservation) =>
  [...(history || []), observation].slice(-20);

export const buildResearchBrief = (apps: WatchApp[], context: ResearchContext, days = 30, now = new Date()) => {
  const normalized = normalizeResearchContext(context);
  const findings = buildMarketSignals(apps, days, now)
    .filter(signal => signal.currentMentions > 0 && (normalized.focusTopic === 'all' || signal.topic === normalized.focusTopic))
    .slice(0, 5);
  return {
    generatedAt: now.toISOString(), days, context: normalized, findings,
    apps: apps.map(app => ({ id: app.id, name: app.name, sample: !!app.sample, country: app.reviewCountry || 'Unverified', coverage: getAppCoverage(app, days, now) })),
  };
};

export type ResearchBrief = ReturnType<typeof buildResearchBrief>;

export const researchBriefMarkdown = (brief: ResearchBrief) => {
  const quote = (value: string) => value.split(/\r?\n/).map(line => '> ' + line).join('\n');
  const lines = ['# Competitor feedback research brief', '', `Generated: ${brief.generatedAt}`, `Period: last ${brief.days} days`,
    'Manual research preview. English keyword topic matches, not an AI answer or a complete market census.',
    ...(brief.apps.some(app => app.sample) ? ['ILLUSTRATIVE SAMPLE DATA: not real user feedback.'] : []),
    '', '## Product context', quote(brief.context.product || 'Not provided'), '', '## Research question', quote(brief.context.question || 'Not provided'),
    `Focus: ${brief.context.focusTopic === 'all' ? 'All topics' : brief.context.focusTopic}`, '', '## Coverage'];
  for (const app of brief.apps) lines.push(`- ${app.name} (${app.country}): ${app.coverage.current.length} current / ${app.coverage.previous.length} previous dated reviews. ${app.coverage.comparable ? 'Comparable samples; completeness not established.' : app.coverage.reason}`);
  lines.push('', '## Evidence to investigate');
  if (!brief.findings.length) lines.push('No matching current-period topic evidence. This does not establish absence of user feedback.');
  for (const finding of brief.findings) {
    lines.push('', `### ${finding.appName}: ${finding.topic}`, `Observed: ${finding.currentMentions} current-period sampled reviews mention this topic.`,
      finding.changePp === null ? `Comparison withheld: ${finding.comparisonReason}.` : `Sample share: ${finding.previousShare.toFixed(1)}% to ${finding.currentShare.toFixed(1)}% (${finding.changePp} percentage points).`,
      `Next validation: ${finding.nextStep}`, 'These reviews do not establish a competitive gap, willingness to switch, or roadmap priority.');
    for (const { review } of finding.evidence.filter(item => item.period === 'current').slice(0, 3)) {
      lines.push('', `${review.userName || 'Anonymous'} | ${dateOf(review)?.toISOString() || 'Undated'} | ${review.score || 'Unrated'} / 5`, quote(review.text));
      const url = review.url || finding.appUrl;
      if (/^https:\/\/(apps\.apple\.com|itunes\.apple\.com|play\.google\.com)\//.test(url)) lines.push(`Source: ${url}`);
    }
  }
  return lines.join('\n');
};
