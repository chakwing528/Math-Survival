-- PostgREST requires both status and headers in the DETAIL JSON for PGRST errors.
-- Without headers, hosted PostgREST returns PGRST121/500 instead of the intended status.

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
            detail = '{"status":400,"headers":{}}';
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
                detail = '{"status":409,"headers":{}}';
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
            detail = '{"status":403,"headers":{}}';
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
            detail = '{"status":429,"headers":{}}';
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
