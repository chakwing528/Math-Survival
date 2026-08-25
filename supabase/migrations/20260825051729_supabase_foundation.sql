-- Math Survival Supabase foundation.
-- Public API objects are opt-in; student and score data remain in an unexposed schema.

alter default privileges for role postgres in schema public
    revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated, service_role;

create schema if not exists math_survival_private;
revoke all on schema math_survival_private from public, anon, authenticated;

create table public.game_config_versions (
    id bigint generated always as identity primary key,
    version text not null unique,
    config jsonb not null,
    is_active boolean not null default false,
    created_at timestamptz not null default clock_timestamp(),
    constraint game_config_versions_version_format
        check (version ~ '^[A-Za-z0-9._-]{1,40}$'),
    constraint game_config_versions_config_object
        check (jsonb_typeof(config) = 'object')
);

create unique index game_config_versions_one_active_idx
    on public.game_config_versions (is_active)
    where is_active;

alter table public.game_config_versions enable row level security;
alter table public.game_config_versions force row level security;

create policy game_config_versions_read_active
    on public.game_config_versions
    for select
    to anon, authenticated
    using (is_active);

revoke all on table public.game_config_versions from public, anon, authenticated, service_role;
grant select on table public.game_config_versions to anon, authenticated;
grant select, insert, update, delete on table public.game_config_versions to service_role;
grant usage, select on sequence public.game_config_versions_id_seq to service_role;

create table math_survival_private.student_directory (
    id bigint generated always as identity primary key,
    class_code text not null,
    student_id text not null,
    display_name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    constraint student_directory_class_format
        check (class_code ~ '^[A-Z0-9-]{1,16}$'),
    constraint student_directory_student_id_format
        check (student_id ~ '^[A-Z0-9-]{1,32}$'),
    constraint student_directory_display_name_length
        check (char_length(btrim(display_name)) between 1 and 64),
    unique (class_code, student_id)
);

create index student_directory_active_lookup_idx
    on math_survival_private.student_directory (class_code, student_id)
    where is_active;

create table math_survival_private.score_submissions (
    id uuid primary key default gen_random_uuid(),
    idempotency_key uuid not null unique,
    student_directory_id bigint not null
        references math_survival_private.student_directory (id) on delete restrict,
    class_code text not null,
    student_id text not null,
    display_name_snapshot text not null,
    difficulty smallint not null,
    score integer not null,
    requester_hash text not null,
    submitted_at timestamptz not null default clock_timestamp(),
    constraint score_submissions_difficulty_range check (difficulty between 1 and 5),
    constraint score_submissions_score_range check (score between 0 and 1000000),
    constraint score_submissions_requester_hash_format check (requester_hash ~ '^[0-9a-f]{64}$')
);

create index score_submissions_leaderboard_idx
    on math_survival_private.score_submissions (score desc, submitted_at asc);
create index score_submissions_student_idx
    on math_survival_private.score_submissions (student_directory_id, submitted_at desc);

create table math_survival_private.submission_rate_limits (
    requester_hash text not null,
    window_start timestamptz not null,
    attempts smallint not null default 1,
    primary key (requester_hash, window_start),
    constraint submission_rate_limits_hash_format check (requester_hash ~ '^[0-9a-f]{64}$'),
    constraint submission_rate_limits_attempts_positive check (attempts > 0)
);

create index submission_rate_limits_cleanup_idx
    on math_survival_private.submission_rate_limits (window_start);

alter table math_survival_private.student_directory enable row level security;
alter table math_survival_private.student_directory force row level security;
alter table math_survival_private.score_submissions enable row level security;
alter table math_survival_private.score_submissions force row level security;
alter table math_survival_private.submission_rate_limits enable row level security;
alter table math_survival_private.submission_rate_limits force row level security;

revoke all on all tables in schema math_survival_private from public, anon, authenticated;
revoke all on all sequences in schema math_survival_private from public, anon, authenticated;
grant usage on schema math_survival_private to service_role;
grant select on table math_survival_private.student_directory to service_role;
grant select, insert on table math_survival_private.score_submissions to service_role;
grant select, insert, update, delete on table math_survival_private.submission_rate_limits to service_role;

create or replace function public.get_leaderboard_v1(p_limit integer default 20)
returns table (
    diff text,
    cls text,
    sid text,
    name text,
    score integer,
    is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        '程度 ' || submission.difficulty::text,
        submission.class_code,
        ''::text,
        left(submission.display_name_snapshot, 1) || '同學',
        submission.score,
        false
    from math_survival_private.score_submissions as submission
    order by submission.score desc, submission.submitted_at asc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke all on function public.get_leaderboard_v1(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_leaderboard_v1(integer) to anon, authenticated, service_role;

create or replace function public.submit_score_v1(
    p_idempotency_key uuid,
    p_class_code text,
    p_student_id text,
    p_difficulty smallint,
    p_score integer,
    p_requester_hash text
)
returns table (
    accepted boolean,
    duplicate boolean,
    name text,
    submission_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    normalized_class text := upper(btrim(p_class_code));
    normalized_student_id text := upper(btrim(p_student_id));
    directory_row math_survival_private.student_directory%rowtype;
    existing_row math_survival_private.score_submissions%rowtype;
    created_id uuid;
    current_attempts smallint;
    current_window timestamptz := date_trunc('minute', clock_timestamp());
begin
    if normalized_class !~ '^[A-Z0-9-]{1,16}$'
        or normalized_student_id !~ '^[A-Z0-9-]{1,32}$'
        or p_difficulty not between 1 and 5
        or p_score not between 0 and 1000000
        or p_requester_hash !~ '^[0-9a-f]{64}$' then
        raise sqlstate 'PGRST' using
            message = '{"code":"INVALID_SUBMISSION","message":"Submission fields are invalid"}',
            detail = '{"status":400}';
    end if;

    select * into existing_row
    from math_survival_private.score_submissions
    where idempotency_key = p_idempotency_key;

    if found then
        if existing_row.class_code <> normalized_class
            or existing_row.student_id <> normalized_student_id
            or existing_row.difficulty <> p_difficulty
            or existing_row.score <> p_score then
            raise sqlstate 'PGRST' using
                message = '{"code":"IDEMPOTENCY_CONFLICT","message":"Idempotency key was already used"}',
                detail = '{"status":409}';
        end if;

        return query select true, true,
            left(existing_row.display_name_snapshot, 1) || '同學', existing_row.id;
        return;
    end if;

    select * into directory_row
    from math_survival_private.student_directory
    where class_code = normalized_class
      and student_id = normalized_student_id
      and is_active
    limit 1;

    if not found then
        raise sqlstate 'PGRST' using
            message = '{"code":"STUDENT_NOT_FOUND","message":"Student record was not found"}',
            detail = '{"status":403}';
    end if;

    delete from math_survival_private.submission_rate_limits
    where requester_hash = p_requester_hash
      and window_start < current_window - interval '2 hours';

    insert into math_survival_private.submission_rate_limits (requester_hash, window_start, attempts)
    values (p_requester_hash, current_window, 1)
    on conflict (requester_hash, window_start)
    do update set attempts = math_survival_private.submission_rate_limits.attempts + 1
    returning attempts into current_attempts;

    if current_attempts > 5 then
        raise sqlstate 'PGRST' using
            message = '{"code":"RATE_LIMITED","message":"Too many submissions"}',
            detail = '{"status":429}';
    end if;

    insert into math_survival_private.score_submissions (
        idempotency_key,
        student_directory_id,
        class_code,
        student_id,
        display_name_snapshot,
        difficulty,
        score,
        requester_hash
    ) values (
        p_idempotency_key,
        directory_row.id,
        normalized_class,
        normalized_student_id,
        directory_row.display_name,
        p_difficulty,
        p_score,
        p_requester_hash
    )
    returning id into created_id;

    return query select true, false, left(directory_row.display_name, 1) || '同學', created_id;
end;
$$;

revoke all on function public.submit_score_v1(uuid, text, text, smallint, integer, text)
    from public, anon, authenticated, service_role;
grant execute on function public.submit_score_v1(uuid, text, text, smallint, integer, text)
    to service_role;

comment on schema math_survival_private is
    'Unexposed student, score, and abuse-control data for Math Survival.';
comment on function public.get_leaderboard_v1(integer) is
    'Anonymous-safe leaderboard projection. It never returns a student ID or full name.';
comment on function public.submit_score_v1(uuid, text, text, smallint, integer, text) is
    'Server-only idempotent score submission. Edge Function validation is an additional boundary.';
