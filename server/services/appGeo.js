// Per-app AI Visibility (GEO) persistence for the app report page.
//
// The standalone /ai-visibility tool keeps nothing: every visit re-runs
// and burns free-tier model quota. Inside an app report the result is
// part of the report, so the latest run per app is stored and reused:
//
//   record = {
//     app:     { hashUrl, name, category, platform },
//     latest:  <full runAiVisibility result>,
//     history: [{ generatedAt, mentions, answers,
//                 perModel: { <modelId>: { mentioned, total } } }, ...]
//                // newest first, capped — enough to show change vs the
//                // previous check without keeping every raw answer,
//     updatedAt: <ISO string>,
//   }
//
// Storage reuses the existing persistence layer: the same Supabase
// 'reports' Storage bucket that already holds the analysis report blobs
// (server/index.js saveToSupabase / getReportFromStorage), one JSON
// object per app at geo/<hashUrl>.json — the codebase's blob-persistence
// pattern, no new database or stack, no schema migration to apply
// out-of-band before this can work in production.
//
// Freshness: a stored result younger than GEO_APP_CACHE_DAYS (default 7)
// is served instead of running again; an explicit force re-run bypasses
// the cache (the per-IP run cooldown in aiVisibility.js still applies —
// that check stays in the route).

import { supabase } from '../supabaseClient.js';
import { storageErrorInfo, classifyStorageError } from '../utils/reportLookup.js';

const BUCKET = 'reports';
const HISTORY_CAP = 12;

export const GEO_APP_CACHE_DAYS = (() => {
  const parsed = Number(process.env.GEO_APP_CACHE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
})();

export function geoStoragePath(hashUrl) {
  return `geo/${hashUrl}.json`;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested by the harness; no I/O)
// ---------------------------------------------------------------------------

// Compact per-run totals: how many recommendation answers mentioned the
// app, overall and per model. Errored answers/models don't count.
export function summarizeRun(result) {
  const perModel = {};
  let mentions = 0;
  let answers = 0;
  for (const model of result?.models || []) {
    let mentioned = 0;
    let total = 0;
    for (const answer of model.answers || []) {
      if (answer && !('error' in answer)) {
        total += 1;
        if (answer.mentioned) mentioned += 1;
      }
    }
    perModel[model.id] = { mentioned, total };
    mentions += mentioned;
    answers += total;
  }
  return { mentions, answers, perModel };
}

export function historyEntryFor(result) {
  return { generatedAt: result.generatedAt, ...summarizeRun(result) };
}

// Build the record to store after a completed run, folding the new run
// into any previous record's history.
export function buildGeoRecord(prevRecord, result, appMeta) {
  const history = [historyEntryFor(result), ...(prevRecord?.history || [])].slice(
    0,
    HISTORY_CAP
  );
  return {
    app: {
      hashUrl: appMeta.hashUrl,
      name: appMeta.name,
      category: appMeta.category ?? prevRecord?.app?.category ?? result?.app?.category ?? null,
      platform: appMeta.platform ?? prevRecord?.app?.platform ?? null,
    },
    latest: result,
    history,
    updatedAt: new Date().toISOString(),
  };
}

export function isFreshRecord(record, nowMs = Date.now(), cacheDays = GEO_APP_CACHE_DAYS) {
  const generatedAt = Date.parse(record?.latest?.generatedAt || '');
  if (!Number.isFinite(generatedAt)) return false;
  return nowMs - generatedAt < cacheDays * 24 * 60 * 60 * 1000;
}

// The run decision for POST /api/ai-visibility/apps/:hashUrl/run:
// serve the stored result while it is fresh, unless the caller forces a
// re-run. (Cooldown is a separate, route-level concern.)
export function planAppRun({ record, force, nowMs = Date.now(), cacheDays = GEO_APP_CACHE_DAYS }) {
  if (!force && isFreshRecord(record, nowMs, cacheDays)) {
    return { action: 'cached', result: record.latest };
  }
  return { action: 'run' };
}

// ---------------------------------------------------------------------------
// Storage (Supabase 'reports' bucket; injectable client for tests)
// ---------------------------------------------------------------------------

export async function loadGeoRecord(hashUrl, client = supabase) {
  const { data, error } = await client.storage.from(BUCKET).download(geoStoragePath(hashUrl));
  if (error) {
    const info = await storageErrorInfo(error);
    if (classifyStorageError(info) === 'not_found') return null;
    throw new Error(`GEO record download failed: ${info.message || error.message || 'unknown'}`);
  }
  if (!data) return null;
  let text;
  if (typeof data.text === 'function') {
    text = await data.text();
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  } else if (data.buffer instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data.buffer);
  } else {
    throw new Error('GEO record download returned an unexpected type');
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    throw new Error('GEO record is not valid JSON');
  }
}

export async function saveGeoRecord(hashUrl, record, client = supabase) {
  const body = new TextEncoder().encode(JSON.stringify(record));
  const { error } = await client.storage
    .from(BUCKET)
    .upload(geoStoragePath(hashUrl), body, { contentType: 'application/json', upsert: true });
  if (error) {
    throw new Error(`GEO record upload failed: ${error.message || 'unknown'}`);
  }
}
