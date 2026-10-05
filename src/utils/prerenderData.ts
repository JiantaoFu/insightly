/**
 * Data embedded by netlify/edge-functions/prerender.ts as
 * <script type="application/json" id="__INSIGHTLY_DATA__">.
 *
 * Lets a page render the prerendered content on its very first React render
 * (no loading spinner, no second fetch). Read once: after the first consumer
 * takes it, client-side navigation fetches as usual.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- shapes are the backend API payloads, untyped elsewhere too */
type PrerenderData =
  | { kind: 'app-report'; shareId: string; appDetails: any; report: string }
  | { kind: 'competitor-report'; shareId: string; report: string }
  | { kind: 'db-analyses'; pageSize: number; results: any[]; pagination: any }
  // Served with HTTP 410: the backend definitively said the report is gone.
  | { kind: 'report-gone'; shareId: string; reportType: 'app' | 'competitor'; reason: string };
/* eslint-enable @typescript-eslint/no-explicit-any */

let cached: PrerenderData | null | undefined;

function read(): PrerenderData | null {
  if (cached !== undefined) return cached;
  cached = null as PrerenderData | null;
  try {
    const el = typeof document !== 'undefined' ? document.getElementById('__INSIGHTLY_DATA__') : null;
    if (el?.textContent) cached = JSON.parse(el.textContent);
    el?.remove();
  } catch {
    cached = null;
  }
  return cached ?? null;
}

export function takePrerenderData<K extends PrerenderData['kind']>(
  kind: K,
  match: (d: Extract<PrerenderData, { kind: K }>) => boolean = () => true
): Extract<PrerenderData, { kind: K }> | null {
  const d = read();
  if (!d || d.kind !== kind || !match(d as Extract<PrerenderData, { kind: K }>)) return null;
  cached = null; // single use
  return d as Extract<PrerenderData, { kind: K }>;
}
