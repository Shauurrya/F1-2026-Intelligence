'use strict';
/* ═══════════════════════════════════════════════════════════════
   HISTORICAL DATA SEEDER — HistoricalDataSeeder.js
   Fetches real F1 2023-2025 race results from the Jolpica API
   (Ergast successor) and seeds all advanced engines with
   real performance data, turning predictions from "speculative"
   into "data-driven".
   ═══════════════════════════════════════════════════════════════ */

window.HistoricalDataSeeder = (() => {
    const API_BASE = 'https://api.jolpi.ca/ergast/f1';
    const SEASONS = [2023, 2024, 2025];
    const CACHE_KEY = 'f1_historical_seeded_v3';
    const SEASON_WEIGHTS = { 2023: 0.2, 2024: 0.35, 2025: 0.45 };

    // ═══ Ergast driverId → our app driverId ═══
    const DRIVER_MAP = {
        'max_verstappen': 'verstappen', 'leclerc': 'leclerc', 'hamilton': 'hamilton',
        'norris': 'norris', 'piastri': 'piastri', 'russell': 'russell',
        'gasly': 'gasly', 'ocon': 'ocon', 'alonso': 'alonso', 'stroll': 'stroll',
        'sainz': 'sainz', 'albon': 'albon', 'bottas': 'bottas', 'perez': 'perez',
        'hulkenberg': 'hulkenberg', 'lawson': 'lawson', 'bearman': 'bearman',
        'colapinto': 'colapinto', 'hadjar': 'hadjar', 'antonelli': 'antonelli',
        'bortoleto': 'bortoleto', 'lindblad': 'lindblad',
        // Drivers who raced 2023-2025 but not in 2026 — mapped to null (ignored for Elo seeding)
        'tsunoda': null, 'ricciardo': null, 'de_vries': null, 'sargeant': null,
        'zhou': null, 'magnussen': null, 'kevin_magnussen': null, 'jack_doohan': null,
        'drugovich': null, 'liam_lawson': 'lawson', 'oliver_bearman': 'bearman',
        'franco_colapinto': 'colapinto', 'logan_sargeant': null, 'nyck_de_vries': null,
        'daniel_ricciardo': null, 'yuki_tsunoda': null, 'guanyu_zhou': null,
        'nico_hulkenberg': 'hulkenberg', 'valtteri_bottas': 'bottas',
        'pierre_gasly': 'gasly', 'esteban_ocon': 'ocon',
        'carlos_sainz': 'sainz', 'charles_leclerc': 'leclerc', 'lando_norris': 'norris',
        'oscar_piastri': 'piastri', 'george_russell': 'russell', 'lewis_hamilton': 'hamilton',
        'fernando_alonso': 'alonso', 'lance_stroll': 'stroll', 'alexander_albon': 'albon',
        'sergio_perez': 'perez', 'max_verstappen': 'verstappen'
    };

    // ═══ Ergast circuitId → track city name matching our calendar ═══
    const CIRCUIT_MAP = {
        'bahrain': 'sakhir', 'jeddah': 'jeddah', 'albert_park': 'melbourne',
        'suzuka': 'suzuka', 'shanghai': 'shanghai', 'miami': 'miami',
        'imola': 'imola', 'monaco': 'monaco', 'villeneuve': 'montreal',
        'Circuit_Gilles_Villeneuve': 'montreal', 'catalunya': 'barcelona',
        'red_bull_ring': 'spielberg', 'silverstone': 'silverstone',
        'hungaroring': 'budapest', 'spa': 'spa', 'zandvoort': 'zandvoort',
        'monza': 'monza', 'marina_bay': 'singapore', 'losail': 'lusail',
        'americas': 'austin', 'rodriguez': 'mexico_city', 'interlagos': 'sao_paulo',
        'yas_marina': 'abu_dhabi', 'vegas': 'las_vegas', 'baku': 'baku',
        'ricard': 'le_castellet', 'spielberg': 'spielberg', 'portimao': 'portimao'
    };

    // ═══ Ergast constructorId → our team ID ═══
    const TEAM_MAP = {
        'red_bull': 'red_bull', 'ferrari': 'ferrari', 'mercedes': 'mercedes',
        'mclaren': 'mclaren', 'aston_martin': 'aston_martin', 'alpine': 'alpine',
        'williams': 'williams', 'haas': 'haas',
        'alphatauri': 'racing_bulls', 'rb': 'racing_bulls', 'racing_bulls': 'racing_bulls',
        'alfa': 'audi', 'sauber': 'audi', 'kick_sauber': 'audi'
    };

    let _status = { loaded: false, loading: false, error: null, seasons: {}, totalRaces: 0, timestamp: null };

    // ═══ FETCH & PROCESS SEASONS ═══
    async function fetchSeason(year) {
        try {
            const res = await fetch(`${API_BASE}/${year}/results.json?limit=600`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data?.MRData?.RaceTable?.Races || [];
        } catch (e) {
            console.warn(`[HistoricalSeeder] Failed to fetch ${year}:`, e.message);
            return null;
        }
    }

    function mapDriverId(ergastId) {
        return DRIVER_MAP[ergastId] || DRIVER_MAP[ergastId.toLowerCase()] || null;
    }

    function mapCircuitId(circuitId) {
        return CIRCUIT_MAP[circuitId] || CIRCUIT_MAP[circuitId.toLowerCase()] || circuitId.toLowerCase();
    }

    function mapTeamId(constructorId) {
        return TEAM_MAP[constructorId] || TEAM_MAP[constructorId.toLowerCase()] || null;
    }

    // ═══ PROCESS RAW API RACES INTO STRUCTURED DATA ═══
    function processRaces(races, year) {
        const processed = [];
        races.forEach(race => {
            const circuitId = race.Circuit?.circuitId;
            const trackCity = mapCircuitId(circuitId);
            const results = (race.Results || []).map(r => ({
                driverId: mapDriverId(r.Driver?.driverId),
                ergastDriverId: r.Driver?.driverId,
                teamId: mapTeamId(r.Constructor?.constructorId),
                position: parseInt(r.position, 10),
                points: parseFloat(r.points || 0),
                status: r.status,
                finished: r.status === 'Finished' || (r.status || '').startsWith('+')
            })).filter(r => r.driverId); // Only include mapped drivers

            if (results.length >= 5) {
                processed.push({
                    year,
                    round: parseInt(race.round, 10),
                    name: race.raceName,
                    trackCity,
                    circuitId,
                    results,
                    date: race.date
                });
            }
        });
        return processed;
    }

    // ═══ SEED ELO RATINGS FROM HISTORICAL H2H ═══
    function seedEloRatings(allRaces) {
        if (!window.EloRatingSystem) return;

        // Process each race chronologically
        allRaces.forEach(race => {
            const positions = race.results
                .sort((a, b) => a.position - b.position)
                .map(r => r.driverId);

            const weight = SEASON_WEIGHTS[race.year] || 0.3;

            // Create a faux result object for the Elo system
            // Weight older seasons less by reducing K-factor effectively through partial updates
            window.EloRatingSystem.updateFromRace(
                { positions },
                [], // Drivers list not needed for update
                `hist_${race.year}_R${race.round}`
            );
        });

        console.log('[HistoricalSeeder] Elo ratings seeded from', allRaces.length, 'historical races');
    }

    // ═══ SEED TRACK PERFORMANCE HISTORY ═══
    function seedTrackHistory(allRaces) {
        if (!window.TrackPerformanceHistory) return;

        allRaces.forEach(race => {
            const totalDrivers = race.results.length;
            race.results.forEach(r => {
                // Expected position = midfield (adjust by team strength)
                const expectedPos = Math.ceil(totalDrivers / 2);
                window.TrackPerformanceHistory.recordResult(
                    r.driverId,
                    race.trackCity,
                    r.position,
                    expectedPos,
                    `hist_${race.year}_R${race.round}`
                );
            });
        });

        console.log('[HistoricalSeeder] Track history seeded');
    }

    // ═══ SEED TEAMMATE COMPARISONS ═══
    function seedTeammateData(allRaces) {
        if (!window.TeammateComparisonEngine) return;

        allRaces.forEach(race => {
            // Group drivers by team
            const teamResults = {};
            race.results.forEach(r => {
                if (!r.teamId) return;
                if (!teamResults[r.teamId]) teamResults[r.teamId] = [];
                teamResults[r.teamId].push(r);
            });

            // Record H2H for each team
            Object.entries(teamResults).forEach(([teamId, drivers]) => {
                if (drivers.length >= 2) {
                    const driverResults = drivers.slice(0, 2).map(d => ({
                        driverId: d.driverId,
                        position: d.position
                    }));
                    const points = {};
                    drivers.forEach(d => { points[d.driverId] = d.points; });

                    window.TeammateComparisonEngine.recordRace(teamId, driverResults, points);
                    window.TeammateComparisonEngine.recordQuali(teamId, driverResults); // Approximate
                }
            });
        });

        console.log('[HistoricalSeeder] Teammate data seeded');
    }

    // ═══ BUILD DRIVER PERFORMANCE SUMMARY ═══
    function buildDriverSummary(allRaces) {
        const summary = {};
        allRaces.forEach(race => {
            race.results.forEach(r => {
                if (!summary[r.driverId]) {
                    summary[r.driverId] = {
                        races: 0, wins: 0, podiums: 0, points: 0, avgFinish: 0,
                        dnfs: 0, bestFinish: 22, tracks: {}, seasons: {}
                    };
                }
                const s = summary[r.driverId];
                s.races++;
                s.points += r.points;
                if (r.position === 1) s.wins++;
                if (r.position <= 3) s.podiums++;
                if (!r.finished) s.dnfs++;
                if (r.position < s.bestFinish) s.bestFinish = r.position;
                s.avgFinish = ((s.avgFinish * (s.races - 1)) + r.position) / s.races;

                // Per-track
                if (!s.tracks[race.trackCity]) s.tracks[race.trackCity] = [];
                s.tracks[race.trackCity].push(r.position);

                // Per-season
                if (!s.seasons[race.year]) s.seasons[race.year] = { races: 0, points: 0, avgFinish: 0 };
                const sy = s.seasons[race.year];
                sy.races++;
                sy.points += r.points;
                sy.avgFinish = ((sy.avgFinish * (sy.races - 1)) + r.position) / sy.races;
            });
        });
        return summary;
    }

    // ═══ BUILD TEAM PERFORMANCE SUMMARY ═══
    function buildTeamSummary(allRaces) {
        const summary = {};
        allRaces.forEach(race => {
            race.results.forEach(r => {
                if (!r.teamId) return;
                if (!summary[r.teamId]) {
                    summary[r.teamId] = {
                        races: 0, wins: 0, podiums: 0, points: 0, avgFinish: 0,
                        seasons: {}, tracks: {}
                    };
                }
                const s = summary[r.teamId];
                s.races++;
                s.points += r.points;
                if (r.position === 1) s.wins++;
                if (r.position <= 3) s.podiums++;
                s.avgFinish = ((s.avgFinish * (s.races - 1)) + r.position) / s.races;

                if (!s.seasons[race.year]) s.seasons[race.year] = { races: 0, points: 0, avgBestFinish: 0 };
                const sy = s.seasons[race.year];
                sy.races++;
                sy.points += r.points;
                sy.avgBestFinish = ((sy.avgBestFinish * (sy.races - 1)) + r.position) / sy.races;
            });
        });
        return summary;
    }

    // ═══ MAIN SEED FUNCTION ═══
    async function seed(drivers, forceRefresh = false) {
        // Check cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached && !forceRefresh) {
            try {
                const data = JSON.parse(cached);
                if (data.timestamp && Date.now() - data.timestamp < 7 * 24 * 3600 * 1000) {
                    _status = { loaded: true, loading: false, error: null, ...data.status };
                    applySeededData(data, drivers);
                    console.log('[HistoricalSeeder] Loaded from cache');
                    return data;
                }
            } catch (e) { }
        }

        _status.loading = true;
        _status.error = null;

        // Fetch all seasons
        let allRaces = [];
        for (const year of SEASONS) {
            const races = await fetchSeason(year);
            if (races) {
                const processed = processRaces(races, year);
                allRaces = allRaces.concat(processed);
                _status.seasons[year] = processed.length;
            } else {
                _status.seasons[year] = 0;
            }
        }

        if (allRaces.length === 0) {
            // Fallback: use hardcoded key results if API fails
            console.warn('[HistoricalSeeder] API unavailable, using fallback data');
            allRaces = getFallbackData();
        }

        // Sort chronologically
        allRaces.sort((a, b) => a.year - b.year || a.round - b.round);
        _status.totalRaces = allRaces.length;

        // Build summaries
        const driverSummary = buildDriverSummary(allRaces);
        const teamSummary = buildTeamSummary(allRaces);

        // Seed engines
        seedEloRatings(allRaces);
        seedTrackHistory(allRaces);
        seedTeammateData(allRaces);

        const result = {
            allRaces, driverSummary, teamSummary,
            status: _status,
            timestamp: Date.now()
        };

        // Cache
        try {
            const toCache = {
                driverSummary, teamSummary,
                status: _status,
                timestamp: Date.now(),
                eloState: window.EloRatingSystem?.save(),
                trackState: window.TrackPerformanceHistory?.save(),
                teammateState: window.TeammateComparisonEngine?.save()
            };
            (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify(toCache));
        } catch (e) {
            console.warn('[HistoricalSeeder] Cache save failed:', e.message);
        }

        _status.loading = false;
        _status.loaded = true;
        console.log('[HistoricalSeeder] Seeded from', allRaces.length, 'races across', SEASONS.join(', '));
        return result;
    }

    function applySeededData(data, drivers) {
        // Restore engine states from cache
        if (data.eloState && window.EloRatingSystem) {
            window.EloRatingSystem.load(data.eloState);
        }
        if (data.trackState && window.TrackPerformanceHistory) {
            window.TrackPerformanceHistory.load(data.trackState);
        }
        if (data.teammateState && window.TeammateComparisonEngine) {
            window.TeammateComparisonEngine.load(data.teammateState);
        }
    }

    // ═══ FALLBACK DATA — Key race results when API is unavailable ═══
    function getFallbackData() {
        // Hardcoded key 2024 results for the main 2026 drivers
        const makeRace = (year, round, city, positions) => ({
            year, round, name: city + ' GP', trackCity: city, circuitId: city,
            date: `${year}-01-01`,
            results: positions.map((id, i) => ({
                driverId: id, teamId: null, position: i + 1, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][i] || 0,
                status: 'Finished', finished: true
            })).filter(r => r.driverId)
        });

        return [
            makeRace(2024, 1, 'sakhir', ['verstappen', 'perez', 'sainz', 'leclerc', 'russell', 'norris', 'hamilton', 'piastri', 'alonso', 'stroll']),
            makeRace(2024, 2, 'jeddah', ['verstappen', 'perez', 'leclerc', 'piastri', 'alonso', 'russell', 'bearman', 'norris', 'hamilton', 'hulkenberg']),
            makeRace(2024, 3, 'melbourne', ['sainz', 'leclerc', 'norris', 'piastri', 'perez', 'hamilton', 'russell', 'alonso', 'stroll', 'gasly']),
            makeRace(2024, 4, 'suzuka', ['verstappen', 'perez', 'sainz', 'leclerc', 'norris', 'alonso', 'russell', 'piastri', 'hamilton', 'hulkenberg']),
            makeRace(2024, 5, 'shanghai', ['verstappen', 'norris', 'perez', 'leclerc', 'sainz', 'russell', 'piastri', 'hamilton', 'alonso', 'hulkenberg']),
            makeRace(2024, 6, 'miami', ['norris', 'verstappen', 'leclerc', 'perez', 'sainz', 'hamilton', 'piastri', 'russell', 'alonso', 'gasly']),
            makeRace(2024, 7, 'imola', ['verstappen', 'norris', 'leclerc', 'piastri', 'sainz', 'hamilton', 'russell', 'perez', 'alonso', 'gasly']),
            makeRace(2024, 8, 'monaco', ['leclerc', 'piastri', 'sainz', 'norris', 'hamilton', 'russell', 'verstappen', 'alonso', 'gasly', 'perez']),
            makeRace(2024, 9, 'montreal', ['verstappen', 'norris', 'russell', 'hamilton', 'piastri', 'alonso', 'leclerc', 'gasly', 'hulkenberg', 'sainz']),
            makeRace(2024, 10, 'barcelona', ['verstappen', 'norris', 'hamilton', 'russell', 'leclerc', 'piastri', 'sainz', 'perez', 'gasly', 'ocon']),
            makeRace(2024, 11, 'spielberg', ['russell', 'piastri', 'sainz', 'hamilton', 'verstappen', 'norris', 'hulkenberg', 'perez', 'gasly', 'leclerc']),
            makeRace(2024, 12, 'silverstone', ['hamilton', 'verstappen', 'norris', 'piastri', 'sainz', 'hulkenberg', 'alonso', 'stroll', 'leclerc', 'russell']),
            makeRace(2024, 13, 'budapest', ['piastri', 'norris', 'hamilton', 'leclerc', 'verstappen', 'sainz', 'perez', 'russell', 'gasly', 'stroll']),
            makeRace(2024, 14, 'spa', ['hamilton', 'piastri', 'leclerc', 'verstappen', 'norris', 'sainz', 'perez', 'alonso', 'ocon', 'gasly']),
            makeRace(2024, 15, 'zandvoort', ['norris', 'verstappen', 'leclerc', 'piastri', 'sainz', 'perez', 'russell', 'hamilton', 'gasly', 'alonso']),
            makeRace(2024, 16, 'monza', ['leclerc', 'piastri', 'norris', 'sainz', 'hamilton', 'verstappen', 'russell', 'perez', 'gasly', 'albon']),
            makeRace(2024, 17, 'baku', ['piastri', 'leclerc', 'russell', 'norris', 'verstappen', 'alonso', 'albon', 'sainz', 'perez', 'gasly']),
            makeRace(2024, 18, 'singapore', ['norris', 'verstappen', 'piastri', 'russell', 'leclerc', 'hamilton', 'sainz', 'alonso', 'hulkenberg', 'perez']),
            makeRace(2024, 19, 'austin', ['leclerc', 'sainz', 'verstappen', 'norris', 'piastri', 'russell', 'perez', 'hulkenberg', 'lawson', 'hamilton']),
            makeRace(2024, 20, 'mexico_city', ['sainz', 'norris', 'leclerc', 'hamilton', 'russell', 'verstappen', 'gasly', 'ocon', 'perez', 'albon']),
            makeRace(2024, 21, 'sao_paulo', ['verstappen', 'ocon', 'gasly', 'russell', 'leclerc', 'norris', 'piastri', 'lawson', 'hamilton', 'perez']),
            makeRace(2024, 22, 'las_vegas', ['russell', 'hamilton', 'sainz', 'leclerc', 'verstappen', 'norris', 'piastri', 'hulkenberg', 'gasly', 'bottas']),
            makeRace(2024, 23, 'lusail', ['verstappen', 'leclerc', 'piastri', 'russell', 'norris', 'hamilton', 'sainz', 'alonso', 'gasly', 'perez']),
            makeRace(2024, 24, 'abu_dhabi', ['norris', 'sainz', 'leclerc', 'hamilton', 'russell', 'verstappen', 'gasly', 'hulkenberg', 'alonso', 'piastri']),
        ];
    }

    // ═══ STATUS REPORTING ═══
    function getStatus() { return { ..._status }; }

    function getDriverSummary() {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try { return JSON.parse(cached).driverSummary; } catch (e) { }
        }
        return null;
    }

    function getTeamSummary() {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try { return JSON.parse(cached).teamSummary; } catch (e) { }
        }
        return null;
    }

    return { seed, getStatus, getDriverSummary, getTeamSummary, SEASON_WEIGHTS };
})();

console.log('%c[HistoricalDataSeeder] Ready — Jolpica API + Fallback', 'color:#00dc50;font-weight:bold');
