import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.MathSurvivalCloudRuntime = {
    provider: 'supabase',
    supabaseUrl: 'https://project-ref.supabase.co/',
    supabasePublishableKey: 'sb_publishable_synthetic_test',
    fallbackReadsToGas: true
};
await import('../../js/cloud-core.js?supabase-adapter-test');
const Cloud = globalThis.MathSurvivalCloud;

function jsonResponse(data, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => data };
}

test('Supabase adapter reads active config and redacted leaderboard RPC', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        if (url.includes('game_config_versions')) {
            return jsonResponse([{ config: { weapons: [[1, 'Test']], monsters: [[1, 'Test']] } }]);
        }
        return jsonResponse([{ diff: '程度 2', cls: 'TST-1A', sid: '', name: '測同學', score: 42, is_me: false }]);
    };

    const config = await Cloud.requestSupabaseAction('getGameData', { fetchImpl });
    const leaderboard = await Cloud.requestSupabaseAction('getLeaderboard', { fetchImpl });
    assert.equal(config.weapons[0][1], 'Test');
    assert.equal(leaderboard[0].sid, '');
    assert.equal(calls[0].options.headers.apikey, 'sb_publishable_synthetic_test');
    assert.deepEqual(JSON.parse(calls[1].options.body), { p_limit: 100 });
});

test('Supabase score submit uses POST body and does not put student fields in the URL', async () => {
    let observed;
    const result = await Cloud.requestSupabaseAction('addScore', {
        params: { cls: 'TST-1A', sid: 'S01', difficulty: '2', score: 42 },
        fetchImpl: async (url, options) => {
            observed = { url, options };
            return jsonResponse({ accepted: true, name: '測同學' });
        }
    });
    const body = JSON.parse(observed.options.body);
    assert.equal(observed.options.method, 'POST');
    assert.equal(observed.url.includes('TST-1A'), false);
    assert.equal(body.classCode, 'TST-1A');
    assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/);
    assert.equal(result.name, '測同學');
});

test('Supabase mutation errors never fall back to legacy GAS GET', async () => {
    const urls = [];
    await assert.rejects(
        Cloud.requestAction('addScore', {
            params: { cls: 'TST-1A', sid: 'S01', difficulty: '2', score: 42 },
            fetchImpl: async url => {
                urls.push(url);
                return jsonResponse({ code: 'RATE_LIMITED' }, { ok: false, status: 429 });
            }
        }),
        error => error.code === 'RATE_LIMITED'
    );
    assert.equal(urls.length, 1);
    assert.equal(urls[0].includes('script.google.com'), false);
});
