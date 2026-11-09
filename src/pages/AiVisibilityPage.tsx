import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import AiVisibilityResults, { RunResult } from '../components/AiVisibilityResults';
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

const AiVisibilityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get('name') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [panel, setPanel] = useState<PanelModel[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  // When the server answers 429 (per-IP spacing between runs), the page
  // queues instead of erroring: it counts down and starts automatically.
  const [queueSecondsLeft, setQueueSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const queueTimerRef = useRef<number | null>(null);
  const queueCancelRef = useRef<(() => void) | null>(null);

  // Stop polling / queueing if the user navigates away mid-run.
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (queueTimerRef.current) window.clearInterval(queueTimerRef.current);
    };
  }, []);

  // Resolves true when the countdown finishes, false when cancelled.
  const waitInQueue = (seconds: number) =>
    new Promise<boolean>((resolve) => {
      let left = Math.max(1, Math.ceil(seconds));
      setQueueSecondsLeft(left);
      const finish = (proceed: boolean) => {
        if (queueTimerRef.current) window.clearInterval(queueTimerRef.current);
        queueTimerRef.current = null;
        queueCancelRef.current = null;
        setQueueSecondsLeft(null);
        resolve(proceed);
      };
      queueCancelRef.current = () => finish(false);
      queueTimerRef.current = window.setInterval(() => {
        left -= 1;
        if (left <= 0) finish(true);
        else setQueueSecondsLeft(left);
      }, 1000);
    });

  const cancelQueue = () => {
    queueCancelRef.current?.();
  };

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

  const run = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || running || queueSecondsLeft !== null) return;
    setError(null);
    setResult(null);
    const POLL_INTERVAL_MS = 3000;
    const POLL_TIMEOUT_MS = 5 * 60 * 1000;
    const QUEUE_CAP_MS = 3 * 60 * 1000;
    try {
      // Start the run. A 429 just means the previous run from this network
      // started too recently — queue for the server's retryAfterSeconds
      // and POST again automatically instead of failing.
      let runId: string | null = null;
      let queuedMs = 0;
      for (;;) {
        const resp = await fetch('/api/ai-visibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, category: category.trim() || undefined }),
        });
        const data = await resp.json().catch(() => null);
        if (resp.status === 429) {
          const waitSeconds =
            data && typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 30;
          queuedMs += waitSeconds * 1000;
          if (queuedMs > QUEUE_CAP_MS) {
            throw new Error('免费额度正忙，排队等待已超过 3 分钟，请稍后再试。');
          }
          const proceed = await waitInQueue(waitSeconds);
          if (!proceed) return; // user cancelled the queue
          continue;
        }
        if (!resp.ok) {
          throw new Error((data && data.error) || `Request failed (${resp.status})`);
        }
        runId = data && data.runId;
        if (!runId) throw new Error('The server did not return a run id. Please try again.');
        break;
      }
      setRunning(true);

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
      if (queueTimerRef.current) window.clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
      queueCancelRef.current = null;
      setQueueSecondsLeft(null);
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
            disabled={running || queueSecondsLeft !== null || !name.trim() || !category.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {(running || queueSecondsLeft !== null) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {queueSecondsLeft !== null ? '排队中…' : running ? 'Running…' : 'Run AI Visibility test'}
          </button>

          {queueSecondsLeft !== null && (
            <div className="flex items-center gap-2 mt-4 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>排队中，将在 {queueSecondsLeft}s 后自动开始</span>
              <button
                type="button"
                onClick={cancelQueue}
                className="ml-auto shrink-0 text-blue-700 font-medium underline underline-offset-2 hover:text-blue-900"
              >
                取消
              </button>
            </div>
          )}

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

        {result && <AiVisibilityResults result={result} />}
      </div>
      <Footer />
    </div>
  );
};

export default AiVisibilityPage;
