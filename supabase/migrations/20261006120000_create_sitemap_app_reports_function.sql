-- Sitemap: list only shared app reports that actually resolve (HTTP 200).
--
-- /api/shared-app-report serves a report from the zip in the `reports`
-- storage bucket (<h[0:2]>/<h[2:4]>/<hash>.zip). saveToSupabase() inserts the
-- analysis_reports row BEFORE uploading that zip and only logs upload
-- failures, so a row can exist without its object; such URLs answer
-- 404 {code:'not_found'} (served as 410 by the edge) and must not be in the
-- sitemap.
--
-- Supabase keeps storage metadata in Postgres (storage.objects, unique index
-- on (bucket_id, name)), so existence is an indexed EXISTS probe here instead
-- of one storage API call per report. PostgREST does not expose the storage
-- schema, hence a SECURITY DEFINER function returning only (hash_url,
-- timestamp) -- both already public via the sitemap itself.
--
-- p_min_timestamp: rows older than this (ms epoch) are expired
--   (RECORD_EXPIRATION_HOURS, computed by the backend). NULL timestamps are
--   NOT expired (same rule as server/utils/reportLookup.js isRowExpired).
create or replace function public.sitemap_app_reports(
  p_min_timestamp bigint default 0,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (hash_url text, "timestamp" bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.hash_url, a."timestamp"
  from public.analysis_reports a
  where a.hash_url ~* '^[0-9a-f]{32}$'
    and (a."timestamp" is null or a."timestamp" >= coalesce(p_min_timestamp, 0))
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'reports'
        and o.name = substr(a.hash_url, 1, 2) || '/' || substr(a.hash_url, 3, 2) || '/' || a.hash_url || '.zip'
    )
  order by a."timestamp" desc nulls last, a.hash_url
  limit least(greatest(coalesce(p_limit, 1000), 0), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.sitemap_app_reports(bigint, integer, integer) from public;
grant execute on function public.sitemap_app_reports(bigint, integer, integer) to anon, authenticated, service_role;

comment on function public.sitemap_app_reports(bigint, integer, integer) is
  'Sitemap feed: analysis_reports rows that are not expired and whose reports/<h0-1>/<h2-3>/<hash>.zip storage object exists. Paged (max 1000/call), newest first.';
