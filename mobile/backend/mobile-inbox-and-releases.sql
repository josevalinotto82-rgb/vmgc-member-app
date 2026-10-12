create table public.mobile_notice_installations (
 user_id uuid not null references auth.users(id) on delete cascade,
 installation_id uuid not null,
 since_at timestamptz not null default now(),
 cleared_at timestamptz,
 primary key(user_id,installation_id)
);
alter table public.mobile_notice_installations enable row level security;
revoke all on public.mobile_notice_installations from public,anon,authenticated;
grant select,insert,update on public.mobile_notice_installations to authenticated;
grant all on public.mobile_notice_installations to service_role;
create policy mobile_installations_owner on public.mobile_notice_installations to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table public.mobile_notice_hidden (
 user_id uuid not null references auth.users(id) on delete cascade,
 notice_id uuid not null references public.club_notices(id) on delete cascade,
 primary key(user_id,notice_id)
);
alter table public.mobile_notice_hidden enable row level security;
revoke all on public.mobile_notice_hidden from public,anon,authenticated;
grant select,insert on public.mobile_notice_hidden to authenticated;
grant all on public.mobile_notice_hidden to service_role;
create policy mobile_hidden_owner on public.mobile_notice_hidden to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.mobile_notice_inbox(p_installation uuid,p_existing boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare notices jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.mobile_notice_installations(user_id,installation_id,since_at)
 values(auth.uid(),p_installation,case when p_existing then now()-interval '14 days' else now() end)
 on conflict do nothing;
 select coalesce(jsonb_agg(row_to_json(n) order by n.created_at desc),'[]'::jsonb) into notices
 from public.club_notice_inbox() n
 join public.mobile_notice_installations s on s.user_id=auth.uid() and s.installation_id=p_installation
 where n.created_at>=greatest(s.since_at,coalesce(s.cleared_at,s.since_at),now()-interval '14 days')
 and not exists(select 1 from public.mobile_notice_hidden h where h.user_id=auth.uid() and h.notice_id=n.id);
 return jsonb_build_object('notices',notices,'server_time',now(),'retention_days',14);
end;$$;
revoke all on function public.mobile_notice_inbox(uuid,boolean) from public,anon;
grant execute on function public.mobile_notice_inbox(uuid,boolean) to authenticated;
create function public.mobile_notice_clear(p_installation uuid)
returns void language sql security invoker set search_path='' as $$
 update public.mobile_notice_installations set cleared_at=now() where user_id=(select auth.uid()) and installation_id=p_installation;
$$;
revoke all on function public.mobile_notice_clear(uuid) from public,anon;
grant execute on function public.mobile_notice_clear(uuid) to authenticated;
create table public.mobile_app_releases(
 platform text not null check(platform in ('ios','android')),
 channel text not null check(channel in ('production','alpha')),
 latest_version text not null,
 latest_build bigint,
 store_url text not null,
 minimum_version text,
 minimum_build bigint,
 message text not null default 'Hay una nueva versión de Villa María Golf. Actualizá para disfrutar las últimas mejoras.',
 published_at timestamptz not null default now(),
 checked_at timestamptz not null default now(),
 primary key(platform,channel)
);
alter table public.mobile_app_releases enable row level security;
revoke all on public.mobile_app_releases from public,anon,authenticated;
grant select on public.mobile_app_releases to anon,authenticated;
grant all on public.mobile_app_releases to service_role;
create policy mobile_releases_read on public.mobile_app_releases for select to anon,authenticated using(true);
create table public.mobile_release_sync_state(
 id integer primary key check(id=1),
 token text not null default(gen_random_uuid()::text||gen_random_uuid()::text),
 last_attempt timestamptz,
 last_status jsonb not null default '{}'::jsonb
);
alter table public.mobile_release_sync_state enable row level security;
revoke all on public.mobile_release_sync_state from public,anon,authenticated;
grant all on public.mobile_release_sync_state to service_role;
insert into public.mobile_release_sync_state(id) values(1);
create index if not exists mobile_notice_hidden_notice_idx on public.mobile_notice_hidden(notice_id);
