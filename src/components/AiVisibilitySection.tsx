import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SERVER_URL } from './Constants';
import AiVisibilityResults, { RunResult, summarizeResult } from './AiVisibilityResults';

// AI Visibility section inside an app report (see ShareReportView).
//
// Unlike the standalone /ai-visibility page, the visitor never types the
// app name or category: the report's share id identifies the app and the
// server resolves the metadata from the stored analysis. The latest
// result is stored server-side and shown while fresh (7 days by
// default); re-checks go through the same async job + per-IP cooldown
// machinery as the standalone tool (POST starts a job, the shared
// /api/ai-visibility/runs/:id endpoint is polled, a 429 becomes a
// countdown queue instead of an error).

interface HistoryEntry {
  generatedAt: string;
  mentions: number;
  answers: number;
  perModel: Record<string, { mentioned: number; total: number }>;
}

interface GeoState {
  hasResult: boolean;
  result?: RunResult;
  history?: HistoryEntry[];
  generatedAt?: string;
  fresh?: boolean;
  cacheDays: number;
}

function ageText(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AiVisibilitySection: React.FC<{ hashUrl: string; appName: string }> = ({
  hashUrl,
  appName,
}) => {
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [queueSecondsLeft, setQueueSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const queueTimerRef = useRef<number | null>(null);
  const queueCancelRef = useRef<(() => void) | null>(null);

  // Stop polling / queueing if the component unmounts mid-run.
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (queueTimerRef.current) window.clearInterval(queueTimerRef.current);
    };
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

  const loadState = async () => {
    try {
      const resp = await fetch(`${SERVER_URL}/api/ai-visibility/apps/${hashUrl}`);
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data) throw new Error('load failed');
      setGeo(data as GeoState);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashUrl]);

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

  const startRun = async (force: boolean) => {
    if (running || queueSecondsLeft !== null) return;
    setError(null);
    const POLL_INTERVAL_MS = 3000;
    const POLL_TIMEOUT_MS = 5 * 60 * 1000;
    const QUEUE_CAP_MS = 3 * 60 * 1000;
    try {
      // Start (or join) the run. A 200 means the stored result is still
      // fresh and was served instead; a 429 means the previous run from
      // this network started too recently — queue and retry automatically.
      let runId: string | null = null;
      let queuedMs = 0;
      for (;;) {
        const resp = await fetch(`${SERVER_URL}/api/ai-visibility/apps/${hashUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force }),
        });
        const data = await resp.json().catch(() => null);
        if (resp.status === 200 && data?.status === 'cached') {
          await loadState();
          return;
        }
        if (resp.status === 429) {
          const waitSeconds =
            data && typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 30;
          queuedMs += waitSeconds * 1000;
          if (queuedMs > QUEUE_CAP_MS) {
            throw new Error('The free model quota is busy and the queue wait exceeded 3 minutes. Please try again shortly.');
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

      const startedAt = Date.now();
      await new Promise<void>((resolve, reject) => {
        const tick = async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            reject(new Error('This check is taking unusually long (over 5 minutes) and was stopped. Please try again in a couple of minutes.'));
            return;
          }
          try {
            const poll = await fetch(`${SERVER_URL}/api/ai-visibility/runs/${runId}`);
            const pdata = await poll.json().catch(() => null);
            if (poll.status === 404) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error((pdata && pdata.error) || 'This check expired before it finished. Please run it again.'));
              return;
            }
            if (!poll.ok || !pdata) return; // transient: keep polling
            if (pdata.status === 'done' && pdata.result) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              resolve();
            } else if (pdata.status === 'error') {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error(pdata.error || 'The check failed on the server.'));
            }
          } catch {
            // network blip during a poll: keep polling until the deadline
          }
        };
        pollRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
        void tick();
      });

      // The finished run is persisted server-side; reload the stored
      // state so the history / change indicator come along with it.
      await loadState();
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

  const result = geo?.hasResult ? geo.result ?? null : null;
  const history = geo?.history || [];
  // history is newest-first and its first entry describes the run that
  // produced `result`; the second entry is the previous check.
  const previous = result && history.length >= 2 ? history[1] : null;
  const currentTotals = result ? summarizeResult(result) : null;
  const mentionDelta =
    previous && currentTotals ? currentTotals.mentioned - previous.mentions : null;
  const busy = running || queueSecondsLeft !== null;
  const nextRefresh =
    result && geo
      ? new Date(Date.parse(result.generatedAt) + geo.cacheDays * 24 * 60 * 60 * 1000)
      : null;

  return (
    <div className="mb-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center mb-2">
          <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            AI Visibility
          </h2>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed mb-4">
          Do AI assistants know {appName} — and do they recommend it when users ask for
          apps in its category without naming a brand? We ask several models what the app
          is, then ask three category questions and check whether it shows up. Answers
          come from the models&apos; own knowledge, so this is a snapshot of AI awareness,
          not a ranking guarantee.
        </p>

        {geo === null && !loadError && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading AI visibility…
          </p>
        )}
        {loadError && geo === null && (
          <p className="text-sm text-gray-500">
            AI visibility data could not be loaded right now.{' '}
            <button type="button" onClick={() => void loadState()} className="text-blue-600 font-medium underline underline-offset-2">
              Retry
            </button>
          </p>
        )}

        {geo !== null && !result && !busy && (
          <button
            type="button"
            onClick={() => void startRun(false)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Check AI visibility
          </button>
        )}

        {result && !busy && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm text-gray-500">
              Last checked {new Date(result.generatedAt).toLocaleDateString()}
              {ageText(result.generatedAt) ? ` (${ageText(result.generatedAt)})` : ''}
            </span>
            {previous && currentTotals && mentionDelta !== null && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                {mentionDelta > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : mentionDelta < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : (
                  <Minus className="w-4 h-4 text-gray-400" />
                )}
                Mentions {currentTotals.mentioned}/{currentTotals.total}
                {mentionDelta !== 0
                  ? ` — ${mentionDelta > 0 ? 'up' : 'down'} from ${previous.mentions}/${previous.answers} on ${new Date(previous.generatedAt).toLocaleDateString()}`
                  : ` — unchanged since ${new Date(previous.generatedAt).toLocaleDateString()}`}
              </span>
            )}
            {geo?.fresh ? (
              <>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 font-semibold px-4 py-2 rounded-lg cursor-not-allowed"
                  title={`This result is less than ${geo.cacheDays} days old. Re-checks unlock on ${nextRefresh?.toLocaleDateString()}.`}
                >
                  <RefreshCw className="w-4 h-4" /> Up to date
                </button>
                <span className="text-xs text-gray-400">
                  Fresh result — re-checks unlock {nextRefresh?.toLocaleDateString()}
                  {geo.cacheDays ? ` (${geo.cacheDays}-day window)` : ''}.{' '}
                  <button
                    type="button"
                    onClick={() => void startRun(true)}
                    className="text-blue-600 font-medium underline underline-offset-2"
                  >
                    Re-check anyway
                  </button>
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startRun(false)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Re-check AI visibility
              </button>
            )}
          </div>
        )}

        {queueSecondsLeft !== null && (
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Queued — starting automatically in {queueSecondsLeft}s</span>
            <button
              type="button"
              onClick={() => queueCancelRef.current?.()}
              className="ml-auto shrink-0 text-blue-700 font-medium underline underline-offset-2 hover:text-blue-900"
            >
              Cancel
            </button>
          </div>
        )}

        {running && (
          <p className="flex items-center gap-2 text-sm text-gray-500 mt-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Asking each model 4 questions (1 cognition + 3 recommendations) and scoring
            the answers — this usually takes 1–2 minutes. Elapsed: {elapsed}s
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && <AiVisibilityResults result={result} />}
    </div>
  );
};

export default AiVisibilitySection;
