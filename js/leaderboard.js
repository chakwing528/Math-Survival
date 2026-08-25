// ==============================================================================
// 排行榜：讀取 / 安全渲染 / 上傳成績（保留現有 GAS GET contract）
// ==============================================================================

import { GAS_URL } from './config.js?v=36';

const Cloud = globalThis.MathSurvivalCloud;
if (!Cloud) throw new Error('MathSurvivalCloud must load before leaderboard.js');

export async function fetchLeaderboard() {
    if (!GAS_URL && Cloud.PROVIDER !== 'supabase') return [];
    return Cloud.requestAction('getLeaderboard');
}

export function renderLeaderboard(data, listEl, myRankEl) {
    Cloud.renderLeaderboard(data, listEl, myRankEl);
}

async function performSubmitScore(input) {
    if (!GAS_URL && Cloud.PROVIDER !== 'supabase') return [];
    const submission = Cloud.normalizeSubmission(input);
    const now = new Date();
    const params = {
        date: now.toLocaleDateString('zh-HK'),
        time: now.toLocaleTimeString('zh-HK'),
        diff: `程度 ${submission.difficulty}`,
        difficulty: submission.difficulty,
        cls: submission.cls,
        sid: submission.sid,
        score: submission.score,
        t: now.getTime()
    };

    let playerName = submission.sid;
    try {
        const response = await Cloud.requestAction('addScore', { params });
        if (response.name) playerName = response.name;
    } catch (error) {
        console.log('上傳或配對延遲', error);
    }

    let leaderboardData = [];
    try {
        leaderboardData = await fetchLeaderboard();
    } catch (error) {
        console.log('讀取最新排行榜失敗', error);
    }
    return Cloud.mergeSubmittedScore(leaderboardData, submission, playerName);
}

export const submitScore = Cloud.createSingleFlight(performSubmitScore);
