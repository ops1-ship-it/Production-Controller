create table public.ingredient_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  import_mode text not null,
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now(),
  total_rows integer not null default 0,
  added_rows integer not null default 0,
  updated_rows integer not null default 0,
  skipped_rows integer not null default 0,
  invalid_rows integer not null default 0,
  error_summary text,
  constraint ingredient_imports_file_type_check check (file_type in ('csv', 'xlsx')),
  constraint ingredient_imports_mode_check check (import_mode in ('add-only', 'add-update')),
  constraint ingredient_imports_totals_check check (
    total_rows >= 0
    and added_rows >= 0
    and updated_rows >= 0
    and skipped_rows >= 0
    and invalid_rows >= 0
  )
);

create table public.ingredient_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ingredient_imports(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  original_row_number integer not null,
  imported_values jsonb not null default '{}'::jsonb,
  import_result text not null,
  validation_message text,
  created_at timestamptz not null default now(),
  constraint ingredient_import_rows_result_check check (
    import_result in ('Ready to Add', 'Ready to Update', 'Duplicate', 'Invalid', 'Skipped')
  )
);

create index ingredient_imports_business_id_idx
  on public.ingredient_imports (business_id);

create index ingredient_imports_imported_at_idx
  on public.ingredient_imports (imported_at desc);

create index ingredient_import_rows_import_id_idx
  on public.ingredient_import_rows (import_id);

create index ingredient_import_rows_business_id_idx
  on public.ingredient_import_rows (business_id);

alter table public.ingredient_imports enable row level security;
alter table public.ingredient_import_rows enable row level security;

create policy "Business users can read ingredient imports"
  on public.ingredient_imports for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Managers write ingredient imports"
  on public.ingredient_imports for all
  to authenticated
  using (public.user_can_write_operations(business_id))
  with check (public.user_can_write_operations(business_id));

create policy "Business users can read ingredient import rows"
  on public.ingredient_import_rows for select
  to authenticated
  using (public.user_has_business_access(business_id));

create policy "Managers write ingredient import rows"
  on public.ingredient_import_rows for all
  to authenticated
  using (public.user_can_write_operations(business_id))
  with check (
    public.user_can_write_operations(business_id)
    and exists (
      select 1
      from public.ingredient_imports ii
      where ii.id = import_id
        and ii.business_id = ingredient_import_rows.business_id
    )
  );
