// ==============================================================================
// 數學題系統：出題 (依難度) + 答題彈窗 UI (計時 / 鍵盤數字鍵 / MCQ)
// ==============================================================================

const MATH_TIME_LIMIT = 10; // 秒

function formatInput(questionStr, ans, explain) {
    return {
        isInput: true,
        answer: ans,
        explain: explain || `\\( \\displaystyle ${questionStr} = ${ans} \\)`,
        question: `<div style="font-size:16px;color:#cbd5e1;margin-bottom:10px;">請計算以下結果：</div><div style="font-size:28px;font-weight:bold;">\\( \\displaystyle ${questionStr} = ? \\)</div>`
    };
}

function generateFallbackInput(weaponLevel) {
    let wl = Math.max(0, weaponLevel);
    let num1 = getRandomInt(11, 20 + wl * 2);
    let num2 = getRandomInt(2, 9);
    return formatInput(`${num1} \\times ${num2}`, num1 * num2);
}

function generateLevel1Question(weaponLevel) {
    let wl = Math.max(0, weaponLevel);
    let min = 1 + wl * 2;
    let max = 30 + wl * 5;
    let A = getRandomInt(min, max);
    let B = getRandomInt(min, max);
    let isAdd = Math.random() > 0.5;
    if (!isAdd && A < B) { let temp = A; A = B; B = temp; }
    let ans = isAdd ? A + B : A - B;
    let op = isAdd ? '+' : '-';
    return formatInput(`${A} ${op} ${B}`, ans);
}

function generateLevel2Question(weaponLevel) {
    let wl = Math.max(0, weaponLevel);
    let maxV = Math.floor(3 + wl * 1.5);
    if (maxV < 3) maxV = 3;
    // 每款題型都帶「先乘除後加減」嘅逐步解釋
    let patterns = [
        () => { let b = getRandomInt(2, maxV), c = getRandomInt(2, maxV), a = getRandomInt(1, maxV * 2); return { q: `${a} + ${b} \\times ${c}`, a: a + b * c, ex: `${a} + ${b} \\times ${c} = ${a} + ${b * c} = ${a + b * c}` }; },
        () => { let b = getRandomInt(2, maxV), c = getRandomInt(2, maxV), a = getRandomInt(b * c + 1, b * c + 20); return { q: `${a} - ${b} \\times ${c}`, a: a - b * c, ex: `${a} - ${b} \\times ${c} = ${a} - ${b * c} = ${a - b * c}` }; },
        () => { let a = getRandomInt(2, maxV), b = getRandomInt(2, maxV), c = getRandomInt(1, maxV * 2); return { q: `${a} \\times ${b} + ${c}`, a: a * b + c, ex: `${a} \\times ${b} + ${c} = ${a * b} + ${c} = ${a * b + c}` }; },
        () => { let a = getRandomInt(2, maxV), b = getRandomInt(2, maxV), c = getRandomInt(1, a * b - 1); return { q: `${a} \\times ${b} - ${c}`, a: a * b - c, ex: `${a} \\times ${b} - ${c} = ${a * b} - ${c} = ${a * b - c}` }; },
        () => { let c = getRandomInt(2, 10), b = c * getRandomInt(2, maxV), a = getRandomInt(1, maxV * 2); return { q: `${a} + ${b} \\div ${c}`, a: a + b / c, ex: `${a} + ${b} \\div ${c} = ${a} + ${b / c} = ${a + b / c}` }; },
        () => { let c = getRandomInt(2, 10), b = c * getRandomInt(2, maxV), a = getRandomInt(b / c + 1, b / c + 20); return { q: `${a} - ${b} \\div ${c}`, a: a - b / c, ex: `${a} - ${b} \\div ${c} = ${a} - ${b / c} = ${a - b / c}` }; },
        () => { let b = getRandomInt(2, 10), a = b * getRandomInt(2, maxV), c = getRandomInt(1, maxV * 2); return { q: `${a} \\div ${b} + ${c}`, a: a / b + c, ex: `${a} \\div ${b} + ${c} = ${a / b} + ${c} = ${a / b + c}` }; },
        () => { let b = getRandomInt(2, 10), a = b * getRandomInt(2, maxV), c = getRandomInt(1, a / b - 1); return { q: `${a} \\div ${b} - ${c}`, a: a / b - c, ex: `${a} \\div ${b} - ${c} = ${a / b} - ${c} = ${a / b - c}` }; }
    ];
    let p = patterns[getRandomInt(0, patterns.length)]();
    return formatInput(p.q, p.a, `<span style="color:#fbbf24;">先乘除，後加減：</span><br>\\( \\displaystyle ${p.ex} \\)`);
}

// 課題顯示名 (學習報告用)
export const TOPIC_NAMES = {
    arithmetic: '整數加減',
    mixed: '四則運算',
    indices: '指數',
    rounding: '捨入',
    expansion: '展開',
    factorization: '因式分解'
};

// 依難度出一題 (沿用原版邏輯)；qData.topic 標記課題
function generateQuestion(difficulty, questionsSolved, weaponLevel) {
    let qData;
    let topic = 'arithmetic';
    try {
        if (difficulty === '1') {
            qData = generateLevel1Question(weaponLevel);
        } else if (difficulty === '2') {
            qData = generateLevel2Question(weaponLevel);
            topic = 'mixed';
        } else if (difficulty === '3') {
            if (questionsSolved < 3) {
                qData = generateLevel1Question(weaponLevel);
            } else if (typeof window.generateIndicesQuestions === 'function') {
                qData = window.generateIndicesQuestions(1, 1)[0];
                topic = 'indices';
            } else {
                qData = generateFallbackInput(weaponLevel);
            }
        } else if (difficulty === '4' || difficulty === '5') {
            let level = difficulty === '4' ? 1 : 2;
            let topics = ['rounding', 'expansion', 'factorization', 'indices'];
            let t = topics[getRandomInt(0, topics.length)];

            if (t === 'rounding' && typeof window.generateRoundingQuestions === 'function') { qData = window.generateRoundingQuestions(1, level)[0]; topic = 'rounding'; }
            else if (t === 'expansion' && typeof window.generateExpansionQuestions === 'function') { qData = window.generateExpansionQuestions(1, level)[0]; topic = 'expansion'; }
            else if (t === 'factorization' && typeof window.generateFactorizationQuestions === 'function') { qData = window.generateFactorizationQuestions(1, level)[0]; topic = 'factorization'; }
            else if (t === 'indices' && typeof window.generateIndicesQuestions === 'function') { qData = window.generateIndicesQuestions(1, level)[0]; topic = 'indices'; }
            else qData = generateFallbackInput(weaponLevel);
        } else {
            qData = generateFallbackInput(weaponLevel);
        }
    } catch (e) {
        console.error("警告：外部進階題庫讀取失敗，已自動切換至後備輸入題。", e);
        qData = generateFallbackInput(weaponLevel);
    }
    if (!qData) qData = generateFallbackInput(weaponLevel);
    qData.topic = topic;
    return qData;
}

let activeKeydownHandler = null;
let activeTimerInterval = null;
let activeResolveTimeout = null;

function clearActiveMathResources() {
    if (activeKeydownHandler) { window.removeEventListener('keydown', activeKeydownHandler); activeKeydownHandler = null; }
    if (activeTimerInterval) { clearInterval(activeTimerInterval); activeTimerInterval = null; }
    if (activeResolveTimeout) { clearTimeout(activeResolveTimeout); activeResolveTimeout = null; }
}

export function dismissMathQuestion() {
    clearActiveMathResources();
    const overlay = document.getElementById('math-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
    }
}

// 顯示數學題彈窗。onResolve(isCorrect) 在答題/超時後 (含 1.2 秒回饋) 被呼叫一次。
export function showMathQuestion({
    type,
    difficulty,
    questionsSolved,
    weaponLevel,
    onResolve,
    timeLimitSeconds = MATH_TIME_LIMIT,
}) {
    const overlay = document.getElementById('math-overlay');
    const headerEl = document.getElementById('math-header');
    const containerEl = document.getElementById('math-container');
    const contentEl = document.getElementById('math-question-content');
    const optsContainer = document.getElementById('math-options-container');
    const timerBar = document.getElementById('math-timer-bar');

    // 防止重複觸發時遺留舊計時器 / 鍵盤監聽
    clearActiveMathResources();

    let resolved = false;
    const hintBox = document.getElementById('math-hint');
    if (hintBox) { hintBox.style.display = 'none'; hintBox.innerHTML = ''; }

    function cleanup() {
        clearActiveMathResources();
    }

    function resolve(isCorrect, delayMs) {
        if (resolved) return;
        resolved = true;
        if (activeTimerInterval) { clearInterval(activeTimerInterval); activeTimerInterval = null; }
        activeResolveTimeout = setTimeout(() => {
            activeResolveTimeout = null;
            cleanup();
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
            onResolve(isCorrect, qData.topic);
        }, delayMs);
    }

    // 答錯：顯示解題步驟，等學生自己撳「明白了」先繼續 (錯誤變學習機會)
    function showHintAndResolve(hintHTML) {
        if (resolved) return;
        resolved = true;
        if (activeTimerInterval) { clearInterval(activeTimerInterval); activeTimerInterval = null; }
        if (!hintBox) {
            activeResolveTimeout = setTimeout(() => {
                activeResolveTimeout = null;
                cleanup();
                overlay.style.display = 'none';
                overlay.setAttribute('aria-hidden', 'true');
                onResolve(false, qData.topic);
            }, 1500);
            return;
        }
        optsContainer.style.display = 'none';
        hintBox.innerHTML = `<div style="color:#fca5a5; font-weight:bold; font-size:16px; margin-bottom:8px;">📖 解題步驟</div><div style="font-size:17px; line-height:1.7;">${hintHTML}</div>`;
        const contBtn = document.createElement('button');
        contBtn.textContent = '明白了，繼續戰鬥 ▶';
        contBtn.style = "display:block; margin: 14px auto 0 auto; background: #16a34a; color: white; border: none; padding: 10px 28px; font-size: 18px; font-weight: bold; border-radius: 8px; cursor: pointer;";
        contBtn.onclick = () => {
            cleanup();
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
            hintBox.style.display = 'none';
            onResolve(false, qData.topic);
        };
        contBtn.className = 'math-continue-btn';
        hintBox.appendChild(contBtn);
        hintBox.style.display = 'block';
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) MathJax.typesetPromise([hintBox]).catch(() => {});
    }

    if (type === 'UPGRADE') {
        headerEl.textContent = '⚡ 武器進化程序 ⚡'; headerEl.style.color = '#eab308';
        containerEl.style.borderColor = '#eab308';
    } else {
        headerEl.textContent = '🔵 彈藥補給程序 🔵'; headerEl.style.color = '#38bdf8';
        containerEl.style.borderColor = '#38bdf8';
    }

    const qData = generateQuestion(difficulty, questionsSolved, weaponLevel);
    contentEl.innerHTML = qData.question;
    optsContainer.innerHTML = '';

    if (qData.isInput) {
        optsContainer.style.display = 'flex';
        optsContainer.style.flexDirection = 'column';
        optsContainer.style.alignItems = 'center';
        optsContainer.style.gap = '10px';

        let currentInputValue = "";

        let inputDisplay = document.createElement('div');
        inputDisplay.id = 'math-num-display';
        inputDisplay.className = 'math-num-display';
        inputDisplay.style = "font-size: 32px; padding: 10px; width: 240px; min-height: 45px; text-align: center; border-radius: 8px; border: 2px solid #94a3b8; background: #334155; color: #fbbf24; font-weight: bold; display: flex; justify-content: center; align-items: center; letter-spacing: 2px;";

        let numpad = document.createElement('div');
        numpad.className = 'math-numpad';
        numpad.style = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 260px; margin-top: 5px;";

        const buttons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '⌫'];
        const updateDisplay = () => { inputDisplay.textContent = currentInputValue; };

        buttons.forEach(btnText => {
            let btn = document.createElement('button');
            btn.textContent = btnText;
            btn.className = 'math-key-btn';
            btn.style = "background: #475569; color: white; border: 2px solid #64748b; padding: 12px; font-size: 24px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: 0.2s;";
            btn.onmouseover = () => btn.style.background = '#64748b';
            btn.onmouseout = () => btn.style.background = '#475569';
            btn.onclick = () => {
                if (resolved) return;
                if (btnText === '⌫') {
                    currentInputValue = currentInputValue.slice(0, -1);
                } else if (btnText === '-') {
                    currentInputValue = currentInputValue.startsWith('-') ? currentInputValue.substring(1) : '-' + currentInputValue;
                } else {
                    if (currentInputValue.length < 8) currentInputValue += btnText;
                }
                updateDisplay();
            };
            numpad.appendChild(btn);
        });

        let submitBtn = document.createElement('button');
        submitBtn.textContent = '確定';
        submitBtn.className = 'math-submit-btn';
        submitBtn.style = "background: #3b82f6; color: white; border: 2px solid #94a3b8; padding: 12px 40px; font-size: 24px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: 0.2s; width: 260px; margin-top: 5px;";
        submitBtn.onmouseover = () => submitBtn.style.background = '#2563eb';
        submitBtn.onmouseout = () => submitBtn.style.background = '#3b82f6';
        submitBtn.onclick = () => {
            if (resolved) return;
            submitBtn.disabled = true;

            let userVal = parseFloat(currentInputValue);
            let correctAns = parseFloat(qData.answer);
            let isCorrect = (!isNaN(userVal) && userVal === correctAns);

            if (isCorrect) {
                inputDisplay.style.color = '#4ade80';
                inputDisplay.style.borderColor = '#4ade80';
                inputDisplay.style.backgroundColor = 'rgba(74, 222, 128, 0.1)';
                resolve(true, 900);
            } else {
                inputDisplay.style.color = '#ef4444';
                inputDisplay.style.borderColor = '#ef4444';
                inputDisplay.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                inputDisplay.innerHTML = `<span style="text-decoration: line-through; margin-right: 15px;">${isNaN(userVal) ? '?' : userVal}</span> <span style="color:#4ade80">${correctAns}</span>`;
                showHintAndResolve(qData.explain || `正確答案：\\( ${correctAns} \\)`);
            }
        };

        activeKeydownHandler = function (e) {
            if (resolved) return;
            if (e.key >= '0' && e.key <= '9') {
                if (currentInputValue.length < 8) currentInputValue += e.key;
                updateDisplay();
            } else if (e.key === 'Backspace') {
                currentInputValue = currentInputValue.slice(0, -1);
                updateDisplay();
            } else if (e.key === '-') {
                currentInputValue = currentInputValue.startsWith('-') ? currentInputValue.substring(1) : '-' + currentInputValue;
                updateDisplay();
            } else if (e.key === 'Enter') {
                submitBtn.click();
            }
        };
        window.addEventListener('keydown', activeKeydownHandler);

        optsContainer.appendChild(inputDisplay);
        optsContainer.appendChild(numpad);
        optsContainer.appendChild(submitBtn);
    } else {
        optsContainer.style.display = 'grid';
        let optionElements = [];
        qData.options.forEach(opt => {
            let btn = document.createElement('div');
            btn.className = 'mcq-btn';
            btn.innerHTML = `<span class="mcq-label" style="color:inherit;">${opt.id}.</span> <span>${opt.text}</span>`;
            optionElements.push({ btn: btn, isCorrect: opt.isCorrect });

            btn.onclick = () => {
                if (resolved) return;

                if (opt.isCorrect) {
                    btn.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
                    btn.style.borderColor = '#4ade80';
                    btn.style.color = '#4ade80';
                    resolve(true, 900);
                } else {
                    btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    btn.style.borderColor = '#ef4444';
                    btn.style.color = '#ef4444';
                    let correctItem = optionElements.find(item => item.isCorrect);
                    if (correctItem) {
                        correctItem.btn.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
                        correctItem.btn.style.borderColor = '#4ade80';
                        correctItem.btn.style.color = '#4ade80';
                    }
                    // 題庫每個錯誤選項自帶「點解錯」嘅詳解 (hint)
                    const correctOpt = qData.options.find(o => o.isCorrect);
                    showHintAndResolve(opt.hint || (correctOpt && correctOpt.hint) || '睇下綠色嗰個正確答案。');
                }
            };
            optsContainer.appendChild(btn);
        });
    }

    // 先同步顯示彈窗；MathJax 只屬漸進增強，任何同步／非同步錯誤都不可阻止答題。
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        try { MathJax.typesetPromise([overlay]).catch(() => {}); } catch (error) {}
    }

    // 倒數計時
    const timeLimit = Math.max(1, Number(timeLimitSeconds) || MATH_TIME_LIMIT);
    let timeLeft = timeLimit;
    timerBar.style.width = '100%';
    timerBar.style.backgroundColor = '#4ade80';
    activeTimerInterval = setInterval(() => {
        if (resolved) return;
        timeLeft -= 0.1;
        let pct = Math.max(0, (timeLeft / timeLimit) * 100);
        timerBar.style.width = pct + '%';
        timerBar.style.backgroundColor = timeLeft < 3 ? '#ef4444' : '#4ade80';
        if (timeLeft <= 0) {
            resolve(false, 0);
        }
    }, 100);
}
