-- Product feedback collection and cadence state

CREATE TABLE public.feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  app_open_count_at_submit INTEGER,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_submissions_user_created
  ON public.feedback_submissions (user_id, created_at DESC);

CREATE INDEX idx_feedback_submissions_created
  ON public.feedback_submissions (created_at DESC);

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own feedback"
  ON public.feedback_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own feedback"
  ON public.feedback_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages feedback submissions"
  ON public.feedback_submissions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
