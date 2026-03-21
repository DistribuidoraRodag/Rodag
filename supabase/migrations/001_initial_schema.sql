-- ============================================================================
-- RODAG MKT SYSTEM — Initial Schema
-- Supabase PostgreSQL
-- ============================================================================

-- 1. PROFILES (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  company_name text,
  phone text,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  daily_request_count int not null default 0,
  last_request_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.update_updated_at();

-- 2. REQUESTS
create table requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  initial_message text not null,
  source_channel text not null default 'web' check (source_channel in ('web', 'whatsapp')),
  status text not null default 'novo_pedido' check (status in (
    'novo_pedido',
    'aguardando_complemento',
    'briefing_em_montagem',
    'briefing_fechado',
    'em_processamento_multiagente',
    'copy_pronta',
    'direcao_criativa_pronta',
    'imagem_gerada',
    'imagem_validada',
    'imagem_corrigida',
    'entrega_em_validacao',
    'precisa_revisao',
    'entrega_finalizada',
    'entregue_ao_cliente'
  )),
  request_type text,
  marketing_goal text,
  product_line text,
  target_audience text,
  delivery_format text,
  revision_count int not null default 0,
  needs_human_review boolean not null default false,
  last_completed_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger requests_updated_at
  before update on requests
  for each row execute function public.update_updated_at();

-- 3. CHAT MESSAGES
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  user_id uuid not null references profiles(id),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  message_type text not null default 'text' check (message_type in (
    'text', 'question', 'briefing_summary', 'delivery', 'status_update'
  )),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 4. REQUEST QUESTIONS
create table request_questions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  question_order int not null,
  question_text text not null,
  answer_text text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. REQUEST BRIEFINGS
create table request_briefings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  summary text,
  piece_type text,
  format text,
  goal text,
  audience text,
  audience_profile text,
  product text,
  offer text,
  mandatory_elements jsonb,
  tone text,
  cta text,
  restrictions jsonb,
  brand_context text,
  structured_brief_json jsonb,
  briefing_version int not null default 1,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. AGENT RUNS
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  agent_name text not null,
  input_payload jsonb,
  output_payload jsonb,
  run_status text not null default 'pending' check (run_status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  tokens_used int,
  model_used text,
  cost_usd numeric(10,6),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- 7. DELIVERABLES
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  deliverable_type text not null check (deliverable_type in (
    'strategy', 'copy', 'creative_direction', 'generated_image', 'full_delivery'
  )),
  title text,
  content_json jsonb,
  content_text text,
  image_url text,
  image_storage_path text,
  qa_score smallint,
  qa_feedback text,
  approved boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now()
);

-- 8. REQUEST EVENTS (audit log)
create table request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  event_type text not null,
  description text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_requests_user_id on requests(user_id);
create index idx_requests_status on requests(status);
create index idx_requests_created_at on requests(created_at desc);
create index idx_chat_messages_request_id on chat_messages(request_id);
create index idx_chat_messages_created_at on chat_messages(request_id, created_at);
create index idx_request_questions_request_id on request_questions(request_id);
create index idx_request_briefings_request_id on request_briefings(request_id);
create index idx_agent_runs_request_id on agent_runs(request_id);
create index idx_agent_runs_status on agent_runs(request_id, run_status);
create index idx_deliverables_request_id on deliverables(request_id);
create index idx_deliverables_type on deliverables(request_id, deliverable_type);
create index idx_request_events_request_id on request_events(request_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Profiles
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Requests
alter table requests enable row level security;

create policy "Users can view own requests"
  on requests for select
  using (auth.uid() = user_id);

create policy "Users can create own requests"
  on requests for insert
  with check (auth.uid() = user_id);

-- Chat Messages (via request ownership)
alter table chat_messages enable row level security;

create policy "Users can view own chat messages"
  on chat_messages for select
  using (exists (
    select 1 from requests where requests.id = chat_messages.request_id and requests.user_id = auth.uid()
  ));

create policy "Users can insert own chat messages"
  on chat_messages for insert
  with check (auth.uid() = user_id);

-- Request Questions
alter table request_questions enable row level security;

create policy "Users can view own request questions"
  on request_questions for select
  using (exists (
    select 1 from requests where requests.id = request_questions.request_id and requests.user_id = auth.uid()
  ));

-- Request Briefings
alter table request_briefings enable row level security;

create policy "Users can view own briefings"
  on request_briefings for select
  using (exists (
    select 1 from requests where requests.id = request_briefings.request_id and requests.user_id = auth.uid()
  ));

-- Deliverables
alter table deliverables enable row level security;

create policy "Users can view own deliverables"
  on deliverables for select
  using (exists (
    select 1 from requests where requests.id = deliverables.request_id and requests.user_id = auth.uid()
  ));

-- Agent Runs: server-side only (service_role), no client policies
alter table agent_runs enable row level security;

-- Request Events: server-side only (service_role), no client policies
alter table request_events enable row level security;

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table requests;

-- ============================================================================
-- STORAGE
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', true)
on conflict (id) do nothing;

create policy "Anyone can view deliverable images"
  on storage.objects for select
  using (bucket_id = 'deliverables');

create policy "Service role can upload deliverables"
  on storage.objects for insert
  with check (bucket_id = 'deliverables');
