-- Recallzy initial schema
-- Run this once in Supabase → SQL Editor → New query → paste → Run.

-- ============ Tables ============

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  file_type text not null check (file_type in ('pdf', 'image', 'docx', 'pptx', 'text')),
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  language text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_materials (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (quiz_id, material_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null,
  type text not null check (type in ('mcq', 'true_false', 'short', 'flashcard')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  accepted_answers jsonb not null default '[]'::jsonb,
  explanation text not null,
  option_explanations jsonb not null default '{}'::jsonb,
  topic text,
  difficulty text,
  source_hint text
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode text not null default 'full' check (mode in ('full', 'retry_mistakes')),
  score int not null default 0,
  total int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_answer text,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists materials_user_idx on public.materials (user_id);
create index if not exists quizzes_user_idx on public.quizzes (user_id, created_at desc);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);
create index if not exists attempts_user_idx on public.attempts (user_id, quiz_id);
create index if not exists answers_attempt_idx on public.answers (attempt_id);
create index if not exists answers_question_idx on public.answers (question_id);

-- ============ Row Level Security: users only see their own data ============

alter table public.materials enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_materials enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.daily_usage enable row level security;

create policy "own materials" on public.materials for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own quizzes" on public.quizzes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own quiz_materials" on public.quiz_materials for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()));

create policy "own questions" on public.questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()));

create policy "own attempts" on public.attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own answers" on public.answers for all to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- Users can read their usage but never change it (the server does that).
create policy "read own usage" on public.daily_usage for select to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on
  public.materials, public.quizzes, public.quiz_materials,
  public.questions, public.attempts, public.answers
  to authenticated;
grant select on public.daily_usage to authenticated;

-- ============ Daily usage counter (server only) ============

create or replace function public.increment_usage(p_user uuid)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.daily_usage (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.daily_usage.count + 1
  returning count;
$$;

revoke execute on function public.increment_usage(uuid) from public, anon, authenticated;

-- ============ Storage: private bucket for uploaded files ============

insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- Files are stored as "<user_id>/<file>", so each user can only touch their own folder.
create policy "own material files" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
