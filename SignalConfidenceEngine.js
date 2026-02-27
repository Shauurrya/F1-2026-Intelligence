window.SignalConfidenceEngine = {
    calculateConfidence: function (source_weight, recency_weight, cross_validation_factor) {
        return source_weight * recency_weight * cross_validation_factor;
    },
    shouldApply: function (confidence_score, threshold = 0.75) {
        return confidence_score > threshold;
    }
};
