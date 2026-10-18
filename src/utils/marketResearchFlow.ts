import { getMarketTopics, getReviewAnalysis, MODEL_CLASSIFIER_VERSION, splitReviewWindows, type MarketReview, type ReviewAnalysis, type WatchApp } from './marketIntelligence';

export interface ResearchApp {
  key: string; title: string; appUrl: string; platform: 'ios' | 'android';
  icon?: string; developer?: string; reason: string;
}
export interface ResearchScope {
  query: string; title: string; country: string; apps: ResearchApp[];
}
export const SCOPE_STORAGE = 'insightly_market_scope_v1';

export function storeAppKey(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    const apple = url.hostname === 'apps.apple.com' && url.pathname.match(/^\/([a-z]{2})\/app\/(?:[^/]+\/)?id(\d+)\/?$/i);
    if (apple) return `ios:${apple[1].toLowerCase()}:${apple[2]}`;
    if (url.hostname === 'play.google.com' && url.pathname === '/store/apps/details' && /^[\w.]+$/.test(url.searchParams.get('id') || '')) return `android:${(url.searchParams.get('gl') || 'us').toLowerCase()}:${url.searchParams.get('id')}`;
  } catch { /* A search phrase is not a store link. */ }
  return '';
}

export function parseResearchApp(value: unknown): ResearchApp | null {
  if (!value || typeof value !== 'object') return null;
  const app = value as ResearchApp;
  if (typeof app.appUrl !== 'string' || !storeAppKey(app.appUrl) || typeof app.title !== 'string' || !app.title.trim() || app.title.length > 200) return null;
  return { key: storeAppKey(app.appUrl), appUrl: app.appUrl, title: app.title,
    platform: app.appUrl.includes('apps.apple.com') ? 'ios' : 'android',
    icon: typeof app.icon === 'string' && app.icon.startsWith('https://') ? app.icon : undefined,
    developer: typeof app.developer === 'string' ? app.developer.slice(0, 200) : '',
    reason: typeof app.reason === 'string' ? app.reason.slice(0, 200) : 'Added to this research' };
}

export function loadResearchScope(value: unknown, apps: WatchApp[]): ResearchScope {
  if (value && typeof value === 'object') {
    const scope = value as ResearchScope;
    if (typeof scope.query === 'string' && scope.query.length <= 400 && typeof scope.title === 'string' && scope.title.length <= 160 && /^[a-z]{2}$/.test(scope.country) && Array.isArray(scope.apps)) {
      const valid = scope.apps.map(parseResearchApp).filter((app): app is ResearchApp => !!app);
      return { query: scope.query, title: scope.title, country: scope.country, apps: [...new Map(valid.map(app => [app.key, app])).values()].slice(0, 5) };
    }
  }
  return { query: '', title: 'Your app research', country: 'us', apps: apps.filter(app => !app.sample).slice(0, 5).map(app => ({
    key: storeAppKey(app.url), title: app.name, appUrl: app.url, platform: app.platform, icon: app.icon, developer: app.developer, reason: 'From your saved sources',
  })).filter(app => app.key) };
}

export function pendingResearchReviews(apps: WatchApp[], profile: { provider: string; model: string }, days?: number, now = new Date()) {
  const groups = apps.filter(app => !app.sample).map(app => {
    const reviews = days ? splitReviewWindows(app.reviews, days, now).current : app.reviews;
    return reviews.filter(review => {
      const analysis = getReviewAnalysis(review);
      return review.text?.trim() && review.text.length <= 16000 && (!analysis || analysis.provider !== profile.provider || analysis.model !== profile.model);
    }).sort((a, b) => new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime())
      .map(review => ({ appId: app.id, appName: app.name, review }));
  });
  const pending: { appId: string; appName: string; review: MarketReview }[] = [];
  while (pending.length < 120 && groups.some(group => group.length)) {
    for (const group of groups) {
      const item = group.shift();
      if (item) pending.push(item);
      if (pending.length === 120) break;
    }
  }
  return pending;
}

export async function classifyResearchReviews(options: {
  apps: WatchApp[]; profile: { provider: string; model: string; maxBatchSize?: number }; marketId: string; serverUrl: string; token: string | null;
  days?: number; signal?: AbortSignal; onProgress: (text: string) => void; onUpdate: (apps: WatchApp[]) => void;
}) {
  let apps = options.apps, completed = 0, batches = 0;
  const pending = pendingResearchReviews(apps, options.profile, options.days);
  // Older backends advertise no capacity and still accept only twelve reviews.
  const advertised = options.profile.maxBatchSize;
  const batchSize = Number.isInteger(advertised) && advertised! > 0 ? Math.min(advertised!, 24) : 12;
  while (completed < pending.length) {
    options.signal?.throwIfAborted();
    const batch: typeof pending = [];
    let characters = 0;
    for (const item of pending.slice(completed, completed + batchSize)) {
      if (characters + item.review.text.length > 60000) break;
      batch.push(item); characters += item.review.text.length;
    }
    const started = Date.now();
    const updateProgress = () => options.onProgress(`Reading feedback: ${completed} / ${pending.length} reviews · batch ${batches + 1}, ${batch.length} reviews · ${Math.floor((Date.now() - started) / 1000)}s`);
    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    let response: Response;
    let result;
    try {
      response = await fetch(`${options.serverUrl}/api/market/classify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      body: JSON.stringify({ marketId: options.marketId, topics: getMarketTopics(apps), reviews: batch.map(({ review, appName }, index) => ({ key: 'r' + index, text: review.text, appName })) }),
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(100000)]) : AbortSignal.timeout(100000),
      });
      result = await response.json();
    } finally { clearInterval(timer); }
    if (!response.ok) throw new Error(result.error || 'Could not read app feedback.');
    if (result.version !== MODEL_CLASSIFIER_VERSION || result.provider !== options.profile.provider || result.model !== options.profile.model || !Array.isArray(result.classifications) || result.classifications.length !== batch.length) throw new Error('Research returned incomplete review evidence.');
    const analyses = new Map<MarketReview, ReviewAnalysis>();
    for (const [index, item] of batch.entries()) {
      const rows = result.classifications.filter((row: { key: string }) => row.key === 'r' + index);
      if (rows.length !== 1) throw new Error('Research returned duplicate or missing reviews.');
      const analysis: ReviewAnalysis = { version: result.version, provider: result.provider, model: result.model, source: 'model', sourceText: item.review.text, analyzedAt: result.analyzedAt, labels: rows[0].labels };
      if (!getReviewAnalysis({ ...item.review, analysis })) throw new Error('Research returned unverifiable review evidence.');
      analyses.set(item.review, analysis);
    }
    apps = apps.map(app => ({ ...app, reviews: app.reviews.map(review => analyses.has(review) ? { ...review, analysis: analyses.get(review) } : review) }));
    options.onUpdate(apps);
    completed += batch.length; batches++;
    options.onProgress(`Reading feedback: ${completed} / ${pending.length} reviews completed`);
  }
  return { apps, completed };
}
