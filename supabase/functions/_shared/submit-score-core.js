const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLASS_PATTERN = /^[A-Z0-9-]{1,16}$/;
const STUDENT_ID_PATTERN = /^[A-Z0-9-]{1,32}$/;
const RPC_ERROR_MESSAGES = new Map([
    ['INVALID_SUBMISSION', 'Submission fields are invalid'],
    ['IDEMPOTENCY_CONFLICT', 'Idempotency key was already used'],
    ['STUDENT_NOT_FOUND', 'Student record was not found'],
    ['RATE_LIMITED', 'Too many submissions']
]);

export class SubmissionError extends Error {
    constructor(code, status, message) {
        super(message);
        this.name = 'SubmissionError';
        this.code = code;
        this.status = status;
    }
}

export function parseAllowedOrigins(value) {
    return new Set(String(value ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
}

export function getCorsHeaders(origin, allowedOrigins) {
    if (!origin || !allowedOrigins.has(origin)) return null;
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

export function normalizeRpcError(value) {
    let code = value && typeof value === 'object' && typeof value.code === 'string'
        ? value.code
        : '';
    if (!RPC_ERROR_MESSAGES.has(code) && value && typeof value === 'object' && typeof value.message === 'string') {
        try {
            const parsed = JSON.parse(value.message);
            code = typeof parsed?.code === 'string' ? parsed.code : '';
        } catch {
            code = '';
        }
    }
    if (!RPC_ERROR_MESSAGES.has(code)) {
        return { code: 'SUBMISSION_REJECTED', message: 'Score submission was rejected' };
    }
    return { code, message: RPC_ERROR_MESSAGES.get(code) };
}

export function normalizeSubmissionPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SubmissionError('INVALID_JSON_BODY', 400, 'JSON object required');
    }
    const normalized = {
        classCode: String(value.classCode ?? '').trim().toUpperCase(),
        studentId: String(value.studentId ?? '').trim().toUpperCase(),
        difficulty: Number(value.difficulty),
        score: Number(value.score),
        idempotencyKey: String(value.idempotencyKey ?? '').trim().toLowerCase()
    };
    if (!CLASS_PATTERN.test(normalized.classCode)
        || !STUDENT_ID_PATTERN.test(normalized.studentId)
        || !Number.isInteger(normalized.difficulty)
        || normalized.difficulty < 1
        || normalized.difficulty > 5
        || !Number.isInteger(normalized.score)
        || normalized.score < 0
        || normalized.score > 1000000
        || !UUID_V4_PATTERN.test(normalized.idempotencyKey)) {
        throw new SubmissionError('INVALID_SUBMISSION', 400, 'Submission fields are invalid');
    }
    return normalized;
}

export function extractRequesterAddress(headers) {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || headers.get('cf-connecting-ip')?.trim() || 'unavailable';
}

export async function hashRequester(address, salt) {
    if (!salt) throw new SubmissionError('SERVER_NOT_CONFIGURED', 500, 'Rate-limit salt is missing');
    const bytes = new TextEncoder().encode(`${salt}:${address}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
