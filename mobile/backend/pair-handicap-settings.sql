create table public.pair_handicap_settings (
 aag_field_id integer not null,
 modality text not null check(modality in ('clasico','americana')),
 config_version integer not null default 1 check(config_version=1),
 tee_strategy text not null check(tee_strategy in ('fixed_by_gender','individual_recommended','most_demanding_pair')),
 male_fixed_tee text not null check(male_fixed_tee in ('Negro','Amarillo','Blanco')),
 female_fixed_tee text not null default 'Rojo' check(female_fixed_tee='Rojo'),
 female_tee_strategy text not null default 'fixed' check(female_tee_strategy='fixed'),
 base_formula text not null default 'index_slope_113_plus_rating_minus_par' check(base_formula='index_slope_113_plus_rating_minus_par'),
 individual_rounding text not null default 'none' check(individual_rounding='none'),
 max_base_difference numeric check(max_base_difference>=0 and max_base_difference<=108),
 difference_adjustment text not null default 'reduce_higher_base' check(difference_adjustment='reduce_higher_base'),
 combination text not null check(combination in ('sum_adjusted_bases','each_adjusted_base')),
 factor numeric not null check(factor>0 and factor<=1),
 final_rounding text not null default 'half_toward_positive_infinity' check(final_rounding='half_toward_positive_infinity'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(aag_field_id,modality)
);
alter table public.pair_handicap_settings enable row level security;
revoke all on public.pair_handicap_settings from anon,authenticated;
grant select on public.pair_handicap_settings to authenticated;
grant update(tee_strategy,male_fixed_tee,female_fixed_tee,max_base_difference,factor,combination) on public.pair_handicap_settings to authenticated;
grant all on public.pair_handicap_settings to service_role;
create policy "Read pair handicap settings" on public.pair_handicap_settings for select to authenticated using(true);
create policy "Admins edit pair handicap settings" on public.pair_handicap_settings for update to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and active=true and role='admin'))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and active=true and role='admin'));
create function public.stamp_pair_handicap_settings() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1; new.updated_at:=now(); return new; end $$;
revoke all on function public.stamp_pair_handicap_settings() from public,anon,authenticated;
create trigger stamp_pair_handicap_settings before update on public.pair_handicap_settings for each row execute function public.stamp_pair_handicap_settings();
insert into public.pair_handicap_settings(aag_field_id,modality,tee_strategy,male_fixed_tee,max_base_difference,combination,factor)
values(1466,'clasico','fixed_by_gender','Negro',5,'sum_adjusted_bases',0.375);
comment on table public.pair_handicap_settings is 'Versioned declarative pair calculator settings. No tournament categories. Clients must implement config_version before using settings.';
comment on column public.pair_handicap_settings.max_base_difference is 'Difference between unrounded course handicap bases; null disables limit. Reduce larger base to smaller plus limit before combination.';
comment on column public.pair_handicap_settings.final_rounding is 'floor(result + 0.5), including negative results. Round only after factor.';
