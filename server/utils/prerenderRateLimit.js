/**
 * /api rate limiting, with a separate budget for the Netlify edge prerender.
 *
 * Why: netlify/edge-functions/prerender.ts fetches report data from this
 * backend for every CDN miss (crawlers, shared links). Those requests come
 * from Netlify's shared egress IPs, so the normal per-IP limit (100 / 15 min)
 * is exhausted quickly; the edge then gets 429 and serves the 200 home-page
 * shell -- duplicate content for Google.
 *
 * How: when PRERENDER_SHARED_SECRET is set (Render) and a request carries the
 * same value in the `X-Insightly-Prerender-Key` header (sent by the edge
 * function when the same env var is set on Netlify), it is counted against a
 * separate, higher, global budget instead of the per-IP one. Only GET requests
 * to the read-only endpoints the edge uses qualify, so a leaked key can't be
 * used to bypass limits on analysis/payment/auth endpoints.
 *
 * Secret missing / too short / wrong header: exactly the old behaviour.
 * The secret value is never logged.
 */
import crypto from 'node:crypto';

export const PRERENDER_KEY_HEADER = 'x-insightly-prerender-key';
export const PRERENDER_SECRET_ENV = 'PRERENDER_SHARED_SECRET';
export const MIN_SECRET_LENGTH = 32;
// Paths relative to the '/api' mount (req.path inside app.use('/api', ...)).
export const PRERENDER_PATHS = new Set(['/shared-app-report', '/shared-competitor-report', '/db-analyses']);
export const DEFAULT_PRERENDER_LIMIT = 3000; // per 15 min, all edge traffic together

/** The configured secret, or null if unset / too short (treated as unset). */
export function configuredSecret(env = process.env) {
  const s = typeof env[PRERENDER_SECRET_ENV] === 'string' ? env[PRERENDER_SECRET_ENV].trim() : '';
  return s.length >= MIN_SECRET_LENGTH ? s : null;
}

/** Constant-time comparison (hash first so lengths always match). */
export function isValidPrerenderKey(provided, secret) {
  if (!secret || typeof provided !== 'string' || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export function isPrerenderRequest(req, secret) {
  return req.method === 'GET' && PRERENDER_PATHS.has(req.path) && isValidPrerenderKey(req.get(PRERENDER_KEY_HEADER), secret);
}

export function prerenderLimit(env = process.env) {
  const n = parseInt(env.PRERENDER_RATE_LIMIT_MAX, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRERENDER_LIMIT;
}

/**
 * @param {object} o
 * @param {Function} o.apiLimiter        existing per-IP limiter
 * @param {Function} o.prerenderLimiter  limiter for authenticated edge requests
 * @param {() => string|null} [o.getSecret]
 * @param {object} [o.log]
 */
export function createApiRateLimit({ apiLimiter, prerenderLimiter, getSecret = () => configuredSecret(), log = console }) {
  const secretAtStart = getSecret();
  log.log(`Edge prerender rate-limit budget: ${secretAtStart ? 'enabled' : `disabled (${PRERENDER_SECRET_ENV} not set or shorter than ${MIN_SECRET_LENGTH} chars)`}`);

  return (req, res, next) => {
    const origin = req.headers.origin || '';
    // Unchanged: GitHub Actions bypass.
    if (origin.includes('github.com')) {
      console.log('Bypassing rate limit for GitHub Actions request');
      return next();
    }
    if (isPrerenderRequest(req, getSecret())) {
      req.isEdgePrerender = true;
      return prerenderLimiter(req, res, next);
    }
    return apiLimiter(req, res, next);
  };
}
