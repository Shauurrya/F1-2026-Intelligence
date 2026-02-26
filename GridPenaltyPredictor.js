'use strict';
/* ═══════════════════════════════════════════════════════════════
   GRID PENALTY PREDICTOR — GridPenaltyPredictor.js
   Tracks PU components, gearbox usage per driver across the
   season. Predicts when drivers will exceed allocations and
   take grid penalties.
   ═══════════════════════════════════════════════════════════════ */

window.GridPenaltyPredictor = (() => {

    // 2026 allocation limits per season
    const LIMITS = {
        ice: 4,       // Internal Combustion Engine
        turbo: 4,     // Turbocharger
        mgu_h: 4,     // MGU-H
        mgu_k: 4,     // MGU-K
        ce: 2,        // Control Electronics
        es: 2,        // Energy Store
        exhaust: 8,   // Exhausts
        gearbox: 4    // Gearbox (consecutive events)
    };

    const PENALTY_POSITIONS = {
        ice: 10, turbo: 5, mgu_h: 5, mgu_k: 5,
        ce: 5, es: 5, exhaust: 5, gearbox: 5
    };

    const CACHE_KEY = 'f1_gridpenalty_v1';
    let _usage = {};

    function initDriverUsage(driverId) {
        if (_usage[driverId]) return;
        _usage[driverId] = {
            ice: 1, turbo: 1, mgu_h: 1, mgu_k: 1,
            ce: 1, es: 1, exhaust: 1, gearbox: 1,
            penalties: [], gearboxAge: 0
        };
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) _usage = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    }

    function saveState() {
        try { (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify(_usage)); } catch (e) { /* ignore */ }
    }

    // Simulate component wear per race
    function advanceRace(round, results) {
        if (!results || !results.positions) return;
        results.positions.forEach(driverId => {
            initDriverUsage(driverId);
            const u = _usage[driverId];
            u.gearboxAge++;

            // Probabilistic component failures/changes (every ~5-6 races per PU component)
            const rng = Math.sin(round * 31337 + driverId.charCodeAt(0) * 7) * 10000;
            const r = rng - Math.floor(rng);

            if (u.gearboxAge >= 6 || (u.gearboxAge >= 4 && r > 0.6)) {
                u.gearbox++;
                u.gearboxAge = 0;
            }

            // PU components change roughly every 5-6 races
            const raceThreshold = 24 / LIMITS.ice; // ~6 races per component
            const roundInCycle = round % Math.ceil(raceThreshold);
            if (roundInCycle === 0 && round > 0) {
                ['ice', 'turbo', 'mgu_h', 'mgu_k'].forEach(comp => {
                    if (r > 0.3) u[comp]++;
                });
            }
            if (round % 12 === 0 && round > 0) {
                u.ce++;
                u.es++;
            }
        });
        saveState();
    }

    function predictPenalties(driverId, currentRound, totalRounds = 24) {
        initDriverUsage(driverId);
        const u = _usage[driverId];
        const predictions = [];
        const remainingRaces = totalRounds - currentRound;

        Object.entries(LIMITS).forEach(([comp, limit]) => {
            const used = u[comp] || 1;
            const remaining = limit - used;

            if (remaining < 0) {
                // Already exceeded
                predictions.push({
                    component: comp,
                    used,
                    limit,
                    exceeded: true,
                    penaltyGrid: PENALTY_POSITIONS[comp],
                    likelyRound: currentRound,
                    risk: 'PENALTY TAKEN'
                });
            } else if (remaining === 0) {
                // At limit — will exceed soon
                const estRound = currentRound + Math.ceil(remainingRaces * 0.3);
                predictions.push({
                    component: comp,
                    used, limit, exceeded: false,
                    penaltyGrid: PENALTY_POSITIONS[comp],
                    likelyRound: estRound,
                    risk: 'HIGH'
                });
            } else {
                // Usage rate
                const rate = used / Math.max(1, currentRound);
                const projectedTotal = Math.ceil(rate * totalRounds);
                const willExceed = projectedTotal > limit;

                if (willExceed) {
                    const exceedRound = Math.ceil(limit / rate);
                    predictions.push({
                        component: comp,
                        used, limit, exceeded: false,
                        penaltyGrid: PENALTY_POSITIONS[comp],
                        likelyRound: exceedRound,
                        risk: remainingRaces > 5 ? 'MEDIUM' : 'LOW'
                    });
                }
            }
        });

        return predictions.sort((a, b) => (a.likelyRound || 99) - (b.likelyRound || 99));
    }

    function renderWidget(drivers, currentRound) {
        let html = `<div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #f9731622;border-radius:12px;padding:1rem">`;

        html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem">
      <span style="font-size:1rem">🔧</span>
      <span style="color:#f97316;font-family:'Orbitron',monospace;font-size:0.7rem;font-weight:bold">GRID PENALTY PREDICTOR</span>
      <span style="margin-left:auto;font-size:0.5rem;color:#666;font-family:monospace">R${currentRound}/24</span>
    </div>`;

        // Component usage overview
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.55rem">';
        html += '<tr style="color:#666;font-size:0.48rem"><th style="text-align:left;padding:0.2rem">Driver</th><th>ICE</th><th>TC</th><th>MGU-H</th><th>MGU-K</th><th>CE</th><th>ES</th><th>GB</th><th>Risk</th></tr>';

        drivers.forEach(d => {
            initDriverUsage(d.id);
            const u = _usage[d.id];
            const penalties = predictPenalties(d.id, currentRound);
            const highRisk = penalties.some(p => p.risk === 'HIGH' || p.exceeded);
            const medRisk = penalties.some(p => p.risk === 'MEDIUM');

            const riskIcon = highRisk ? '🔴' : medRisk ? '🟡' : '🟢';
            const compCell = (comp) => {
                const used = u[comp] || 0;
                const limit = LIMITS[comp];
                const pct = used / limit;
                const color = pct >= 1 ? '#ff4444' : pct >= 0.75 ? '#ffd166' : '#888';
                return `<td style="text-align:center;color:${color};font-weight:${pct >= 1 ? 'bold' : 'normal'}">${used}/${limit}</td>`;
            };

            html += `<tr style="border-top:1px solid #ffffff06;${highRisk ? 'background:#ff444408' : ''}">
        <td style="padding:0.2rem;color:${d.color};font-size:0.55rem">${d.name}</td>
        ${compCell('ice')}${compCell('turbo')}${compCell('mgu_h')}${compCell('mgu_k')}${compCell('ce')}${compCell('es')}${compCell('gearbox')}
        <td style="text-align:center">${riskIcon}</td>
      </tr>`;
        });
        html += '</table>';

        // Upcoming predicted penalties
        const allPenalties = [];
        drivers.forEach(d => {
            const pens = predictPenalties(d.id, currentRound);
            pens.forEach(p => allPenalties.push({ ...p, driver: d }));
        });

        const upcoming = allPenalties.filter(p => !p.exceeded && p.likelyRound && p.likelyRound <= currentRound + 5).sort((a, b) => a.likelyRound - b.likelyRound);

        if (upcoming.length > 0) {
            html += `<div style="margin-top:0.7rem;padding-top:0.5rem;border-top:1px solid #ffffff08">
        <div style="font-size:0.55rem;color:#f97316;font-weight:bold;margin-bottom:0.3rem">⚠️ Upcoming Predicted Penalties</div>`;
            upcoming.slice(0, 5).forEach(p => {
                html += `<div style="font-size:0.52rem;color:#ddd;margin:0.15rem 0;display:flex;align-items:center;gap:0.3rem">
          <span style="color:${p.driver.color}">${p.driver.name}</span>
          <span style="color:#888">R${p.likelyRound}</span>
          <span style="color:#f97316">${p.component.toUpperCase()}</span>
          <span style="color:#ff4444;margin-left:auto">-${p.penaltyGrid} grid</span>
        </div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    loadState();

    return { initDriverUsage, advanceRace, predictPenalties, renderWidget, LIMITS };
})();

console.log('%c[GridPenaltyPredictor] Ready — PU & gearbox tracking', 'color:#f97316;font-weight:bold');
