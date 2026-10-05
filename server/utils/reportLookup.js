/**
 * Pure decision logic for the public shared-report endpoints
 * (/api/shared-app-report, /api/shared-competitor-report).
 *
 * The contract the frontend edge function (netlify/edge-functions/prerender.ts)
 * relies on:
 *   200                                  -> report payload
 *   404 { code: 'not_found' }            -> DEFINITELY does not exist
 *   410 { code: 'expired' }              -> exists but past RECORD_EXPIRATION_HOURS
 *   503 { code: 'unavailable' }          -> transient: storage / DB error, try again
 * Only `code` is machine-readable; `error` stays human text for the SPA.
 * Anything without a `code` must be treated as ambiguous by clients.
 */

// Share IDs are md5 hex digests (generateUrlHash in server/utils.js).
export const SHARE_ID_RE = /^[0-9a-f]{32}$/i;

export const isValidShareId = (id) => typeof id === 'string' && SHARE_ID_RE.test(id);

/**
 * Normalise a Supabase storage download error into
 * { status, statusCode, error, message }.
 *
 * storage-js 2.x download() uses `noResolveJson`, so an HTTP error arrives as a
 * StorageUnknownError whose `originalError` is the raw fetch Response (no
 * `.status` on the error itself). StorageApiError (other calls) has `.status`.
 * We read the Response JSON body when it is still unread.
 */
export async function storageErrorInfo(error) {
  const info = {
    status: error?.status ?? error?.originalError?.status,
    statusCode: error?.statusCode,
    error: error?.error,
    message: error?.message,
  };
  const res = error?.originalError;
  if (res && typeof res.json === 'function' && !res.bodyUsed) {
    try {
      const body = await res.json();
      if (body && typeof body === 'object') {
        info.statusCode = body.statusCode ?? info.statusCode;
        info.error = body.error ?? info.error;
        info.message = body.message ?? body.msg ?? info.message;
      }
    } catch {
      /* non-JSON body: keep what we have */
    }
  }
  return info;
}

/**
 * Classify a normalised storage error (see storageErrorInfo).
 * 'not_found' only with BOTH an HTTP 400/404 AND an explicit object-not-found
 * indicator in the body; everything else (5xx, 429, network, auth, missing
 * bucket, unreadable body) is 'error' so we never claim "gone" on a blip.
 *
 * Supabase storage answers a missing object with HTTP 400 (older storage-api)
 * or 404 (newer) and body {"statusCode":"404","error":"not_found","message":"Object not found"}.
 */
export function classifyStorageError(info) {
  if (!info) return 'error';
  const status = Number(info.status);
  const bodyCode = String(info.statusCode ?? '');
  const text = `${info.error ?? ''} ${info.message ?? ''}`.toLowerCase();
  if (/bucket/.test(text)) return 'error'; // "Bucket not found" is a config error, not a missing report
  const explicitNotFound = bodyCode === '404' || /not[_ ]?found/.test(text);
  if ((status === 400 || status === 404) && explicitNotFound) return 'not_found';
  return 'error';
}

/**
 * Expiry check for DB rows. Unlike isRecordEntryExpired (used for the in-memory
 * cache), a missing/NULL timestamp is NOT treated as expired here: legacy rows
 * without a timestamp are still valid reports (see sitemap.js), and calling them
 * expired would be a false "gone".
 */
export function isRowExpired(timestamp, now, expirationMs) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return false;
  const ts = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(ts)) return false;
  return now - ts > expirationMs;
}

const NOT_FOUND = (msg) => ({ status: 404, body: { error: msg, code: 'not_found', shouldReanalyze: true } });
const EXPIRED = (msg) => ({ status: 410, body: { error: msg, code: 'expired', shouldReanalyze: true } });
const UNAVAILABLE = { status: 503, body: { error: 'Report temporarily unavailable. Please try again.', code: 'unavailable' } };

/**
 * App report decision after the storage download and the analysis_reports lookup.
 * @param {{storage:'ok'|'not_found'|'error', row:'present'|'absent'|'error', timestamp?:any, now:number, expirationMs:number}} s
 * @returns {{status:number, body?:object, serve?:true}}
 */
export function decideAppReport({ storage, row, timestamp, now, expirationMs }) {
  const expired = row === 'present' && isRowExpired(timestamp, now, expirationMs);
  if (storage === 'ok') {
    if (expired) return EXPIRED('Report expired. Please re-run the analysis.');
    // Row absent / row lookup failed / not expired: we have the report, serve it
    // (same as before this change).
    return { status: 200, serve: true };
  }
  if (storage === 'not_found') {
    if (row === 'absent') return NOT_FOUND('Report not found');
    if (row === 'present') {
      // Metadata exists but the file is definitively gone.
      return expired ? EXPIRED('Report expired. Please re-run the analysis.') : NOT_FOUND('Report not found');
    }
    return UNAVAILABLE; // could not confirm with the DB
  }
  return UNAVAILABLE;
}

/**
 * Competitor report decision after an in-memory cache miss and a
 * comparison_reports lookup by hash_url.
 * @param {{row:'present'|'absent'|'error', timestamp?:any, now:number, expirationMs:number}} s
 */
export function decideCompetitorReport({ row, timestamp, now, expirationMs }) {
  if (row === 'error') return UNAVAILABLE;
  if (row === 'absent') return NOT_FOUND('Report not found. Please re-run the comparison.');
  if (isRowExpired(timestamp, now, expirationMs)) return EXPIRED('Report expired. Please re-run the comparison.');
  return { status: 200, serve: true };
}
