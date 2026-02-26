'use strict';
/* ========================================================
   TELEMETRY FUSION ENGINE — TelemetryFusion.js
   Phase 5: Live Telemetry Fusion Engine
   ======================================================== */

const TelemetryFusionEngine = (() => {

    // Evaluates True Race Pace and expected finish
    function updateRaceProjection(driver, currentPos, remainingLaps, projectedPaceDelta, stratGain, degLoss) {

        // expected finish calculation
        let expectedPos = currentPos + (projectedPaceDelta * remainingLaps * 0.5) + stratGain - degLoss;

        expectedPos = Math.max(1, Math.min(20, expectedPos));

        return expectedPos;
    }

    return { updateRaceProjection };
})();

window.TelemetryFusionEngine = TelemetryFusionEngine;
