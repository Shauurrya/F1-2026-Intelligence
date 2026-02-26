window.MonteCarloIntegrityEngine = {
    validateSimulations: function (simResults) {
        if (!simResults || simResults.length === 0) return null;
        let sum = simResults.reduce((a, b) => a + b, 0);
        let mean = sum / simResults.length;
        let variance = simResults.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / simResults.length;
        let stdDev = Math.sqrt(variance);

        let skewness = simResults.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / (simResults.length * Math.pow(stdDev, 3));
        let kurtosis = simResults.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / (simResults.length * Math.pow(stdDev, 4));

        let stable = true;
        if (Math.abs(skewness) > 1.5 || kurtosis > 4) {
            stable = false;
        }

        return {
            mean: mean,
            variance: variance,
            skewness: skewness,
            kurtosis: kurtosis,
            stable: stable
        };
    }
};
