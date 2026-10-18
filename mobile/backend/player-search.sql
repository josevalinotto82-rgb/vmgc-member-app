-- Mobile search only. Invoker preserves existing table RLS; no personal contact fields.
alter table public.aag_enrolleds add column if not exists mobile_search_words tsvector generated always as (to_tsvector('simple',coalesce(search_text,''))) stored;
alter table public.players add column if not exists mobile_search_words tsvector generated always as (to_tsvector('simple',coalesce(search_text,''))) stored;
create index if not exists aag_enrolleds_mobile_words_idx on public.aag_enrolleds using gin (mobile_search_words);
create index if not exists players_mobile_words_idx on public.players using gin (mobile_search_words);

create or replace function public.mobile_player_search(p_term text, p_limit integer default 6)
returns setof jsonb language plpgsql stable security invoker
set search_path = '' as $$
declare
  term text := btrim(regexp_replace(lower(public.unaccent(left(coalesce(p_term,''),100))), '[^a-z0-9]+', ' ', 'g'));
  terms tsquery;
  numeric_term boolean;
begin
  if length(term)<2 or not exists(select 1 from public.profiles where id=(select auth.uid()) and active=true) then return; end if;
  numeric_term := term ~ '^[0-9]+$';
  select to_tsquery('simple',string_agg(quote_literal(w)||':*',' & ')) into terms from unnest(string_to_array(term,' ')) w where w<>'';
  return query
  with candidates as (
    select p.id::text id, p.aag_member_number, p.first_name,p.last_name,p.full_name,
      coalesce(e.current_index,p.current_index) current_index, coalesce(e.gender,p.gender) gender,
      coalesce(e.club_name,p.club_name) club_name,coalesce(e.option_club_id,p.option_club_id) option_club_id,
      (coalesce(e.option_club_id,p.option_club_id)=408 or p.is_club_member is true) is_club_member,
      coalesce(p.country,'Argentina') country,'players'::text origen_busqueda, 0 source_rank
    from public.players p left join public.aag_enrolleds e on e.enrollment_number=p.aag_member_number
    where case when numeric_term then p.aag_member_number=term else p.mobile_search_words @@ terms end
    union all
    select 'aag:'||e.enrollment_number,e.enrollment_number,e.first_name,e.last_name,e.full_name,
      e.current_index,e.gender,e.club_name,e.option_club_id,e.option_club_id=408,'Argentina','aag_enrolleds',1
    from public.aag_enrolleds e
    where case when numeric_term then e.enrollment_number=term else e.mobile_search_words @@ terms end
  ), unique_players as (
    select distinct on (coalesce(nullif(aag_member_number,''),id)) * from candidates
    order by coalesce(nullif(aag_member_number,''),id),source_rank
  )
  select to_jsonb(u)-'source_rank' from unique_players u
  order by coalesce(u.aag_member_number=term,false) desc, case
    when btrim(lower(public.unaccent(coalesce(u.last_name,split_part(u.full_name,',',1),'')))) = term then 0
    when btrim(lower(public.unaccent(coalesce(u.last_name,split_part(u.full_name,',',1),'')))) = split_part(term,' ',1) then 1
    when to_tsvector('simple',lower(public.unaccent(coalesce(u.last_name,split_part(u.full_name,',',1),'')))) @@ to_tsquery('simple',quote_literal(split_part(term,' ',1))||':*') then 2
    else 3 end,
    (u.is_club_member is true) desc, u.full_name,u.id
  limit greatest(1,least(coalesce(p_limit,6),15));
end;
$$;
revoke all on function public.mobile_player_search(text,integer) from public,anon;
grant execute on function public.mobile_player_search(text,integer) to authenticated;

