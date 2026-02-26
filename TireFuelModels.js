'use strict';
/* ========================================================
   TIRE DEGRADATION + FUEL MASS MODELS — TireFuelModels.js
   Phase 2: True Tire Degradation (exponential + linear)
   Phase 3: 2026 Fuel Mass Model
   ======================================================== */

const TireDegradationModel = (() => {

    // Compound-specific parameters
    const COMPOUNDS = {
        soft: {
            base_loss: 0.020,           // 0.015–0.025 range, centered
            degradation_constant: 21,   // 18–24 range, centered
            type: 'exponential',
            optimal_temp: 35,           // °C
        },
        medium: {
            base_loss: 0.008,
            linear_factor: 0.003,       // 0.002–0.004 range
            type: 'linear',
            optimal_temp: 33,
        },
        hard: {
            base_loss: 0.004,
            linear_factor: 0.0015,      // 0.001–0.002 range
            type: 'linear',
            optimal_temp: 30,
        },
        intermediate: {
            base_loss: 0.012,
            linear_factor: 0.0025,
            type: 'linear',
            optimal_temp: 25,
        },
        wet: {
            base_loss: 0.008,
            linear_factor: 0.002,
            type: 'linear',
            optimal_temp: 20,
        }
    };

    // Track degradation multipliers
    const TRACK_DEG = {
        'High': 1.35,
        'Medium-High': 1.18,
        'Medium': 1.0,
        'Low-Medium': 0.85,
        'Low': 0.70,
    };

    // 2026-specific: narrower tyres → 15% more overheating
    const OVERHEATING_2026_COEFF = 1.15;

    /**
     * Calculate tire pace loss for a given stint
     * @param {string} compound - soft|medium|hard|intermediate|wet
     * @param {number} lapsOnTire - number of laps on current set
     * @param {number} trackTemp - track temperature in °C
     * @param {number} driverSmoothness - 0.85–1.15 (from DriverPersonalityMatrix.tire_smoothness)
     * @param {string} trackDeg - High|Medium-High|Medium|Low-Medium|Low
     * @param {number} fuelMass - current fuel mass in kg (affects tire load)
     * @returns {number} pace_loss in seconds per lap
     */
    function getPaceLoss(compound, lapsOnTire, trackTemp, driverSmoothness, trackDeg, fuelMass) {
        const comp = COMPOUNDS[compound] || COMPOUNDS.medium;
        let paceLoss;

        if (comp.type === 'exponential') {
            // Soft tire:  pace_loss = base × e^(laps / deg_constant)
            paceLoss = comp.base_loss * Math.exp(lapsOnTire / comp.degradation_constant);
        } else {
            // Medium/Hard: pace_loss = base + (laps × linear_factor)
            paceLoss = comp.base_loss + (lapsOnTire * comp.linear_factor);
        }

        // Temperature scaling: 1 + ((track_temp - optimal_temp) × 0.015)
        const tempFactor = 1 + ((trackTemp - comp.optimal_temp) * 0.015);

        // Track degradation modifier
        const trackDegMod = TRACK_DEG[trackDeg] || 1.0;

        // Driver smoothness inverse: smoother driver = less deg
        const smoothnessInverse = driverSmoothness > 0 ? (1 / driverSmoothness) : 1.0;

        // 2026 overheating adjustment
        const overheatMod = OVERHEATING_2026_COEFF;

        // Fuel mass effect: heavier car → more tire stress
        const fuelLoadMod = fuelMass > 0 ? (1 + (fuelMass / 500)) : 1.0;

        // Final: pace_loss × temp × track_deg × smoothness_inv × 2026_coeff
        const finalLoss = paceLoss * tempFactor * trackDegMod * smoothnessInverse * overheatMod * fuelLoadMod;

        // REALISM CONSTRAINT: max ±0.4s per lap deviation
        return Math.min(0.4, Math.max(0, finalLoss));
    }

    /**
     * Estimate optimal stint length for a compound
     * @param {string} compound
     * @param {number} trackTemp
     * @param {string} trackDeg
     * @returns {number} optimal laps before pace loss > 0.8s threshold
     */
    function getOptimalStintLength(compound, trackTemp, trackDeg) {
        for (let lap = 1; lap <= 60; lap++) {
            const loss = getPaceLoss(compound, lap, trackTemp, 1.0, trackDeg, 40);
            if (loss > 0.35) return lap;
        }
        return 60;
    }

    /**
     * Get tire delta modifier for calculatePace() integration
     * Returns a pace reduction value (higher = slower)
     * Normalized to 0.0-0.05 range for pace equation
     */
    function getPaceModifier(compound, lapsOnTire, trackTemp, driverSmoothness, trackDeg, fuelMass) {
        const rawLoss = getPaceLoss(compound, lapsOnTire, trackTemp, driverSmoothness, trackDeg, fuelMass);
        // Normalize to pace equation scale (0-0.05 impact)
        return rawLoss * 0.05;
    }

    return { getPaceLoss, getOptimalStintLength, getPaceModifier, COMPOUNDS };
})();


// ═══════════════════════════════════════════════════════════════
// PHASE 3: FUEL MASS MODEL (2026 REGULATION ACCURATE)
// ═══════════════════════════════════════════════════════════════

const FuelMassModel = (() => {

    const DEFAULTS = {
        start_fuel: 75.0,     // kg (70–80 range, 2026 lower fuel era)
        burn_rate: 1.4,       // kg/lap
        fuel_gain_coeff: 0.00022,  // seconds gained per kg burned
        max_gain_per_lap: 0.03,    // REALISM CONSTRAINT
        sc_burn_factor: 0.55,      // SC reduces burn by 45%
        rain_burn_factor: 1.05,    // Rain increases burn by 5%
    };

    /**
     * Calculate remaining fuel at a given lap
     * @param {number} currentLap
     * @param {number} totalLaps
     * @param {boolean} scActive - safety car active flag
     * @param {boolean} isWet - wet conditions flag
     * @param {number} scLaps - number of laps under SC so far
     * @returns {{ remaining: number, burned: number, burnRate: number }}
     */
    function getFuelState(currentLap, totalLaps, scActive = false, isWet = false, scLaps = 0) {
        let effectiveBurnRate = DEFAULTS.burn_rate;
        if (scActive) effectiveBurnRate *= DEFAULTS.sc_burn_factor;
        if (isWet) effectiveBurnRate *= DEFAULTS.rain_burn_factor;

        // Calculate actual fuel burned considering SC laps had lower burn
        const normalLaps = currentLap - scLaps;
        const fuelBurned = (normalLaps * DEFAULTS.burn_rate) + (scLaps * DEFAULTS.burn_rate * DEFAULTS.sc_burn_factor);
        const remaining = Math.max(0, DEFAULTS.start_fuel - fuelBurned);

        return {
            remaining,
            burned: DEFAULTS.start_fuel - remaining,
            burnRate: effectiveBurnRate,
        };
    }

    /**
     * Calculate fuel-corrected pace gain
     * Lighter car → faster lap times
     * @param {number} currentLap
     * @param {number} scLaps
     * @returns {number} pace_gain in seconds (positive = faster)
     */
    function getFuelPaceGain(currentLap, scLaps = 0) {
        const fuelState = getFuelState(currentLap, 0, false, false, scLaps);
        let gain = fuelState.burned * DEFAULTS.fuel_gain_coeff;

        // REALISM CONSTRAINT: max 0.03s per lap
        gain = Math.min(gain, currentLap * DEFAULTS.max_gain_per_lap);
        return gain;
    }

    /**
     * Get fuel modifier for calculatePace() integration
     * Returns a pace improvement (positive = faster, added to basePace)
     * Normalized to 0.0-0.02 range for pace equation
     */
    function getPaceModifier(currentLap, totalLaps, scLaps) {
        const rawGain = getFuelPaceGain(currentLap, scLaps);
        // Normalize: ~0.015s gain → ~0.0015 pace improvement
        return rawGain * 0.01;
    }

    return { getFuelState, getFuelPaceGain, getPaceModifier, DEFAULTS };
})();

console.log('%c[TireFuelModels] Loaded — Exponential tire + 2026 fuel model', 'color:#a78bfa;font-weight:bold');
