-- Synthetic local-only fixtures. Never place real student data in this file.
insert into public.game_config_versions (version, config, is_active)
values (
    'local-test-v1',
    '{"weapons": [["level", "name"], [1, "Test Pistol"]], "monsters": [["tier", "name"], [1, "Test Zombie"]]}'::jsonb,
    true
)
on conflict (version) do update set config = excluded.config, is_active = excluded.is_active;

insert into math_survival_private.student_directory (class_code, student_id, display_name)
values ('TST-1A', 'S01', '測試學生甲')
on conflict (class_code, student_id) do update
set display_name = excluded.display_name, is_active = true, updated_at = clock_timestamp();
