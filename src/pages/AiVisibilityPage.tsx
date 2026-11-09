import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { updateMetadata } from '../utils/metadata';

// AI Visibility (GEO-style) test UI. POST /api/ai-visibility starts an
// async job on the backend (a full run takes ~70s — too long for one
// proxied request), and this page polls GET /api/ai-visibility/runs/:id
// until it finishes. Each model in the panel answers a cognition question
// ("What is <app>?") and 3 non-branded recommendation questions; we show
// whether the app was mentioned, where, and what was recommended instead.

interface PanelModel {
  id: string;
  label: string;
  configured: boolean;
}

interface CognitionOk {
  raw: string;
  summary: string | null;
  pricingClaim: string | null;
  competitors: string[];
}
interface CognitionErr {
  error: string;
}
type Cognition = CognitionOk | CognitionErr;

interface AnswerOk {
  question: string;
  mentioned: boolean;
  position: number | null;
  recommended: string[];
  raw: string;
}
interface AnswerErr {
  question: string;
  error: string;
}
type Answer = AnswerOk | AnswerErr;

interface ModelResult {
  id: string;
  label: string;
  cognition: Cognition;
  answers: Answer[];
}

interface RunResult {
  app: { name: string; category: string | null };
  generatedAt: string;
  questions: string[];
  models: ModelResult[];
}

const isErr = (a: Answer | Cognition): a is AnswerErr | CognitionErr => 'error' in a;

const AiVisibilityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get('name') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [panel, setPanel] = useState<PanelModel[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // Stop polling if the user navigates away mid-run.
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    updateMetadata(
      'AI Visibility Test | Insightly',
      'See what AI assistants like Gemini know about your app — and whether they recommend it when users ask for apps in your category.',
      { canonicalPath: '/ai-visibility' }
    );
    fetch('/api/ai-visibility/models')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.models)) setPanel(d.models);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [running]);

  const summary = useMemo(() => {
    if (!result) return null;
    let total = 0;
    let mentioned = 0;
    for (const m of result.models) {
      for (const a of m.answers) {
        if (!isErr(a)) {
          total += 1;
          if (a.mentioned) mentioned += 1;
        }
      }
    }
    return { total, mentioned, modelCount: result.models.length };
  }, [result]);

  const run = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const POLL_INTERVAL_MS = 3000;
    const POLL_TIMEOUT_MS = 5 * 60 * 1000;
    try {
      const resp = await fetch('/api/ai-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, category: category.trim() || undefined }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        // Includes the 429 cooldown message from the server.
        throw new Error((data && data.error) || `Request failed (${resp.status})`);
      }
      const runId = data && data.runId;
      if (!runId) throw new Error('The server did not return a run id. Please try again.');

      // Poll the job until it completes. The run lives on the server, so a
      // single failed poll (network blip) is not fatal — only the 5-minute
      // deadline, a 404 (job gone), or a server-reported error ends it.
      const startedAt = Date.now();
      await new Promise<void>((resolve, reject) => {
        const tick = async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            reject(
              new Error(
                'This run is taking unusually long (over 5 minutes) and was stopped. Please try again in a couple of minutes.'
              )
            );
            return;
          }
          try {
            const poll = await fetch(`/api/ai-visibility/runs/${runId}`);
            const pdata = await poll.json().catch(() => null);
            if (poll.status === 404) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error((pdata && pdata.error) || 'This run expired before it finished. Please run it again.'));
              return;
            }
            if (!poll.ok || !pdata) return; // transient: keep polling
            if (pdata.status === 'done' && pdata.result) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              setResult(pdata.result as RunResult);
              resolve();
            } else if (pdata.status === 'error') {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error(pdata.error || 'The run failed on the server.'));
            }
            // status 'running' → wait for the next tick
          } catch {
            // network blip during a poll: keep polling until the deadline
          }
        };
        pollRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
        void tick();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-8 h-8 text-blue-600" />
          <h1 className="text-4xl font-extrabold text-gray-900">AI Visibility Test</h1>
        </div>
        <p className="text-gray-600 mb-8 max-w-3xl">
          What do AI assistants say about your app — and do they recommend it when users ask for
          apps in your category without naming a brand? We ask each model what your app is, then
          ask three category questions and check whether your app shows up. Answers come from the
          models&apos; own knowledge (API access, no live web browsing), so treat this as a
          snapshot of AI awareness, not a ranking guarantee.
        </p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">App name *</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lomorage"
                maxLength={80}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Category *</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. private photo backup"
                maxLength={60}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          {panel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Model panel:</span>
              {panel.map((m) => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    m.configured
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  {m.label}
                  {!m.configured && ' (not configured)'}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={running || !name.trim() || !category.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            {running ? 'Running…' : 'Run AI Visibility test'}
          </button>

          {running && (
            <p className="text-sm text-gray-500 mt-3">
              Asking each model 4 questions (1 cognition + 3 recommendations) and scoring the
              answers — this usually takes 1–2 minutes. Elapsed: {elapsed}s
            </p>
          )}
          {error && (
            <div className="flex items-start gap-2 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {result && summary && (
          <>
            <div className="bg-blue-600 text-white rounded-xl px-6 py-5 mb-8">
              <p className="text-lg font-semibold">
                {result.app.name} was mentioned in {summary.mentioned} of {summary.total}{' '}
                recommendation answers across {summary.modelCount} models.
              </p>
              <p className="text-blue-100 text-sm mt-1">
                Test questions: {result.questions.join(' · ')}
              </p>
            </div>

            <div className="space-y-6">
              {result.models.map((m) => (
                <section
                  key={m.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-4">{m.label}</h2>

                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    What it thinks the app is
                  </h3>
                  {isErr(m.cognition) ? (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-5">
                      {m.cognition.error}
                    </p>
                  ) : (
                    <div className="mb-5">
                      {m.cognition.summary ? (
                        <p className="text-gray-800 mb-2">{m.cognition.summary}</p>
                      ) : (
                        <p className="text-gray-500 italic mb-2">No summary extracted.</p>
                      )}
                      {m.cognition.pricingClaim && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Pricing claim:</span>{' '}
                          {m.cognition.pricingClaim}
                        </p>
                      )}
                      {m.cognition.competitors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {m.cognition.competitors.map((c) => (
                            <span
                              key={c}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="text-sm text-blue-600 cursor-pointer">
                          Raw cognition answer
                        </summary>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-2">
                          {m.cognition.raw}
                        </pre>
                      </details>
                    </div>
                  )}

                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Recommendation questions
                  </h3>
                  <div className="space-y-4">
                    {m.answers.map((a, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-4">
                        <p className="font-medium text-gray-900 mb-2">{a.question}</p>
                        {isErr(a) ? (
                          <p className="text-sm text-red-700">{a.error}</p>
                        ) : (
                          <>
                            <p className="flex items-center gap-2 text-sm mb-2">
                              {a.mentioned ? (
                                <>
                                  <Check className="w-4 h-4 text-green-600" />
                                  <span className="text-green-700 font-medium">
                                    Mentioned
                                    {a.position
                                      ? ` — #${a.position}${
                                          a.recommended.length
                                            ? ` of ${a.recommended.length}`
                                            : ''
                                        }`
                                      : ''}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-red-500" />
                                  <span className="text-red-600 font-medium">Not mentioned</span>
                                </>
                              )}
                            </p>
                            {a.recommended.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {a.recommended.map((r) => (
                                  <span
                                    key={r}
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      r.toLowerCase() ===
                                      result.app.name.toLowerCase()
                                        ? 'bg-green-100 text-green-800 font-semibold'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                            <details>
                              <summary className="text-sm text-blue-600 cursor-pointer">
                                Raw answer
                              </summary>
                              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-2">
                                {a.raw}
                              </pre>
                            </details>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-6">
              Run at {new Date(result.generatedAt).toLocaleString()}. API answers reflect each
              model&apos;s built-in knowledge, which may be outdated — always verify factual
              claims (like pricing) against the app&apos;s store listing.
            </p>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AiVisibilityPage;
