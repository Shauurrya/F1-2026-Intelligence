'use strict';
/* ═══════════════════════════════════════════════════════════════
   ML PACE REGRESSION ENGINE — MLPaceRegression.js
   
   Learns optimal pace weights from historical race data using
   multivariate linear regression (ordinary least squares).
   
   Instead of hardcoded weights (40% driver, 42% car, 18% track),
   this engine learns from actual race results what the optimal
   combination is. Updates after every race result.
   
   Features used:
   - Driver rating (0-100)
   - Team/car rating (0-100)
   - Track type multiplier (street/power/technical)
   - Grid position (1-22)
   - Weather condition (dry/wet/mixed)
   - Tire compound choice
   - Historical track performance
   
   Target: Finishing position normalized to 0-1
   ═══════════════════════════════════════════════════════════════ */

window.MLPaceRegression = (() => {

    // ── MODEL STATE ──
    const MODEL = {
        weights: {
            driverRating: 0.40,     // initialized to current hardcoded values
            teamRating: 0.42,
            trackAffinity: 0.18,
            gridPosition: -0.15,    // grid pos → higher = worse
            weatherSkill: 0.08,
            tireManagement: 0.05,
            formMomentum: 0.06,
            eloRating: 0.10,
            bias: 0.0,
        },
        learningRate: 0.001,
        regularization: 0.0001,  // L2 regularization to prevent overfitting
        trainingData: [],         // accumulated race results
        epoch: 0,
        lastLoss: null,
        trained: false,
    };

    const STORAGE_KEY = 'f1_ml_regression_v1';

    // ── FEATURE EXTRACTION ──
    function extractFeatures(driverId, teamId, race, gridPos, weatherType) {
        // Normalize all features to 0-1 range
        const drivers = typeof PredictionsCenter !== 'undefined' ? PredictionsCenter.getDrivers?.() : null;
        const driver = drivers?.find(d => d.id === driverId);

        const driverRating = driver ? driver.rating / 100 : 0.5;
        const teamRating = typeof DynamicModel !== 'undefined' ? DynamicModel.getTeamRating?.(teamId) / 100 : 0.5;

        // Track affinity from TrackPerformanceHistory
        let trackAffinity = 0.5;
        if (window.TrackPerformanceHistory && race?.short) {
            const hist = window.TrackPerformanceHistory.getDriverTrackScore?.(driverId, race.short);
            if (hist !== undefined && hist !== null) trackAffinity = Math.max(0, Math.min(1, hist / 20));
        }

        const gridNorm = gridPos ? (22 - gridPos) / 21 : 0.5;  // P1=1.0, P22=0.0

        // Weather skill
        let weatherSkill = 0.5;
        if (driver && typeof DriverSkillMatrix !== 'undefined') {
            const skills = DriverSkillMatrix[driverId];
            if (skills) {
                weatherSkill = weatherType === 'wet' ? (skills.wetDriving || 0.5) :
                    weatherType === 'mixed' ? (skills.wetDriving || 0.5) * 0.7 + 0.3 : 0.5;
            }
        }

        // Tire management
        let tireMgmt = 0.5;
        if (typeof DriverPersonalityMatrix !== 'undefined') {
            const personality = DriverPersonalityMatrix[driverId];
            if (personality) tireMgmt = personality.tireSmoothness || 0.5;
        }

        // Form momentum
        let formMomentum = 0.5;
        if (typeof DynamicModel !== 'undefined') {
            const form = DynamicModel.getDriverFormMult?.(driverId);
            if (form) formMomentum = (form - 0.95) / 0.1 + 0.5; // map 0.95-1.05 to 0-1
        }

        // Elo rating
        let eloNorm = 0.5;
        if (window.EloRatingSystem) {
            const elo = window.EloRatingSystem.getRating?.(driverId);
            if (elo) eloNorm = Math.max(0, Math.min(1, (elo - 1200) / 600)); // 1200-1800 range
        }

        return {
            driverRating,
            teamRating,
            trackAffinity,
            gridPosition: gridNorm,
            weatherSkill,
            tireManagement: tireMgmt,
            formMomentum,
            eloRating: eloNorm,
        };
    }

    // ── PREDICTION ──
    function predict(features) {
        let score = MODEL.weights.bias;
        for (const [key, value] of Object.entries(features)) {
            score += (MODEL.weights[key] || 0) * value;
        }
        return Math.max(0, Math.min(1, score)); // clamp to [0, 1]
    }

    /**
     * Predict finishing position for a driver (1-22 scale)
     * Higher score = better predicted finish
     */
    function predictPosition(driverId, teamId, race, gridPos, weatherType) {
        const features = extractFeatures(driverId, teamId, race, gridPos, weatherType);
        const score = predict(features);
        // Convert score (0-1) to position estimate (22-1, where 1=best)
        return Math.round(22 - score * 21);
    }

    /**
     * Get the learned weight multipliers for PredictionEngine
     * Returns { driver: W, car: W, track: W } normalized to sum to 1
     */
    function getLearnedWeights() {
        if (!MODEL.trained) {
            return { driver: 0.40, car: 0.42, track: 0.18 };
        }
        const d = Math.abs(MODEL.weights.driverRating);
        const c = Math.abs(MODEL.weights.teamRating);
        const t = Math.abs(MODEL.weights.trackAffinity);
        const total = d + c + t || 1;
        return {
            driver: d / total,
            car: c / total,
            track: t / total,
        };
    }

    // ── TRAINING (Online Gradient Descent) ──
    function addTrainingExample(driverId, teamId, race, gridPos, weatherType, actualPosition) {
        const features = extractFeatures(driverId, teamId, race, gridPos, weatherType);
        const target = (22 - actualPosition) / 21; // normalize position to 0-1 (P1=1.0)
        MODEL.trainingData.push({ features, target });

        // Keep last 500 data points to prevent memory bloat
        if (MODEL.trainingData.length > 500) {
            MODEL.trainingData = MODEL.trainingData.slice(-500);
        }
    }

    function train(epochs = 50) {
        if (MODEL.trainingData.length < 20) {
            // Not enough data to learn meaningfully
            return { loss: null, message: 'Need at least 20 race results to train' };
        }

        let totalLoss = 0;

        for (let e = 0; e < epochs; e++) {
            totalLoss = 0;

            // Shuffle training data for each epoch
            const shuffled = [...MODEL.trainingData].sort(() => Math.random() - 0.5);

            for (const example of shuffled) {
                const prediction = predict(example.features);
                const error = prediction - example.target;
                totalLoss += error * error;

                // Gradient descent update for each weight
                for (const [key, value] of Object.entries(example.features)) {
                    if (MODEL.weights[key] !== undefined) {
                        const gradient = error * value + MODEL.regularization * MODEL.weights[key];
                        MODEL.weights[key] -= MODEL.learningRate * gradient;
                    }
                }
                // Bias update
                MODEL.weights.bias -= MODEL.learningRate * error;
            }

            totalLoss /= shuffled.length;
        }

        MODEL.epoch += epochs;
        MODEL.lastLoss = totalLoss;
        MODEL.trained = true;

        save();

        return {
            loss: totalLoss.toFixed(6),
            epoch: MODEL.epoch,
            weights: { ...MODEL.weights },
            dataPoints: MODEL.trainingData.length,
        };
    }

    /**
     * Record a full race result and retrain
     */
    function recordRaceResult(race, result, drivers) {
        if (!result || !result.positions || !drivers) return;

        const weatherType = race.rain_probability > 0.5 ? 'wet' : race.rain_probability > 0.2 ? 'mixed' : 'dry';

        result.positions.forEach((dId, idx) => {
            const driver = drivers.find(d => d.id === dId);
            if (!driver) return;
            const gridPos = idx + 1; // We use actual position as approximation if no grid data
            addTrainingExample(dId, driver.team, race, gridPos, weatherType, idx + 1);
        });

        // Retrain with new data
        const result2 = train(30);
        console.log(`[MLRegression] Trained on ${MODEL.trainingData.length} examples | Loss: ${result2.loss} | Weights:`,
            getLearnedWeights());

        return result2;
    }

    // ── PERSISTENCE ──
    function save() {
        try {
            (window.safeStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify({
                weights: MODEL.weights,
                trainingData: MODEL.trainingData.slice(-200), // save last 200
                epoch: MODEL.epoch,
                lastLoss: MODEL.lastLoss,
                trained: MODEL.trained,
            }));
        } catch (e) { /* ignore */ }
    }

    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.weights) MODEL.weights = { ...MODEL.weights, ...data.weights };
                if (data.trainingData) MODEL.trainingData = data.trainingData;
                if (data.epoch) MODEL.epoch = data.epoch;
                if (data.lastLoss !== undefined) MODEL.lastLoss = data.lastLoss;
                if (data.trained) MODEL.trained = data.trained;
                console.log(`[MLRegression] Loaded ${MODEL.trainingData.length} training examples, epoch ${MODEL.epoch}`);
            }
        } catch (e) { /* ignore */ }
    }

    // Auto-load on init
    load();

    return {
        predictPosition,
        getLearnedWeights,
        recordRaceResult,
        train,
        addTrainingExample,
        getModel: () => ({ ...MODEL, weights: { ...MODEL.weights } }),
        save,
        load,
    };
})();

console.log('%c[MLPaceRegression] Ready — Gradient descent pace weight learning', 'color:#818cf8;font-weight:bold');
