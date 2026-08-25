import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SubmissionError,
    getCorsHeaders,
    hashRequester,
    normalizeSubmissionPayload,
    parseAllowedOrigins
} from '../../supabase/functions/_shared/submit-score-core.js';

test('normalizes a valid score submission and rejects malformed fields', () => {
    assert.deepEqual(normalizeSubmissionPayload({
        classCode: ' tst-1a ', studentId: ' s01 ', difficulty: 2, score: 42,
        idempotencyKey: '00000000-0000-4000-8000-000000000001'
    }), {
        classCode: 'TST-1A', studentId: 'S01', difficulty: 2, score: 42,
        idempotencyKey: '00000000-0000-4000-8000-000000000001'
    });
    assert.throws(
        () => normalizeSubmissionPayload({ classCode: '1A', studentId: '01', difficulty: 9, score: 2 }),
        error => error instanceof SubmissionError && error.code === 'INVALID_SUBMISSION'
    );
});

test('returns CORS headers only for an exact configured origin', () => {
    const allowed = parseAllowedOrigins('https://chakwing528.github.io,http://127.0.0.1:8000');
    assert.equal(getCorsHeaders('https://evil.example', allowed), null);
    assert.equal(getCorsHeaders('https://chakwing528.github.io', allowed)['Access-Control-Allow-Origin'], 'https://chakwing528.github.io');
});

test('hashes requester metadata without retaining the raw address', async () => {
    const first = await hashRequester('192.0.2.1', 'synthetic-test-salt');
    const second = await hashRequester('192.0.2.1', 'synthetic-test-salt');
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(first, second);
    assert.equal(first.includes('192.0.2.1'), false);
});
