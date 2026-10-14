
-- =========================================================================
-- AI JOBS (background processing)
-- =========================================================================
CREATE TABLE public.ai_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_jobs_user ON public.ai_jobs(user_id, created_at DESC);
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own jobs"   ON public.ai_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own jobs" ON public.ai_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own jobs" ON public.ai_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own jobs" ON public.ai_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_ai_jobs_touch BEFORE UPDATE ON public.ai_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- CHAT MESSAGES (unified Nouri chat — survives reload)
-- =========================================================================
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  citations JSONB,
  meal_id UUID,
  active_job_id UUID,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id, created_at);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages"   ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own messages" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================================
-- FAMILY MEMBERS
-- =========================================================================
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  member_id TEXT NOT NULL,
  name TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, member_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own family"   ON public.family_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own family" ON public.family_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own family" ON public.family_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own family" ON public.family_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_family_touch BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- MEAL PLANS (per week)
-- =========================================================================
CREATE TABLE public.meal_plans (
  user_id UUID NOT NULL,
  week_key TEXT NOT NULL,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own plans"   ON public.meal_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON public.meal_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plans" ON public.meal_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON public.meal_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_meal_plans_touch BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- RECIPES
-- =========================================================================
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recipes_user ON public.recipes(user_id, created_at DESC);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recipes"   ON public.recipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recipes" ON public.recipes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recipes" ON public.recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================================
-- GROCERY LISTS (per week)
-- =========================================================================
CREATE TABLE public.grocery_lists (
  user_id UUID NOT NULL,
  week_key TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own grocery"   ON public.grocery_lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own grocery" ON public.grocery_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own grocery" ON public.grocery_lists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own grocery" ON public.grocery_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_grocery_touch BEFORE UPDATE ON public.grocery_lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- DASHBOARD LAYOUT
-- =========================================================================
CREATE TABLE public.dashboard_layout (
  user_id UUID NOT NULL PRIMARY KEY,
  layout JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own layout"   ON public.dashboard_layout FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own layout" ON public.dashboard_layout FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own layout" ON public.dashboard_layout FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own layout" ON public.dashboard_layout FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_layout_touch BEFORE UPDATE ON public.dashboard_layout
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- USER STATE (catch-all bag for small settings)
-- =========================================================================
CREATE TABLE public.user_state (
  user_id UUID NOT NULL PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own state"   ON public.user_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own state" ON public.user_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own state" ON public.user_state FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_user_state_touch BEFORE UPDATE ON public.user_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- PROFILES: calendar feed token
-- =========================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_token UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_calendar_token ON public.profiles(calendar_token);

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER TABLE public.ai_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
