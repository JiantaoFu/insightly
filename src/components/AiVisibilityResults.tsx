import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

// Shared rendering for an AI Visibility run result, used by the
// standalone /ai-visibility page and by the AI Visibility section inside
// app reports (components/AiVisibilitySection.tsx). The result shape is
// exactly what POST /api/ai-visibility produces (see
// server/services/aiVisibility.js).

export interface CognitionOk {
  raw: string;
  summary: string | null;
  pricingClaim: string | null;
  competitors: string[];
}
export interface CognitionErr {
  error: string;
}
export type Cognition = CognitionOk | CognitionErr;

export interface AnswerOk {
  question: string;
  mentioned: boolean;
  position: number | null;
  recommended: string[];
  raw: string;
}
export interface AnswerErr {
  question: string;
  error: string;
}
export type Answer = AnswerOk | AnswerErr;

export interface ModelResult {
  id: string;
  label: string;
  cognition: Cognition;
  answers: Answer[];
}

export interface RunResult {
  app: { name: string; category: string | null };
  generatedAt: string;
  questions: string[];
  models: ModelResult[];
}

export const isErr = (a: Answer | Cognition): a is AnswerErr | CognitionErr => 'error' in a;

// Overall mention totals across the panel (errored answers don't count).
export function summarizeResult(result: RunResult): { total: number; mentioned: number } {
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
  return { total, mentioned };
}

const AiVisibilityResults: React.FC<{ result: RunResult }> = ({ result }) => {
  const summary = useMemo(
    () => ({ ...summarizeResult(result), modelCount: result.models.length }),
    [result]
  );

  return (
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
  );
};

export default AiVisibilityResults;
