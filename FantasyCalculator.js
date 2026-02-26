'use strict';
/* ═══════════════════════════════════════════════════════════════
   FANTASY F1 POINTS CALCULATOR — FantasyCalculator.js
   Projects Fantasy F1 points based on AI predictions.
   Helps users optimize their fantasy team selections.
   ═══════════════════════════════════════════════════════════════ */

window.FantasyCalculator = (() => {

    // Official F1 Fantasy 2026 Point System (approximated)
    const FANTASY_POINTS = {
        position: { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
        qualifying: { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 0, 10: 0 },
        positionsGained: 2,    // Per position gained from grid
        positionsLost: -2,     // Per position lost from grid
        fastestLap: 5,
        beatTeammate: 5,
        driverOfTheDay: 10,
        finishedRace: 1,
        dnf: -15,
        streak3: 5,           // 3-race streak in top 10
    };

    // Estimated market prices (budget: $100M)
    const DRIVER_PRICES = {
        verstappen: 30.5, leclerc: 28.0, norris: 27.5, hamilton: 26.0,
        piastri: 23.5, russell: 22.0, sainz: 18.0, alonso: 17.5,
        gasly: 14.0, albon: 13.5, ocon: 12.0, hulkenberg: 11.5,
        bearman: 10.0, bottas: 10.0, perez: 9.5, lawson: 9.0,
        bortoleto: 8.5, colapinto: 8.0, antonelli: 15.0, hadjar: 8.5,
        stroll: 7.5, lindblad: 7.0
    };

    const BUDGET = 100;

    function calculateExpectedPoints(predictions) {
        if (!predictions || !predictions.length) return [];
        return predictions.map((p, pos) => {
            const driverId = p.driver?.id;
            const racePoints = FANTASY_POINTS.position[pos + 1] || 0;
            const qualiBonus = FANTASY_POINTS.qualifying[Math.max(1, pos + 1)] || 0;
            const finishBonus = p.dnfProb < 50 ? FANTASY_POINTS.finishedRace : FANTASY_POINTS.dnf;
            const avgGain = Math.max(0, 11 - (pos + 1)) * 0.3; // Estimated position gain value
            const total = racePoints + qualiBonus * 0.7 + finishBonus + avgGain * FANTASY_POINTS.positionsGained;

            return {
                driver: p.driver,
                driverId,
                projectedPoints: Math.round(total * 10) / 10,
                racePoints,
                qualiPoints: Math.round(qualiBonus * 0.7 * 10) / 10,
                price: DRIVER_PRICES[driverId] || 10,
                valueRatio: total / (DRIVER_PRICES[driverId] || 10)
            };
        });
    }

    function findOptimalTeam(fantasyData, teamSize = 5) {
        // Knapsack-style: find best value team within budget
        const sorted = [...fantasyData].sort((a, b) => b.valueRatio - a.valueRatio);
        const team = [];
        let budgetLeft = BUDGET;

        for (const d of sorted) {
            if (team.length >= teamSize) break;
            if (d.price <= budgetLeft) {
                team.push(d);
                budgetLeft -= d.price;
            }
        }

        return {
            team,
            totalCost: BUDGET - budgetLeft,
            totalProjected: team.reduce((sum, d) => sum + d.projectedPoints, 0),
            budgetRemaining: budgetLeft
        };
    }

    function renderWidget(predictions, drivers) {
        const fantasyData = calculateExpectedPoints(predictions);
        if (!fantasyData.length) return '<div style="color:#666;font-size:0.6rem">Run a race simulation first to see fantasy projections.</div>';

        const optimal = findOptimalTeam(fantasyData);

        let html = `<div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #ffd16622;border-radius:12px;padding:1rem">`;

        // Optimal team header
        html += `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem">
      <span style="font-size:1rem">🎰</span>
      <span style="color:#ffd166;font-family:'Orbitron',monospace;font-size:0.7rem;font-weight:bold">OPTIMAL FANTASY TEAM</span>
      <span style="margin-left:auto;font-size:0.55rem;color:#00dc50;font-family:monospace">$${optimal.totalCost.toFixed(1)}M / $${BUDGET}M</span>
    </div>`;

        // Optimal team cards
        html += '<div style="display:flex;gap:0.4rem;margin-bottom:1rem;flex-wrap:wrap">';
        optimal.team.forEach((d, i) => {
            const border = i === 0 ? '#ffd166' : '#ffffff22';
            html += `<div style="flex:1;min-width:90px;background:#ffffff06;border:1px solid ${border};border-radius:8px;padding:0.5rem;text-align:center">
        <div style="font-size:0.55rem;color:${d.driver?.color || '#aaa'};font-weight:bold">${d.driver?.name || '?'}</div>
        <div style="font-size:0.9rem;color:#ffd166;font-weight:bold;margin:0.2rem 0">${d.projectedPoints.toFixed(0)}</div>
        <div style="font-size:0.45rem;color:#888">$${d.price}M · ${d.valueRatio.toFixed(2)} val</div>
      </div>`;
        });
        html += '</div>';

        // Projected total
        html += `<div style="background:#ffd16610;border-radius:8px;padding:0.5rem;text-align:center;margin-bottom:0.8rem">
      <span style="font-size:0.6rem;color:#ffd166">Projected Team Points: </span>
      <span style="font-size:1rem;color:#ffd166;font-weight:bold;font-family:'Orbitron',monospace">${optimal.totalProjected.toFixed(0)} pts</span>
    </div>`;

        // Full table - best value drivers
        html += `<div style="font-size:0.55rem;color:#888;font-weight:bold;margin-bottom:0.3rem">All Drivers — Value Ranking</div>`;
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.55rem">';
        html += '<tr style="color:#666;font-size:0.48rem"><th style="text-align:left;padding:0.2rem">#</th><th style="text-align:left">Driver</th><th>Proj. Pts</th><th>Price</th><th>Value</th></tr>';

        const byValue = [...fantasyData].sort((a, b) => b.valueRatio - a.valueRatio);
        byValue.slice(0, 15).forEach((d, i) => {
            const isInTeam = optimal.team.some(t => t.driverId === d.driverId);
            html += `<tr style="border-top:1px solid #ffffff06;${isInTeam ? 'background:#ffd16608' : ''}">
        <td style="padding:0.2rem;color:#888">${i + 1}</td>
        <td style="color:${d.driver?.color || '#999'}">${d.driver?.name || '?'} ${isInTeam ? '⭐' : ''}</td>
        <td style="text-align:center;color:#ffd166">${d.projectedPoints.toFixed(0)}</td>
        <td style="text-align:center;color:#888">$${d.price}M</td>
        <td style="text-align:center;color:${d.valueRatio > 2.5 ? '#00dc50' : d.valueRatio > 1.5 ? '#ffd166' : '#888'};font-weight:bold">${d.valueRatio.toFixed(2)}</td>
      </tr>`;
        });
        html += '</table></div>';

        return html;
    }

    return { calculateExpectedPoints, findOptimalTeam, renderWidget, DRIVER_PRICES, BUDGET };
})();

console.log('%c[FantasyCalculator] Ready — Fantasy F1 optimizer', 'color:#ffd166;font-weight:bold');
