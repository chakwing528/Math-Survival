begin;

select plan(18);

select has_schema('math_survival_private', 'private schema exists');
select has_table('public', 'game_config_versions', 'public game config table exists');
select has_table('math_survival_private', 'student_directory', 'private student directory exists');
select has_table('math_survival_private', 'score_submissions', 'private score table exists');

select ok(
    (select relrowsecurity from pg_class where oid = 'public.game_config_versions'::regclass),
    'RLS is enabled on public game config'
);
select ok(
    (select relforcerowsecurity from pg_class where oid = 'public.game_config_versions'::regclass),
    'RLS is forced on public game config'
);
select ok(not has_schema_privilege('anon', 'math_survival_private', 'usage'), 'anon cannot use private schema');
select ok(not has_table_privilege('anon', 'math_survival_private.student_directory', 'select'), 'anon cannot read students');
select ok(not has_table_privilege('anon', 'math_survival_private.score_submissions', 'select'), 'anon cannot read scores');
select ok(has_table_privilege('anon', 'public.game_config_versions', 'select'), 'anon can select game config');
select ok(not has_table_privilege('anon', 'public.game_config_versions', 'insert'), 'anon cannot insert game config');
select ok(has_function_privilege('anon', 'public.get_leaderboard_v1(integer)', 'execute'), 'anon can read redacted leaderboard');
select ok(not has_function_privilege('anon', 'public.submit_score_v1(uuid,text,text,smallint,integer,text)', 'execute'), 'anon cannot submit directly');
select ok(has_function_privilege('service_role', 'public.submit_score_v1(uuid,text,text,smallint,integer,text)', 'execute'), 'service role can use server submit RPC');

set local role service_role;
select lives_ok(
    $$select * from public.submit_score_v1(
        '00000000-0000-4000-8000-000000000001'::uuid,
        'TST-1A', 'S01', 2::smallint, 42,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )$$,
    'service role can submit a synthetic score'
);

select lives_ok(
    $$do $block$
    begin
        perform public.submit_score_v1('00000000-0000-4000-8000-000000000011'::uuid, 'TST-1A', 'S01', 2::smallint, 11, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        perform public.submit_score_v1('00000000-0000-4000-8000-000000000012'::uuid, 'TST-1A', 'S01', 2::smallint, 12, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        perform public.submit_score_v1('00000000-0000-4000-8000-000000000013'::uuid, 'TST-1A', 'S01', 2::smallint, 13, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        perform public.submit_score_v1('00000000-0000-4000-8000-000000000014'::uuid, 'TST-1A', 'S01', 2::smallint, 14, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    end
    $block$;$$,
    'five submissions in one window are accepted'
);

select throws_ok(
    $$select * from public.submit_score_v1(
        '00000000-0000-4000-8000-000000000015'::uuid,
        'TST-1A', 'S01', 2::smallint, 15,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )$$,
    'PGRST',
    '{"code":"RATE_LIMITED","message":"Too many submissions"}',
    'the sixth new submission in one minute is rate limited'
);
reset role;

select results_eq(
    $$select sid, name from public.get_leaderboard_v1(1)$$,
    $$values (''::text, '測同學'::text)$$,
    'public leaderboard removes student ID and masks the name'
);

select * from finish();
rollback;
