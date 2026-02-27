'use strict';
/* ========================================================
   ADAPTIVE CORE ENGINES — AdaptiveCore.js
   Phases 1, 4, 5, 6, 7 & 8 implementations
   ======================================================== */

// PHASE 1 — LIVE LAP DELTA LEARNING ENGINE (MATHEMATICAL MODEL)
// After every completed lap: Store sector times and lap time.
// After every 5 laps: Compute rolling averages & error
const LapDeltaLearningEngine = (() => {
    let telemetryStats = {};
    let adjustments = {};

    function processLap(driverId, teamId, actualLapTime, predictedLapTime, sectorTimes, predSectors) {
        if (!telemetryStats[driverId]) telemetryStats[driverId] = { count: 0, actualLapSum: 0, predLapSum: 0 };

        // DATA AUTHENTICITY RULE: Never invent performance values
        if (!actualLapTime || !predictedLapTime) return;

        telemetryStats[driverId].count++;
        telemetryStats[driverId].actualLapSum += actualLapTime;
        telemetryStats[driverId].predLapSum += predictedLapTime;

        if (telemetryStats[driverId].count % 5 === 0) {
            let actualAvg = telemetryStats[driverId].actualLapSum / 5;
            let predAvg = telemetryStats[driverId].predLapSum / 5;
            let error = actualAvg - predAvg;

            if (Math.abs(error) > 0.15) {
                let adjustmentFactor = error * 0.6;
                // Sector error if available
                if (sectorTimes && predSectors && sectorTimes.length === 3 && predSectors.length === 3) {
                    let s1Err = sectorTimes[0] - predSectors[0];
                    let s2Err = sectorTimes[1] - predSectors[1];
                    let s3Err = sectorTimes[2] - predSectors[2];
                    let sectorError = (s1Err + s2Err + s3Err) / 3;
                    adjustmentFactor = (adjustmentFactor * 0.5) + (sectorError * 0.5);
                }

                if (!adjustments[teamId]) adjustments[teamId] = 0;

                // Adjustment relative to reference lap
                let referenceLap = 85.0; // typical F1 lap ~85s
                let currentRating = 1.0;
                let newRating = currentRating * (1 - (adjustmentFactor / referenceLap));

                // Convert back to a percentage modifier delta (-0.03 to 0.03 limits)
                let pctAdj = newRating - currentRating;
                adjustments[teamId] += pctAdj;

                // Clamp max ±3% per race
                adjustments[teamId] = Math.max(-0.03, Math.min(0.03, adjustments[teamId]));
            }

            telemetryStats[driverId].actualLapSum = 0;
            telemetryStats[driverId].predLapSum = 0;
        }
    }

    function getTeamAdjustment(teamId) {
        return adjustments[teamId] || 0;
    }

    return { processLap, getTeamAdjustment };
})();

// PHASE 4 — DYNAMIC BASE PERFORMANCE RECALIBRATION
const RoundAdaptiveBase = (() => {
    function getRecalibratedBase(currentBase, last3RaceDeltas, practiceDelta, qualiDelta) {
        let avgLast3 = last3RaceDeltas && last3RaceDeltas.length ? last3RaceDeltas.reduce((a, b) => a + b, 0) / last3RaceDeltas.length : currentBase;

        let recentDelta = (avgLast3 * 0.5) + (practiceDelta * 0.3) + (qualiDelta * 0.2);
        let newTeamBase = (currentBase * 0.65) + (recentDelta * 0.35);

        // Clamp per race: max ±5%
        if (newTeamBase > currentBase * 1.05) newTeamBase = currentBase * 1.05;
        if (newTeamBase < currentBase * 0.95) newTeamBase = currentBase * 0.95;

        return newTeamBase;
    }
    return { getRecalibratedBase };
})();

// PHASE 5 — WEATHER OVERRIDE ENGINE (LIVE ONLY)
const LiveWeatherOverrideEngine = (() => {
    function getModifiers(trackTemp, windSpeed, humidity, rainIntensity, driverWetSkill) {
        let degTempMod = 1 + ((trackTemp - 35) * 0.012);
        let mistakeMult = 1 + (windSpeed / 60);
        let humidityFactor = 1 + ((humidity - 60) * 0.003);
        let wetBoost = driverWetSkill * (1 + (rainIntensity * 0.15));

        return { degTempMod, mistakeMult, humidityFactor, wetBoost };
    }
    return { getModifiers };
})();

// PHASE 6 — RELIABILITY CALIBRATION FROM SCRAPER DATA
const ReliabilityCalibrationEngine = (() => {
    const SUPPLIER_COEFFICIENTS = {
        ferrari: 0.95,
        mercedes: 0.96,
        honda: 0.94,
        red_bull_ford: 0.98,
        renault: 1.08
    };

    function getFailureProbability(baseFailRate, histDNFRate, supplierId) {
        let teamRelFactor = 1 - histDNFRate;
        let failProb = baseFailRate * (1 + (1 - teamRelFactor) * 1.8);

        let supplierMod = SUPPLIER_COEFFICIENTS[supplierId] || 1.0;
        return failProb * supplierMod;
    }
    return { getFailureProbability };
})();

// PHASE 7 — REMAINING RACE PROJECTION MODEL
const RemainingRaceProjectionEngine = (() => {
    function projectRemaining(totalLaps, currentLap, initialScProb, expectedStintLength, lapsUsed, scOccurred) {
        let remainingLaps = totalLaps - currentLap;
        let raceProgress = currentLap / Math.max(1, totalLaps);

        let remainingSC = initialScProb * (1 - raceProgress);
        if (scOccurred) remainingSC *= 0.6;

        let tireRemaining = expectedStintLength - lapsUsed;

        return { remainingLaps, remainingSC, tireRemaining };
    }
    return { projectRemaining };
})();

// PHASE 8 — LIVE REPROJECTION LOOP
const LiveReprojectionLoop = (() => {
    let lastComputeLap = -1;
    let lapCache = {};

    function checkAndReproject(currentLap, callback) {
        if (currentLap <= lastComputeLap) return; // Prevent recompute storms

        // Every 3 laps: Recalculate
        if (currentLap % 3 === 0 && currentLap !== 0) {
            // Must run async without UI blocking
            setTimeout(() => {
                if (callback) callback();
            }, 0);
        }
        lastComputeLap = currentLap;
    }

    function cacheCalc(lapIdentifier, data) { lapCache[lapIdentifier] = data; }
    function getCache(lapIdentifier) { return lapCache[lapIdentifier]; }

    return { checkAndReproject, cacheCalc, getCache };
})();

// export globally
window.LapDeltaLearningEngine = LapDeltaLearningEngine;
window.RoundAdaptiveBase = RoundAdaptiveBase;
window.LiveWeatherOverrideEngine = LiveWeatherOverrideEngine;
window.ReliabilityCalibrationEngine = ReliabilityCalibrationEngine;
window.RemainingRaceProjectionEngine = RemainingRaceProjectionEngine;
window.LiveReprojectionLoop = LiveReprojectionLoop;

// PHASE 10 — VALIDATION
(function runDiagnostics() {
    console.log('%c[AdaptiveCore] Running Diagnostic Tests...', 'color:#58a6ff;font-weight:bold');

    // Tire & Fuel (if loaded before or checked lazily in Predictions - wait, Tire/Fuel is loaded before this script)
    if (typeof TireDegradationModel !== 'undefined' && typeof FuelMassModel !== 'undefined') {
        const s = TireDegradationModel.getPaceLoss('soft', 15, 35, 1.0, 'Medium', 70);
        const m = TireDegradationModel.getPaceLoss('medium', 15, 35, 1.0, 'Medium', 70);
        console.assert(s > m, `Tire exponential decay behavior check failed: Soft(${s}) vs Medium(${m})`);

        const f1 = FuelMassModel.getPaceModifier(1, 60, 0);
        const f2 = FuelMassModel.getPaceModifier(30, 60, 0);
        console.assert(f2 > f1, `Fuel model accuracy check failed: Lap 30 gain(${f2}) <= Lap 1 gain(${f1})`);
    }

    // Live Recalibration Response
    LapDeltaLearningEngine.processLap('test_driver', 'ferrari', 95.0, 85.0, [], []); // Slow 1
    LapDeltaLearningEngine.processLap('test_driver', 'ferrari', 95.0, 85.0, [], []); // Slow 2
    LapDeltaLearningEngine.processLap('test_driver', 'ferrari', 95.0, 85.0, [], []); // Slow 3
    LapDeltaLearningEngine.processLap('test_driver', 'ferrari', 95.0, 85.0, [], []); // Slow 4
    LapDeltaLearningEngine.processLap('test_driver', 'ferrari', 95.0, 85.0, [], []); // Slow 5 triggers update
    let adj = LapDeltaLearningEngine.getTeamAdjustment('ferrari');
    console.assert(adj < 0, `Live recalibration response check failed: Team pace should decrease, got ${adj}`);

    // Wet Race Pace Boost
    let w = LiveWeatherOverrideEngine.getModifiers(20, 10, 80, 0.8, 1.10);
    console.assert(w.wetBoost > 1.10, `Wet race pace boost check failed: Boost (${w.wetBoost}) should exceed wet skill 1.10`);

    // Base Recalibration Removal of Testing Bias
    let rb = RoundAdaptiveBase.getRecalibratedBase(0.85, [1.0, 1.05, 0.98], 0.0, 0.1);
    console.assert(rb !== 0.85, `Base recalibration removal of testing bias check failed: Result is ${rb}`);

    console.log('%c[AdaptiveCore] Diagnostic Tests Complete.', 'color:#3fb950;font-style:italic');
})();
