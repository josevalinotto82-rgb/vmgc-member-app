-- Each limit is inclusive; the next range starts strictly above it.
-- Full supported index domain: -10 through 54. Save all ranges atomically.
create table public.tee_recommendation_settings (
  aag_field_id integer primary key,
  rules jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.tee_recommendation_settings enable row level security;
revoke all on public.tee_recommendation_settings from anon, authenticated;
grant select on public.tee_recommendation_settings to authenticated;
grant update (rules) on public.tee_recommendation_settings to authenticated;
grant all on public.tee_recommendation_settings to service_role;
create policy "Members read tee recommendations" on public.tee_recommendation_settings
for select to authenticated using (true);
create policy "Active admins update tee recommendations" on public.tee_recommendation_settings
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true and p.role='admin'));

create function public.validate_tee_recommendation_settings() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare g text; item jsonb; previous numeric; boundary numeric; position integer;
begin
  if jsonb_typeof(new.rules) is distinct from 'object'
    or not (new.rules ? 'male' and new.rules ? 'female') then
    raise exception 'Se requieren rangos para caballeros y damas.';
  end if;
  foreach g in array array['male','female'] loop
    if jsonb_typeof(new.rules->g) is distinct from 'array'
      or jsonb_array_length(new.rules->g) not between 1 and 4 then
      raise exception 'Cada categoría debe tener entre uno y cuatro rangos.';
    end if;
    previous := -10; position := 0;
    for item in select value from jsonb_array_elements(new.rules->g) loop
      if item->>'tee' is null or item->>'tee' not in ('Negro','Amarillo','Blanco','Rojo')
        or jsonb_typeof(item->'max_index') is distinct from 'number' then
        raise exception 'Tee o límite de Index inválido.';
      end if;
      boundary := (item->>'max_index')::numeric;
      if boundary < -10 or boundary > 54 or (position > 0 and boundary <= previous) then
        raise exception 'Los límites deben estar ordenados, sin superposición, entre -10 y 54.';
      end if;
      previous := boundary; position := position + 1;
    end loop;
    if previous <> 54 then raise exception 'El último rango debe terminar en Index 54.'; end if;
    if (select count(distinct value->>'tee') from jsonb_array_elements(new.rules->g)) <> position then
      raise exception 'No se puede repetir un tee en la misma categoría.';
    end if;
  end loop;
  if TG_OP = 'UPDATE' then new.revision := old.revision + 1; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.validate_tee_recommendation_settings() from public, anon, authenticated;
create trigger validate_tee_recommendation_settings before insert or update
on public.tee_recommendation_settings for each row execute function public.validate_tee_recommendation_settings();
insert into public.tee_recommendation_settings(aag_field_id,rules) values
(1466,'{"male":[{"tee":"Negro","max_index":9},{"tee":"Amarillo","max_index":15},{"tee":"Blanco","max_index":54}],"female":[{"tee":"Rojo","max_index":54}]}');
