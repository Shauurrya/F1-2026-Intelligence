window.DistributionIntegrityValidator = {
    validateAndAdjust: function (simResults, currentChaosFactor) {
        let validation = window.MonteCarloIntegrityEngine.validateSimulations(simResults);
        if (!validation || !validation.stable) {
            return currentChaosFactor * 0.85;
        }
        return currentChaosFactor;
    }
};
