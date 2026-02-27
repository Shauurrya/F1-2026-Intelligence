window.ConfidenceBandEngine = {
    calculateBands: function (simResults) {
        let stats = window.MonteCarloIntegrityEngine.validateSimulations(simResults);
        if (!stats) return null;

        let SE_finish = Math.sqrt(stats.variance) / Math.sqrt(simResults.length);
        let confidence_score = 1 - (Math.sqrt(stats.variance) / 20);
        if (confidence_score < 0) confidence_score = 0;

        return {
            mean_finish: stats.mean,
            sigma: Math.sqrt(stats.variance),
            se: SE_finish,
            confidence_score: confidence_score,
            band_68: [stats.mean - Math.sqrt(stats.variance), stats.mean + Math.sqrt(stats.variance)],
            band_95: [stats.mean - 2 * Math.sqrt(stats.variance), stats.mean + 2 * Math.sqrt(stats.variance)],
            band_99: [stats.mean - 3 * Math.sqrt(stats.variance), stats.mean + 3 * Math.sqrt(stats.variance)]
        };
    },
    calculateWinCI: function (p, N) {
        let margin = 1.96 * Math.sqrt((p * (1 - p)) / N);
        return [p - margin, p + margin];
    }
};
