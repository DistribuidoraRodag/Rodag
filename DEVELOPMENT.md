# RODAG MKT SYSTEM — Plano de Desenvolvimento

## Documento de execução técnica — versão definitiva

---

## 1. Análise Crítica da Arquitetura Atual

### O que está bom e mantemos

- 5 agentes consolidados + orchestrator (Manus validou que funciona)
- Schema de 7 tabelas cobre todo o fluxo
- Fluxo de estados com 11 status claros
- QA com retry loop (max 2x) + flag de revisão humana
- Creative Agent condicional (só roda pra peças visuais)
- Brand context injetado em todos os prompts

### Problemas identificados e melhorias

#### Problema 1: 9 chamadas de LLM por pedido = latência alta

O fluxo atual faz chamadas sequenciais:
Intake → Briefing → Strategy → Copy → Creative Direction → Visual Prompt → Image Gen → QA → Delivery

Isso pode levar 40-60 segundos. Cliente fica esperando.

**Melhoria:** Paralelizar onde possível.
- Strategy + Copy podem rodar em paralelo (são independentes após briefing)
- Creative Direction + Visual Prompt podem ser uma única chamada (GPT-4o gera direção + prompt junto)
- QA + Delivery são uma única chamada (já é assim no Manus)

Fluxo otimizado:
```
Intake (Haiku)           ~1s
    ↓
Briefing (Sonnet)        ~3s
    ↓
┌─────────────────────────────────┐
│ PARALELO:                       │
│ Strategy+Copy (GPT-4o)    ~4s   │
│ Creative+Prompt (Sonnet)  ~4s   │
└─────────────────────────────────┘
    ↓                        ~4s (não 8s)
Image Generation (Ideogram)  ~8s
    ↓
QA+Delivery (Sonnet)         ~3s
                          ────────
                    TOTAL: ~19s (não 40s+)
```

#### Problema 2: Copy Agent separado do Strategy é desperdício

No Manus, Strategy + Copy já são um agente só. Mas a proposta anterior separava
Strategy (Claude) de Copy (GPT-4o). Isso força 2 chamadas + passagem de contexto.

**Melhoria:** Manter Strategy+Copy como agente único no GPT-4o.
O GPT-4o recebe o briefing e retorna estratégia + copy numa só chamada.
Motivo: copy precisa do ângulo estratégico pra ser coerente. Separar gera
risco de desalinhamento.

#### Problema 3: Creative Direction + Visual Prompt são redundantes como 2 chamadas

A direção criativa (layout, cores, hierarquia) e o prompt de imagem são
outputs complementares do mesmo raciocínio visual.

**Melhoria:** Um único agente "Creative Agent" no Claude Sonnet retorna:
- Direção visual (texto)
- Layout (zonas)
- Prompt de imagem (inglês, otimizado)
- Instrução para designer (português)

Já é assim no Manus. Manter.

#### Problema 4: Sem geração real de imagem

O Manus gera apenas o prompt textual. O cliente ainda precisa ir ao Canva/Midjourney
manualmente. Isso quebra a proposta de "entrega pronta".

**Melhoria:** Integrar Ideogram 3 API para gerar a imagem automaticamente.
O Production Agent pega o prompt do Creative Agent e chama a API do Ideogram.
A imagem gerada é salva no Supabase Storage e entregue junto com a peça.

Fallback: se Ideogram falhar, entregar o prompt + instrução para designer
(graceful degradation, não erro fatal).

#### Problema 5: Polling no frontend (refetchInterval 3s)

Ineficiente, gasta requests desnecessários, delay de até 3s na atualização.

**Melhoria:** Supabase Realtime. Subscription na tabela `requests` filtrada
por `id`. Frontend recebe push instantâneo quando status muda.

#### Problema 6: Sem versionamento de prompts no código

O Manus hardcoda os prompts dentro de `agents.ts`. Se quiser testar uma
variação de prompt, precisa mexer no código e fazer deploy.

**Melhoria:** Tabela `prompt_versions` no Supabase. Cada agente busca
o prompt ativo antes de rodar. Permite A/B testing e rollback sem deploy.

Mas para v1, vamos hardcodar (como o Manus fez) e migrar para DB depois.
Over-engineering no começo é pior que prompt fixo.

#### Problema 7: Sem autenticação real

O Manus usa OAuth proprietário. Precisamos de auth real.

**Melhoria:** Supabase Auth com magic link (email) para v1.
Sem senha, sem fricção. Cliente recebe link por email, clica, está logado.
Depois podemos adicionar login com Google ou WhatsApp OTP.

#### Problema 8: Sem storage para imagens geradas

**Melhoria:** Supabase Storage bucket "deliverables".
Imagens geradas pelo Ideogram são salvas com path:
`deliverables/{request_id}/{version}_{type}.png`

#### Problema 9: Sem rate limiting

Cliente pode spammar solicitações e gerar custo alto de API.

**Melhoria:** Rate limit simples: max 10 solicitações por dia por usuário.
Implementar como check no API route antes de criar request.
Para v1, suficiente. Depois, implementar billing.

#### Problema 10: Orchestrator sem recovery

Se o orchestrator falha no meio (ex: API do GPT-4o caiu), o request fica
preso num status intermediário pra sempre.

**Melhoria:**
- Salvar o último step completado no request
- API route de retry que retoma do último step
- Cron job (ou Trigger.dev) que detecta requests presos há >5min e retenta

---

## 2. Arquitetura Final de Agentes

### Mapa definitivo (6 chamadas de IA por pedido visual, 4 por pedido texto)

```
PEDIDO VISUAL (post, story, banner, carrossel, anúncio):

  [1] Intake Agent ──────────── Claude Haiku 4.5    (~1s)
  [2] Briefing Agent ────────── Claude Sonnet 4.6   (~3s)
  [3] Strategy+Copy Agent ───── GPT-4o              (~4s)  ┐ PARALELO
  [4] Creative Agent ────────── Claude Sonnet 4.6   (~4s)  ┘ (~4s total)
  [5] Image Generation ──────── Ideogram 3          (~8s)
  [6] QA+Delivery Agent ─────── Claude Sonnet 4.6   (~3s)
                                                    ────────
                                              TOTAL: ~19s

PEDIDO TEXTO (legenda, WhatsApp, roteiro):

  [1] Intake Agent ──────────── Claude Haiku 4.5    (~1s)
  [2] Briefing Agent ────────── Claude Sonnet 4.6   (~3s)
  [3] Strategy+Copy Agent ───── GPT-4o              (~4s)
  [4] QA+Delivery Agent ─────── Claude Sonnet 4.6   (~3s)
                                                    ────────
                                              TOTAL: ~11s
```

### Contratos de cada agente

#### Agent 1: Intake Agent (Claude Haiku 4.5)

```
INPUT:  { message: string }
OUTPUT: {
  request_type: string | null,
  marketing_goal: string | null,
  product_line: string | null,
  target_audience: string | null,
  mandatory_info: { price, cta, brand: string | null },
  confidence: number,
  missing_fields: string[],
  questions: string[],
  needs_followup: boolean
}
WRITES: requests (campos extraídos), request_questions
```

#### Agent 2: Briefing Agent (Claude Sonnet 4.6)

```
INPUT:  { originalMessage: string, questionsAndAnswers: {q,a}[] }
OUTPUT: {
  summary, piece_type, format, goal, audience, audience_profile,
  product, offer, mandatory_elements: string[], tone, cta,
  restrictions: string[], brand_context: string
}
WRITES: request_briefings
```

#### Agent 3: Strategy+Copy Agent (GPT-4o)

```
INPUT:  { briefing: BriefingResult }
OUTPUT: {
  strategy: { angle, value_prop, trigger, approach },
  copy: {
    headline_1, headline_2, body,
    caption_short, caption_long,
    cta_primary, cta_secondary, cta_whatsapp
  }
}
WRITES: deliverables (type: "strategy")
```

#### Agent 4: Creative Agent (Claude Sonnet 4.6) — CONDICIONAL

```
INPUT:  { briefing: BriefingResult, strategyCopy: StrategyCopyResult }
OUTPUT: {
  visual_direction: { style, colors[], hierarchy[], mood },
  layout: { format, top, center, bottom_left, bottom_right, corner },
  image_prompt: string (inglês, otimizado para Ideogram/Midjourney),
  designer_instruction: string (português)
}
WRITES: deliverables (type: "creative_direction")
TRIGGERS: Image Generation
```

#### Agent 5: Image Generation (Ideogram 3) — CONDICIONAL

```
INPUT:  { prompt: string, aspect_ratio: string }
OUTPUT: { image_url: string, saved_path: string }
WRITES: Supabase Storage (bucket: deliverables)
FALLBACK: Se falhar, entrega só o prompt textual
```

#### Agent 6: QA+Delivery Agent (Claude Sonnet 4.6)

```
INPUT:  { briefing, strategyCopy, creative?, imageUrl? }
OUTPUT: {
  qa: {
    score: 1-10, approved: boolean,
    checklist: { objective_met, audience_correct, cta_present,
                 mandatory_info_included, tone_adequate, copy_visual_aligned },
    issues: string[], feedback: string
  },
  delivery: string (Markdown formatado)
}
WRITES: deliverables (type: "full_delivery"), chat_messages (type: "delivery")
```

---

## 3. Schema do Banco — Supabase (PostgreSQL)

### Tabelas

```sql
-- 1. PROFILES (extensão do auth.users do Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  company_name text,
  phone text,
  email text,
  role text default 'user' check (role in ('user', 'admin')),
  daily_request_count int default 0,
  last_request_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. REQUESTS
create table requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  title text,
  initial_message text not null,
  source_channel text default 'web' check (source_channel in ('web', 'whatsapp')),
  status text default 'novo_pedido' check (status in (
    'novo_pedido', 'aguardando_complemento', 'briefing_em_montagem',
    'briefing_fechado', 'em_processamento_multiagente', 'copy_pronta',
    'direcao_criativa_pronta', 'entrega_em_validacao', 'precisa_revisao',
    'entrega_finalizada', 'entregue_ao_cliente'
  )),
  request_type text,
  marketing_goal text,
  product_line text,
  target_audience text,
  delivery_format text,
  revision_count int default 0,
  needs_human_review boolean default false,
  last_completed_step text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. CHAT MESSAGES
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  user_id uuid not null references profiles(id),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  message_type text default 'text' check (message_type in (
    'text', 'question', 'briefing_summary', 'delivery', 'status_update'
  )),
  metadata jsonb,
  created_at timestamptz default now()
);

-- 4. REQUEST QUESTIONS
create table request_questions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  question_order int not null,
  question_text text not null,
  answer_text text,
  answered_at timestamptz,
  created_at timestamptz default now()
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
  briefing_version int default 1,
  is_final boolean default false,
  created_at timestamptz default now()
);

-- 6. AGENT RUNS
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  agent_name text not null,
  input_payload jsonb,
  output_payload jsonb,
  run_status text default 'pending' check (run_status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  tokens_used int,
  model_used text,
  cost_usd numeric(10,6),
  started_at timestamptz default now(),
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
  approved boolean default false,
  version int default 1,
  created_at timestamptz default now()
);

-- 8. REQUEST EVENTS (audit log)
create table request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  event_type text not null,
  description text,
  payload jsonb,
  created_at timestamptz default now()
);
```

### Diferenças do Manus → nosso schema

| Aspecto | Manus | Nosso |
|---------|-------|-------|
| IDs | int auto-increment | UUID |
| Banco | MySQL (TiDB) | PostgreSQL (Supabase) |
| Auth | tabela users custom | auth.users + profiles |
| Timestamps | timestamp | timestamptz (timezone-aware) |
| JSON | json | jsonb (indexável) |
| Novo campo agent_runs | — | model_used, cost_usd (tracking de custo) |
| Novo campo deliverables | — | image_url, image_storage_path |
| Novo campo requests | — | last_completed_step (recovery) |
| Segurança | nenhuma | RLS policies por user_id |

### RLS Policies

```sql
-- Profiles: usuário só vê/edita o próprio perfil
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Requests: usuário só vê os próprios
alter table requests enable row level security;
create policy "Users can view own requests" on requests
  for select using (auth.uid() = user_id);
create policy "Users can create own requests" on requests
  for insert with check (auth.uid() = user_id);

-- Chat messages: via request ownership
alter table chat_messages enable row level security;
create policy "Users can view own chat messages" on chat_messages
  for select using (
    request_id in (select id from requests where user_id = auth.uid())
  );

-- Mesma lógica para request_questions, request_briefings, deliverables
-- Agent runs e request_events: acesso via service_role apenas (server-side)
```

### Indexes

```sql
create index idx_requests_user_id on requests(user_id);
create index idx_requests_status on requests(status);
create index idx_chat_messages_request_id on chat_messages(request_id);
create index idx_request_questions_request_id on request_questions(request_id);
create index idx_agent_runs_request_id on agent_runs(request_id);
create index idx_deliverables_request_id on deliverables(request_id);
create index idx_request_events_request_id on request_events(request_id);
```

### Supabase Realtime

```sql
-- Habilitar realtime na tabela requests (para status updates)
alter publication supabase_realtime add table requests;
```

---

## 4. Estrutura de Arquivos do Projeto

```
Rodag/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  ← Root layout (providers, fonts)
│   │   ├── page.tsx                    ← Landing page (não autenticado)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          ← Magic link login
│   │   │   └── callback/route.ts       ← Auth callback
│   │   └── (dashboard)/
│   │       ├── layout.tsx              ← Dashboard layout (sidebar, header)
│   │       ├── page.tsx                ← Dashboard (lista de solicitações)
│   │       ├── chat/[id]/page.tsx      ← Chat com agentes
│   │       └── delivery/[id]/page.tsx  ← Visualização da entrega
│   │
│   ├── components/
│   │   ├── ui/                         ← shadcn/ui (57 componentes)
│   │   ├── new-request-modal.tsx       ← Modal nova solicitação
│   │   ├── agent-pipeline.tsx          ← Barra de progresso dos agentes
│   │   ├── chat-message.tsx            ← Bolha de mensagem
│   │   ├── question-form.tsx           ← Formulário de perguntas
│   │   ├── delivery-section.tsx        ← Seção colapsável da entrega
│   │   ├── copy-field.tsx              ← Campo com botão copiar
│   │   └── request-card.tsx            ← Card de solicitação no dashboard
│   │
│   ├── lib/
│   │   ├── utils.ts                    ← cn() helper
│   │   ├── constants.ts                ← Status labels, pipeline config
│   │   └── supabase/
│   │       ├── client.ts               ← Browser client (anon key)
│   │       ├── server.ts               ← Server client (cookies)
│   │       ├── admin.ts                ← Admin client (service role)
│   │       └── middleware.ts           ← Session refresh
│   │
│   ├── actions/
│   │   ├── requests.ts                 ← Server Actions (create, answer, reopen)
│   │   └── auth.ts                     ← Server Actions (login, logout)
│   │
│   ├── agents/
│   │   ├── brand-context.ts            ← RODAG_BRAND_CONTEXT constante
│   │   ├── intake.ts                   ← Intake Agent (Claude Haiku)
│   │   ├── briefing.ts                 ← Briefing Agent (Claude Sonnet)
│   │   ├── strategy-copy.ts            ← Strategy+Copy Agent (GPT-4o)
│   │   ├── creative.ts                 ← Creative Agent (Claude Sonnet)
│   │   ├── image-generation.ts         ← Image Gen (Ideogram 3)
│   │   ├── qa-delivery.ts             ← QA+Delivery Agent (Claude Sonnet)
│   │   ├── orchestrator.ts             ← Sequenciador + retry loop
│   │   └── types.ts                    ← IntakeResult, BriefingResult, etc.
│   │
│   ├── hooks/
│   │   ├── use-realtime-request.ts     ← Supabase Realtime subscription
│   │   └── use-mobile.ts              ← shadcn hook
│   │
│   ├── types/
│   │   └── database.ts                 ← Types gerados do Supabase
│   │
│   └── middleware.ts                   ← Auth session refresh
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      ← Schema completo
│
├── .env.local                          ← Credenciais
├── components.json                     ← shadcn config
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 5. Variáveis de Ambiente (.env.local)

```env
# Supabase (já configurado)
NEXT_PUBLIC_SUPABASE_URL=https://aswyvqyxbipryhzccwqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# IA - Agentes
ANTHROPIC_API_KEY=                    ← Claude (Haiku + Sonnet)
OPENAI_API_KEY=                       ← GPT-4o (Strategy+Copy)
IDEOGRAM_API_KEY=                     ← Ideogram 3 (Image Generation)

# Supabase CLI
SUPABASE_CLI_ACCESS_TOKEN=...
SUPABASE_RODAG_PROJECT_ID=...

# GitHub
GITHUB_ACCESS_TOKEN=...
```

---

## 6. Fases de Desenvolvimento

### FASE 1 — Fundação (banco + auth + estrutura)

**Objetivo:** Projeto rodando com login e banco conectado.

1. Criar migration SQL no Supabase (8 tabelas + RLS + indexes)
2. Gerar types do Supabase (`supabase gen types`)
3. Implementar auth com magic link (login/callback/logout)
4. Criar layout do dashboard (header, sidebar, shell)
5. Profile auto-creation via trigger no Supabase (on auth.users insert)

**Entrega:** Usuário loga, vê dashboard vazio, profile criado.

---

### FASE 2 — Chat + Intake Agent

**Objetivo:** Cliente cria solicitação e recebe perguntas inteligentes.

1. Modal de nova solicitação (textarea + exemplos)
2. Server Action: `createRequest` → salva no banco
3. Implementar Intake Agent (Claude Haiku)
4. Se tem perguntas → mostrar no chat com formulário
5. Se não tem perguntas → ir direto pro orchestrator
6. Página de chat com histórico de mensagens

**Entrega:** Cliente escreve pedido, recebe 3-5 perguntas, responde.

---

### FASE 3 — Orchestrator + Agentes de Produção

**Objetivo:** Pipeline completo de briefing → strategy → copy → creative.

1. Implementar Briefing Agent (Claude Sonnet)
2. Implementar Strategy+Copy Agent (GPT-4o)
3. Implementar Creative Agent (Claude Sonnet) — condicional
4. Implementar Orchestrator (sequenciamento + status updates)
5. Supabase Realtime no frontend (status da request em tempo real)
6. Agent Pipeline visual (barra de progresso no chat)

**Entrega:** Após responder perguntas, agentes produzem a peça automaticamente.

---

### FASE 4 — QA + Entrega

**Objetivo:** Validação de qualidade e entrega formatada.

1. Implementar QA+Delivery Agent (Claude Sonnet)
2. Retry loop (score < 7 → re-roda Strategy+Copy com feedback)
3. Flag needsHumanReview se max retries
4. Delivery Page com seções colapsáveis e copy-to-clipboard
5. Markdown rendering da entrega no chat

**Entrega:** Cliente recebe peça validada com score de qualidade.

---

### FASE 5 — Geração de Imagem

**Objetivo:** Arte gerada automaticamente e entregue junto.

1. Integrar Ideogram 3 API
2. Supabase Storage bucket "deliverables"
3. Salvar imagem gerada + path no deliverable
4. Mostrar imagem na DeliveryPage
5. Download da imagem
6. Fallback: se Ideogram falhar, entregar só o prompt

**Entrega:** Cliente recebe copy + arte pronta.

---

### FASE 6 — Polish + Recovery

**Objetivo:** Sistema robusto e agradável de usar.

1. Rate limiting (max 10 requests/dia)
2. Recovery de requests presos (last_completed_step + retry)
3. Landing page (não autenticado)
4. Reabrir/revisar solicitação concluída
5. Tracking de custo por request (model_used, cost_usd em agent_runs)
6. Toast notifications com sonner
7. Mobile responsive

**Entrega:** Sistema pronto para uso real.

---

### FASE 7 — Futuro (pós-v1)

- WhatsApp Business integration
- Admin panel para revisão humana
- Template library para tipos comuns de peça
- Prompt versioning (tabela prompt_versions + A/B test)
- PDF export da entrega
- Canva API integration (gerar design direto no Canva)
- SSE/WebSocket para streaming de output dos agentes
- Billing por uso

---

## 7. Decisões Técnicas

### Por que GPT-4o para Copy e não Claude?

- GPT-4o é mais fluente em copy persuasiva em PT-BR
- Tom mais "vivo" e comercial, menos formal
- Claude tende a ser mais analítico (melhor pra QA/estratégia)
- Testamos depois e podemos trocar se Claude melhorar

### Por que Ideogram e não DALL-E?

- Ideogram 3 é o único que renderiza texto legível dentro de imagem
- Peça de marketing PRECISA de texto na arte (preço, CTA, telefone)
- DALL-E gera imagens bonitas mas texto ilegível
- Custo similar (~$0.08/imagem)

### Por que Supabase Realtime e não polling?

- Push instantâneo vs delay de 3-8s
- Menos requests ao servidor
- Melhor UX (status atualiza imediatamente)
- Supabase Realtime é gratuito no plano free

### Por que Server Actions e não tRPC?

- Next.js App Router tem Server Actions nativo
- tRPC adiciona complexidade sem benefício real no Next.js
- Type safety via Supabase types + Zod validation nas actions
- Menos dependências

### Por que hardcodar prompts e não tabela prompt_versions?

- Para v1, prompts vão mudar frequentemente durante desenvolvimento
- Ter no código = git history = rollback fácil
- Tabela prompt_versions é over-engineering pra v1
- Migrar para DB quando o sistema estabilizar

---

## 8. Estimativa de Custo por Request

### Pedido com imagem (post, banner, story)

| Agente | Modelo | Input tokens | Output tokens | Custo |
|--------|--------|-------------|---------------|-------|
| Intake | Haiku 4.5 | ~500 | ~300 | $0.0003 |
| Briefing | Sonnet 4.6 | ~1500 | ~500 | $0.009 |
| Strategy+Copy | GPT-4o | ~2000 | ~800 | $0.018 |
| Creative | Sonnet 4.6 | ~2500 | ~600 | $0.014 |
| Image Gen | Ideogram 3 | — | 1 imagem | $0.080 |
| QA+Delivery | Sonnet 4.6 | ~3000 | ~800 | $0.017 |
| **TOTAL** | | | | **~$0.14** |

### Pedido só texto (legenda, WhatsApp, roteiro)

| Agente | Modelo | Custo |
|--------|--------|-------|
| Intake | Haiku 4.5 | $0.0003 |
| Briefing | Sonnet 4.6 | $0.009 |
| Strategy+Copy | GPT-4o | $0.018 |
| QA+Delivery | Sonnet 4.6 | $0.017 |
| **TOTAL** | | **~$0.04** |

### Com retry do QA (1 revisão)

Adiciona ~$0.035 (Strategy+Copy + Creative re-run).
Total com retry: ~$0.18 por pedido visual.

---

## 9. Ordem de Execução

```
FASE 1: Fundação        → banco, auth, layout
FASE 2: Chat + Intake   → fluxo de entrada funcionando
FASE 3: Agentes         → pipeline completo
FASE 4: QA + Entrega    → validação e output
FASE 5: Imagem          → Ideogram integration
FASE 6: Polish          → recovery, rate limit, mobile
```

Cada fase é deployável independentemente.
O cliente pode usar o sistema a partir da Fase 4.
Imagem (Fase 5) é upgrade, não blocker.
