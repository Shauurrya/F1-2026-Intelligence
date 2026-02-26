'use strict';
/* ═══════════════════════════════════════════════════════════════
   COMMUNITY PREDICTIONS — CommunityPredictions.js
   Users submit their own P1-P3 predictions before each race.
   Compares human vs AI accuracy over the season.
   ═══════════════════════════════════════════════════════════════ */

window.CommunityPredictions = (() => {

    const CACHE_KEY = 'f1_community_preds_v1';
    let _predictions = {};
    let _accuracy = { human: { total: 0, correct: 0, podiumHits: 0 }, ai: { total: 0, correct: 0, podiumHits: 0 } };

    function loadState() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                _predictions = data.predictions || {};
                _accuracy = data.accuracy || _accuracy;
            }
        } catch (e) { /* ignore */ }
    }

    function saveState() {
        try {
            (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify({ predictions: _predictions, accuracy: _accuracy }));
        } catch (e) { /* ignore */ }
    }

    function submitPrediction(round, p1, p2, p3) {
        _predictions[round] = { p1, p2, p3, timestamp: Date.now() };
        saveState();
    }

    function getPrediction(round) {
        return _predictions[round] || null;
    }

    function evaluateResult(round, actualPositions, aiPredictions) {
        const human = _predictions[round];
        if (!human || !actualPositions) return;

        const actualTop3 = actualPositions.slice(0, 3);

        // Human accuracy
        _accuracy.human.total++;
        if (human.p1 === actualTop3[0]) _accuracy.human.correct++;
        const humanPodHits = [human.p1, human.p2, human.p3].filter(d => actualTop3.includes(d)).length;
        _accuracy.human.podiumHits += humanPodHits;

        // AI accuracy
        if (aiPredictions && aiPredictions.length >= 3) {
            _accuracy.ai.total++;
            const aiTop3 = aiPredictions.slice(0, 3).map(p => p.driver?.id);
            if (aiTop3[0] === actualTop3[0]) _accuracy.ai.correct++;
            const aiPodHits = aiTop3.filter(d => actualTop3.includes(d)).length;
            _accuracy.ai.podiumHits += aiPodHits;
        }

        saveState();
    }

    function renderPanel(round, drivers) {
        const existing = _predictions[round];
        const humanWinRate = _accuracy.human.total > 0 ? (_accuracy.human.correct / _accuracy.human.total * 100).toFixed(0) : '—';
        const aiWinRate = _accuracy.ai.total > 0 ? (_accuracy.ai.correct / _accuracy.ai.total * 100).toFixed(0) : '—';
        const humanPodRate = _accuracy.human.total > 0 ? (_accuracy.human.podiumHits / (_accuracy.human.total * 3) * 100).toFixed(0) : '—';
        const aiPodRate = _accuracy.ai.total > 0 ? (_accuracy.ai.podiumHits / (_accuracy.ai.total * 3) * 100).toFixed(0) : '—';

        const driverOpts = drivers.map(d => `<option value="${d.id}" style="color:${d.color}">${d.full}</option>`).join('');

        let html = `<div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #a78bfa22;border-radius:12px;padding:1rem">`;

        // Header with H2H score
        html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem">
      <span style="font-size:1rem">🗣️</span>
      <span style="color:#a78bfa;font-family:'Orbitron',monospace;font-size:0.7rem;font-weight:bold">YOU vs AI</span>
    </div>`;

        // H2H comparison
        html += `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0.5rem;margin-bottom:1rem;align-items:center">
      <div style="text-align:center;background:#a78bfa08;border-radius:8px;padding:0.6rem">
        <div style="font-size:0.5rem;color:#a78bfa;text-transform:uppercase;letter-spacing:0.5px">You</div>
        <div style="font-size:1.2rem;color:#a78bfa;font-weight:bold;margin:0.2rem 0">${humanWinRate}%</div>
        <div style="font-size:0.45rem;color:#888">Winner accuracy</div>
        <div style="font-size:0.55rem;color:#a78bfa;margin-top:0.2rem">${humanPodRate}% podium</div>
      </div>
      <div style="font-size:1rem;color:#666">⚔️</div>
      <div style="text-align:center;background:#58a6ff08;border-radius:8px;padding:0.6rem">
        <div style="font-size:0.5rem;color:#58a6ff;text-transform:uppercase;letter-spacing:0.5px">AI</div>
        <div style="font-size:1.2rem;color:#58a6ff;font-weight:bold;margin:0.2rem 0">${aiWinRate}%</div>
        <div style="font-size:0.45rem;color:#888">Winner accuracy</div>
        <div style="font-size:0.55rem;color:#58a6ff;margin-top:0.2rem">${aiPodRate}% podium</div>
      </div>
    </div>`;

        // Input form
        html += `<div style="font-size:0.6rem;color:#ddd;margin-bottom:0.4rem;font-weight:600">Your Prediction for R${round}:</div>`;

        ['P1 (Winner)', 'P2', 'P3'].forEach((label, i) => {
            const val = existing ? [existing.p1, existing.p2, existing.p3][i] : '';
            html += `<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem">
        <span style="color:#ffd166;font-size:0.6rem;width:65px;font-weight:bold">${label}</span>
        <select id="community-p${i + 1}" style="flex:1;padding:0.3rem;background:#0d1117;border:1px solid #ffffff15;border-radius:6px;color:#ddd;font-size:0.6rem" ${existing ? 'disabled' : ''}>
          <option value="">Select driver...</option>
          ${driverOpts}
        </select>
      </div>`;
        });

        if (!existing) {
            html += `<button onclick="PredictionsCenter.submitCommunityPrediction()" style="margin-top:0.4rem;padding:0.4rem 1rem;background:#a78bfa22;border:1px solid #a78bfa44;color:#a78bfa;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace;width:100%">🔒 Lock In Prediction</button>`;
        } else {
            html += `<div style="margin-top:0.4rem;padding:0.3rem;background:#00dc5010;border-radius:6px;text-align:center;font-size:0.55rem;color:#00dc50">
        ✅ Prediction locked: ${[existing.p1, existing.p2, existing.p3].join(' → ')}
      </div>`;
        }

        // History
        const rounds = Object.keys(_predictions).sort((a, b) => parseInt(a) - parseInt(b));
        if (rounds.length > 0) {
            html += `<div style="margin-top:0.7rem;padding-top:0.5rem;border-top:1px solid #ffffff08">
        <div style="font-size:0.5rem;color:#888;margin-bottom:0.3rem">Past Predictions:</div>`;
            rounds.forEach(r => {
                const pred = _predictions[r];
                html += `<div style="font-size:0.5rem;color:#aaa;margin:0.15rem 0">
          <span style="color:#ffd166">R${r}</span>: ${pred.p1} → ${pred.p2} → ${pred.p3}
        </div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    loadState();

    return { submitPrediction, getPrediction, evaluateResult, renderPanel, getAccuracy: () => ({ ..._accuracy }) };
})();

console.log('%c[CommunityPredictions] Ready — Human vs AI showdown', 'color:#a78bfa;font-weight:bold');
