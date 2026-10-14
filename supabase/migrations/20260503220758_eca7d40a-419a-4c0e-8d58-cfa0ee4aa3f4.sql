-- Quick-log favorites: snapshots of meals the user wants to re-log instantly
-- without any AI call. Schema mirrors the meals table so a 1-tap log just
-- copies the row over.
CREATE TABLE public.meal_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_name TEXT NOT NULL,
  type TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein INTEGER NOT NULL DEFAULT 0,
  carbs INTEGER NOT NULL DEFAULT 0,
  fat INTEGER NOT NULL DEFAULT 0,
  micros JSONB,
  -- Used to bubble most-recently-tapped favorites to the top.
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevent the same favorite from being saved twice (case-sensitive on name+type).
  UNIQUE (user_id, meal_name, type)
);

CREATE INDEX idx_meal_favorites_user ON public.meal_favorites (user_id, last_used_at DESC NULLS LAST, created_at DESC);

ALTER TABLE public.meal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites"
  ON public.meal_favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own favorites"
  ON public.meal_favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own favorites"
  ON public.meal_favorites FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own favorites"
  ON public.meal_favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);