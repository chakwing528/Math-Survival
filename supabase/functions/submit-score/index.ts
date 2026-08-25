import {
    SubmissionError,
    extractRequesterAddress,
    getCorsHeaders,
    hashRequester,
    normalizeRpcError,
    normalizeSubmissionPayload,
    parseAllowedOrigins
} from '../_shared/submit-score-core.js';

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string> | null) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...(corsHeaders ?? {}) }
    });
}

function serverHeaders(serverKey: string) {
    const headers: Record<string, string> = {
        apikey: serverKey,
        'Content-Type': 'application/json'
    };
    if (serverKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serverKey}`;
    return headers;
}

Deno.serve(async request => {
    const origin = request.headers.get('origin') ?? '';
    const allowedOrigins = parseAllowedOrigins(Deno.env.get('MATH_SURVIVAL_ALLOWED_ORIGINS'));
    const corsHeaders = getCorsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
        return corsHeaders
            ? new Response(null, { status: 204, headers: corsHeaders })
            : jsonResponse({ code: 'ORIGIN_NOT_ALLOWED' }, 403, null);
    }
    if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders);
    if (!corsHeaders) return jsonResponse({ code: 'ORIGIN_NOT_ALLOWED' }, 403, null);

    const expectedPublicKey = Deno.env.get('MATH_SURVIVAL_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!expectedPublicKey || request.headers.get('apikey') !== expectedPublicKey) {
        return jsonResponse({ code: 'INVALID_API_KEY' }, 401, corsHeaders);
    }

    try {
        const payload = normalizeSubmissionPayload(await request.json());
        const requesterHash = await hashRequester(
            extractRequesterAddress(request.headers),
            Deno.env.get('MATH_SURVIVAL_RATE_LIMIT_SALT')
        );
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serverKey = Deno.env.get('MATH_SURVIVAL_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serverKey) throw new SubmissionError('SERVER_NOT_CONFIGURED', 500, 'Server credentials are missing');

        const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_score_v1`, {
            method: 'POST',
            headers: serverHeaders(serverKey),
            body: JSON.stringify({
                p_idempotency_key: payload.idempotencyKey,
                p_class_code: payload.classCode,
                p_student_id: payload.studentId,
                p_difficulty: payload.difficulty,
                p_score: payload.score,
                p_requester_hash: requesterHash
            })
        });
        const result = await rpcResponse.json().catch(() => null);
        if (!rpcResponse.ok) {
            return jsonResponse(normalizeRpcError(result), rpcResponse.status, corsHeaders);
        }

        const receipt = Array.isArray(result) ? result[0] : result;
        return jsonResponse({
            accepted: receipt?.accepted === true,
            duplicate: receipt?.duplicate === true,
            name: typeof receipt?.name === 'string' ? receipt.name : '',
            receiptId: typeof receipt?.submission_id === 'string' ? receipt.submission_id : ''
        }, 200, corsHeaders);
    } catch (error) {
        if (error instanceof SubmissionError) {
            return jsonResponse({ code: error.code, message: error.message }, error.status, corsHeaders);
        }
        return jsonResponse({ code: 'INVALID_REQUEST', message: 'Request could not be processed' }, 400, corsHeaders);
    }
});
