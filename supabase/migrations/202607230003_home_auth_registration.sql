alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists contact_number text not null default '',
  add column if not exists country_calling_code text;

update public.profiles
set
  first_name = coalesce(nullif(first_name, ''), split_part(coalesce(full_name, ''), ' ', 1), ''),
  last_name = coalesce(
    nullif(last_name, ''),
    nullif(trim(regexp_replace(coalesce(full_name, ''), '^[^ ]+ ?', '')), ''),
    ''
  ),
  email = lower(coalesce(email, '')),
  contact_number = coalesce(contact_number, '')
where true;

alter table public.profiles
  alter column email set not null;

alter table public.businesses
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists province_region text,
  add column if not exists postal_code text,
  add column if not exists country_code text not null default 'ZA',
  add column if not exists currency_symbol text not null default 'R',
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists registration_idempotency_key text;

create unique index if not exists businesses_registration_idempotency_key_idx
  on public.businesses (registration_idempotency_key)
  where registration_idempotency_key is not null;

alter table public.business_users
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists business_users_set_updated_at on public.business_users;
create trigger business_users_set_updated_at
  before update on public.business_users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first_name text := trim(coalesce(v_meta->>'first_name', ''));
  v_last_name text := trim(coalesce(v_meta->>'last_name', ''));
  v_email text := lower(trim(coalesce(new.email, v_meta->>'email', '')));
  v_contact_number text := trim(coalesce(v_meta->>'contact_number', ''));
  v_calling_code text := trim(coalesce(v_meta->>'country_calling_code', ''));
  v_business_name text := trim(coalesce(v_meta->>'business_name', ''));
  v_address_line_1 text := nullif(trim(coalesce(v_meta->>'address_line_1', '')), '');
  v_address_line_2 text := nullif(trim(coalesce(v_meta->>'address_line_2', '')), '');
  v_city text := nullif(trim(coalesce(v_meta->>'city', '')), '');
  v_province_region text := nullif(trim(coalesce(v_meta->>'province_region', '')), '');
  v_postal_code text := nullif(trim(coalesce(v_meta->>'postal_code', '')), '');
  v_country_code text := upper(trim(coalesce(v_meta->>'country_code', 'ZA')));
  v_currency_code text := upper(trim(coalesce(v_meta->>'currency_code', 'ZAR')));
  v_currency_symbol text := trim(coalesce(v_meta->>'currency_symbol', 'R'));
  v_timezone text := trim(coalesce(v_meta->>'timezone', 'Africa/Johannesburg'));
  v_idempotency_key text := nullif(trim(coalesce(v_meta->>'registration_idempotency_key', '')), '');
  v_business_id uuid;
  v_location_id uuid;
  v_address text;
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    full_name,
    email,
    contact_number,
    country_calling_code,
    avatar_url
  )
  values (
    new.id,
    v_first_name,
    v_last_name,
    trim(v_first_name || ' ' || v_last_name),
    v_email,
    v_contact_number,
    v_calling_code,
    null
  )
  on conflict (id) do update
    set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      full_name = excluded.full_name,
      email = excluded.email,
      contact_number = excluded.contact_number,
      country_calling_code = excluded.country_calling_code,
      updated_at = now();

  if coalesce(v_meta->>'registration_intent', '') <> 'owner_business' then
    return new;
  end if;

  if v_first_name = '' or v_last_name = '' or v_email = '' or v_contact_number = '' then
    raise exception 'Registration user details are incomplete.';
  end if;

  if v_business_name = '' or v_country_code = '' or v_currency_code = '' then
    raise exception 'Registration business details are incomplete.';
  end if;

  if v_idempotency_key is not null then
    select id
    into v_business_id
    from public.businesses
    where registration_idempotency_key = v_idempotency_key
      and created_by = new.id
    limit 1;
  end if;

  if v_business_id is null then
    insert into public.businesses (
      name,
      currency_code,
      currency_symbol,
      timezone,
      vat_percentage,
      address_line_1,
      address_line_2,
      city,
      province_region,
      postal_code,
      country_code,
      created_by,
      registration_idempotency_key
    )
    values (
      v_business_name,
      v_currency_code,
      v_currency_symbol,
      v_timezone,
      0,
      v_address_line_1,
      v_address_line_2,
      v_city,
      v_province_region,
      v_postal_code,
      v_country_code,
      new.id,
      v_idempotency_key
    )
    returning id into v_business_id;
  end if;

  insert into public.business_users (business_id, user_id, role, is_active)
  values (v_business_id, new.id, 'owner', true)
  on conflict (business_id, user_id) do update
    set role = 'owner',
        is_active = true,
        updated_at = now();

  v_address := concat_ws(
    ', ',
    v_address_line_1,
    v_address_line_2,
    v_city,
    v_province_region,
    v_postal_code,
    v_country_code
  );

  select id
  into v_location_id
  from public.locations
  where business_id = v_business_id
  order by created_at
  limit 1;

  if v_location_id is null then
    insert into public.locations (
      business_id,
      name,
      location_code,
      timezone,
      address
    )
    values (
      v_business_id,
      'Main Location',
      'MAIN',
      v_timezone,
      nullif(v_address, '')
    )
    returning id into v_location_id;
  end if;

  insert into public.location_users (location_id, user_id)
  values (v_location_id, new.id)
  on conflict (location_id, user_id) do nothing;

  update public.profiles
  set
    default_business_id = v_business_id,
    default_location_id = v_location_id,
    updated_at = now()
  where id = new.id;

  return new;
exception
  when others then
    raise exception 'Registration setup could not be completed.';
end;
$$;

drop trigger if exists on_auth_user_created_registration on auth.users;
create trigger on_auth_user_created_registration
  after insert on auth.users
  for each row execute function public.handle_new_user_registration();
