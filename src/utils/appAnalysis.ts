import { appendSyncObservation, getReviewAnalysis, MODEL_CLASSIFIER_VERSION, observeReviewSync, requestedCountry, type WatchApp, type MarketReview } from './marketIntelligence';
import { classifyResearchReviews, storeAppKey, type ResearchApp } from './marketResearchFlow';
import { opportunityInputKey, opportunityRequest, parseOpportunityReport, selectOpportunityEvidence, type OpportunityReport } from './marketOpportunities';
import { newResearchProject, type ResearchProject } from './researchProjects';

export const analysisId = (app: ResearchApp) => `analysis:${app.key}`;
export async function marketRequest(server: string, path: string, token: string | null, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`${server}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The analysis service is unavailable. Please try again.');
  return data;
}

// Each completed result has one immutable app/time scope. Partial collection is retained
// separately, while failed or cancelled runs never replace the previous result.
export async function analyzeApplication(options: {
  app: ResearchApp; days: number; previous?: ResearchProject; savedApps: WatchApp[]; server: string; token: string | null;
  signal: AbortSignal; progress: (message: string) => void; retain: (app: WatchApp) => void;
}): Promise<ResearchProject> {
  const { app, days, signal, progress, server, token, previous, retain } = options;
  const request = (path: string, body?: unknown) => marketRequest(server, path, token, signal, body);
  progress('Connecting to the analysis service...');
  const profile = await request('/api/market/classifier');
  if (!profile.configured || profile.version !== MODEL_CLASSIFIER_VERSION || profile.provider !== 'gemini' || typeof profile.model !== 'string') throw new Error('Gemini analysis is not configured or is unavailable.');
  progress(`Collecting reviews for ${app.title}...`);
  const startedAt = new Date().toISOString();
  const data = await request(app.platform === 'ios' ? '/app-store/process-url' : '/google-play/process-url', { url: app.appUrl, maxReviews: 500, months: 0 });
  if (!data.details || !Array.isArray(data.reviews?.reviews)) throw new Error('The store returned an invalid review response.');
  const existing = options.savedApps.find(item => !item.sample && storeAppKey(item.url) === app.key);
  const country = data.reviews.country || requestedCountry(app.appUrl);
  if (country !== requestedCountry(app.appUrl) || (existing?.reviewCountry && country !== existing.reviewCountry)) throw new Error('The store returned a different region. Previous data is unchanged; choose a link for that region.');
  const source = data.reviews.source || (app.platform === 'android' ? 'review-feed' : undefined);
  const observed = observeReviewSync(existing?.reviews || [], data.reviews.reviews as MarketReview[], {
    startedAt, finishedAt: new Date().toISOString(), url: app.appUrl, kind: existing ? 'refresh' : 'baseline',
    country, source, partial: data.reviews.partial, limitReached: data.reviews.limitReached,
  });
  let collected: WatchApp = { ...existing, id: existing?.id || crypto.randomUUID(), name: app.title, url: app.appUrl, icon: app.icon, developer: app.developer,
    platform: app.platform, role: 'my-app', reviews: observed.reviews, syncedAt: observed.observation.finishedAt,
    reviewCountry: country, reviewSource: source, partial: !!data.reviews.partial, lastFetchedCount: data.reviews.reviews.length,
    lastAddedCount: observed.observation.discovered, syncHistory: appendSyncObservation(existing?.syncHistory, observed.observation) };
  signal.throwIfAborted(); retain(collected);
  const classified = await classifyResearchReviews({ apps: [collected], profile, days, marketId: analysisId(app), serverUrl: server, token, signal,
    onProgress: progress, onUpdate: apps => { collected = apps[0]; retain(collected); } });
  const context = { mode: 'improve' as const, product: app.title, question: `What user problems in ${app.title} are worth solving next?`, focusTopic: 'all' };
  const cohort = classified.apps.map(item => ({ ...item, reviews: item.reviews.filter(review => {
    const analysis = getReviewAnalysis(review); return !!analysis && analysis.model === profile.model && analysis.provider === profile.provider;
  }) }));
  const evidence = selectOpportunityEvidence(cohort, context, days);
  if (!evidence.length) throw new Error(`No classified review evidence in the last ${days} days. Try a wider period or another app. Collected reviews are saved.`);
  const inputKey = opportunityInputKey(context, evidence, days);
  let report: OpportunityReport | null = previous?.report?.inputKey === inputKey && previous.report.model === profile.model ? previous.report : null;
  if (!report) {
    progress('Finding opportunities and checking their evidence...');
    const result = await request('/api/market/opportunities', opportunityRequest(analysisId(app), context, evidence, days));
    report = parseOpportunityReport({ ...result, inputKey, evidence, context, days, sample: false, researchAppKeys: [app.key] });
    if (!report || report.provider !== profile.provider || report.model !== profile.model) throw new Error('The analysis returned invalid opportunities or citations. Your previous result is unchanged.');
  }
  signal.throwIfAborted();
  return { ...newResearchProject(), ...previous, id: analysisId(app), workflow: 'apps', sample: false, decision: undefined,
    scope: { query: app.appUrl, title: app.title, country, apps: [app] }, research: context, report, days, analysisApp: { ...classified.apps[0], reviews: classified.apps[0].reviews.map(review => {
      const analysis = getReviewAnalysis(review);
      return analysis && (analysis.model !== profile.model || analysis.provider !== profile.provider) ? { ...review, analysis: undefined } : review;
    }) } };
}
