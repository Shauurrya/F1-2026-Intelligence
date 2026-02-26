'use strict';
/* ========================================================
   MONTE CARLO STABILITY ENGINE — MonteCarloStability.js
   Phase 4: Seeded Monte Carlo Stability Engine
   ======================================================== */

const MonteCarloStabilityEngine = (() => {

    function generateDeterministicSeed(trackId, roundNumber, weatherState, sessionType) {
        // Simple hash function for stability
        const str = `${trackId}-${roundNumber}-${weatherState}-${sessionType}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) + 1; // Ensure positive non-zero seed
    }

    return { generateDeterministicSeed };
})();

window.MonteCarloStabilityEngine = MonteCarloStabilityEngine;
