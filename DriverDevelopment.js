'use strict';
/* ═══════════════════════════════════════════════════════════════
   DRIVER DEVELOPMENT CURVES — DriverDevelopment.js
   Models rookies improving over the season, veterans maintaining/
   declining. Adjusts base driver ratings dynamically.
   ═══════════════════════════════════════════════════════════════ */

window.DriverDevelopment = (() => {

    // Development profiles
    const PROFILES = {
        // Rookies: steep learning curve, start lower, improve fast
        antonelli: { type: 'rookie', startMod: 0.92, peakMod: 1.02, learningRate: 0.015, peakRound: 20 },
        hadjar: { type: 'rookie', startMod: 0.90, peakMod: 1.00, learningRate: 0.012, peakRound: 22 },
        lindblad: { type: 'rookie', startMod: 0.88, peakMod: 0.98, learningRate: 0.013, peakRound: 24 },
        bearman: { type: 'sophomore', startMod: 0.95, peakMod: 1.02, learningRate: 0.008, peakRound: 16 },
        bortoleto: { type: 'rookie', startMod: 0.91, peakMod: 1.01, learningRate: 0.012, peakRound: 20 },
        colapinto: { type: 'sophomore', startMod: 0.94, peakMod: 1.01, learningRate: 0.008, peakRound: 18 },

        // Prime drivers: stable and near peak
        leclerc: { type: 'prime', startMod: 1.00, peakMod: 1.02, learningRate: 0.002, peakRound: 12 },
        norris: { type: 'prime', startMod: 1.00, peakMod: 1.02, learningRate: 0.002, peakRound: 10 },
        piastri: { type: 'ascending', startMod: 0.98, peakMod: 1.04, learningRate: 0.005, peakRound: 16 },
        russell: { type: 'prime', startMod: 1.00, peakMod: 1.01, learningRate: 0.001, peakRound: 8 },
        verstappen: { type: 'prime', startMod: 1.02, peakMod: 1.03, learningRate: 0.001, peakRound: 6 },
        gasly: { type: 'prime', startMod: 0.99, peakMod: 1.01, learningRate: 0.002, peakRound: 10 },
        sainz: { type: 'prime', startMod: 1.00, peakMod: 1.02, learningRate: 0.002, peakRound: 10 },
        lawson: { type: 'ascending', startMod: 0.96, peakMod: 1.03, learningRate: 0.006, peakRound: 18 },

        // Experienced: stable then slight decline
        hamilton: { type: 'veteran', startMod: 1.01, peakMod: 1.01, declineRate: 0.001, peakRound: 1 },
        alonso: { type: 'veteran', startMod: 1.00, peakMod: 1.00, declineRate: 0.001, peakRound: 1 },
        bottas: { type: 'veteran', startMod: 0.98, peakMod: 0.98, declineRate: 0.001, peakRound: 1 },
        perez: { type: 'veteran', startMod: 0.97, peakMod: 0.97, declineRate: 0.002, peakRound: 1 },
        hulkenberg: { type: 'veteran', startMod: 0.99, peakMod: 0.99, declineRate: 0.001, peakRound: 1 },
        ocon: { type: 'established', startMod: 0.99, peakMod: 1.00, learningRate: 0.001, peakRound: 8 },
        albon: { type: 'established', startMod: 0.99, peakMod: 1.02, learningRate: 0.003, peakRound: 14 },
        stroll: { type: 'plateau', startMod: 0.97, peakMod: 0.97, learningRate: 0.0, peakRound: 1 }
    };

    function getModifier(driverId, round) {
        const p = PROFILES[driverId];
        if (!p) return 1.0;

        if (p.type === 'veteran') {
            // Veterans start at peak and gradually decline
            const decline = Math.max(0, round - p.peakRound) * (p.declineRate || 0);
            return Math.max(p.peakMod - decline, p.startMod - 0.05);
        }

        if (p.type === 'plateau') {
            return p.startMod;
        }

        // Rookie/ascending/prime: S-curve learning
        if (round <= p.peakRound) {
            const progress = round / p.peakRound;
            // Sigmoid-like curve: slow start, fast middle, slow end
            const sigmoid = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
            return p.startMod + (p.peakMod - p.startMod) * sigmoid;
        }

        // Past peak: maintain with very slight improvement
        return p.peakMod + (round - p.peakRound) * 0.0005;
    }

    function getProfile(driverId) {
        return PROFILES[driverId] || { type: 'unknown', startMod: 1.0, peakMod: 1.0, learningRate: 0, peakRound: 1 };
    }

    function renderWidget(drivers, currentRound) {
        let html = '<div class="f1-dev-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.5rem">';

        // Sort by development type
        const typeOrder = { rookie: 0, sophomore: 1, ascending: 2, prime: 3, established: 4, veteran: 5, plateau: 6 };
        const sorted = [...drivers].sort((a, b) => (typeOrder[PROFILES[a.id]?.type] || 4) - (typeOrder[PROFILES[b.id]?.type] || 4));

        sorted.forEach(d => {
            const p = PROFILES[d.id];
            if (!p) return;

            const currentMod = getModifier(d.id, currentRound);
            const futureMod = getModifier(d.id, Math.min(24, currentRound + 6));
            const trajectory = futureMod > currentMod + 0.005 ? '📈' : futureMod < currentMod - 0.005 ? '📉' : '➡️';

            const typeColors = {
                rookie: '#58a6ff', sophomore: '#3fb950', ascending: '#a78bfa',
                prime: '#ffd166', established: '#888', veteran: '#f97316', plateau: '#666'
            };
            const typeColor = typeColors[p.type] || '#888';

            // Mini sparkline — modifier across 24 rounds
            const points = [];
            for (let r = 1; r <= 24; r++) {
                const mod = getModifier(d.id, r);
                const x = (r - 1) / 23 * 160;
                const y = 28 - (mod - 0.85) / 0.2 * 24;
                points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
            }
            const sparkline = `<svg width="164" height="32" style="margin-top:0.2rem">
        <polyline points="${points.join(' ')}" fill="none" stroke="${typeColor}" stroke-width="1.5" opacity="0.7"/>
        <circle cx="${((currentRound - 1) / 23 * 160).toFixed(1)}" cy="${(28 - (currentMod - 0.85) / 0.2 * 24).toFixed(1)}" r="3" fill="${typeColor}"/>
      </svg>`;

            html += `<div style="background:#ffffff04;border-radius:8px;padding:0.5rem 0.6rem;border-left:2px solid ${d.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.15rem">
          <span style="font-size:0.6rem;color:${d.color};font-weight:bold">${d.name}</span>
          <span style="font-size:0.5rem;color:${typeColor};background:${typeColor}15;padding:0.1rem 0.3rem;border-radius:3px;text-transform:uppercase">${p.type}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem">
          <span style="font-size:0.7rem;color:#ddd;font-weight:bold;font-family:monospace">${(currentMod * 100).toFixed(1)}%</span>
          <span style="font-size:0.7rem">${trajectory}</span>
          <span style="font-size:0.5rem;color:#888">→ ${(futureMod * 100).toFixed(1)}%</span>
        </div>
        ${sparkline}
      </div>`;
        });

        html += '</div>';
        return html;
    }

    return { getModifier, getProfile, renderWidget, PROFILES };
})();

console.log('%c[DriverDevelopment] Ready — Rookie curves & veteran decline', 'color:#58a6ff;font-weight:bold');
