// js/topics/indices.js

// ==========================================
// 指數定律專用輔助函數與提示訊息
// ==========================================

// 處理負數的括號顯示 (例如: -5 變成 "(-5)")
function safeNeg(n) { 
    return n < 0 ? `(${n})` : n; 
}

// 格式化單變數最終答案 (處理負指數轉正指數)
function formatFinalMath(v, p) { 
    return p > 0 ? `${v}^{${p}}` : p < 0 ? `\\frac{1}{${v}^{${-p}}}` : `1`; 
}

function formatFinal(v, p) { 
    return `\\( \\displaystyle ${formatFinalMath(v, p)} \\)`; 
}

// 格式化雙變數最終答案 (處理負指數轉正指數，並組合成份數)
function get2VarMath(v1, p1, v2, p2) {
    if (p1 === 0 && p2 === 0) return "1";
    let num = "", den = "";
    if (p1 > 0) num += `${v1}^{${p1}}`; else if (p1 < 0) den += `${v1}^{${-p1}}`;
    if (p2 > 0) num += `${v2}^{${p2}}`; else if (p2 < 0) den += `${v2}^{${-p2}}`;
    if (num === "") num = "1";
    if (den === "") return num;
    return `\\frac{${num}}{${den}}`;
}

function formatFinal2Vars(v1, p1, v2, p2) { 
    return `\\( \\displaystyle ${get2VarMath(v1, p1, v2, p2)} \\)`; 
}

// 專屬錯誤提示訊息
const msgInd1 = `<div class="text-red-600 font-bold text-lg mb-1">❗ 次方的次方，指數相乘</div>`;
const msgInd2 = `<div class="text-red-600 font-bold text-lg mb-1">❗ 同類相乘，指數相加</div>`;
const msgInd3 = `<div class="text-red-600 font-bold text-lg mb-1">❗ 同類相除，指數相減</div>`;

// ==========================================
// 題目生成器：指數定律
// ==========================================
function generateIndicesQuestions(num, levelPref) {
    const bank = [];
    const singleVars = ['x', 'y', 'a', 'b', 'm', 'n', 'r', 's', 'p', 'q']; 
    const varPairs = [['x', 'y'], ['a', 'b'], ['m', 'n'], ['r', 's'], ['p', 'q']];
    
    for (let i = 0; i < num; i++) {
        let levelType = levelPref;
        if (levelPref === 'mixed') {
            const types = ['1', '2', '3'];
            levelType = types[getRandomInt(0, types.length)];
        } else {
            levelType = String(levelPref);
        }
        
        let qObj = { id: i + 1, topic: "指數定律 (Law of Indices)" };
        let questionMathStr = "";

        if (levelType === '1') {
            qObj.level = "⭐ 程度 1";
            const v = singleVars[getRandomInt(0, singleVars.length)];
            let a = getRandomExp(), b = getRandomExp(), type = getRandomInt(0, 3); 
            let options = [];
            
            if (type === 0) {
                questionMathStr = `(${v}^{${a}})^{${b}}`;
                let correct = a * b;
                let eqCorrect = buildEq([
                    { text: `(${v}^{${a}})^{${b}}`, hide: false },
                    { text: `${v}^{${a} \\times ${safeNeg(b)}}`, hide: true },
                    { text: `${v}^{${correct}}`, hide: false },
                    { text: formatFinalMath(v, correct), hide: false }
                ]);
                let eqWrong = buildEq([{ text: `(${v}^{${a}})^{${b}}`, hide: false }, { text: `${v}^{${a} \\times ${safeNeg(b)}}`, hide: true }, { text: `${v}^{?}`, hide: false }]);
                
                options.push({ text: formatFinal(v, correct), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) });
                [a+b, a-b, b-a].forEach((w, idx) => {
                    let uniqueW = w; while(uniqueW === correct || options.some(opt => opt.w === uniqueW)) uniqueW += (idx+1);
                    options.push({ text: formatFinal(v, uniqueW), w: uniqueW, isCorrect: false, hint: wrapHint(msgInd1, eqWrong) });
                });
            } else if (type === 1) {
                questionMathStr = `${v}^{${a}} \\times ${v}^{${b}}`;
                let correct = a + b;
                let eqCorrect = buildEq([
                    { text: `${v}^{${a}} \\times ${v}^{${b}}`, hide: false },
                    { text: `${v}^{${a} + ${safeNeg(b)}}`, hide: true },
                    { text: `${v}^{${correct}}`, hide: false },
                    { text: formatFinalMath(v, correct), hide: false }
                ]);
                let eqWrong = buildEq([{ text: `${v}^{${a}} \\times ${v}^{${b}}`, hide: false }, { text: `${v}^{${a} + ${safeNeg(b)}}`, hide: true }, { text: `${v}^{?}`, hide: false }]);
                
                options.push({ text: formatFinal(v, correct), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) });
                [a*b, a-b, b-a].forEach((w, idx) => {
                    let uniqueW = w; while(uniqueW === correct || options.some(opt => opt.w === uniqueW)) uniqueW += (idx+1);
                    options.push({ text: formatFinal(v, uniqueW), w: uniqueW, isCorrect: false, hint: wrapHint(msgInd2, eqWrong) });
                });
            } else {
                questionMathStr = `\\frac{${v}^{${a}}}{${v}^{${b}}}`;
                let correct = a - b;
                let eqCorrect = buildEq([
                    { text: `\\frac{${v}^{${a}}}{${v}^{${b}}}`, hide: false },
                    { text: `\\frac{${v}^{${a} - ${safeNeg(b)}}}{1}`, hide: true },
                    { text: `\\frac{${v}^{${correct}}}{1}`, hide: false },
                    { text: formatFinalMath(v, correct), hide: false }
                ]);
                let eqWrong = buildEq([{ text: `\\frac{${v}^{${a}}}{${v}^{${b}}}`, hide: false }, { text: `\\frac{${v}^{${a} - ${safeNeg(b)}}}{1}`, hide: true }, { text: `\\frac{${v}^{?}}{1}`, hide: false }]);
                
                options.push({ text: formatFinal(v, correct), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) });
                [a*b, a+b, b-a].forEach((w, idx) => {
                    let uniqueW = w; while(uniqueW === correct || options.some(opt => opt.w === uniqueW)) uniqueW += (idx+1);
                    options.push({ text: formatFinal(v, uniqueW), w: uniqueW, isCorrect: false, hint: wrapHint(msgInd3, eqWrong) });
                });
            }
            qObj.options = shuffleArray(options).map((opt, idx) => ({...opt, id: String.fromCharCode(65 + idx)}));
            
        } else if (levelType === '2') {
            qObj.level = "⭐⭐ 程度 2";
            const v = singleVars[getRandomInt(0, singleVars.length)];
            let a = getRandomExp(), b = getRandomExp(), c = getRandomExp(), type = getRandomInt(0, 2); 
            let options = [];
            
            if (type === 0) {
                questionMathStr = `\\frac{(${v}^{${a}})^{${b}}}{${v}^{${c}}}`;
                let correct = a * b - c;
                let eqCorrect = buildEq([
                    { text: `\\frac{(${v}^{${a}})^{${b}}}{${v}^{${c}}}`, hide: false },
                    { text: `\\frac{${v}^{${a} \\times ${safeNeg(b)}}}{${v}^{${c}}}`, hide: true },
                    { text: `\\frac{${v}^{${a*b}}}{${v}^{${c}}}`, hide: false },
                    { text: `\\frac{${v}^{${a*b} - ${safeNeg(c)}}}{1}`, hide: true },
                    { text: `\\frac{${v}^{${correct}}}{1}`, hide: false },
                    { text: formatFinalMath(v, correct), hide: false }
                ]);
                
                let wrongsRaw = [
                    { w: a+b-c, hint: wrapHint(msgInd1, buildEq([{ text: `\\frac{(${v}^{${a}})^{${b}}}{${v}^{${c}}}`, hide: false }, { text: `\\frac{${v}^{${a} \\times ${safeNeg(b)}}}{${v}^{${c}}}`, hide: true }, { text: `\\frac{${v}^{?}}{${v}^{${c}}}`, hide: false }])) },
                    { w: a*b+c, hint: wrapHint(msgInd3, buildEq([{ text: `\\frac{${v}^{${a*b}}}{${v}^{${c}}}`, hide: false }, { text: `\\frac{${v}^{${a*b} - ${safeNeg(c)}}}{1}`, hide: true }, { text: `\\frac{${v}^{?}}{1}`, hide: false }])) },
                    { w: a+b+c, hint: wrapHint(msgInd1, buildEq([{ text: `\\frac{(${v}^{${a}})^{${b}}}{${v}^{${c}}}`, hide: false }, { text: `\\frac{${v}^{${a} \\times ${safeNeg(b)}}}{${v}^{${c}}}`, hide: true }, { text: `\\frac{${v}^{?}}{${v}^{${c}}}`, hide: false }])) }
                ];

                options.push({ text: formatFinal(v, correct), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) });
                wrongsRaw.forEach((obj, idx) => {
                    let uniqueW = obj.w; while(uniqueW === correct || options.some(opt => opt.w === uniqueW)) uniqueW += (idx+1);
                    options.push({ text: formatFinal(v, uniqueW), w: uniqueW, isCorrect: false, hint: obj.hint });
                });
            } else {
                questionMathStr = `(${v}^{${a}})^{${b}} \\times ${v}^{${c}}`;
                let correct = a * b + c;
                let eqCorrect = buildEq([
                    { text: `(${v}^{${a}})^{${b}} \\times ${v}^{${c}}`, hide: false },
                    { text: `${v}^{${a} \\times ${safeNeg(b)}} \\times ${v}^{${c}}`, hide: true },
                    { text: `${v}^{${a*b}} \\times ${v}^{${c}}`, hide: false },
                    { text: `${v}^{${a*b} + ${safeNeg(c)}}`, hide: true },
                    { text: `${v}^{${correct}}`, hide: false },
                    { text: formatFinalMath(v, correct), hide: false }
                ]);

                let wrongsRaw = [
                    { w: a+b+c, hint: wrapHint(msgInd1, buildEq([{ text: `(${v}^{${a}})^{${b}} \\times ${v}^{${c}}`, hide: false }, { text: `${v}^{${a} \\times ${safeNeg(b)}} \\times ${v}^{${c}}`, hide: true }, { text: `${v}^{?} \\times ${v}^{${c}}`, hide: false }])) },
                    { w: a*b-c, hint: wrapHint(msgInd2, buildEq([{ text: `${v}^{${a*b}} \\times ${v}^{${c}}`, hide: false }, { text: `${v}^{${a*b} + ${safeNeg(c)}}`, hide: true }, { text: `${v}^{?}`, hide: false }])) },
                    { w: a+b-c, hint: wrapHint(msgInd1, buildEq([{ text: `(${v}^{${a}})^{${b}} \\times ${v}^{${c}}`, hide: false }, { text: `${v}^{${a} \\times ${safeNeg(b)}} \\times ${v}^{${c}}`, hide: true }, { text: `${v}^{?} \\times ${v}^{${c}}`, hide: false }])) }
                ];

                options.push({ text: formatFinal(v, correct), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) });
                wrongsRaw.forEach((obj, idx) => {
                    let uniqueW = obj.w; while(uniqueW === correct || options.some(opt => opt.w === uniqueW)) uniqueW += (idx+1);
                    options.push({ text: formatFinal(v, uniqueW), w: uniqueW, isCorrect: false, hint: obj.hint });
                });
            }
            qObj.options = shuffleArray(options).map((opt, idx) => ({...opt, id: String.fromCharCode(65 + idx)}));

        } else {
            qObj.level = "⭐⭐⭐ 程度 3";
            const pair = varPairs[getRandomInt(0, varPairs.length)];
            const v1 = pair[0], v2 = pair[1];
            let a = getRandomExp(), b = getRandomExp(), c = getRandomExp(), d = getRandomExp(), e = getRandomExp();
            
            questionMathStr = `\\frac{(${v1}^{${a}}${v2}^{${b}})^{${c}}}{${v1}^{${d}}${v2}^{${e}}}`;
            
            let pCorrect = { p1: a * c - d, p2: b * c - e };
            let pWrong1 = { p1: a + c - d, p2: b + c - e }; 
            let pWrong2 = { p1: a * c + d, p2: b * c + e }; 
            let pWrong3 = { p1: d - a * c, p2: e - b * c }; 
            
            let pOpts = [pCorrect, pWrong1, pWrong2, pWrong3];
            for (let j=1; j<4; j++) {
                while((pOpts[j].p1 === pOpts[0].p1 && pOpts[j].p2 === pOpts[0].p2) || (j > 1 && pOpts[j].p1 === pOpts[1].p1 && pOpts[j].p2 === pOpts[1].p2) || (j > 2 && pOpts[j].p1 === pOpts[2].p1 && pOpts[j].p2 === pOpts[2].p2)) {
                    pOpts[j].p1 += 1;
                }
            }
            
            let eqCorrect = buildEq([
                { text: `\\frac{(${v1}^{${a}}${v2}^{${b}})^{${c}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false },
                { text: `\\frac{${v1}^{${a} \\times ${safeNeg(c)}}${v2}^{${b} \\times ${safeNeg(c)}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: true },
                { text: `\\frac{${v1}^{${a*c}}${v2}^{${b*c}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false },
                { text: `\\frac{${v1}^{${a*c} - ${safeNeg(d)}}${v2}^{${b*c} - ${safeNeg(e)}}}{1}`, hide: true },
                { text: `\\frac{${v1}^{${pOpts[0].p1}}${v2}^{${pOpts[0].p2}}}{1}`, hide: false },
                { text: get2VarMath(v1, pOpts[0].p1, v2, pOpts[0].p2), hide: false }
            ]);

            let options = [
                { text: formatFinal2Vars(v1, pOpts[0].p1, v2, pOpts[0].p2), isCorrect: true, hint: wrapHint(msgCorrect, eqCorrect) },
                { text: formatFinal2Vars(v1, pOpts[1].p1, v2, pOpts[1].p2), isCorrect: false, hint: wrapHint(msgInd1, buildEq([{ text: `\\frac{(${v1}^{${a}}${v2}^{${b}})^{${c}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false }, { text: `\\frac{${v1}^{${a} \\times ${safeNeg(c)}}${v2}^{${b} \\times ${safeNeg(c)}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: true }, { text: `\\frac{${v1}^{?}${v2}^{?}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false }])) },
                { text: formatFinal2Vars(v1, pOpts[2].p1, v2, pOpts[2].p2), isCorrect: false, hint: wrapHint(msgInd3, buildEq([{ text: `\\frac{${v1}^{${a*c}}${v2}^{${b*c}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false }, { text: `\\frac{${v1}^{${a*c} - ${safeNeg(d)}}${v2}^{${b*c} - ${safeNeg(e)}}}{1}`, hide: true }, { text: `\\frac{${v1}^{?}${v2}^{?}}{1}`, hide: false }])) },
                { text: formatFinal2Vars(v1, pOpts[3].p1, v2, pOpts[3].p2), isCorrect: false, hint: wrapHint(msgInd3, buildEq([{ text: `\\frac{${v1}^{${a*c}}${v2}^{${b*c}}}{${v1}^{${d}}${v2}^{${e}}}`, hide: false }, { text: `\\frac{${v1}^{${a*c} - ${safeNeg(d)}}${v2}^{${b*c} - ${safeNeg(e)}}}{1}`, hide: true }, { text: `\\frac{${v1}^{?}${v2}^{?}}{1}`, hide: false }])) }
            ];
            
            qObj.options = shuffleArray(options).map((opt, idx) => ({...opt, id: String.fromCharCode(65 + idx)}));
        }
        
        // 統一的大字體排版
        qObj.question = `
        <div class="mb-4 text-base sm:text-lg text-slate-600">化簡以下數式，並以正指數表示答案：</div>
        <div class="text-xl sm:text-2xl font-bold text-indigo-700 py-4 overflow-x-auto math-scroll whitespace-nowrap w-full">
            \\( \\displaystyle ${questionMathStr} \\)
        </div>`;
        
        bank.push(qObj);
    }
    return bank;
}
