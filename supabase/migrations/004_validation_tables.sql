-- ============================================
-- RODAG MKT SYSTEM — Validation & State History
-- ============================================

-- 1. IMAGE VALIDATIONS
create table public.image_validations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  expected_text jsonb not null,
  detected_text jsonb,
  similarity_score numeric(5,2),
  ocr_confidence numeric(5,2),
  needs_correction boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_image_validations_request on public.image_validations(request_id);

-- 2. VISUAL CORRECTIONS
create table public.visual_corrections (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.image_validations(id) on delete cascade,
  correction_type text not null check (correction_type in ('prompt_adjustment','layout_fix','text_overlay','fallback')),
  original_prompt text,
  adjusted_prompt text,
  attempt_number int not null default 1,
  created_at timestamptz not null default now()
);

create index idx_visual_corrections_validation on public.visual_corrections(validation_id);

-- 3. REQUEST STATE HISTORY
create table public.request_state_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  from_state text,
  to_state text not null,
  reason text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_state_history_request on public.request_state_history(request_id);
create index idx_state_history_created on public.request_state_history(request_id, created_at);

-- RLS: server-side only (service_role)
alter table public.image_validations enable row level security;
alter table public.visual_corrections enable row level security;
alter table public.request_state_history enable row level security;
