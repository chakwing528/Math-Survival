import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const supabaseUrl = String(process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY ?? '');
const allowedOrigin = String(process.env.MATH_SURVIVAL_TEST_ORIGIN ?? 'http://127.0.0.1:8000');
const runRateLimitCheck = process.env.MATH_SURVIVAL_TEST_RATE_LIMIT === '1';

assert.match(supabaseUrl, /^https:\/\/[a-z]{20}\.supabase\.co$/, 'SUPABASE_URL must be a hosted project URL');
assert.match(publishableKey, /^sb_publishable_/, 'SUPABASE_PUBLISHABLE_KEY must be a modern publishable key');

const publicHeaders = { apikey: publishableKey };
const submission = {
    classCode: 'TST-1A',
    studentId: 'S01',
    difficulty: 2,
    score: 42,
    idempotencyKey: randomUUID()
};

async function requestJson(path, options = {}) {
    const response = await fetch(`${supabaseUrl}${path}`, options);
    const body = await response.json().catch(() => null);
    return { response, body };
}

const configRead = await requestJson('/rest/v1/game_config_versions?select=config&is_active=eq.true&limit=1', {
    headers: publicHeaders
});
assert.equal(configRead.response.status, 200, 'active config should be publicly readable');
assert.equal(Array.isArray(configRead.body), true, 'active config should return an array');
assert.equal(configRead.body.length, 1, 'staging should have exactly one active config');

const leaderboardRead = await requestJson('/rest/v1/rpc/get_leaderboard_v1', {
    method: 'POST',
    headers: { ...publicHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: 100 })
});
assert.equal(leaderboardRead.response.status, 200, 'redacted leaderboard RPC should be publicly readable');
assert.equal(Array.isArray(leaderboardRead.body), true, 'leaderboard should return an array');
for (const row of leaderboardRead.body) {
    assert.equal(row.sid, '', 'leaderboard must never expose a student ID');
    assert.match(row.name, /^.{1}同學$/u, 'leaderboard name must stay masked');
}

const directSubmit = await requestJson('/rest/v1/rpc/submit_score_v1', {
    method: 'POST',
    headers: { ...publicHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
        p_idempotency_key: submission.idempotencyKey,
        p_class_code: submission.classCode,
        p_student_id: submission.studentId,
        p_difficulty: submission.difficulty,
        p_score: submission.score,
        p_requester_hash: 'a'.repeat(64)
    })
});
assert.ok([401, 403, 404].includes(directSubmit.response.status), 'browser key must not call the submit RPC directly');

const rejectedOrigin = await requestJson('/functions/v1/submit-score', {
    method: 'POST',
    headers: {
        ...publicHeaders,
        'Content-Type': 'application/json',
        Origin: 'https://not-allowed.invalid'
    },
    body: JSON.stringify(submission)
});
assert.equal(rejectedOrigin.response.status, 403, 'an unlisted origin must be rejected');
assert.equal(rejectedOrigin.body?.code, 'ORIGIN_NOT_ALLOWED');

async function submit(payload) {
    return requestJson('/functions/v1/submit-score', {
        method: 'POST',
        headers: { ...publicHeaders, 'Content-Type': 'application/json', Origin: allowedOrigin },
        body: JSON.stringify(payload)
    });
}

const accepted = await submit(submission);
assert.equal(accepted.response.status, 200, 'valid synthetic score should be accepted');
assert.equal(accepted.body?.accepted, true);
assert.equal(accepted.body?.duplicate, false);
assert.match(accepted.body?.receiptId ?? '', /^[0-9a-f-]{36}$/i);

const duplicate = await submit(submission);
assert.equal(duplicate.response.status, 200, 'an idempotent retry should succeed');
assert.equal(duplicate.body?.accepted, true);
assert.equal(duplicate.body?.duplicate, true);
assert.equal(duplicate.body?.receiptId, accepted.body?.receiptId);

if (runRateLimitCheck) {
    for (let attempt = 2; attempt <= 5; attempt += 1) {
        const withinLimit = await submit({ ...submission, score: 40 + attempt, idempotencyKey: randomUUID() });
        assert.equal(withinLimit.response.status, 200, `submission ${attempt} should remain within the rate limit`);
    }
    const rateLimited = await submit({ ...submission, score: 99, idempotencyKey: randomUUID() });
    assert.equal(rateLimited.response.status, 429, 'the sixth new submission in one minute should be rate limited');
    assert.equal(rateLimited.body?.code, 'RATE_LIMITED');
}

console.log(JSON.stringify({
    configRead: 'passed',
    leaderboardRedaction: 'passed',
    directSubmitDenied: directSubmit.response.status,
    badOriginDenied: rejectedOrigin.response.status,
    accepted: accepted.response.status,
    duplicate: duplicate.body?.duplicate === true,
    rateLimit: runRateLimitCheck ? 'passed' : 'skipped'
}));
