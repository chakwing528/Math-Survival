// Shared Google Apps Script boundary for both the 3D and classic 2D clients.
(function initMathSurvivalCloud(global) {
    'use strict';

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyhAYaMKRTbD_VyHDe-MZZ5OBZVdsvY2l9qcKWq8TuliBKptbhLpQsHbc4wdyKmX24Cvg/exec';
    const DEFAULT_TIMEOUT_MS = 6000;
    const MAX_LEADERBOARD_ITEMS = 100;
    const ALLOWED_ACTIONS = new Set(['getGameData', 'getLeaderboard', 'addScore']);

    class CloudError extends Error {
        constructor(code, message, options = {}) {
            super(message, options);
            this.name = 'CloudError';
            this.code = code;
        }
    }

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function cleanText(value, maxLength, { trim = false } = {}) {
        if (value == null) return '';
        let text = String(value).replace(/[\u0000-\u001f\u007f]/g, '');
        if (trim) text = text.trim();
        return text.slice(0, maxLength);
    }

    function normalizeScore(value) {
        const score = Number(value);
        if (!Number.isFinite(score) || score < 0 || score > 1000000) return null;
        return Math.round(score);
    }

    function normalizeLeaderboardItem(item) {
        if (!isPlainObject(item)) return null;
        const score = normalizeScore(item.score);
        if (score === null) return null;
        return {
            diff: cleanText(item.diff, 32),
            cls: cleanText(item.cls, 16),
            sid: cleanText(item.sid, 32),
            name: cleanText(item.name, 64),
            score,
            isMe: item.isMe === true
        };
    }

    function normalizeLeaderboard(data) {
        if (!Array.isArray(data)) {
            throw new CloudError('INVALID_LEADERBOARD', 'Leaderboard response must be an array');
        }
        return data.slice(0, MAX_LEADERBOARD_ITEMS).map(normalizeLeaderboardItem).filter(Boolean);
    }

    function sanitizeRows(value) {
        if (!Array.isArray(value)) return [];
        return value.slice(0, 100).filter(Array.isArray).map(row => row.slice(0, 16).map(cell => {
            if (typeof cell === 'number') return Number.isFinite(cell) ? cell : '';
            if (typeof cell === 'boolean') return cell;
            if (typeof cell === 'string') return cleanText(cell, 160);
            return '';
        }));
    }

    function normalizeGameData(data) {
        if (!isPlainObject(data)) {
            throw new CloudError('INVALID_GAME_DATA', 'Game-data response must be an object');
        }
        return {
            weapons: sanitizeRows(data.weapons ?? data.Weapons ?? data['設定武器']),
            monsters: sanitizeRows(data.monsters ?? data.Monsters ?? data['設定魔物'])
        };
    }

    function normalizeSubmitResponse(data) {
        if (!isPlainObject(data)) return { name: '' };
        return { name: cleanText(data.name, 64, { trim: true }) };
    }

    function normalizeSubmission({ cls, sid, score, difficulty }) {
        const normalized = {
            cls: cleanText(cls, 16, { trim: true }).toUpperCase(),
            sid: cleanText(sid, 32, { trim: true }).toUpperCase(),
            score: normalizeScore(score),
            difficulty: cleanText(difficulty, 1, { trim: true })
        };
        if (!normalized.cls || !normalized.sid) {
            throw new CloudError('INVALID_SUBMISSION', 'Class and student ID are required');
        }
        if (normalized.score === null || !/^[1-5]$/.test(normalized.difficulty)) {
            throw new CloudError('INVALID_SUBMISSION', 'Score or difficulty is invalid');
        }
        return normalized;
    }

    function buildActionUrl(action, params = {}) {
        if (!ALLOWED_ACTIONS.has(action)) throw new CloudError('INVALID_ACTION', `Unsupported GAS action: ${action}`);
        const url = new URL(GAS_URL);
        url.searchParams.set('action', action);
        for (const [key, value] of Object.entries(params)) {
            if (value != null) url.searchParams.set(key, String(value));
        }
        if (!url.searchParams.has('t')) url.searchParams.set('t', `${Date.now()}_${Math.random()}`);
        return url.toString();
    }

    async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = global.fetch } = {}) {
        if (typeof fetchImpl !== 'function') throw new CloudError('NO_FETCH', 'Fetch is unavailable');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit' });
            if (!response || !response.ok) {
                throw new CloudError('HTTP_ERROR', `Cloud request failed with HTTP ${response?.status ?? 'unknown'}`);
            }
            try {
                return await response.json();
            } catch (error) {
                throw new CloudError('INVALID_JSON', 'Cloud response was not valid JSON', { cause: error });
            }
        } catch (error) {
            if (error instanceof CloudError) throw error;
            if (controller.signal.aborted) throw new CloudError('TIMEOUT', `Cloud request exceeded ${timeoutMs}ms`, { cause: error });
            throw new CloudError('NETWORK_ERROR', 'Cloud request failed', { cause: error });
        } finally {
            clearTimeout(timeout);
        }
    }

    async function requestAction(action, { params, timeoutMs, fetchImpl } = {}) {
        const data = await fetchJson(buildActionUrl(action, params), { timeoutMs, fetchImpl });
        if (action === 'getLeaderboard') return normalizeLeaderboard(data);
        if (action === 'getGameData') return normalizeGameData(data);
        return normalizeSubmitResponse(data);
    }

    function createSingleFlight(task) {
        let active = null;
        return (...args) => {
            if (active) return active;
            active = Promise.resolve().then(() => task(...args)).finally(() => { active = null; });
            return active;
        };
    }

    function setListMessage(listEl, message) {
        if (!listEl) return;
        const li = listEl.ownerDocument.createElement('li');
        li.textContent = message;
        listEl.replaceChildren(li);
    }

    function getDisplayItem(item) {
        const name = item.name.toUpperCase();
        const sid = item.sid.toUpperCase();
        const cls = item.cls.toUpperCase();
        const displayCls = cls === ' ' ? '' : cls;
        const displayName = cls === ' ' ? sid : (name.trim() ? name : sid);
        return {
            displayCls,
            safeName: displayName.length > 6 ? `${displayName.slice(0, 6)}..` : displayName,
            shortDiff: item.diff.replace('程度 ', 'L')
        };
    }

    function appendSpan(document, parent, text, style) {
        const span = document.createElement('span');
        span.textContent = text;
        if (style) span.style.cssText = style;
        parent.appendChild(span);
    }

    function renderLeaderboard(data, listEl, myRankEl, { classic = false } = {}) {
        if (!listEl) return;
        const items = normalizeLeaderboard(data);
        listEl.replaceChildren();
        if (myRankEl) {
            myRankEl.replaceChildren();
            myRankEl.style.display = 'none';
        }
        if (!items.length) {
            setListMessage(listEl, '暫無數據');
            return;
        }

        let myRank = -1;
        let myItem = null;
        const document = listEl.ownerDocument;
        items.forEach((item, index) => {
            if (item.isMe) { myRank = index + 1; myItem = item; }
            const display = getDisplayItem(item);
            const li = document.createElement('li');
            appendSpan(document, li, `${index + 1}.`);
            appendSpan(document, li, display.displayCls);
            appendSpan(document, li, display.safeName);
            appendSpan(document, li, `${item.score}分`, 'text-align:right;');
            appendSpan(document, li, `(${display.shortDiff})`, classic ? 'text-align:right;color:#475569;' : 'text-align:right;opacity:0.6;');
            if (item.isMe) {
                li.classList.add('lb-me');
                if (classic) li.style.cssText = 'background-color:rgba(46,204,113,0.4);border-radius:4px;';
            }
            listEl.appendChild(li);
        });

        if (myRank !== -1 && myRankEl && myItem) {
            const display = getDisplayItem(myItem);
            const wrapper = document.createElement('div');
            wrapper.className = 'my-rank-inner';
            if (classic) wrapper.style.cssText = 'background:rgba(234,179,8,0.3);border:2px solid #f59e0b;border-radius:6px;padding:10px;margin-bottom:8px;color:#fff;text-align:center;';
            const title = document.createElement('div');
            title.textContent = `你的排名：第 ${myRank} 名`;
            title.style.cssText = classic ? 'font-weight:bold;font-size:16px;margin-bottom:4px;' : 'font-weight:bold;font-size:20px;margin-bottom:6px;';
            const detail = document.createElement('div');
            detail.textContent = `${display.displayCls}　${display.safeName}　${myItem.score}分 (${display.shortDiff})`;
            detail.style.cssText = classic ? 'font-size:14px;color:#cbd5e1;' : 'font-size:17px;opacity:0.9;';
            wrapper.append(title, detail);
            myRankEl.appendChild(wrapper);
            myRankEl.style.display = 'block';
        }
    }

    function mergeSubmittedScore(leaderboard, submission, playerName) {
        const items = normalizeLeaderboard(leaderboard);
        const diff = `程度 ${submission.difficulty}`;
        let matched = false;
        for (const item of items) {
            if (!matched && item.sid.toUpperCase() === submission.sid && item.cls.toUpperCase() === submission.cls && item.score === submission.score && item.diff === diff && !item.isMe) {
                item.isMe = true;
                item.name = cleanText(playerName, 64, { trim: true }) || submission.sid;
                matched = true;
            }
        }
        if (!matched) {
            items.push({ diff, cls: submission.cls, sid: submission.sid, name: cleanText(playerName, 64, { trim: true }) || submission.sid, score: submission.score, isMe: true });
        }
        return items.sort((a, b) => b.score - a.score);
    }

    global.MathSurvivalCloud = Object.freeze({
        GAS_URL,
        DEFAULT_TIMEOUT_MS,
        CloudError,
        buildActionUrl,
        createSingleFlight,
        fetchJson,
        mergeSubmittedScore,
        normalizeGameData,
        normalizeLeaderboard,
        normalizeSubmission,
        renderLeaderboard,
        requestAction,
        setListMessage
    });
})(globalThis);
