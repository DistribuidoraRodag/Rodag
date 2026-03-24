-- ============================================
-- RODAG MKT SYSTEM — EG OS v3 Compliance
-- Content pipeline + approval + sales + telemetry
-- ============================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('post', 'promo', 'tecnico', 'institucional', 'lancamento');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE content_channel AS ENUM ('instagram', 'facebook', 'linkedin', 'whatsapp', 'todos');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE content_brand AS ENUM ('scania', 'volvo', 'iveco', 'todas');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE content_status AS ENUM ('rascunho', 'pendente', 'quality_check', 'aprovado', 'rejeitado', 'publicado', 'agendado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. CONTENT (main content table)
CREATE TABLE IF NOT EXISTS public.content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type content_type NOT NULL DEFAULT 'post',
  brand content_brand NOT NULL DEFAULT 'todas',
  channel content_channel NOT NULL DEFAULT 'instagram',
  title text NOT NULL,
  body_text text NOT NULL,
  status content_status NOT NULL DEFAULT 'rascunho',
  quality_score integer,
  quality_details jsonb,
  output_level smallint NOT NULL DEFAULT 3 CHECK (output_level BETWEEN 1 AND 4),
  ai_model text,
  ai_tokens_used integer DEFAULT 0,
  ai_cost_usd numeric(10,6) DEFAULT 0,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  scheduled_for timestamptz,
  hashtags text[],
  image_suggestion text,
  visual_palette jsonb,
  request_id uuid REFERENCES public.requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_status ON public.content(status);
CREATE INDEX idx_content_brand ON public.content(brand);
CREATE INDEX idx_content_channel ON public.content(channel);
CREATE INDEX idx_content_type ON public.content(type);
CREATE INDEX idx_content_created_by ON public.content(created_by);
CREATE INDEX idx_content_created_at ON public.content(created_at DESC);

CREATE TRIGGER content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- 2. CONTENT VERSIONS (channel adaptations)
CREATE TABLE IF NOT EXISTS public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  channel content_channel NOT NULL,
  adapted_text text NOT NULL,
  adapted_hashtags text[],
  char_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_versions_content ON public.content_versions(content_id);

-- 3. SHARES (sales team tracking)
CREATE TABLE IF NOT EXISTS public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES public.profiles(id),
  channel content_channel NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_content ON public.shares(content_id);
CREATE INDEX idx_shares_by ON public.shares(shared_by);

-- 4. APPROVAL HISTORY
CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'revision_requested')),
  acted_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_content ON public.approval_history(content_id);

-- 5. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read = false;

-- 6. USAGE LOGS (telemetry)
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  agent text NOT NULL,
  model text NOT NULL,
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  latency_ms integer DEFAULT 0,
  content_id uuid REFERENCES public.content(id),
  qa_score integer,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_agent ON public.usage_logs(agent);
CREATE INDEX idx_usage_logs_created ON public.usage_logs(created_at DESC);

-- 7. DECISION LOGS (EG OS v3 governance)
CREATE TABLE IF NOT EXISTS public.decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decided_by text NOT NULL,
  decision text NOT NULL,
  reason text,
  alternatives text,
  expected_impact text,
  next_step text,
  project text DEFAULT 'rodag',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. PROMPTS LIBRARY
CREATE TABLE IF NOT EXISTS public.prompts_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type content_type,
  channel content_channel,
  prompt_text text NOT NULL,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  avg_quality_score numeric(5,2),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON public.prompts_library
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Content
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_content" ON public.content FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "mkt_read_all_content" ON public.content FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "mkt_insert_content" ON public.content FOR INSERT
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "client_read_approved" ON public.content FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'client'
    AND status = 'aprovado'
  );

-- Content Versions
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_versions" ON public.content_versions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Shares
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_shares" ON public.shares FOR ALL
  USING (auth.uid() = shared_by);
CREATE POLICY "admin_read_shares" ON public.shares FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Approval History
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_approval" ON public.approval_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifications" ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

-- Usage Logs
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_usage" ON public.usage_logs FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Decision Logs
ALTER TABLE public.decision_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_decisions" ON public.decision_logs FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Prompts Library
ALTER TABLE public.prompts_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_prompts" ON public.prompts_library FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "auth_read_prompts" ON public.prompts_library FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add role column to profiles if not exists
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'client';
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
