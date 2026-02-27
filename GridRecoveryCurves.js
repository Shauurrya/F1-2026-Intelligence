'use strict';
/* ═══════════════════════════════════════════════════════════════
   GRID RECOVERY CURVES — GridRecoveryCurves.js
   
   Models non-linear grid position → finish position conversion
   per track. Instead of a simple linear penalty, each track has
   a unique recovery curve based on overtaking difficulty:
   
   - Monaco: P1 → P1 (70%), P5 → P1 (2%)       [hardest to overtake]
   - Bahrain: P1 → P1 (55%), P5 → P1 (12%)      [easier to overtake]
   - Monza: P1 → P1 (45%), P5 → P1 (15%)        [easiest to overtake]
   
   Also learns from actual race data when available.
   ═══════════════════════════════════════════════════════════════ */

window.GridRecoveryCurves = (() => {

    const STORAGE_KEY = 'f1_grid_recovery_v1';

    // ─────────────────────────────────────────────────────────────
    // BASE RECOVERY CURVES (sigmoid-shaped per track)
    // Format: { alpha: steepness, beta: midpoint, maxRecovery: max positions gained }
    // Higher alpha = steeper curve (harder to recover)
    // ─────────────────────────────────────────────────────────────
    const BASE_CURVES = {
        // Street circuits — very hard to overtake
        monaco: { alpha: 0.55, beta: 2.0, maxRecovery: 3, posRetention: 0.92 },
        singapore: { alpha: 0.45, beta: 3.0, maxRecovery: 5, posRetention: 0.85 },
        baku: { alpha: 0.30, beta: 5.0, maxRecovery: 8, posRetention: 0.75 },
        jeddah: { alpha: 0.28, beta: 5.5, maxRecovery: 9, posRetention: 0.72 },
        las_vegas: { alpha: 0.25, beta: 6.0, maxRecovery: 10, posRetention: 0.70 },
        miami: { alpha: 0.30, beta: 5.0, maxRecovery: 8, posRetention: 0.75 },

        // Technical circuits — moderate overtaking
        suzuka: { alpha: 0.40, beta: 3.5, maxRecovery: 5, posRetention: 0.82 },
        budapest: { alpha: 0.45, beta: 3.0, maxRecovery: 4, posRetention: 0.85 },
        zandvoort: { alpha: 0.48, beta: 2.5, maxRecovery: 4, posRetention: 0.88 },
        imola: { alpha: 0.38, beta: 4.0, maxRecovery: 6, posRetention: 0.80 },
        barcelona: { alpha: 0.35, beta: 4.5, maxRecovery: 7, posRetention: 0.78 },
        melbourne: { alpha: 0.32, beta: 4.5, maxRecovery: 7, posRetention: 0.76 },

        // Power circuits — easy to overtake
        monza: { alpha: 0.20, beta: 7.0, maxRecovery: 14, posRetention: 0.60 },
        spa: { alpha: 0.22, beta: 6.5, maxRecovery: 12, posRetention: 0.65 },
        spielberg: { alpha: 0.18, beta: 8.0, maxRecovery: 15, posRetention: 0.55 },
        bahrain: { alpha: 0.25, beta: 6.0, maxRecovery: 10, posRetention: 0.70 },
        silverstone: { alpha: 0.28, beta: 5.5, maxRecovery: 9, posRetention: 0.72 },
        austin: { alpha: 0.27, beta: 6.0, maxRecovery: 10, posRetention: 0.70 },
        shanghai: { alpha: 0.25, beta: 6.0, maxRecovery: 10, posRetention: 0.70 },
        interlagos: { alpha: 0.24, beta: 6.5, maxRecovery: 11, posRetention: 0.68 },
        lusail: { alpha: 0.26, beta: 5.5, maxRecovery: 9, posRetention: 0.72 },
        yas_marina: { alpha: 0.28, beta: 5.0, maxRecovery: 8, posRetention: 0.74 },
        mexico: { alpha: 0.25, beta: 6.0, maxRecovery: 10, posRetention: 0.70 },
        montreal: { alpha: 0.26, beta: 5.5, maxRecovery: 9, posRetention: 0.72 },

        // Default for unknown tracks
        default: { alpha: 0.30, beta: 5.0, maxRecovery: 8, posRetention: 0.75 },
    };

    // Historical data accumulator (learns from real results)
    let _learnedData = {}; // { trackId: [{ gridPos, finishPos, driverId }] }

    // ─────────────────────────────────────────────────────────────
    // SIGMOID RECOVERY FUNCTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate expected finish position from grid position using non-linear curve
     * @param {number} gridPos - Starting grid position (1-22)
     * @param {string} trackId - Track short name  
     * @param {number} paceAdvantage - Pace advantage relative to grid position (0 = neutral, positive = faster than grid suggests)
     * @returns {Object} { expectedFinish, recoveryPotential, retentionStrength }
     */
    function getExpectedFinish(gridPos, trackId, paceAdvantage = 0) {
        const curve = BASE_CURVES[trackId] || BASE_CURVES.default;

        // Check if we have learned data for this track
        const learned = _learnedData[trackId];
        let learnedBias = 0;
        if (learned && learned.length >= 10) {
            // Calculate average actual recovery for similar grid positions
            const similar = learned.filter(d => Math.abs(d.gridPos - gridPos) <= 2);
            if (similar.length >= 3) {
                const avgRecovery = similar.reduce((a, d) => a + (d.gridPos - d.finishPos), 0) / similar.length;
                learnedBias = avgRecovery * 0.3; // 30% weight to learned data
            }
        }

        // Non-linear recovery model:
        // Positions that can be gained = maxRecovery * sigmoid(paceAdvantage, alpha, beta)
        // Modified by grid position (easier to gain from midfield than from pole)

        const gridFactor = Math.min(1.0, gridPos / 10); // Harder to gain positions from front (already near limit)
        const positionsFromPace = paceAdvantage * curve.maxRecovery * gridFactor;

        // Sigmoid-based natural recovery (track-dependent)
        // At tracks like Monaco, even with pace advantage, recovery is limited
        const sigmoidInput = (paceAdvantage - 0.1) / 0.3; // normalize pace advantage
        const sigmoidRecovery = curve.maxRecovery / (1 + Math.exp(-curve.alpha * sigmoidInput));

        // Blend pace-based and sigmoid recovery
        const rawRecovery = positionsFromPace * 0.6 + sigmoidRecovery * 0.4 + learnedBias;

        // Apply position retention (track-dependent defense ability)
        // If car is at its "correct" position (pace = grid), retention keeps it there
        const retentionForce = curve.posRetention * (1 - Math.abs(paceAdvantage) * 0.5);

        // Expected finish = grid position - recovery (clamped to 1-22)
        let expectedFinish = gridPos - rawRecovery;
        expectedFinish = Math.max(1, Math.min(22, Math.round(expectedFinish)));

        return {
            expectedFinish,
            recoveryPotential: Math.round(rawRecovery * 10) / 10,
            retentionStrength: Math.round(retentionForce * 100) / 100,
            curveParams: curve,
            learnedBias: Math.round(learnedBias * 10) / 10,
        };
    }

    /**
     * Get position-to-position transition probability matrix for a track
     * Returns P(finish at position j | start at position i) for each i,j pair
     * @param {string} trackId
     * @param {number} gridSize - Number of cars (default 22)
     * @returns {Array<Array<number>>} 22x22 probability matrix
     */
    function getTransitionMatrix(trackId, gridSize = 22) {
        const curve = BASE_CURVES[trackId] || BASE_CURVES.default;
        const matrix = [];

        for (let startPos = 1; startPos <= gridSize; startPos++) {
            const row = new Array(gridSize).fill(0);
            const sigma = (1 - curve.posRetention) * 3 + 1; // spread based on track difficulty

            // Generate probability distribution around expected finish
            let totalProb = 0;
            for (let finishPos = 1; finishPos <= gridSize; finishPos++) {
                const distance = finishPos - startPos;

                // Skewed normal — easier to lose positions than gain them
                const gainPenalty = distance < 0 ? 1.0 + curve.alpha * 2 : 1.0;
                const prob = Math.exp(-((distance * gainPenalty) ** 2) / (2 * sigma ** 2));
                row[finishPos - 1] = prob;
                totalProb += prob;
            }

            // Normalize to sum to 1
            for (let j = 0; j < gridSize; j++) {
                row[j] = totalProb > 0 ? row[j] / totalProb : 1 / gridSize;
            }

            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Get pace-adjusted modifier for PredictionEngine
     * Returns a multiplier that makes grid position matter more/less depending on track
     */
    function getGridImportance(trackId) {
        const curve = BASE_CURVES[trackId] || BASE_CURVES.default;
        // posRetention directly maps to how important grid position is
        // Monaco (0.92) → grid is 92% of the battle
        // Spielberg (0.55) → grid is only 55% of the battle
        return curve.posRetention;
    }

    /**
     * Convert a linear grid penalty to a track-specific non-linear one
     * Used to replace the simple `gridPenalty = (gridPos - 1) * 0.06` in predictions
     */
    function getNonLinearGridPenalty(gridPos, trackId) {
        const curve = BASE_CURVES[trackId] || BASE_CURVES.default;

        // Non-linear: front grid = small penalty, midfield = medium, back = large
        // Uses a quadratic curve scaled by posRetention
        const normalizedPos = (gridPos - 1) / 21; // 0 at P1, 1 at P22
        const penalty = Math.pow(normalizedPos, 1.4) * curve.posRetention * 0.12;

        return penalty;
    }

    // ─────────────────────────────────────────────────────────────
    // LEARNING FROM RESULTS
    // ─────────────────────────────────────────────────────────────
    function recordResult(trackId, gridPos, finishPos, driverId) {
        if (!_learnedData[trackId]) _learnedData[trackId] = [];
        _learnedData[trackId].push({ gridPos, finishPos, driverId, timestamp: Date.now() });

        // Keep last 100 data points per track
        if (_learnedData[trackId].length > 100) {
            _learnedData[trackId] = _learnedData[trackId].slice(-100);
        }
        save();
    }

    function recordRaceResult(trackId, result, gridOrder) {
        if (!result?.positions || !gridOrder) return;
        result.positions.forEach((dId, finishIdx) => {
            const gridIdx = gridOrder.findIndex(g => g.driver?.id === dId || g === dId);
            if (gridIdx >= 0) {
                recordResult(trackId, gridIdx + 1, finishIdx + 1, dId);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────
    function save() {
        try {
            (window.safeStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify(_learnedData));
        } catch (e) { /* ignore */ }
    }

    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) _learnedData = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    }

    // Auto-load
    load();

    return {
        getExpectedFinish,
        getTransitionMatrix,
        getGridImportance,
        getNonLinearGridPenalty,
        recordResult,
        recordRaceResult,
        getCurve: (trackId) => BASE_CURVES[trackId] || BASE_CURVES.default,
        getAllCurves: () => ({ ...BASE_CURVES }),
        getLearnedData: () => ({ ..._learnedData }),
    };
})();

console.log('%c[GridRecoveryCurves] Ready — Non-linear grid recovery per track', 'color:#eab308;font-weight:bold');
