// ==============================================================================
// 排行榜：讀取 / 渲染 / 上傳成績 (沿用原有 Google Apps Script API)
// ==============================================================================

import { GAS_URL } from './config.js?v=33';

export async function fetchLeaderboard() {
    if (!GAS_URL) return [];
    let res = await fetch(`${GAS_URL}?action=getLeaderboard&t=${new Date().getTime()}_${Math.random()}`);
    return await res.json();
}

// 將排行榜渲染到指定容器 (listEl: <ol>, myRankEl: 可選的「你的排名」區塊)
export function renderLeaderboard(data, listEl, myRankEl) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (myRankEl) myRankEl.style.display = 'none';

    if (!data || data.length === 0) { listEl.innerHTML = "<li>暫無數據</li>"; return; }

    let myRank = -1;
    let myItem = null;

    data.forEach((item, index) => {
        if (item.isMe) { myRank = index + 1; myItem = item; }

        let li = document.createElement('li');

        let itemNameStr = item.name != null ? String(item.name).toUpperCase() : "";
        let itemSidStr = item.sid != null ? String(item.sid).toUpperCase() : "";
        let itemClsStr = item.cls != null ? String(item.cls).toUpperCase() : "";
        let itemDiffStr = item.diff != null ? String(item.diff) : "";

        let displayCls = itemClsStr;
        let displayName = (itemNameStr.trim() !== "") ? itemNameStr : itemSidStr;
        if (itemClsStr === " ") { displayCls = ""; displayName = itemSidStr; }

        let safeName = displayName.length > 6 ? displayName.substring(0, 6) + '..' : displayName;
        let shortDiff = itemDiffStr.replace("程度 ", "L");

        li.innerHTML = `
            <span>${index + 1}.</span>
            <span>${displayCls}</span>
            <span>${safeName}</span>
            <span style="text-align:right;">${item.score}分</span>
            <span style="text-align:right; opacity:0.6;">(${shortDiff})</span>
        `;
        if (item.isMe) { li.classList.add('lb-me'); }
        listEl.appendChild(li);
    });

    if (myRank !== -1 && myRankEl && myItem) {
        let nameStr = myItem.name != null ? String(myItem.name).toUpperCase() : "";
        let sidStr = myItem.sid != null ? String(myItem.sid).toUpperCase() : "";
        let clsStr = myItem.cls != null ? String(myItem.cls).toUpperCase() : "";
        let diffStr = myItem.diff != null ? String(myItem.diff) : "";

        let displayCls = clsStr === " " ? "" : clsStr;
        let displayName = clsStr === " " ? sidStr : ((nameStr.trim() !== "") ? nameStr : sidStr);
        let safeName = displayName.length > 6 ? displayName.substring(0, 6) + '..' : displayName;
        let shortDiff = diffStr.replace("程度 ", "L");

        myRankEl.innerHTML = `
            <div class="my-rank-inner">
                <div style="font-weight: bold; font-size: 20px; margin-bottom: 6px;">你的排名：第 ${myRank} 名</div>
                <div style="font-size: 17px; opacity: 0.9;">${displayCls}　<b style="font-size:19px;">${safeName}</b>　${myItem.score}分 (${shortDiff})</div>
            </div>
        `;
        myRankEl.style.display = 'block';
    }
}

// 上傳成績並回傳含 isMe 標記的最新排行榜數據
export async function submitScore({ cls, sid, score, difficulty }) {
    if (!GAS_URL) return [];

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-HK');
    const timeStr = now.toLocaleTimeString('zh-HK');
    const diff = "程度 " + difficulty;
    const timestamp = now.getTime();

    if (cls === "") cls = " ";
    cls = cls.toUpperCase();
    sid = sid.toUpperCase();

    let playerName = sid;

    const addUrl = `${GAS_URL}?action=addScore&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&diff=${encodeURIComponent(diff)}&cls=${encodeURIComponent(cls)}&sid=${encodeURIComponent(sid)}&score=${score}&t=${timestamp}`;

    try {
        let res = await fetch(addUrl);
        let json = await res.json();
        if (json && json.name && String(json.name).trim() !== "") {
            playerName = String(json.name);
        }
    } catch (e) {
        console.log("上傳或配對延遲", e);
    }

    let leaderboardData = [];
    try {
        leaderboardData = await fetchLeaderboard();
    } catch (e) {
        console.log("讀取最新排行榜失敗", e);
    }

    let alreadyExists = false;
    for (let i = 0; i < leaderboardData.length; i++) {
        let item = leaderboardData[i];
        let itemSidStr = item.sid != null ? String(item.sid).toUpperCase() : "";
        let itemClsStr = item.cls != null ? String(item.cls).toUpperCase() : "";

        if (itemSidStr === sid && itemClsStr === cls && item.score === score && item.diff === diff && !item.isMe) {
            item.isMe = true;
            item.name = playerName;
            alreadyExists = true;
            break;
        }
    }

    if (!alreadyExists) {
        leaderboardData.push({ diff: diff, cls: cls, sid: sid, name: playerName, score: score, isMe: true });
    }

    leaderboardData.sort((a, b) => b.score - a.score);
    return leaderboardData;
}
