'use strict';
/* ========================================================
   STRATEGY WINDOW MODEL — StrategyModel.js
   Phase 3: Mathematical Undercut / Overcut Model
   ======================================================== */

const StrategyWindowModel = (() => {

    function calculateUndercutDelta(currentTire, lapsOnTire, newTire, trackTemp) {
        // Simplified mapping for tire pace loss based on TireDegradationModel
        let inLapDegLoss = 0.05 + (lapsOnTire * 0.003);

        let outLapTempGain = 0.85; // new tire grip bonus
        let newTireGripBonus = 1.2;

        if (currentTire === 'hard') inLapDegLoss = 0.02 + (lapsOnTire * 0.001);
        if (newTire === 'soft') newTireGripBonus = 1.8;
        if (newTire === 'hard') newTireGripBonus = 0.8;

        outLapTempGain += (trackTemp - 30) * 0.01;

        let undercutDelta = (outLapTempGain + newTireGripBonus) - inLapDegLoss;

        return undercutDelta;
    }

    // Evaluate pit window success probability based on undercut delta
    function getPitSuccessProbability(undercutDelta) {
        if (undercutDelta > 1.5) return 0.85;
        if (undercutDelta > 0.5) return 0.65;
        if (undercutDelta > 0.0) return 0.50;
        return 0.20; // High risk of overcut failure
    }

    return { calculateUndercutDelta, getPitSuccessProbability };
})();

window.StrategyWindowModel = StrategyWindowModel;
