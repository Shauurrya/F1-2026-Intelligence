'use strict';
/* ═══════════════════════════════════════════════════════════════
   DARK HORSE / UPSET ALERTS — DarkHorseAlerts.js
   Flags when midfield/backmarker drivers have unusually high
   win/podium probability. Detects track-specific advantages.
   ═══════════════════════════════════════════════════════════════ */

window.DarkHorseAlerts = (() => {

    // Expected performance tier (1=front, 2=mid, 3=back)
    const EXPECTED_TIER = {
        leclerc: 1, hamilton: 1, norris: 1, piastri: 1, verstappen: 1, russell: 1,
        sainz: 2, alonso: 2, gasly: 2, albon: 2, ocon: 2, antonelli: 2,
        bearman: 2, hulkenberg: 2, perez: 2, bottas: 2, lawson: 3,
        colapinto: 3, hadjar: 3, bortoleto: 3, stroll: 3, lindblad: 3
    };

    function detectDarkHorses(predictions, race) {
        if (!predictions || !predictions.length) return [];

        const alerts = [];

        predictions.forEach((p, pos) => {
            const tier = EXPECTED_TIER[p.driver?.id] || 2;
            const driverId = p.driver?.id;
            const winProb = p.winProb || 0;
            const podProb = p.podiumProb || 0;

            // Tier 2 driver with high win chance
            if (tier === 2 && winProb > 8) {
                alerts.push({
                    type: 'dark_horse',
                    severity: winProb > 15 ? 'hot' : 'warm',
                    driver: p.driver,
                    message: `${p.driver.full} has ${winProb.toFixed(1)}% win probability — unusual for a midfield driver!`,
                    detail: `Predicted P${pos + 1} at ${race.name}`,
                    icon: '🐴',
                    winProb, podProb
                });
            }

            // Tier 3 driver in top 5
            if (tier === 3 && pos < 5) {
                alerts.push({
                    type: 'upset',
                    severity: pos < 3 ? 'hot' : 'warm',
                    driver: p.driver,
                    message: `${p.driver.full} predicted P${pos + 1} — a potential upset!`,
                    detail: `Backmarker in top 5 at ${race.name}`,
                    icon: '🚨',
                    winProb, podProb
                });
            }

            // Tier 2/3 driver with podium probability > 25%
            if (tier >= 2 && podProb > 25 && pos < 6) {
                alerts.push({
                    type: 'podium_threat',
                    severity: podProb > 40 ? 'hot' : 'warm',
                    driver: p.driver,
                    message: `${p.driver.full} — ${podProb.toFixed(0)}% podium chance`,
                    detail: `Strong at ${race.short} track type`,
                    icon: '🏆',
                    winProb, podProb
                });
            }

            // Any driver with win prob shift > 10% vs their base rating
            if (winProb > 15 && tier !== 1) {
                alerts.push({
                    type: 'track_specialist',
                    severity: 'warm',
                    driver: p.driver,
                    message: `${p.driver.full} — track advantage at ${race.short}`,
                    detail: `${winProb.toFixed(1)}% win probability from track specialization`,
                    icon: '🎯',
                    winProb, podProb
                });
            }
        });

        // Deduplicate by driver
        const seen = new Set();
        return alerts.filter(a => {
            const key = `${a.driver.id}_${a.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => (a.severity === 'hot' ? 0 : 1) - (b.severity === 'hot' ? 0 : 1));
    }

    function renderAlerts(predictions, race) {
        const alerts = detectDarkHorses(predictions, race);
        if (!alerts.length) {
            return `<div style="background:#ffffff04;border-radius:8px;padding:0.6rem;text-align:center">
        <span style="font-size:0.9rem">😴</span>
        <div style="font-size:0.55rem;color:#888;margin-top:0.2rem">No upsets predicted — chalk race expected</div>
      </div>`;
        }

        let html = '<div style="display:grid;gap:0.4rem">';
        alerts.slice(0, 6).forEach(a => {
            const borderColor = a.severity === 'hot' ? '#ff4444' : '#ffd166';
            const bgColor = a.severity === 'hot' ? '#ff444408' : '#ffd16608';

            html += `<div style="background:${bgColor};border:1px solid ${borderColor}33;border-left:3px solid ${borderColor};border-radius:8px;padding:0.5rem 0.7rem;display:flex;align-items:center;gap:0.5rem">
        <span style="font-size:1.1rem">${a.icon}</span>
        <div style="flex:1">
          <div style="font-size:0.62rem;color:#ddd;font-weight:600">${a.message}</div>
          <div style="font-size:0.5rem;color:#888;margin-top:0.1rem">${a.detail}</div>
        </div>
        ${a.severity === 'hot' ? '<span style="font-size:0.5rem;padding:0.15rem 0.4rem;background:#ff4444;color:white;border-radius:10px;font-weight:bold;animation:pulse 1.5s infinite">HOT</span>' : ''}
      </div>`;
        });
        html += '</div>';
        return html;
    }

    return { detectDarkHorses, renderAlerts, EXPECTED_TIER };
})();

console.log('%c[DarkHorseAlerts] Ready — Upset detection system', 'color:#ff4444;font-weight:bold');
