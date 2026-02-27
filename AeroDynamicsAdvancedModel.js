window.AeroDynamicsAdvancedModel = {
    calculateDirtyAirPenalty: function (trackType, cornerSpeedProfile, gapTime, turbulenceDuration) {
        let penalty = 0.1;
        if (gapTime < 1.2) {
            penalty = 0.5 * (1.2 - gapTime);
        }
        if (turbulenceDuration > 5 && gapTime < 1.2) {
            penalty += 0.04;
        }
        return penalty;
    },
    calculateDrsGain: function (base_drs_gain, speedTrapDeltaFactor, isHighSpeedZone) {
        let gain = base_drs_gain * speedTrapDeltaFactor;
        if (isHighSpeedZone) {
            gain *= 1.2;
        }
        return gain;
    }
};
