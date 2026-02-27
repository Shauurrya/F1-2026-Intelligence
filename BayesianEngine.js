'use strict';
/* ========================================================
   BAYESIAN PERFORMANCE ENGINE — BayesianEngine.js
   Phase 1: Bayesian Performance Reweighting Engine
   ======================================================== */

const BayesianPerformanceEngine = (() => {
    let telemetryStats = {};

    let teamAdjustments = {};

    // Used to track dynamic Bayesian rating updates per driver lap
    function processLapDelta(driverId, teamId, actualLapTime, predictedLapTime, currentRating = 1.0) {
        if (!actualLapTime || !predictedLapTime) return currentRating;

        if (!telemetryStats[driverId]) {
            telemetryStats[driverId] = { count: 0, actualSum: 0, predSum: 0, teamId: teamId };
        }

        telemetryStats[driverId].count++;
        telemetryStats[driverId].actualSum += actualLapTime;
        telemetryStats[driverId].predSum += predictedLapTime;

        // Process every lap incrementally
        let priorWeight = 15.0; // Assume confidence base equivalent to 15 laps
        let evidenceWeight = telemetryStats[driverId].count; // Weight increases as laps pile up

        let avgActual = telemetryStats[driverId].actualSum / evidenceWeight;
        let avgPred = telemetryStats[driverId].predSum / evidenceWeight;
        let error = avgActual - avgPred;

        // Convert time error to a performance delta
        // Uses actual predicted lap time instead of hardcoded 85s for accurate per-track scaling
        // e.g., 0.5s slower on a 65s lap (Austria) = -0.0077 vs 105s lap (Spa) = -0.0048
        let referenceTime = avgPred > 0 ? avgPred : 85.0; // fallback to 85s if no pred data
        let observedDelta = -(error / referenceTime);

        // Bayesian Update Formula
        // posterior = (prior*priorW + obs*obsW) / (priorW + obsW)
        // Here we track the *adjustment* relative to 0.
        let priorAdjustment = 0;
        let posteriorAdjustment = ((priorAdjustment * priorWeight) + (observedDelta * evidenceWeight)) / (priorWeight + evidenceWeight);

        // Clamp adjustment max ±3%
        posteriorAdjustment = Math.max(-0.03, Math.min(0.03, posteriorAdjustment));

        // Average driver adjustments for the team
        let teamDrivers = Object.values(telemetryStats).filter(d => d.teamId === teamId);
        let teamSum = 0;
        let driverCount = 0;

        teamDrivers.forEach(dInfo => {
            let dAvgAct = dInfo.actualSum / dInfo.count;
            let dAvgPred = dInfo.predSum / dInfo.count;
            let dRefTime = dAvgPred > 0 ? dAvgPred : 85.0;
            let dObserved = -((dAvgAct - dAvgPred) / dRefTime);
            let dPost = ((0 * priorWeight) + (dObserved * dInfo.count)) / (priorWeight + dInfo.count);
            dPost = Math.max(-0.03, Math.min(0.03, dPost));
            teamSum += dPost;
            driverCount++;
        });

        teamAdjustments[teamId] = driverCount > 0 ? (teamSum / driverCount) : 0;

        let newRating = currentRating * (1 + posteriorAdjustment);

        return {
            newRating: newRating,
            adjustment: posteriorAdjustment
        };
    }

    function getTeamAdjustment(teamId) {
        return teamAdjustments[teamId] || 0;
    }

    return { processLapDelta, getTeamAdjustment };
})();

window.BayesianPerformanceEngine = BayesianPerformanceEngine;
