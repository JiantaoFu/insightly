create table report_section_embeddings (
  id bigint primary key generated always as identity,
  report_id UUID references analysis_reports(id) on delete cascade,
  content text,
  embedding vector(384),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add checksum column to analysis_reports if not exists
alter table analysis_reports 
add column if not exists embedding_checksum text;

-- Create embedding search function
create or replace function match_report_sections(
  query_embedding vector(384),
  similarity_threshold float,
  match_count int
)
returns table (
  id bigint,
  report_id UUID,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    report_section_embeddings.id,
    report_section_embeddings.report_id,
    report_section_embeddings.content,
    1 - (report_section_embeddings.embedding <=> query_embedding) as similarity
  from report_section_embeddings
  where 1 - (report_section_embeddings.embedding <=> query_embedding) > similarity_threshold
  order by report_section_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;