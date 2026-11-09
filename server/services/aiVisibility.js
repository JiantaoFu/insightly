// AI Visibility (GEO-style) test.
//
// Given an app (name + category/description), this asks several LLMs:
//   1. a cognition question ("What is <app>?") — answered from the model's
//      own knowledge, no app data is fed in, and
//   2. three non-branded recommendation questions (generated once by Gemini,
//      identical for every model, never naming the app or any brand),
// then reports per model: the cognition answer (plus a judge-extracted
// summary / pricing claim / competitors), and for each recommendation
// answer whether the app was mentioned, at what position, and which
// products were recommended instead.
//
// Model panel (quotas are deliberately spread across independent free
// providers, so one provider's cap cannot take down the whole panel):
//   - Gemini via the shared LLM_PROVIDERS helper (same resolved model as
//     production, incl. its fallback logic). Needs GEMINI_API_KEY.
//   - Groq free tier (GROQ_API_KEY; model overridable with GEO_GROQ_MODEL).
//   - GitHub Models free tier (GITHUB_MODELS_API_KEY; model overridable
//     with GEO_GITHUB_MODEL).
//   - OpenRouter free models (OPENROUTER_API_KEY; list overridable with
//     GEO_OPENROUTER_MODELS, comma-separated). OpenRouter's free catalog
//     rotates, hence the env override.
//
// No persistence: runs execute as in-memory async jobs (a full run takes
// ~70s, longer than the site's CDN proxy waits for a synchronous response,
// so the API starts a job and the client polls for the result). A per-IP
// cooldown protects the free-tier quotas. Per-model / per-answer failures
// are captured in the result and never fail the whole run.

import axios from 'axios';
import { randomUUID } from 'crypto';
import { LLM_PROVIDERS } from '../llmProviders.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODELS =
  'nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_GITHUB_MODEL = 'openai/gpt-4.1-mini';
const CALL_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 1200;
const GITHUB_MAX_TOKENS = 1000;
// Gap required between run starts per client IP. It only exists to keep
// free-tier model quotas from being burned by rapid repeats — runs take
// ~77s, so anything much longer than the spacing the quotas need makes a
// second run feel broken. Overridable via GEO_COOLDOWN_SECONDS.
const COOLDOWN_SECONDS = (() => {
  const parsed = Number(process.env.GEO_COOLDOWN_SECONDS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
})();
const COOLDOWN_MS = COOLDOWN_SECONDS * 1000;
const RAW_CAP = 10_000;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function geminiModelId() {
  return LLM_PROVIDERS.gemini.resolveModel();
}

function openRouterModelIds() {
  return String(process.env.GEO_OPENROUTER_MODELS || DEFAULT_OPENROUTER_MODELS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function openRouterLabel(modelId) {
  const base = modelId.replace(/:free$/, '');
  const short = base.includes('/') ? base.split('/').slice(1).join('/') : base;
  return `${short} (OpenRouter, free)`;
}

function groqModelId() {
  return String(process.env.GEO_GROQ_MODEL || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
}

function githubModelId() {
  return (
    String(process.env.GEO_GITHUB_MODEL || DEFAULT_GITHUB_MODEL).trim() || DEFAULT_GITHUB_MODEL
  );
}

// Panel entries: { id, label, provider, model, keyEnv, configured }.
// keyEnv is internal only (used for the "not configured" error message);
// getPanelStatus never exposes it.
export function getPanel() {
  const panel = [
    {
      id: geminiModelId(),
      label: `Gemini ${geminiModelId().replace(/^gemini-/, '')}`,
      provider: 'gemini',
      model: geminiModelId(),
      keyEnv: 'GEMINI_API_KEY',
      configured: Boolean(process.env.GEMINI_API_KEY),
    },
    {
      id: groqModelId(),
      label: 'Llama 3.3 70B (Groq, free)',
      provider: 'groq',
      model: groqModelId(),
      keyEnv: 'GROQ_API_KEY',
      configured: Boolean(process.env.GROQ_API_KEY),
    },
    {
      id: githubModelId(),
      label: 'GPT-4.1 mini (GitHub Models, free)',
      provider: 'github',
      model: githubModelId(),
      keyEnv: 'GITHUB_MODELS_API_KEY',
      configured: Boolean(process.env.GITHUB_MODELS_API_KEY),
    },
  ];
  for (const model of openRouterModelIds()) {
    panel.push({
      id: model,
      label: openRouterLabel(model),
      provider: 'openrouter',
      model,
      keyEnv: 'OPENROUTER_API_KEY',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
    });
  }
  return panel;
}

// Public view for GET /api/ai-visibility/models — never includes secrets.
export function getPanelStatus() {
  return getPanel().map(({ id, label, configured }) => ({ id, label, configured }));
}

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

async function geminiText(prompt) {
  return withTimeout(
    LLM_PROVIDERS.gemini.generateResponse(null, prompt),
    CALL_TIMEOUT_MS,
    'Gemini call'
  );
}

// Shared caller for the OpenAI-compatible chat-completions providers
// (OpenRouter, Groq, GitHub Models all speak this shape).
async function chatCompletionsText({ url, apiKey, model, prompt, maxTokens, headers, providerName }) {
  const response = await axios.post(
    url,
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
    },
    {
      timeout: CALL_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${providerName} returned an empty response`);
  }
  return content;
}

async function openRouterText(model, prompt) {
  return chatCompletionsText({
    url: OPENROUTER_URL,
    apiKey: process.env.OPENROUTER_API_KEY,
    model,
    prompt,
    maxTokens: MAX_TOKENS,
    headers: {
      'HTTP-Referer': 'https://insightly.top',
      'X-Title': 'Insightly AI Visibility',
    },
    providerName: 'OpenRouter',
  });
}

async function groqText(model, prompt) {
  return chatCompletionsText({
    url: GROQ_URL,
    apiKey: process.env.GROQ_API_KEY,
    model,
    prompt,
    maxTokens: MAX_TOKENS,
    providerName: 'Groq',
  });
}

async function githubModelsText(model, prompt) {
  return chatCompletionsText({
    url: GITHUB_MODELS_URL,
    apiKey: process.env.GITHUB_MODELS_API_KEY,
    model,
    prompt,
    maxTokens: GITHUB_MAX_TOKENS,
    providerName: 'GitHub Models',
  });
}

function callModel(entry, prompt) {
  switch (entry.provider) {
    case 'gemini':
      return geminiText(prompt);
    case 'groq':
      return groqText(entry.model, prompt);
    case 'github':
      return githubModelsText(entry.model, prompt);
    default:
      return openRouterText(entry.model, prompt);
  }
}

// ---------------------------------------------------------------------------
// JSON extraction / judging (always Gemini; failures degrade to nulls)
// ---------------------------------------------------------------------------

function extractJson(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```(?:json)?/gi, '');
  try {
    return JSON.parse(cleaned.trim());
  } catch {
    // fall through to brace matching
  }
  const firstObj = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    try {
      return JSON.parse(cleaned.slice(firstObj, lastObj + 1));
    } catch {
      // fall through
    }
  }
  const firstArr = cleaned.indexOf('[');
  const lastArr = cleaned.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    try {
      return JSON.parse(cleaned.slice(firstArr, lastArr + 1));
    } catch {
      // fall through
    }
  }
  return null;
}

function cleanStringList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim().slice(0, maxLen))
    .slice(0, maxItems);
}

async function judgeRecommendation(name, question, answer) {
  const prompt = [
    'You extract structured data from an AI assistant answer.',
    `The user had asked: "${question}"`,
    'The assistant answered:',
    '"""',
    answer.slice(0, 4000),
    '"""',
    'List every specific app or product the assistant recommended, in the order they were recommended.',
    `Then give the 1-based position of "${name}" in that list, or null if it is not among the recommendations.`,
    'Respond with JSON only, exactly like: {"recommended": ["App A", "App B"], "targetPosition": 2}',
  ].join('\n');
  const parsed = extractJson(await geminiText(prompt));
  if (!parsed || typeof parsed !== 'object') throw new Error('judge returned no JSON');
  const recommended = cleanStringList(parsed.recommended, 12, 80);
  let targetPosition = null;
  if (
    Number.isInteger(parsed.targetPosition) &&
    parsed.targetPosition >= 1 &&
    parsed.targetPosition <= Math.max(recommended.length, 1)
  ) {
    targetPosition = parsed.targetPosition;
  }
  return { recommended, targetPosition };
}

async function judgeCognition(name, answer) {
  const prompt = [
    `Summarize this description of the app "${name}":`,
    '"""',
    answer.slice(0, 4000),
    '"""',
    'Respond with JSON only, exactly like: {"summary": "<one sentence>", "pricingClaim": "<what the text claims about price, or null>", "competitors": ["<competitor name>"]}',
  ].join('\n');
  const parsed = extractJson(await geminiText(prompt));
  if (!parsed || typeof parsed !== 'object') throw new Error('judge returned no JSON');
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 300) : null,
    pricingClaim:
      typeof parsed.pricingClaim === 'string' && parsed.pricingClaim.trim()
        ? parsed.pricingClaim.trim().slice(0, 200)
        : null,
    competitors: cleanStringList(parsed.competitors, 10, 60),
  };
}

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

function templateQuestions(category) {
  const c = category.trim().toLowerCase();
  return [
    `What is the best app for ${c}?`,
    `Which apps do you recommend for ${c}?`,
    `I'm looking for a good ${c} app — what should I use?`,
  ];
}

async function generateQuestions({ name, category, description }) {
  const fallback = () => {
    if (category) return templateQuestions(category);
    const err = new Error('category or description is required to build test questions');
    err.status = 400;
    throw err;
  };

  if (!process.env.GEMINI_API_KEY) return fallback();

  const prompt = [
    'You write test questions used to measure how AI assistants recommend apps.',
    `App under test: "${name}". Do NOT name this app or any other brand/product in the questions.`,
    category ? `Category: ${category}` : null,
    description ? `What the app does: ${description.slice(0, 500)}` : null,
    'Write exactly 3 natural questions a real user might ask an AI assistant when they need an app like this one (for example asking for the best app for a task, or how to do something the app helps with).',
    'The questions must be generic: no brand names, no product names.',
    'Respond with a JSON array of exactly 3 strings, nothing else.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const parsed = extractJson(await geminiText(prompt));
    const list = cleanStringList(parsed, 3, 200);
    const nameLower = name.toLowerCase();
    const usable = list.filter((q) => !q.toLowerCase().includes(nameLower));
    if (usable.length === 3) return usable;
    // A generated question named the app (or parsing fell short): mix in templates.
    if (category) {
      const templates = templateQuestions(category);
      const out = [];
      for (let i = 0; i < 3; i++) out.push(usable[i] || templates[i]);
      return out;
    }
    if (usable.length === 3) return usable;
    return fallback();
  } catch {
    return fallback();
  }
}

// ---------------------------------------------------------------------------
// Mention detection
// ---------------------------------------------------------------------------

function isMentioned(name, text) {
  if (!text) return false;
  const hay = text.toLowerCase();
  const needle = name.toLowerCase();
  if (hay.includes(needle)) return true;
  const squashed = needle.replace(/\s+/g, '');
  return squashed.length >= 3 && hay.replace(/\s+/g, '').includes(squashed);
}

// ---------------------------------------------------------------------------
// Per-model run
// ---------------------------------------------------------------------------

async function runModel(entry, name, questions) {
  if (!entry.configured) {
    const error = `${entry.keyEnv} is not configured`;
    return {
      id: entry.id,
      label: entry.label,
      cognition: { error },
      answers: questions.map((question) => ({ question, error })),
    };
  }

  const cognitionPrompt = `What is ${name}? Describe what it does, who it is for, its pricing, and its main competitors.`;

  const cognitionPromise = (async () => {
    try {
      const raw = String(await callModel(entry, cognitionPrompt)).slice(0, RAW_CAP);
      let judged = { summary: null, pricingClaim: null, competitors: [] };
      try {
        judged = await judgeCognition(name, raw);
      } catch {
        // Judge is best-effort; raw answer still stands on its own.
      }
      return { raw, ...judged };
    } catch (e) {
      return { error: String((e && e.message) || e).slice(0, 300) };
    }
  })();

  // The 3 recommendation questions are independent of each other and of
  // the cognition flow: run them all concurrently so a slow free-tier
  // model cannot multiply the total run time.
  const answersPromise = Promise.all(
    questions.map(async (question) => {
      try {
        const raw = String(await callModel(entry, question)).slice(0, RAW_CAP);
        const mentioned = isMentioned(name, raw);
        let recommended = [];
        let position = null;
        try {
          const judged = await judgeRecommendation(name, question, raw);
          recommended = judged.recommended;
          position = judged.targetPosition;
        } catch {
          // mentioned-only fallback
        }
        return { question, mentioned, position, recommended, raw };
      } catch (e) {
        return { question, error: String((e && e.message) || e).slice(0, 300) };
      }
    })
  );

  const [cognition, answers] = await Promise.all([cognitionPromise, answersPromise]);

  return { id: entry.id, label: entry.label, cognition, answers };
}

// ---------------------------------------------------------------------------
// Cooldown (per IP, in-memory)
// ---------------------------------------------------------------------------

const lastRunByIp = new Map();

export function cooldownStatus(ip) {
  const last = lastRunByIp.get(ip);
  if (!last) return { ok: true };
  const remainingMs = COOLDOWN_MS - (Date.now() - last);
  if (remainingMs <= 0) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export function markRunStarted(ip) {
  lastRunByIp.set(ip, Date.now());
  // Opportunistic cleanup so the map cannot grow unboundedly.
  if (lastRunByIp.size > 500) {
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const [key, ts] of lastRunByIp) {
      if (ts < cutoff) lastRunByIp.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Client IP (for the cooldown)
// ---------------------------------------------------------------------------

// Behind the site CDN the request reaches us via a proxy, so req.ip is the
// proxy's egress address — shared by every site visitor. The CDN sets
// x-forwarded-for with the real client first; key the cooldown on that.
export function clientIpFromRequest(req) {
  const xff = req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : typeof xff === 'string' ? xff.split(',')[0] : '';
  const candidate = String(first || '').trim();
  if (candidate) return candidate.slice(0, 64);
  return req?.ip || req?.socket?.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Async jobs (in-memory; result kept 30 minutes for the polling client)
// ---------------------------------------------------------------------------

const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map();

function pruneJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

// Fire-and-forget wrapper around runAiVisibility: the POST handler returns
// the runId immediately and the client polls GET .../runs/:runId. The run
// promise always resolves into the job record — it never rejects into the
// void (that would be an unhandled rejection and lose the error).
export function startAiVisibilityJob(params) {
  pruneJobs();
  const id = randomUUID();
  const job = { id, status: 'running', createdAt: Date.now(), result: null, error: null };
  jobs.set(id, job);
  runAiVisibility(params)
    .then((result) => {
      job.status = 'done';
      job.result = result;
    })
    .catch((e) => {
      job.status = 'error';
      job.error = String((e && e.message) || e).slice(0, 300);
    });
  return job;
}

export function getAiVisibilityJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    jobs.delete(id);
    return null;
  }
  return job;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runAiVisibility({ name, category, description }) {
  const questions = await generateQuestions({ name, category, description });
  const panel = getPanel();
  const models = await Promise.all(panel.map((entry) => runModel(entry, name, questions)));
  return {
    app: { name, category: category || null },
    generatedAt: new Date().toISOString(),
    questions,
    models,
  };
}
