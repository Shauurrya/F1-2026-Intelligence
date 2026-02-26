'use strict';
/* ========================================================
   AERO MODEL — AeroModel.js
   Phase 2: Real DRS + Dirty Air Physics Model
   ======================================================== */

const AeroDynamicsRaceModel = (() => {

    function getAeroPaceDelta(driverId, gapAhead, speedTrapDelta, trackType, hasActiveAero) {
        let dirtyAirPenalty = 0;
        let drsGain = 0;

        // Dirty Air Penalty
        if (gapAhead > 0 && gapAhead < 1.2) {
            if (trackType === 'high_speed') dirtyAirPenalty = 0.35;
            else if (trackType === 'street' || trackType === 'monaco') dirtyAirPenalty = 0.25;
            else dirtyAirPenalty = 0.15; // default
        }

        // DRS Gain
        if (gapAhead > 0 && gapAhead < 1.0) {
            drsGain = 0.30;
            if (trackType === 'high_speed') drsGain = 0.45;
            else if (trackType === 'street' || trackType === 'monaco') drsGain = 0.20;

            // Refine with speed trap
            if (speedTrapDelta > 5.0) drsGain += 0.05; // Significant overspeed

            // 2026 Active Aero Boost
            if (hasActiveAero) {
                drsGain *= 1.10; // 10% average boost
            }
        }

        // Return combined delta (negative means faster)
        return dirtyAirPenalty - drsGain;
    }

    return { getAeroPaceDelta };
})();

window.AeroDynamicsRaceModel = AeroDynamicsRaceModel;
