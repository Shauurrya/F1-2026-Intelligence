window.DataSanityFilter = {
    filterLaps: function (laps) {
        if (!laps || laps.length === 0) return [];
        // Use correct OpenF1 API field: lap_duration (not .time)
        let times = laps
            .map(l => l.lap_duration)
            .filter(t => t != null && t > 0)
            .sort((a, b) => a - b);
        if (times.length === 0) return laps; // No valid times, return all rather than empty
        let median = times[Math.floor(times.length / 2)];

        let validLaps = laps.filter(lap => {
            // Use correct OpenF1 API field names
            if (lap.is_pit_out_lap) return false;
            if (!lap.lap_duration || lap.lap_duration <= 0) return false;
            if (lap.lap_duration > median * 1.15) return false; // 15% threshold — preserves SC/yellow flag laps
            return true;
        });
        return validLaps;
    }
};
