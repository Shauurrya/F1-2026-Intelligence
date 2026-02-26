'use strict';
/* ═══════════════════════════════════════════════════════════════
   POST-RACE ANALYSIS DASHBOARD — PostRaceAnalysis.js
   After each race, shows visual Predicted vs Actual comparison,
   highlights hits/misses, biggest surprises, accuracy score.
   ═══════════════════════════════════════════════════════════════ */

window.PostRaceAnalysis = (() => {

    function analyze(round, predicted, actual, drivers) {
        if (!predicted || !actual || !actual.positions) return null;

        const predPositions = predicted.map(p => p.driver.id);
        const actPositions = actual.positions;

        const comparisons = [];
        const maxLen = Math.min(actPositions.length, 20);

        for (let i = 0; i < maxLen; i++) {
            const actualDriver = actPositions[i];
            const predPos = predPositions.indexOf(actualDriver);
            const d = drivers.find(dr => dr.id === actualDriver);

            comparisons.push({
                actualPos: i + 1,
                predPos: predPos >= 0 ? predPos + 1 : 22,
                driverId: actualDriver,
                driver: d,
                delta: predPos >= 0 ? (predPos + 1) - (i + 1) : null,
                isExactHit: predPos === i,
                isWithin1: predPos >= 0 && Math.abs(predPos - i) <= 1,
                isWithin3: predPos >= 0 && Math.abs(predPos - i) <= 3,
                isSurprise: predPos >= 0 && Math.abs(predPos - i) >= 5
            });
        }

        // Accuracy metrics
        const exactHits = comparisons.filter(c => c.isExactHit).length;
        const within1 = comparisons.filter(c => c.isWithin1).length;
        const within3 = comparisons.filter(c => c.isWithin3).length;
        const surprises = comparisons.filter(c => c.isSurprise);

        // Winner prediction
        const winnerCorrect = predPositions[0] === actPositions[0];
        const podiumHits = actPositions.slice(0, 3).filter(d => predPositions.slice(0, 3).includes(d)).length;

        // Kendall's Tau correlation (simplified)
        let concordant = 0, discordant = 0;
        for (let i = 0; i < maxLen - 1; i++) {
            for (let j = i + 1; j < maxLen; j++) {
                const predI = predPositions.indexOf(actPositions[i]);
                const predJ = predPositions.indexOf(actPositions[j]);
                if (predI < 0 || predJ < 0) continue;
                if (predI < predJ) concordant++;
                else discordant++;
            }
        }
        const tau = (concordant + discordant) > 0 ? (concordant - discordant) / (concordant + discordant) : 0;

        return {
            round,
            comparisons,
            exactHits,
            within1,
            within3,
            total: maxLen,
            surprises,
            winnerCorrect,
            podiumHits,
            kendallTau: tau,
            overallScore: Math.round((exactHits / maxLen * 30 + within3 / maxLen * 40 + tau * 30) * 100) / 100
        };
    }

    function renderDashboard(analysis, raceName) {
        if (!analysis) return '<div style="color:#666;font-size:0.6rem">No analysis available — run a prediction then enter a result to see post-race analysis.</div>';

        const { comparisons, exactHits, within1, within3, total, surprises, winnerCorrect, podiumHits, kendallTau, overallScore } = analysis;

        let html = `<div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #ffffff0a;border-radius:12px;padding:1rem">`;

        // Header with score
        const scoreColor = overallScore > 70 ? '#00dc50' : overallScore > 50 ? '#ffd166' : overallScore > 30 ? '#f97316' : '#ff4444';
        html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <div>
        <div style="font-size:0.75rem;color:#ddd;font-weight:bold">${raceName || `Round ${analysis.round}`}</div>
        <div style="font-size:0.55rem;color:#888">Predicted vs Actual Analysis</div>
      </div>
      <div style="text-align:center;background:${scoreColor}15;border:2px solid ${scoreColor}44;border-radius:12px;padding:0.5rem 1rem">
        <div style="font-size:1.2rem;font-weight:bold;color:${scoreColor};font-family:'Orbitron',monospace">${overallScore.toFixed(0)}</div>
        <div style="font-size:0.45rem;color:#888;text-transform:uppercase;letter-spacing:0.5px">Accuracy Score</div>
      </div>
    </div>`;

        // Quick stats
        html += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;margin-bottom:1rem">
      <div style="background:#ffffff04;border-radius:8px;padding:0.4rem;text-align:center">
        <div style="font-size:0.95rem;color:${winnerCorrect ? '#00dc50' : '#ff4444'}">${winnerCorrect ? '✅' : '❌'}</div>
        <div style="font-size:0.45rem;color:#888">Winner</div>
      </div>
      <div style="background:#ffffff04;border-radius:8px;padding:0.4rem;text-align:center">
        <div style="font-size:0.8rem;color:#ffd166;font-weight:bold">${podiumHits}/3</div>
        <div style="font-size:0.45rem;color:#888">Podium</div>
      </div>
      <div style="background:#ffffff04;border-radius:8px;padding:0.4rem;text-align:center">
        <div style="font-size:0.8rem;color:#00dc50;font-weight:bold">${exactHits}</div>
        <div style="font-size:0.45rem;color:#888">Exact Hits</div>
      </div>
      <div style="background:#ffffff04;border-radius:8px;padding:0.4rem;text-align:center">
        <div style="font-size:0.8rem;color:#58a6ff;font-weight:bold">${within3}/${total}</div>
        <div style="font-size:0.45rem;color:#888">Within ±3</div>
      </div>
      <div style="background:#ffffff04;border-radius:8px;padding:0.4rem;text-align:center">
        <div style="font-size:0.8rem;color:#a78bfa;font-weight:bold">${(kendallTau * 100).toFixed(0)}%</div>
        <div style="font-size:0.45rem;color:#888">Correlation</div>
      </div>
    </div>`;

        // Position comparison table
        html += `<div style="font-size:0.6rem;color:#a78bfa;font-weight:bold;margin-bottom:0.4rem">📊 Position Comparison</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:0.6rem">`;
        html += `<tr style="color:#666;font-size:0.5rem"><th style="text-align:left;padding:0.25rem">ACTUAL</th><th style="text-align:left">DRIVER</th><th>PREDICTED</th><th>DELTA</th><th>VERDICT</th></tr>`;

        comparisons.slice(0, 10).forEach(c => {
            const deltaColor = c.delta === null ? '#666' : c.delta === 0 ? '#00dc50' : Math.abs(c.delta) <= 2 ? '#ffd166' : Math.abs(c.delta) <= 4 ? '#f97316' : '#ff4444';
            const deltaText = c.delta === null ? '—' : c.delta === 0 ? '✓' : c.delta > 0 ? `▼${c.delta}` : `▲${Math.abs(c.delta)}`;
            const verdict = c.isExactHit ? '<span style="color:#00dc50">EXACT ✓</span>' : c.isWithin1 ? '<span style="color:#58a6ff">Close</span>' : c.isSurprise ? '<span style="color:#ff4444">Surprise!</span>' : '<span style="color:#888">—</span>';
            const rowBg = c.isExactHit ? '#00dc5008' : c.isSurprise ? '#ff444408' : 'transparent';

            html += `<tr style="border-top:1px solid #ffffff06;background:${rowBg}">
        <td style="padding:0.25rem;color:#ffd166;font-weight:bold">P${c.actualPos}</td>
        <td style="color:${c.driver?.color || '#999'}">${c.driver?.name || c.driverId}</td>
        <td style="text-align:center;color:#888">P${c.predPos}</td>
        <td style="text-align:center;color:${deltaColor};font-weight:bold">${deltaText}</td>
        <td style="text-align:center">${verdict}</td>
      </tr>`;
        });
        html += '</table>';

        // Biggest surprises
        if (surprises.length > 0) {
            html += `<div style="margin-top:0.8rem;padding-top:0.5rem;border-top:1px solid #ffffff08">
        <div style="font-size:0.6rem;color:#ff4444;font-weight:bold;margin-bottom:0.3rem">🔥 Biggest Surprises</div>`;
            surprises.forEach(s => {
                const direction = s.delta > 0 ? 'Overperformed' : 'Underperformed';
                html += `<div style="font-size:0.55rem;color:#ddd;margin:0.2rem 0">
          <span style="color:${s.driver?.color || '#999'}">${s.driver?.name || s.driverId}</span>
          — Predicted P${s.predPos}, Finished P${s.actualPos}
          <span style="color:${s.delta > 0 ? '#00dc50' : '#ff4444'}">(${direction} by ${Math.abs(s.delta)} places)</span>
        </div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    return { analyze, renderDashboard };
})();

console.log('%c[PostRaceAnalysis] Ready — Predicted vs Actual comparison', 'color:#f97316;font-weight:bold');
