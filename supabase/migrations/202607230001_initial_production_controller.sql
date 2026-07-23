create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.convert_quantity(
  p_quantity numeric,
  p_from_uom text,
  p_to_uom text
)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_quantity is null then
    return 0;
  end if;

  if p_from_uom = p_to_uom then
    return p_quantity;
  end if;

  if p_from_uom = 'kg' and p_to_uom = 'g' then
    return p_quantity * 1000;
  end if;

  if p_from_uom = 'g' and p_to_uom = 'kg' then
    return p_quantity / 1000;
  end if;

  if p_from_uom = 'L' and p_to_uom = 'ml' then
    return p_quantity * 1000;
  end if;

  if p_from_uom = 'ml' and p_to_uom = 'L' then
    return p_quantity / 1000;
  end if;

  return p_quantity;
end;
$$;

create or replace function public.calculate_ingredient_unit_cost(
  p_purchase_quantity numeric,
  p_purchase_uom text,
  p_recipe_base_uom text,
  p_purchase_cost numeric
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_converted_quantity numeric;
begin
  v_converted_quantity := public.convert_quantity(
    p_purchase_quantity,
    p_purchase_uom,
    p_recipe_base_uom
  );

  if v_converted_quantity <= 0 then
    return 0;
  end if;

  return round(p_purchase_cost / v_converted_quantity, 6);
end;
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_code text,
  currency_code text not null default 'ZAR',
  vat_percentage numeric not null default 15,
  timezone text not null default 'Africa/Johannesburg',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  location_code text,
  timezone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  default_business_id uuid references public.businesses(id),
  default_location_id uuid references public.locations(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint business_users_role_check check (
    role in ('owner', 'administrator', 'manager', 'production_user', 'viewer')
  ),
  constraint business_users_business_user_key unique (business_id, user_id)
);

create table public.location_users (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint location_users_location_user_key unique (location_id, user_id)
);

create table public.units_of_measure (
  code text primary key,
  label text not null,
  uom_type text not null,
  sort_order integer not null default 0
);

create table public.production_statuses (
  code text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_terminal boolean not null default false
);

create table public.ingredient_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ingredient_categories_business_name_key unique (business_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_business_name_key unique (business_id, name)
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.ingredient_categories(id),
  supplier_id uuid references public.suppliers(id),
  name text not null,
  description text,
  sku text,
  purchase_quantity numeric not null,
  purchase_uom text not null,
  purchase_cost numeric not null,
  recipe_base_uom text not null,
  cost_per_base_unit numeric not null,
  default_wastage_percentage numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_purchase_quantity_check check (purchase_quantity > 0),
  constraint ingredients_purchase_cost_check check (purchase_cost >= 0),
  constraint ingredients_wastage_check check (
    default_wastage_percentage >= 0 and default_wastage_percentage <= 100
  )
);

create unique index ingredients_business_sku_key
  on public.ingredients (business_id, sku)
  where sku is not null;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  recipe_code text,
  category text,
  description text,
  status text not null default 'draft',
  current_version_number integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint recipes_status_check check (status in ('draft', 'active', 'archived'))
);

create unique index recipes_business_code_key
  on public.recipes (business_id, recipe_code)
  where recipe_code is not null;

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version_number integer not null,
  main_ingredient_id uuid references public.ingredients(id),
  base_main_quantity numeric not null,
  base_main_uom text not null,
  expected_yield numeric,
  expected_yield_uom text,
  expected_yield_percentage numeric,
  expected_production_loss numeric,
  formula_ingredient_cost numeric not null default 0,
  estimated_additional_cost numeric not null default 0,
  expected_total_cost numeric not null default 0,
  expected_cost_per_yield_unit numeric,
  default_selling_unit_quantity numeric,
  default_selling_unit_uom text,
  default_pricing_method text,
  default_pricing_percentage numeric,
  expected_selling_price numeric,
  method_introduction text,
  is_current boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint recipe_versions_recipe_version_key unique (recipe_id, version_number),
  constraint recipe_versions_pricing_method_check check (
    default_pricing_method is null
    or default_pricing_method in ('markup', 'gross_margin')
  )
);

create table public.recipe_formula_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  formula_quantity numeric not null,
  formula_uom text not null,
  converted_base_quantity numeric not null,
  ingredient_cost_snapshot numeric not null,
  line_cost numeric not null,
  is_main_ingredient boolean not null default false,
  is_optional boolean not null default false,
  wastage_percentage numeric not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint recipe_formula_quantity_check check (formula_quantity > 0),
  constraint recipe_formula_wastage_check check (
    wastage_percentage >= 0 and wastage_percentage <= 100
  )
);

create unique index recipe_formula_one_main_ingredient
  on public.recipe_formula_lines (recipe_version_id)
  where is_main_ingredient;

create table public.recipe_method_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  step_number integer not null,
  title text,
  instructions text not null,
  duration_minutes integer,
  temperature_value numeric,
  temperature_uom text,
  equipment text,
  notes text,
  image_path text,
  created_at timestamptz not null default now(),
  constraint recipe_method_step_unique unique (recipe_version_id, step_number)
);

create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  image_type text,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.ingredient_images (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  image_type text,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id),
  batch_number text not null,
  recipe_id uuid not null references public.recipes(id),
  recipe_version_id uuid not null references public.recipe_versions(id),
  status text not null default 'draft',
  responsible_user_id uuid references auth.users(id),
  started_by uuid references auth.users(id),
  completed_by uuid references auth.users(id),
  start_datetime timestamptz,
  end_datetime timestamptz,
  main_ingredient_id uuid references public.ingredients(id),
  base_main_quantity numeric not null,
  base_main_uom text not null,
  actual_main_quantity numeric not null,
  actual_main_uom text not null,
  scaling_factor numeric not null,
  starting_yield numeric,
  starting_yield_uom text,
  completed_yield numeric,
  completed_yield_uom text,
  yield_percentage numeric,
  production_loss numeric,
  production_loss_percentage numeric,
  expected_ingredient_cost numeric not null default 0,
  actual_ingredient_cost numeric not null default 0,
  additional_cost numeric not null default 0,
  total_production_cost numeric not null default 0,
  selling_unit_quantity numeric,
  selling_unit_uom text,
  number_of_sellable_units numeric,
  cost_per_selling_unit numeric,
  pricing_method text,
  pricing_percentage numeric,
  recommended_selling_price_ex_vat numeric,
  vat_percentage numeric not null default 15,
  recommended_selling_price_inc_vat numeric,
  manual_selling_price numeric,
  final_selling_price numeric,
  expected_revenue numeric,
  expected_gross_profit numeric,
  actual_gross_margin numeric,
  outcome_notes text,
  quality_rating integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_batches_scaling_factor_check check (scaling_factor > 0),
  constraint production_batches_actual_main_quantity_check check (actual_main_quantity > 0),
  constraint production_batches_quality_rating_check check (
    quality_rating is null or quality_rating between 1 and 5
  ),
  constraint production_batches_end_after_start_check check (
    end_datetime is null or start_datetime is null or end_datetime >= start_datetime
  ),
  constraint production_batches_completed_yield_check check (
    completed_yield is null or completed_yield >= 0
  ),
  constraint production_batches_pricing_method_check check (
    pricing_method is null or pricing_method in ('markup', 'gross_margin')
  ),
  constraint production_batches_status_check check (
    status in ('draft', 'in_progress', 'resting', 'drying', 'awaiting_review', 'on_hold', 'completed', 'cancelled')
  ),
  constraint production_batches_business_batch_number_key unique (business_id, batch_number)
);

create table public.production_ingredient_lines (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  ingredient_name_snapshot text not null,
  formula_quantity numeric not null,
  formula_uom text not null,
  calculated_quantity numeric not null,
  calculated_uom text not null,
  actual_quantity numeric,
  actual_uom text,
  quantity_variance numeric,
  ingredient_cost_snapshot numeric not null,
  expected_line_cost numeric not null,
  actual_line_cost numeric,
  cost_variance numeric,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_method_steps (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  source_recipe_method_step_id uuid,
  step_number integer not null,
  title text,
  instructions text not null,
  duration_minutes integer,
  temperature_value numeric,
  temperature_uom text,
  equipment text,
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  constraint production_method_step_unique unique (production_batch_id, step_number)
);

create table public.production_additional_costs (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  cost_type text not null,
  description text,
  quantity numeric not null default 1,
  rate numeric not null default 0,
  total_cost numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_notes (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  note_type text not null,
  note text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint production_notes_type_check check (
    note_type in ('pre_production', 'progress', 'outcome', 'issue', 'quality')
  )
);

create table public.production_images (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  image_type text,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create or replace function public.user_has_business_access(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = (select auth.uid())
      and bu.is_active
  );
$$;

create or replace function public.user_has_role(p_business_id uuid, p_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = (select auth.uid())
      and bu.role = p_role
      and bu.is_active
  );
$$;

create or replace function public.user_has_location_access(p_location_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.locations l
    where l.id = p_location_id
      and public.user_has_business_access(l.business_id)
      and (
        exists (
          select 1
          from public.location_users lu
          where lu.location_id = p_location_id
            and lu.user_id = (select auth.uid())
        )
        or public.user_has_role(l.business_id, 'owner')
        or public.user_has_role(l.business_id, 'administrator')
        or public.user_has_role(l.business_id, 'manager')
      )
  );
$$;

create or replace function public.user_can_write_operations(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = (select auth.uid())
      and bu.is_active
      and bu.role in ('owner', 'administrator', 'manager')
  );
$$;

create or replace function public.user_can_work_production(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = (select auth.uid())
      and bu.is_active
      and bu.role in ('owner', 'administrator', 'manager', 'production_user')
  );
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_business_id uuid;
  v_record_id uuid;
begin
  v_business_id := nullif(coalesce(v_new ->> 'business_id', v_old ->> 'business_id'), '')::uuid;
  v_record_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;

  insert into public.audit_logs (
    business_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  )
  values (
    v_business_id,
    tg_table_name,
    v_record_id,
    lower(tg_op),
    v_old,
    v_new,
    (select auth.uid())
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.generate_batch_number(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next integer;
begin
  select count(*) + 1
  into v_next
  from public.production_batches
  where business_id = p_business_id
    and batch_number like 'PB-' || v_year || '-%';

  return 'PB-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.start_production_batch(
  p_business_id uuid,
  p_location_id uuid,
  p_recipe_id uuid,
  p_recipe_version_id uuid,
  p_actual_main_quantity numeric,
  p_actual_main_uom text,
  p_start_datetime timestamptz,
  p_responsible_user_id uuid,
  p_notes text
)
returns public.production_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe public.recipes;
  v_version public.recipe_versions;
  v_batch public.production_batches;
  v_scaling_factor numeric;
begin
  if not public.user_can_work_production(p_business_id) then
    raise exception 'You do not have permission to start production.';
  end if;

  if p_location_id is not null and not public.user_has_location_access(p_location_id) then
    raise exception 'You do not have access to this location.';
  end if;

  select *
  into v_recipe
  from public.recipes
  where id = p_recipe_id
    and business_id = p_business_id
    and archived_at is null;

  if not found then
    raise exception 'Recipe not found.';
  end if;

  select *
  into v_version
  from public.recipe_versions
  where recipe_id = p_recipe_id
    and (id = p_recipe_version_id or (p_recipe_version_id is null and is_current))
  order by is_current desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Recipe version not found.';
  end if;

  v_scaling_factor :=
    public.convert_quantity(p_actual_main_quantity, p_actual_main_uom, v_version.base_main_uom)
    / nullif(v_version.base_main_quantity, 0);

  if v_scaling_factor is null or v_scaling_factor <= 0 then
    raise exception 'Scaling factor must be greater than zero.';
  end if;

  insert into public.production_batches (
    business_id,
    location_id,
    batch_number,
    recipe_id,
    recipe_version_id,
    status,
    responsible_user_id,
    started_by,
    start_datetime,
    main_ingredient_id,
    base_main_quantity,
    base_main_uom,
    actual_main_quantity,
    actual_main_uom,
    scaling_factor,
    expected_ingredient_cost,
    selling_unit_quantity,
    selling_unit_uom,
    pricing_method,
    pricing_percentage,
    vat_percentage
  )
  values (
    p_business_id,
    p_location_id,
    public.generate_batch_number(p_business_id),
    p_recipe_id,
    v_version.id,
    'in_progress',
    p_responsible_user_id,
    (select auth.uid()),
    p_start_datetime,
    v_version.main_ingredient_id,
    v_version.base_main_quantity,
    v_version.base_main_uom,
    p_actual_main_quantity,
    p_actual_main_uom,
    v_scaling_factor,
    v_version.formula_ingredient_cost * v_scaling_factor,
    v_version.default_selling_unit_quantity,
    v_version.default_selling_unit_uom,
    v_version.default_pricing_method,
    v_version.default_pricing_percentage,
    (select vat_percentage from public.businesses where id = p_business_id)
  )
  returning * into v_batch;

  insert into public.production_ingredient_lines (
    production_batch_id,
    ingredient_id,
    ingredient_name_snapshot,
    formula_quantity,
    formula_uom,
    calculated_quantity,
    calculated_uom,
    actual_quantity,
    actual_uom,
    quantity_variance,
    ingredient_cost_snapshot,
    expected_line_cost,
    actual_line_cost,
    cost_variance,
    notes,
    sort_order
  )
  select
    v_batch.id,
    rfl.ingredient_id,
    i.name,
    rfl.formula_quantity,
    rfl.formula_uom,
    rfl.formula_quantity * v_scaling_factor,
    rfl.formula_uom,
    rfl.formula_quantity * v_scaling_factor,
    rfl.formula_uom,
    0,
    rfl.ingredient_cost_snapshot,
    rfl.line_cost * v_scaling_factor,
    rfl.line_cost * v_scaling_factor,
    0,
    rfl.notes,
    rfl.sort_order
  from public.recipe_formula_lines rfl
  join public.ingredients i on i.id = rfl.ingredient_id
  where rfl.recipe_version_id = v_version.id
  order by rfl.sort_order;

  insert into public.production_method_steps (
    production_batch_id,
    source_recipe_method_step_id,
    step_number,
    title,
    instructions,
    duration_minutes,
    temperature_value,
    temperature_uom,
    equipment,
    notes
  )
  select
    v_batch.id,
    rms.id,
    rms.step_number,
    rms.title,
    rms.instructions,
    rms.duration_minutes,
    rms.temperature_value,
    rms.temperature_uom,
    rms.equipment,
    rms.notes
  from public.recipe_method_steps rms
  where rms.recipe_version_id = v_version.id
  order by rms.step_number;

  if p_notes is not null and length(trim(p_notes)) > 0 then
    insert into public.production_notes (
      production_batch_id,
      note_type,
      note,
      created_by
    )
    values (v_batch.id, 'pre_production', p_notes, (select auth.uid()));
  end if;

  return v_batch;
end;
$$;

create or replace function public.complete_production_batch(
  p_production_batch_id uuid,
  p_end_datetime timestamptz,
  p_starting_yield numeric,
  p_completed_yield numeric,
  p_completed_yield_uom text,
  p_completed_by uuid,
  p_quality_rating integer,
  p_outcome_notes text
)
returns public.production_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.production_batches;
  v_actual_ingredient_cost numeric;
  v_additional_cost numeric;
  v_total_cost numeric;
  v_yield_percentage numeric;
  v_loss numeric;
  v_loss_percentage numeric;
  v_sellable_units numeric;
  v_cost_per_selling_unit numeric;
  v_recommended_ex_vat numeric;
  v_recommended_inc_vat numeric;
  v_final_price numeric;
  v_expected_revenue numeric;
  v_expected_profit numeric;
  v_margin numeric;
begin
  select *
  into v_batch
  from public.production_batches
  where id = p_production_batch_id
  for update;

  if not found then
    raise exception 'Production not found.';
  end if;

  if not public.user_can_work_production(v_batch.business_id) then
    raise exception 'You do not have permission to complete this production.';
  end if;

  if v_batch.status = 'completed' then
    raise exception 'Production is already completed.';
  end if;

  if p_end_datetime < coalesce(v_batch.start_datetime, p_end_datetime) then
    raise exception 'End date may not be earlier than start date.';
  end if;

  if p_completed_yield < 0 then
    raise exception 'Completed yield may not be negative.';
  end if;

  update public.production_ingredient_lines
  set
    actual_line_cost = coalesce(actual_quantity, calculated_quantity) * ingredient_cost_snapshot,
    quantity_variance = coalesce(actual_quantity, calculated_quantity) - calculated_quantity,
    cost_variance = (coalesce(actual_quantity, calculated_quantity) * ingredient_cost_snapshot) - expected_line_cost,
    updated_at = now()
  where production_batch_id = p_production_batch_id;

  select coalesce(sum(coalesce(actual_line_cost, expected_line_cost)), 0)
  into v_actual_ingredient_cost
  from public.production_ingredient_lines
  where production_batch_id = p_production_batch_id;

  select coalesce(sum(total_cost), 0)
  into v_additional_cost
  from public.production_additional_costs
  where production_batch_id = p_production_batch_id;

  v_total_cost := v_actual_ingredient_cost + v_additional_cost;
  v_yield_percentage := case when p_starting_yield > 0 then (p_completed_yield / p_starting_yield) * 100 else null end;
  v_loss := greatest(p_starting_yield - p_completed_yield, 0);
  v_loss_percentage := case when p_starting_yield > 0 then (v_loss / p_starting_yield) * 100 else null end;
  v_sellable_units := case
    when coalesce(v_batch.selling_unit_quantity, 0) > 0
      then p_completed_yield / v_batch.selling_unit_quantity
    else null
  end;
  v_cost_per_selling_unit := case
    when coalesce(v_sellable_units, 0) > 0
      then v_total_cost / v_sellable_units
    else null
  end;

  if v_batch.pricing_method = 'markup' then
    v_recommended_ex_vat := v_cost_per_selling_unit * (1 + coalesce(v_batch.pricing_percentage, 0) / 100);
  elsif v_batch.pricing_method = 'gross_margin' and coalesce(v_batch.pricing_percentage, 0) < 100 then
    v_recommended_ex_vat := v_cost_per_selling_unit / (1 - coalesce(v_batch.pricing_percentage, 0) / 100);
  else
    v_recommended_ex_vat := v_cost_per_selling_unit;
  end if;

  v_recommended_inc_vat := v_recommended_ex_vat * (1 + v_batch.vat_percentage / 100);
  v_final_price := coalesce(v_batch.manual_selling_price, v_recommended_ex_vat);
  v_expected_revenue := coalesce(v_sellable_units, 0) * coalesce(v_final_price, 0);
  v_expected_profit := v_expected_revenue - v_total_cost;
  v_margin := case when v_expected_revenue > 0 then (v_expected_profit / v_expected_revenue) * 100 else null end;

  update public.production_batches
  set
    status = 'completed',
    end_datetime = p_end_datetime,
    completed_by = coalesce(p_completed_by, (select auth.uid())),
    starting_yield = p_starting_yield,
    starting_yield_uom = p_completed_yield_uom,
    completed_yield = p_completed_yield,
    completed_yield_uom = p_completed_yield_uom,
    yield_percentage = v_yield_percentage,
    production_loss = v_loss,
    production_loss_percentage = v_loss_percentage,
    actual_ingredient_cost = v_actual_ingredient_cost,
    additional_cost = v_additional_cost,
    total_production_cost = v_total_cost,
    number_of_sellable_units = v_sellable_units,
    cost_per_selling_unit = v_cost_per_selling_unit,
    recommended_selling_price_ex_vat = v_recommended_ex_vat,
    recommended_selling_price_inc_vat = v_recommended_inc_vat,
    final_selling_price = v_final_price,
    expected_revenue = v_expected_revenue,
    expected_gross_profit = v_expected_profit,
    actual_gross_margin = v_margin,
    quality_rating = p_quality_rating,
    outcome_notes = p_outcome_notes,
    completed_at = now(),
    updated_at = now()
  where id = p_production_batch_id
  returning * into v_batch;

  insert into public.production_notes (
    production_batch_id,
    note_type,
    note,
    created_by
  )
  select v_batch.id, 'outcome', p_outcome_notes, (select auth.uid())
  where p_outcome_notes is not null and length(trim(p_outcome_notes)) > 0;

  return v_batch;
end;
$$;

create or replace function public.storage_object_business_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first_path_part text;
begin
  v_first_path_part := split_part(object_name, '/', 1);
  if v_first_path_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_first_path_part::uuid;
  end if;
  return null;
end;
$$;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create trigger production_batches_set_updated_at
  before update on public.production_batches
  for each row execute function public.set_updated_at();

create trigger production_ingredient_lines_set_updated_at
  before update on public.production_ingredient_lines
  for each row execute function public.set_updated_at();

create trigger production_additional_costs_set_updated_at
  before update on public.production_additional_costs
  for each row execute function public.set_updated_at();

create trigger ingredients_audit_log
  after insert or update or delete on public.ingredients
  for each row execute function public.write_audit_log();

create trigger recipes_audit_log
  after insert or update or delete on public.recipes
  for each row execute function public.write_audit_log();

create trigger production_batches_audit_log
  after insert or update or delete on public.production_batches
  for each row execute function public.write_audit_log();

create index business_users_user_id_idx on public.business_users (user_id);
create index business_users_business_id_idx on public.business_users (business_id);
create index locations_business_id_idx on public.locations (business_id);
create index location_users_user_id_idx on public.location_users (user_id);
create index ingredient_categories_business_id_idx on public.ingredient_categories (business_id);
create index suppliers_business_id_idx on public.suppliers (business_id);
create index ingredients_business_id_idx on public.ingredients (business_id);
create index ingredients_category_id_idx on public.ingredients (category_id);
create index ingredients_supplier_id_idx on public.ingredients (supplier_id);
create index ingredients_name_idx on public.ingredients using gin (to_tsvector('simple', name));
create index recipes_business_id_idx on public.recipes (business_id);
create index recipes_status_idx on public.recipes (status);
create index recipe_versions_recipe_id_idx on public.recipe_versions (recipe_id);
create index recipe_formula_lines_recipe_version_id_idx on public.recipe_formula_lines (recipe_version_id);
create index recipe_method_steps_recipe_version_id_idx on public.recipe_method_steps (recipe_version_id);
create index production_batches_business_id_idx on public.production_batches (business_id);
create index production_batches_location_id_idx on public.production_batches (location_id);
create index production_batches_recipe_id_idx on public.production_batches (recipe_id);
create index production_batches_status_idx on public.production_batches (status);
create index production_batches_start_datetime_idx on public.production_batches (start_datetime);
create index production_batches_completed_at_idx on public.production_batches (completed_at);
create index production_batches_reports_idx on public.production_batches (business_id, status, completed_at);
create index production_ingredient_lines_batch_id_idx on public.production_ingredient_lines (production_batch_id);
create index production_method_steps_batch_id_idx on public.production_method_steps (production_batch_id);
create index production_additional_costs_batch_id_idx on public.production_additional_costs (production_batch_id);
create index production_notes_batch_id_idx on public.production_notes (production_batch_id);
create index production_images_batch_id_idx on public.production_images (production_batch_id);
create index audit_logs_business_id_idx on public.audit_logs (business_id);
create index audit_logs_record_id_idx on public.audit_logs (record_id);
create index audit_logs_changed_at_idx on public.audit_logs (changed_at);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.locations enable row level security;
alter table public.location_users enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.production_statuses enable row level security;
alter table public.ingredient_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_formula_lines enable row level security;
alter table public.recipe_method_steps enable row level security;
alter table public.recipe_images enable row level security;
alter table public.ingredient_images enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_ingredient_lines enable row level security;
alter table public.production_method_steps enable row level security;
alter table public.production_additional_costs enable row level security;
alter table public.production_notes enable row level security;
alter table public.production_images enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles are owned by their user"
  on public.profiles for all
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Business users can read their businesses"
  on public.businesses for select
  to authenticated
  using (public.user_has_business_access(id));

create policy "Owners and administrators can update businesses"
  on public.businesses for update
  to authenticated
  using (public.user_has_role(id, 'owner') or public.user_has_role(id, 'administrator'))
  with check (public.user_has_role(id, 'owner') or public.user_has_role(id, 'administrator'));

create policy "Business users can read memberships"
  on public.business_users for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Owners and administrators manage memberships"
  on public.business_users for all
  to authenticated
  using (public.user_has_role(business_id, 'owner') or public.user_has_role(business_id, 'administrator'))
  with check (public.user_has_role(business_id, 'owner') or public.user_has_role(business_id, 'administrator'));

create policy "Business users can read locations"
  on public.locations for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Owners and administrators manage locations"
  on public.locations for all
  to authenticated
  using (public.user_has_role(business_id, 'owner') or public.user_has_role(business_id, 'administrator'))
  with check (public.user_has_role(business_id, 'owner') or public.user_has_role(business_id, 'administrator'));

create policy "Business users can read location users"
  on public.location_users for select
  to authenticated
  using (public.user_has_location_access(location_id));

create policy "Managers manage location users"
  on public.location_users for all
  to authenticated
  using (
    exists (
      select 1 from public.locations l
      where l.id = location_id
        and (public.user_has_role(l.business_id, 'owner') or public.user_has_role(l.business_id, 'administrator'))
    )
  )
  with check (
    exists (
      select 1 from public.locations l
      where l.id = location_id
        and (public.user_has_role(l.business_id, 'owner') or public.user_has_role(l.business_id, 'administrator'))
    )
  );

create policy "Authenticated users can read unit lookups"
  on public.units_of_measure for select
  to authenticated
  using (true);

create policy "Authenticated users can read production status lookups"
  on public.production_statuses for select
  to authenticated
  using (true);

create policy "Business users can read ingredient categories"
  on public.ingredient_categories for select
  to authenticated
  using (business_id is null or public.user_has_business_access(business_id));

create policy "Managers write ingredient categories"
  on public.ingredient_categories for all
  to authenticated
  using (business_id is not null and public.user_can_write_operations(business_id))
  with check (business_id is not null and public.user_can_write_operations(business_id));

create policy "Business users can read suppliers"
  on public.suppliers for select
  to authenticated
  using (business_id is null or public.user_has_business_access(business_id));

create policy "Managers write suppliers"
  on public.suppliers for all
  to authenticated
  using (business_id is not null and public.user_can_write_operations(business_id))
  with check (business_id is not null and public.user_can_write_operations(business_id));

create policy "Business users can read ingredients"
  on public.ingredients for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Managers write ingredients"
  on public.ingredients for all
  to authenticated
  using (public.user_can_write_operations(business_id))
  with check (public.user_can_write_operations(business_id));

create policy "Business users can read recipes"
  on public.recipes for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Managers write recipes"
  on public.recipes for all
  to authenticated
  using (public.user_can_write_operations(business_id))
  with check (public.user_can_write_operations(business_id));

create policy "Business users can read recipe versions"
  on public.recipe_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_has_business_access(r.business_id)
    )
  );

create policy "Managers write recipe versions"
  on public.recipe_versions for all
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_can_write_operations(r.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_can_write_operations(r.business_id)
    )
  );

create policy "Business users can read recipe formula lines"
  on public.recipe_formula_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_has_business_access(r.business_id)
    )
  );

create policy "Managers write recipe formula lines"
  on public.recipe_formula_lines for all
  to authenticated
  using (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_can_write_operations(r.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_can_write_operations(r.business_id)
    )
  );

create policy "Business users can read recipe method steps"
  on public.recipe_method_steps for select
  to authenticated
  using (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_has_business_access(r.business_id)
    )
  );

create policy "Managers write recipe method steps"
  on public.recipe_method_steps for all
  to authenticated
  using (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_can_write_operations(r.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipe_versions rv
      join public.recipes r on r.id = rv.recipe_id
      where rv.id = recipe_version_id and public.user_can_write_operations(r.business_id)
    )
  );

create policy "Business users can read production batches"
  on public.production_batches for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Production users write production batches"
  on public.production_batches for all
  to authenticated
  using (public.user_can_work_production(business_id))
  with check (public.user_can_work_production(business_id));

create policy "Business users can read production child records"
  on public.production_ingredient_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_has_business_access(pb.business_id)
    )
  );

create policy "Production users write production ingredient lines"
  on public.production_ingredient_lines for all
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Business users can read production method steps"
  on public.production_method_steps for select
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_has_business_access(pb.business_id)
    )
  );

create policy "Production users write production method steps"
  on public.production_method_steps for all
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Business users can read production additional costs"
  on public.production_additional_costs for select
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_has_business_access(pb.business_id)
    )
  );

create policy "Production users write production additional costs"
  on public.production_additional_costs for all
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Business users can read production notes"
  on public.production_notes for select
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_has_business_access(pb.business_id)
    )
  );

create policy "Production users write production notes"
  on public.production_notes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Production users update production notes"
  on public.production_notes for update
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Production users delete production notes"
  on public.production_notes for delete
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Business users can read production images"
  on public.production_images for select
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_has_business_access(pb.business_id)
    )
  );

create policy "Production users manage production images"
  on public.production_images for all
  to authenticated
  using (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.production_batches pb
      where pb.id = production_batch_id and public.user_can_work_production(pb.business_id)
    )
  );

create policy "Business users can read recipe images"
  on public.recipe_images for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_has_business_access(r.business_id)
    )
  );

create policy "Managers manage recipe images"
  on public.recipe_images for all
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_can_write_operations(r.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.user_can_write_operations(r.business_id)
    )
  );

create policy "Business users can read ingredient images"
  on public.ingredient_images for select
  to authenticated
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_id and public.user_has_business_access(i.business_id)
    )
  );

create policy "Managers manage ingredient images"
  on public.ingredient_images for all
  to authenticated
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_id and public.user_can_write_operations(i.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_id and public.user_can_write_operations(i.business_id)
    )
  );

create policy "Business users can read audit logs"
  on public.audit_logs for select
  to authenticated
  using (business_id is not null and public.user_has_business_access(business_id));

create policy "System can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (business_id is not null and public.user_has_business_access(business_id));

insert into public.units_of_measure (code, label, uom_type, sort_order)
values
  ('kg', 'Kilogram', 'mass', 10),
  ('g', 'Gram', 'mass', 20),
  ('L', 'Litre', 'volume', 30),
  ('ml', 'Millilitre', 'volume', 40),
  ('each', 'Each', 'count', 50),
  ('packet', 'Packet', 'count', 60),
  ('bottle', 'Bottle', 'count', 70),
  ('tub', 'Tub', 'count', 80),
  ('case', 'Case', 'count', 90),
  ('custom', 'Custom', 'custom', 100)
on conflict (code) do update
set label = excluded.label,
    uom_type = excluded.uom_type,
    sort_order = excluded.sort_order;

insert into public.production_statuses (code, label, sort_order, is_terminal)
values
  ('draft', 'Draft', 10, false),
  ('in_progress', 'In Progress', 20, false),
  ('resting', 'Resting', 30, false),
  ('drying', 'Drying', 40, false),
  ('awaiting_review', 'Awaiting Review', 50, false),
  ('on_hold', 'On Hold', 60, false),
  ('completed', 'Completed', 70, true),
  ('cancelled', 'Cancelled', 80, true)
on conflict (code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_terminal = excluded.is_terminal;

insert into public.ingredient_categories (business_id, name, description)
values
  (null, 'Meat', 'Primary meat ingredients'),
  (null, 'Seasoning', 'Salt, cures and seasoning bases'),
  (null, 'Spice', 'Spices and flavourings'),
  (null, 'Liquid', 'Liquid ingredients'),
  (null, 'Additive', 'Functional additives'),
  (null, 'Packaging', 'Packaging and labels')
on conflict (business_id, name) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recipe-images', 'recipe-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('recipe-method-images', 'recipe-method-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('production-images', 'production-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('ingredient-images', 'ingredient-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Business users can read private app images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-method-images', 'production-images', 'ingredient-images')
    and public.user_has_business_access(public.storage_object_business_id(name))
  );

create policy "Business users can upload private app images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('recipe-images', 'recipe-method-images', 'production-images', 'ingredient-images')
    and public.user_has_business_access(public.storage_object_business_id(name))
  );

create policy "Business users can update private app images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-method-images', 'production-images', 'ingredient-images')
    and public.user_has_business_access(public.storage_object_business_id(name))
  )
  with check (
    bucket_id in ('recipe-images', 'recipe-method-images', 'production-images', 'ingredient-images')
    and public.user_has_business_access(public.storage_object_business_id(name))
  );

create policy "Business users can delete private app images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-method-images', 'production-images', 'ingredient-images')
    and public.user_has_business_access(public.storage_object_business_id(name))
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
