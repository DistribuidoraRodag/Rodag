-- ============================================
-- RODAG MKT SYSTEM — Business Rules Engine
-- ============================================

-- 1. BRAND RULES
create table public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null unique,
  tone text not null,
  must_include jsonb not null default '[]',
  forbidden_terms jsonb not null default '[]',
  style text not null,
  color_palette jsonb,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_brand_rules_name on public.brand_rules(brand_name);

create trigger brand_rules_updated_at
  before update on public.brand_rules
  for each row execute procedure public.update_updated_at();

-- 2. PRODUCT CATALOG
create table public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null check (category in (
    'filtros','turbinas','freios','embreagens','suspensao','motor','eletrica','outros'
  )),
  valid_brands jsonb not null default '[]',
  technical_notes text,
  price_range jsonb,
  keywords jsonb default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_product_catalog_category on public.product_catalog(category);
create index idx_product_catalog_active on public.product_catalog(is_active) where is_active = true;

-- 3. RESTRICTED TERMS
create table public.restricted_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  reason text,
  severity text not null default 'blocked' check (severity in ('warning','blocked')),
  created_at timestamptz not null default now()
);

-- 4. CLIENT PREFERENCES
create table public.client_preferences (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_tone text,
  common_products jsonb default '[]',
  cta_style text,
  preferred_formats jsonb default '[]',
  successful_requests jsonb default '[]',
  updated_at timestamptz default now()
);

create trigger client_prefs_updated_at
  before update on public.client_preferences
  for each row execute procedure public.update_updated_at();

-- ============================================
-- RLS
-- ============================================

alter table public.brand_rules enable row level security;
create policy "Authenticated users can read brand rules"
  on public.brand_rules for select
  using (auth.role() = 'authenticated');

alter table public.product_catalog enable row level security;
create policy "Authenticated users can read product catalog"
  on public.product_catalog for select
  using (auth.role() = 'authenticated');

alter table public.restricted_terms enable row level security;
create policy "Authenticated users can read restricted terms"
  on public.restricted_terms for select
  using (auth.role() = 'authenticated');

alter table public.client_preferences enable row level security;
create policy "Users can read own preferences"
  on public.client_preferences for select
  using (auth.uid() = client_id);
create policy "Users can update own preferences"
  on public.client_preferences for update
  using (auth.uid() = client_id);
create policy "Users can insert own preferences"
  on public.client_preferences for insert
  with check (auth.uid() = client_id);
