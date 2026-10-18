-- Avisos privados de inscripción: sólo para la cuenta del jugador anotado.
-- Aplicado con Supabase apply_migration; esta copia documenta la configuración del servidor.
alter table public.club_notices
 add column recipient_user_id uuid references public.profiles(id) on delete cascade,
 add column registration_id uuid references public.registrations(id) on delete cascade;
create unique index club_notices_registration_unique on public.club_notices(registration_id) where registration_id is not null;
create index club_notices_recipient_created on public.club_notices(recipient_user_id,created_at desc) where recipient_user_id is not null;
alter policy club_notices_read on public.club_notices to authenticated
 using ((recipient_user_id is null or recipient_user_id=(select auth.uid())) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));

-- La casilla web mantiene su comportamiento: los avisos personales son para móvil.
create or replace function public.club_notice_inbox() returns setof public.club_notices
language sql stable set search_path='' as $$
 select n.* from public.club_notices n
 where n.recipient_user_id is null
 and n.created_at >= (select p.created_at from public.profiles p where p.id=(select auth.uid()) and p.active)
 and n.created_at > coalesce((select cleared_at from public.club_notice_inbox_state where user_id=(select auth.uid())),'-infinity'::timestamptz)
 and not exists(select 1 from public.club_notice_hidden h where h.user_id=(select auth.uid()) and h.notice_id=n.id)
 order by n.created_at desc,n.id limit 50;
$$;
create or replace function public.mobile_notice_inbox(p_installation uuid,p_existing boolean default false) returns jsonb
language plpgsql set search_path='' as $$
declare notices jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.mobile_notice_installations(user_id,installation_id,since_at)
 values(auth.uid(),p_installation,case when p_existing then now()-interval '14 days' else now() end) on conflict do nothing;
 select coalesce(jsonb_agg(row_to_json(n) order by n.created_at desc),'[]'::jsonb) into notices
 from (
   select all_notices.* from (
     select broadcast.* from public.club_notice_inbox() broadcast
     union all
     select targeted.* from public.club_notices targeted where targeted.recipient_user_id=auth.uid()
   ) all_notices
   join public.mobile_notice_installations s on s.user_id=auth.uid() and s.installation_id=p_installation
   where all_notices.created_at>=greatest(s.since_at,coalesce(s.cleared_at,s.since_at),now()-interval '14 days')
   and not exists(select 1 from public.mobile_notice_hidden h where h.user_id=auth.uid() and h.notice_id=all_notices.id)
   order by all_notices.created_at desc,all_notices.id limit 50
 ) n;
 return jsonb_build_object('notices',notices,'server_time',now(),'retention_days',14);
end;$$;

create or replace function vmgc_push.queue_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into vmgc_push.deliveries(notice_id,token,user_id,available_at)
 select new.id,d.token,d.user_id,case when new.recipient_user_id is null then now() else now()+interval '20 seconds' end
 from vmgc_push.devices d join public.profiles p on p.id=d.user_id
 where d.enabled and p.active and (new.recipient_user_id is null or d.user_id=new.recipient_user_id);
 return new;
end;$$;

create or replace function vmgc_push.notify_player_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); recipients uuid[]; recipient uuid; member_number text;
 actor_name text; tournament_name text; tournament_date text; departure text; hole text;
begin
 if actor is null or new.linked_player_id is null or new.registration_status in ('cancelled','review_required') then return new; end if;
 select coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(btrim(p.display_name),''),'Un integrante del club')
 into actor_name from public.profiles p where p.id=actor and p.active;
 if actor_name is null then return new; end if;
 select nullif(btrim(p.aag_member_number::text),'') into member_number from public.players p where p.id=new.linked_player_id;
 select array_agg(distinct p.profile_id) into recipients
 from public.players p join public.profiles u on u.id=p.profile_id and u.active
 where p.id=new.linked_player_id or (member_number is not null and nullif(btrim(p.aag_member_number::text),'')=member_number);
 -- No adivinar una cuenta cuando la vinculación es ambigua.
 if coalesce(cardinality(recipients),0)<>1 then return new; end if;
 recipient:=recipients[1];if recipient=actor then return new;end if;
 select t.name,to_char(t.tournament_date,'DD/MM/YYYY'),left(coalesce(l.line_time::text,b.start_time::text,''),5),l.starting_hole::text
 into tournament_name,tournament_date,departure,hole
 from public.tournaments t join public.starting_lines l on l.id=new.starting_line_id
 join public.starting_blocks b on b.id=l.starting_block_id and b.tournament_id=t.id
 where t.id=new.tournament_id;
 if tournament_name is null then return new;end if;
 insert into public.club_notices(title,body,destination,kind,created_by,recipient_user_id,registration_id)
 values('Te anotaron a un torneo',left(actor_name||' te inscribió en '||tournament_name||coalesce(' ('||tournament_date||')','')||'.'||case when departure<>'' then ' Tu salida es a las '||departure else '' end||coalesce(' por el hoyo '||hole,'')||'.',1000),
 'grilla_interactiva.html?torneo_id='||new.tournament_id::text,'manual',actor,recipient,new.id)
 on conflict (registration_id) where registration_id is not null do nothing;
 return new;
end;$$;
revoke all on function vmgc_push.notify_player_registration() from public,anon,authenticated;
create trigger notify_player_registration after insert on public.registrations
 for each row execute function vmgc_push.notify_player_registration();

-- Un borrado de inscripción elimina su aviso por FK; una cancelación lo retira también.
create or replace function vmgc_push.cancel_registration_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.registration_status='cancelled' then delete from public.club_notices where registration_id=new.id;end if;
 return new;
end;$$;
revoke all on function vmgc_push.cancel_registration_notice() from public,anon,authenticated;
create trigger cancel_registration_notice after update of registration_status on public.registrations
 for each row when (new.registration_status='cancelled') execute function vmgc_push.cancel_registration_notice();

-- Comprobar que el jugador siga en ese casillero antes de enviar el aviso.
create or replace function public.push_claim()
returns table(delivery_id bigint,notice_id uuid,token text,user_id uuid,title text,body text,image_url text,destination text)
language plpgsql security definer set search_path='' as $$
begin
 update vmgc_push.deliveries d set status='failed',last_error='REGISTRATION_CANCELLED_OR_CHANGED'
 from public.club_notices n where n.id=d.notice_id and n.registration_id is not null and d.status='pending'
 and not exists(select 1 from public.registrations r join public.line_slots s on s.id=r.line_slot_id
 where r.id=n.registration_id and r.registration_status not in ('cancelled','review_required') and s.linked_player_id=r.linked_player_id);
 return query
 with picked as(select d.id from vmgc_push.deliveries d where d.status='pending' and d.available_at<=now() and d.attempts<5 order by d.id limit 40 for update skip locked),
 claimed as(update vmgc_push.deliveries d set attempts=d.attempts+1,available_at=now()+interval '3 minutes' from picked where d.id=picked.id returning d.*)
 select c.id,n.id,c.token,c.user_id,n.title,n.body,n.image_url,n.destination from claimed c join public.club_notices n on n.id=c.notice_id;
end;$$;
