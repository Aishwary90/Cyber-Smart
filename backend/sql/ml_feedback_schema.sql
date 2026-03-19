-- Table to store user feedback used for model learning.
create table if not exists public.case_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid null references public.cases(id) on delete set null,
  incident_text text not null,
  predicted_class text null,
  corrected_class text null,
  verdict_type text null,
  was_helpful boolean null,
  rating int null check (rating between 1 and 5),
  notes text null,
  answers jsonb not null default '{}'::jsonb,
  confidence numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_feedback_user_idx on public.case_feedback(user_id, created_at desc);
create index if not exists case_feedback_label_idx on public.case_feedback(corrected_class, predicted_class);

alter table public.case_feedback enable row level security;

-- Users can read/write only their own feedback.
create policy "case_feedback_select_own"
  on public.case_feedback
  for select
  using (auth.uid() = user_id);

create policy "case_feedback_insert_own"
  on public.case_feedback
  for insert
  with check (auth.uid() = user_id);
