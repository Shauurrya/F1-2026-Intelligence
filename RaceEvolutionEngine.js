window.RaceEvolutionEngine = {
    fuelMassGain: function (remainingFuel) {
        return remainingFuel * 0.022;
    },
    getTireDegradation: function (lap_i, compound, trackTemp, driverSmoothness, overheatingCoef) {
        let baseDeg = lap_i * 0.05;
        if (compound === 'soft') baseDeg = Math.pow(1.08, lap_i) * 0.05;
        if (compound === 'medium') baseDeg = lap_i * 0.04;
        if (compound === 'hard') baseDeg = lap_i * 0.025;
        return baseDeg * (trackTemp / 30) * driverSmoothness * overheatingCoef;
    },
    simulateRemainingLaps: function (driverId, currentLap, totalLaps, basePace, remainingFuel, compound, trackTemp, driverSmoothness, overheatingCoef, dirtyAirPenalty, drsGain, trackEvolution, weatherAdjustment, pressureAdjustment) {
        let totalTime = 0;
        let fuel = remainingFuel;
        for (let i = currentLap; i <= totalLaps; i++) {
            let tireDeg = this.getTireDegradation(i - currentLap, compound, trackTemp, driverSmoothness, overheatingCoef);
            let fuelGain = this.fuelMassGain(fuel);
            let lapTime = basePace + tireDeg - fuelGain + dirtyAirPenalty - drsGain + trackEvolution + weatherAdjustment + pressureAdjustment;
            totalTime += lapTime;
            fuel -= 1.5;
            if (fuel < 0) fuel = 0;
        }
        return totalTime;
    }
};
