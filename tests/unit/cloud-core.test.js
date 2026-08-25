import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../js/cloud-core.js');
const Cloud = globalThis.MathSurvivalCloud;

test('normalizes leaderboard rows and rejects an invalid top-level response', () => {
    const payload = '<img id="xss-proof" src=x onerror="globalThis.__xss=1">';
    const rows = Cloud.normalizeLeaderboard([
        { cls: payload, sid: '01', name: payload, score: '12.4', diff: '程度 1', isMe: true },
        { cls: '1A', sid: '02', score: 'not-a-number', diff: '程度 1' }
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].score, 12);
    assert.equal(rows[0].cls.length, 16);
    assert.ok(rows[0].name.length <= 64);
    assert.equal(rows[0].isMe, true);
    assert.throws(() => Cloud.normalizeLeaderboard({ rows: [] }), error => error.code === 'INVALID_LEADERBOARD');
});

test('normalizes known game-data aliases and discards nested objects', () => {
    const data = Cloud.normalizeGameData({
        Weapons: [['level', 'name'], [1, 'Pistol', { unsafe: true }]],
        Monsters: [['tier', 'name'], [1, 'Zombie']]
    });

    assert.deepEqual(data.weapons[1], [1, 'Pistol', '']);
    assert.equal(data.monsters[1][1], 'Zombie');
    assert.throws(() => Cloud.normalizeGameData([]), error => error.code === 'INVALID_GAME_DATA');
});

test('validates submissions and bounds personal-data fields', () => {
    const submission = Cloud.normalizeSubmission({ cls: ' 1a ', sid: ' 01 ', score: 8.6, difficulty: '2' });
    assert.deepEqual(submission, { cls: '1A', sid: '01', score: 9, difficulty: '2' });
    assert.throws(
        () => Cloud.normalizeSubmission({ cls: '', sid: '01', score: 10, difficulty: '2' }),
        error => error.code === 'INVALID_SUBMISSION'
    );
    assert.throws(
        () => Cloud.normalizeSubmission({ cls: '1A', sid: '01', score: 10, difficulty: '9' }),
        error => error.code === 'INVALID_SUBMISSION'
    );
});

test('reports HTTP, invalid JSON, and timeout failures with explicit codes', async () => {
    await assert.rejects(
        Cloud.fetchJson('https://example.invalid', { fetchImpl: async () => ({ ok: false, status: 503 }) }),
        error => error.code === 'HTTP_ERROR'
    );
    await assert.rejects(
        Cloud.fetchJson('https://example.invalid', { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) }),
        error => error.code === 'INVALID_JSON'
    );
    await assert.rejects(
        Cloud.fetchJson('https://example.invalid', {
            timeoutMs: 5,
            fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            })
        }),
        error => error.code === 'TIMEOUT'
    );
});

test('single-flight wrapper coalesces concurrent submissions and resets afterwards', async () => {
    let calls = 0;
    const task = Cloud.createSingleFlight(async value => {
        calls += 1;
        await Promise.resolve();
        return value;
    });

    const first = task('first');
    const second = task('second');
    assert.equal(first, second);
    assert.equal(await first, 'first');
    assert.equal(calls, 1);
    assert.equal(await task('third'), 'third');
    assert.equal(calls, 2);
});

test('merges a submitted result once and sorts by numeric score', () => {
    const submission = Cloud.normalizeSubmission({ cls: '1A', sid: '01', score: 20, difficulty: '1' });
    const rows = Cloud.mergeSubmittedScore([
        { cls: '1A', sid: '02', name: 'B', score: 30, diff: '程度 1' },
        { cls: '1A', sid: '01', name: '', score: 20, diff: '程度 1' }
    ], submission, 'Student');

    assert.equal(rows.length, 2);
    assert.equal(rows[1].isMe, true);
    assert.equal(rows[1].name, 'Student');
});
