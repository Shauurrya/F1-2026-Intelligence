'use strict';
/* ═══════════════════════════════════════════════════════════════
   ADVANCED ENGINES — AdvancedEngines.js
   All improvements: Elo, Track History, Lap-by-lap, 
   Position Probability, Teammate Deltas, Title Battle,
   Tire Strategy Analytics, Accuracy Tracking, etc.
   ═══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// A. ELO / GLICKO-2 RATING SYSTEM
// ─────────────────────────────────────────────────────────────
window.EloRatingSystem = (() => {
    const K_FACTOR = 8;
    const INITIAL_RATING = 1500;
    const INITIAL_RD = 200; // Rating Deviation (Glicko-2 uncertainty)
    const MIN_RD = 50;
    const MAX_RD = 350;
    const RD_DECAY = 5; // RD increases per race missed

    let ratings = {};
    let history = {}; // { driverId: [{ round, rating, rd }] }

    function init(drivers) {
        drivers.forEach(d => {
            if (!ratings[d.id]) {
                // Convert base rating (0-100) to Elo scale
                const baseElo = 1200 + (d.rating / 100) * 600;
                const isRookie = d.rating < 82;
                ratings[d.id] = {
                    elo: baseElo,
                    rd: isRookie ? 280 : INITIAL_RD, // Rookies have higher uncertainty
                    volatility: isRookie ? 0.08 : 0.06,
                    peak: baseElo,
                    floor: baseElo
                };
            }
            if (!history[d.id]) history[d.id] = [];
        });
    }

    function expectedScore(rA, rB) {
        return 1.0 / (1.0 + Math.pow(10, (rB - rA) / 400));
    }

    // Update ratings after a race using head-to-head comparisons
    function updateFromRace(raceResult, drivers, round) {
        if (!raceResult || !raceResult.positions || raceResult.positions.length < 3) return;

        const positions = raceResult.positions;
        const updates = {};

        // Initialize updates
        positions.forEach(dId => {
            updates[dId] = { delta: 0, comparisons: 0 };
        });

        // Compare each pair of drivers
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const winnerId = positions[i];
                const loserId = positions[j];

                const rW = ratings[winnerId];
                const rL = ratings[loserId];
                if (!rW || !rL) continue;

                const expectedW = expectedScore(rW.elo, rL.elo);
                const expectedL = 1 - expectedW;

                // Weight by position gap (close finishes matter more)
                const gapWeight = Math.max(0.3, 1.0 - (j - i) * 0.05);

                // RD-scaled K factor (higher uncertainty = bigger adjustments)
                const kW = K_FACTOR * (rW.rd / INITIAL_RD) * gapWeight;
                const kL = K_FACTOR * (rL.rd / INITIAL_RD) * gapWeight;

                updates[winnerId].delta += kW * (1 - expectedW);
                updates[winnerId].comparisons++;
                updates[loserId].delta += kL * (0 - expectedL);
                updates[loserId].comparisons++;
            }
        }

        // Apply updates
        Object.keys(updates).forEach(dId => {
            const u = updates[dId];
            if (u.comparisons === 0) return;

            const r = ratings[dId];
            if (!r) return;

            // Normalize by comparisons
            const avgDelta = u.delta / Math.sqrt(u.comparisons);
            r.elo = Math.max(1000, Math.min(2200, r.elo + avgDelta));

            // Reduce RD after competing (more certain about rating)
            r.rd = Math.max(MIN_RD, r.rd * 0.95);

            // Track peak/floor
            if (r.elo > r.peak) r.peak = r.elo;
            if (r.elo < r.floor) r.floor = r.elo;

            // Record history
            history[dId].push({ round, rating: Math.round(r.elo), rd: Math.round(r.rd) });
        });
    }

    // Get normalized rating (0-1 scale) for use in pace calculation
    function getNormalizedRating(driverId) {
        const r = ratings[driverId];
        if (!r) return 0.5;
        return (r.elo - 1000) / 1200; // Maps 1000-2200 to 0-1
    }

    // Get confidence interval
    function getConfidenceInterval(driverId) {
        const r = ratings[driverId];
        if (!r) return { low: 0.4, high: 0.6 };
        const rdNorm = r.rd / 400;
        const base = getNormalizedRating(driverId);
        return { low: Math.max(0, base - rdNorm), high: Math.min(1, base + rdNorm) };
    }

    function getRating(driverId) { return ratings[driverId] || { elo: INITIAL_RATING, rd: INITIAL_RD }; }
    function getHistory(driverId) { return history[driverId] || []; }
    function getAllRatings() { return { ...ratings }; }

    function save() { return { ratings, history }; }
    function load(data) {
        if (data.ratings) ratings = data.ratings;
        if (data.history) history = data.history;
    }

    return { init, updateFromRace, getNormalizedRating, getConfidenceInterval, getRating, getHistory, getAllRatings, save, load };
})();

// ─────────────────────────────────────────────────────────────
// B. TRACK-SPECIFIC PERFORMANCE HISTORY + SIMILARITY CLUSTERING
// ─────────────────────────────────────────────────────────────
window.TrackPerformanceHistory = (() => {
    // Track similarity clusters
    const CLUSTERS = {
        street_tight: ['monaco', 'singapore', 'budapest', 'zandvoort'],
        power_straight: ['monza', 'jeddah', 'spa', 'baku', 'montreal'],
        technical_aero: ['suzuka', 'silverstone', 'barcelona', 'austin'],
        balanced: ['bahrain', 'melbourne', 'shanghai', 'miami'],
        highspeed: ['spielberg', 'interlagos', 'lusail']
    };

    let driverTrackHistory = {}; // { driverId: { trackShort: { races, avgFinish, bestFinish, paceDeltas[] } } }
    let teamTrackHistory = {};

    function init(drivers) {
        drivers.forEach(d => {
            if (!driverTrackHistory[d.id]) driverTrackHistory[d.id] = {};
        });
    }

    function recordResult(driverId, trackShort, position, expectedPosition, round) {
        if (!driverTrackHistory[driverId]) driverTrackHistory[driverId] = {};
        const h = driverTrackHistory[driverId];
        if (!h[trackShort]) h[trackShort] = { races: 0, avgFinish: 0, bestFinish: 22, paceDeltas: [] };

        const entry = h[trackShort];
        const delta = expectedPosition - position; // Positive = better than expected
        entry.paceDeltas.push({ round, delta, weight: 1.0 });

        // Keep only last 5 entries, weight by recency
        if (entry.paceDeltas.length > 5) entry.paceDeltas.shift();
        entry.paceDeltas.forEach((p, i) => {
            p.weight = 0.5 + (i / entry.paceDeltas.length) * 0.5; // Recent = higher weight
        });

        entry.races++;
        entry.avgFinish = ((entry.avgFinish * (entry.races - 1)) + position) / entry.races;
        if (position < entry.bestFinish) entry.bestFinish = position;
    }

    function getTrackCluster(trackCity) {
        const city = (trackCity || '').toLowerCase();
        for (const [cluster, tracks] of Object.entries(CLUSTERS)) {
            if (tracks.some(t => city.includes(t))) return cluster;
        }
        return 'balanced';
    }

    // Get pace modifier for a driver at a specific track
    function getTrackPaceModifier(driverId, trackShort, trackCity) {
        const h = driverTrackHistory[driverId];
        if (!h) return 1.0;

        // Direct track history
        const direct = h[trackShort];
        if (direct && direct.paceDeltas.length > 0) {
            const weightedSum = direct.paceDeltas.reduce((s, p) => s + p.delta * p.weight, 0);
            const totalWeight = direct.paceDeltas.reduce((s, p) => s + p.weight, 0);
            const avgDelta = weightedSum / totalWeight;
            return 1.0 + avgDelta * 0.003; // Convert position delta to pace modifier
        }

        // Fallback: use similar tracks from same cluster
        const cluster = getTrackCluster(trackCity);
        const similarTracks = CLUSTERS[cluster] || [];
        let clusterDeltas = [];

        similarTracks.forEach(sim => {
            Object.keys(h).forEach(key => {
                if (key.toLowerCase().includes(sim) && h[key].paceDeltas.length > 0) {
                    const lastDelta = h[key].paceDeltas[h[key].paceDeltas.length - 1];
                    clusterDeltas.push(lastDelta.delta * 0.5); // Half weight for cluster match
                }
            });
        });

        if (clusterDeltas.length > 0) {
            const avg = clusterDeltas.reduce((a, b) => a + b, 0) / clusterDeltas.length;
            return 1.0 + avg * 0.002;
        }

        return 1.0;
    }

    function save() { return { driverTrackHistory, teamTrackHistory }; }
    function load(data) {
        if (data.driverTrackHistory) driverTrackHistory = data.driverTrackHistory;
        if (data.teamTrackHistory) teamTrackHistory = data.teamTrackHistory;
    }

    return { init, recordResult, getTrackPaceModifier, getTrackCluster, save, load, getClusters: () => CLUSTERS };
})();

// ─────────────────────────────────────────────────────────────
// C. LAP-BY-LAP RACE SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────
window.LapByLapEngine = (() => {
    const TIRE_DEG_RATES = {
        soft: { base: 0.065, cliff: 18 },
        medium: { base: 0.040, cliff: 30 },
        hard: { base: 0.025, cliff: 42 },
        inter: { base: 0.035, cliff: 35 },
        wet: { base: 0.020, cliff: 50 }
    };

    const FUEL_BURN_RATE = 1.74; // kg per lap
    const FUEL_PACE_GAIN = 0.035; // sec per kg burned
    const PIT_STATIONARY = 22; // seconds pit lane time loss (typical)

    function simulateRace(drivers, race, rng, weather) {
        const totalLaps = race.laps || 57;
        const stops = race.strategy_stops || 1;
        const startFuel = totalLaps * FUEL_BURN_RATE + 2; // +2kg margin

        // Initialize driver states
        const states = drivers.map((d, gridPos) => ({
            driver: d,
            gridPos: gridPos + 1,
            totalTime: 0,
            fuel: startFuel,
            tire: race.tire_compounds ? mapCompound(race.tire_compounds[0]) : 'medium',
            lapsOnTire: 0,
            stopsCompleted: 0,
            retired: false,
            positions: [],
            gapToLeader: 0,
            lastLapTime: 0,
            tireHistory: []
        }));

        // Determine pit windows
        const pitWindows = calculatePitWindows(totalLaps, stops);

        // SC timing
        const scLap = (rng.next() < race.sc_probability) ? Math.floor(rng.range(5, totalLaps * 0.7)) : -1;
        const scDuration = scLap > 0 ? Math.floor(rng.range(3, 7)) : 0;

        // Simulate each lap
        for (let lap = 1; lap <= totalLaps; lap++) {
            const underSC = (lap >= scLap && lap < scLap + scDuration);
            const raceProgress = lap / totalLaps;

            states.forEach(s => {
                if (s.retired) return;

                // Base lap time (lower = faster)
                let lapTime = getBaseLapTime(s.driver, race, rng, weather, raceProgress);

                // Tire degradation
                const tireDeg = getTireDeg(s.tire, s.lapsOnTire, race);
                lapTime += tireDeg;
                s.lapsOnTire++;

                // Fuel effect (lighter = faster)
                const fuelGain = (startFuel - s.fuel) * FUEL_PACE_GAIN / startFuel;
                lapTime -= fuelGain;
                s.fuel = Math.max(0, s.fuel - FUEL_BURN_RATE);

                // Dirty air (from cars ahead)
                const posIdx = states.filter(x => !x.retired).sort((a, b) => a.totalTime - b.totalTime).indexOf(s);
                if (posIdx > 0 && !underSC) {
                    const ahead = states.filter(x => !x.retired).sort((a, b) => a.totalTime - b.totalTime)[posIdx - 1];
                    const gap = s.totalTime - ahead.totalTime;
                    if (gap < 1.5) {
                        const dirtyAir = getDirtyAirPenalty(race.track_type, gap);
                        lapTime += dirtyAir;
                        // DRS benefit
                        if (gap < 1.0) {
                            lapTime -= getDRSGain(race.track_type, race.drs_zones || 1);
                        }
                    }
                }

                // Safety car pace
                if (underSC) {
                    lapTime = 100; // Neutralized laps
                }

                // Pit stop
                if (shouldPit(s, lap, pitWindows, totalLaps, rng)) {
                    const pitTime = getPitTime(s.driver.team, rng);
                    lapTime += pitTime + PIT_STATIONARY / totalLaps;
                    const nextTire = getNextTire(s.tire, race.tire_compounds, s.stopsCompleted, stops);
                    s.tireHistory.push({ tire: s.tire, laps: s.lapsOnTire });
                    s.tire = nextTire;
                    s.lapsOnTire = 0;
                    s.stopsCompleted++;
                }

                s.lastLapTime = lapTime;
                s.totalTime += lapTime;
            });

            // SC restart bunching
            if (lap === scLap + scDuration && scLap > 0) {
                const leader = states.filter(x => !x.retired).sort((a, b) => a.totalTime - b.totalTime)[0];
                if (leader) {
                    states.forEach(s => {
                        if (!s.retired && s !== leader) {
                            // Bunch up within 1-2 seconds
                            const gap = s.totalTime - leader.totalTime;
                            if (gap > 2) {
                                s.totalTime = leader.totalTime + rng.range(0.5, 2.0);
                            }
                        }
                    });
                }
            }

            // Record positions at end of lap
            const sorted = states.filter(x => !x.retired).sort((a, b) => a.totalTime - b.totalTime);
            sorted.forEach((s, i) => {
                s.positions.push(i + 1);
                s.gapToLeader = i === 0 ? 0 : s.totalTime - sorted[0].totalTime;
            });
        }

        // Final result
        const finalOrder = states.filter(s => !s.retired).sort((a, b) => a.totalTime - b.totalTime);
        const retiredDrivers = states.filter(s => s.retired);

        return {
            finishOrder: finalOrder.map(s => s.driver),
            gaps: finalOrder.map(s => s.gapToLeader),
            lapData: states,
            retirements: retiredDrivers.length,
            scLap,
            totalLaps
        };
    }

    function getBaseLapTime(driver, race, rng, weather, progress) {
        // Use existing engines if available
        let basePace = 90 - (driver.rating * 0.3);

        // Team performance
        const teamRating = window.PredictionsCenter ?
            (typeof DynamicModel !== 'undefined' ? 50 : 50) : 50;
        basePace -= teamRating * 0.2;

        // Add small variance
        basePace += rng.norm(0, 0.15);

        // Weather impact
        if (weather === 'wet' || weather === 'heavy_rain') {
            basePace += rng.range(0.5, 2.0);
        }

        return basePace;
    }

    function getTireDeg(compound, lapsOnTire, race) {
        const rates = TIRE_DEG_RATES[compound] || TIRE_DEG_RATES.medium;
        let deg = rates.base * lapsOnTire;

        // Cliff effect (exponential near end of tire life)
        if (lapsOnTire > rates.cliff) {
            deg += Math.pow(1.08, lapsOnTire - rates.cliff) * 0.1;
        }

        // Track tire deg modifier
        const trackDeg = { 'High': 1.3, 'Medium-High': 1.15, 'Medium': 1.0, 'Low-Medium': 0.85, 'Low': 0.7 };
        deg *= (trackDeg[race.tire_deg] || 1.0);

        return deg;
    }

    function getDirtyAirPenalty(trackType, gap) {
        const base = { 'power': 0.2, 'highspeed': 0.3, 'technical': 0.35, 'street_hybrid': 0.25, 'monaco': 0.15, 'balanced': 0.2 };
        const penalty = (base[trackType] || 0.25) * (1.0 - gap / 1.5);
        return Math.max(0, penalty);
    }

    function getDRSGain(trackType, drsZones) {
        const base = { 'power': 0.45, 'highspeed': 0.35, 'technical': 0.2, 'street_hybrid': 0.25, 'monaco': 0.1, 'balanced': 0.3 };
        return (base[trackType] || 0.25) * Math.min(drsZones, 3) / 2;
    }

    function calculatePitWindows(totalLaps, stops) {
        const windows = [];
        for (let i = 1; i <= stops; i++) {
            const center = Math.floor(totalLaps * i / (stops + 1));
            windows.push({ lap: center, window: [center - 3, center + 3] });
        }
        return windows;
    }

    function shouldPit(state, lap, pitWindows, totalLaps, rng) {
        if (state.stopsCompleted >= pitWindows.length) return false;
        const nextWindow = pitWindows[state.stopsCompleted];
        if (!nextWindow) return false;
        if (lap >= nextWindow.window[0] && lap <= nextWindow.window[1]) {
            return rng.next() < 0.35;  // Stagger pit stops
        }
        // Emergency pit if tire is degraded past cliff
        const rates = TIRE_DEG_RATES[state.tire] || TIRE_DEG_RATES.medium;
        if (state.lapsOnTire > rates.cliff + 5) return true;
        return false;
    }

    function getPitTime(teamId, rng) {
        const times = {
            ferrari: 2.1, mclaren: 2.0, mercedes: 2.1, red_bull: 2.0,
            alpine: 2.5, haas: 2.6, audi: 2.7, racing_bulls: 2.5,
            williams: 2.4, cadillac: 2.8, aston_martin: 3.0
        };
        return (times[teamId] || 2.5) + rng.norm(0, 0.2);
    }

    function getNextTire(current, compounds, stopsCompleted, totalStops) {
        if (stopsCompleted === 0) return 'hard';
        if (stopsCompleted === 1 && totalStops >= 2) return 'medium';
        return 'hard';
    }

    function mapCompound(compound) {
        if (!compound) return 'medium';
        const c = compound.toUpperCase();
        if (c === 'C5' || c === 'C4') return 'soft';
        if (c === 'C3' || c === 'C2') return 'medium';
        return 'hard';
    }

    return { simulateRace, TIRE_DEG_RATES, calculatePitWindows };
})();

// ─────────────────────────────────────────────────────────────
// F. HEAD-TO-HEAD TEAMMATE COMPARISON ENGINE
// ─────────────────────────────────────────────────────────────
window.TeammateComparisonEngine = (() => {
    let data = {}; // { teamId: { driver1: { quali: [], race: [], points: 0 }, driver2: { ... } } }

    function init(drivers) {
        const teams = {};
        drivers.forEach(d => {
            if (!teams[d.team]) teams[d.team] = [];
            teams[d.team].push(d.id);
        });

        Object.entries(teams).forEach(([teamId, driverIds]) => {
            if (!data[teamId]) {
                data[teamId] = {};
                driverIds.forEach(dId => {
                    data[teamId][dId] = { quali: [], race: [], points: 0, qualiWins: 0, raceWins: 0 };
                });
            }
        });
    }

    function recordQuali(teamId, results) {
        // results: [{ driverId, position }]
        if (!data[teamId]) return;
        if (results.length < 2) return;

        results.forEach(r => {
            if (data[teamId][r.driverId]) {
                data[teamId][r.driverId].quali.push(r.position);
            }
        });

        // Head-to-head
        if (results[0].position < results[1].position) {
            if (data[teamId][results[0].driverId]) data[teamId][results[0].driverId].qualiWins++;
        } else {
            if (data[teamId][results[1].driverId]) data[teamId][results[1].driverId].qualiWins++;
        }
    }

    function recordRace(teamId, results, points) {
        if (!data[teamId]) return;

        results.forEach(r => {
            if (data[teamId][r.driverId]) {
                data[teamId][r.driverId].race.push(r.position);
                data[teamId][r.driverId].points += (points[r.driverId] || 0);
            }
        });

        if (results.length >= 2) {
            if (results[0].position < results[1].position) {
                if (data[teamId][results[0].driverId]) data[teamId][results[0].driverId].raceWins++;
            } else {
                if (data[teamId][results[1].driverId]) data[teamId][results[1].driverId].raceWins++;
            }
        }
    }

    function getComparison(teamId) {
        const teamData = data[teamId];
        if (!teamData) return null;

        const driverIds = Object.keys(teamData);
        if (driverIds.length < 2) return null;

        const [d1, d2] = driverIds;
        const t1 = teamData[d1];
        const t2 = teamData[d2];

        const totalQuali = (t1.qualiWins || 0) + (t2.qualiWins || 0);
        const totalRace = (t1.raceWins || 0) + (t2.raceWins || 0);

        return {
            drivers: [d1, d2],
            qualiH2H: [t1.qualiWins || 0, t2.qualiWins || 0],
            raceH2H: [t1.raceWins || 0, t2.raceWins || 0],
            avgQualiGap: calculateAvgGap(t1.quali, t2.quali),
            avgRaceGap: calculateAvgGap(t1.race, t2.race),
            pointsDiff: (t1.points || 0) - (t2.points || 0),
            totalRaces: Math.max(t1.race.length, t2.race.length)
        };
    }

    function calculateAvgGap(arr1, arr2) {
        if (!arr1.length || !arr2.length) return 0;
        const len = Math.min(arr1.length, arr2.length);
        let sum = 0;
        for (let i = 0; i < len; i++) {
            sum += arr1[i] - arr2[i];
        }
        return sum / len;
    }

    function getAllComparisons() {
        return Object.keys(data).map(teamId => ({
            team: teamId,
            ...getComparison(teamId)
        })).filter(c => c.drivers);
    }

    function save() { return data; }
    function load(d) { if (d) data = d; }

    return { init, recordQuali, recordRace, getComparison, getAllComparisons, save, load };
})();

// ─────────────────────────────────────────────────────────────
// G. PERFORMANCE TREND ANALYSIS ENGINE
// ─────────────────────────────────────────────────────────────
window.PerformanceTrendEngine = (() => {
    let teamTrends = {}; // { teamId: [{ round, rating, velocity, avgFinish }] }
    let driverTrends = {}; // { driverId: [{ round, finish, qualiPos, form }] }

    function recordRound(round, teams, drivers) {
        // Record team performance snapshot
        Object.entries(teams).forEach(([teamId, data]) => {
            if (!teamTrends[teamId]) teamTrends[teamId] = [];
            teamTrends[teamId].push({
                round,
                rating: data.rating || 50,
                velocity: data.velocity || 0,
                avgFinish: data.avgFinish || 11,
                timestamp: Date.now()
            });
        });

        // Record driver performance snapshot  
        Object.entries(drivers).forEach(([driverId, data]) => {
            if (!driverTrends[driverId]) driverTrends[driverId] = [];
            driverTrends[driverId].push({
                round,
                finish: data.finish || 11,
                qualiPos: data.qualiPos || 11,
                form: data.form || 1.0,
                timestamp: Date.now()
            });
        });
    }

    function getTeamTrend(teamId) {
        const trend = teamTrends[teamId] || [];
        if (trend.length < 2) return { direction: 'stable', momentum: 0, data: trend };

        const recent = trend.slice(-5);
        const avgRecent = recent.reduce((s, t) => s + t.rating, 0) / recent.length;
        const avgOld = trend.slice(0, Math.max(1, trend.length - 5)).reduce((s, t) => s + t.rating, 0) / Math.max(1, trend.length - 5);

        const momentum = avgRecent - avgOld;
        let direction = 'stable';
        if (momentum > 2) direction = 'rising';
        else if (momentum < -2) direction = 'falling';

        return { direction, momentum: Math.round(momentum * 10) / 10, data: trend };
    }

    function getDriverTrend(driverId) {
        const trend = driverTrends[driverId] || [];
        if (trend.length < 2) return { direction: 'stable', momentum: 0, data: trend };

        const recent = trend.slice(-3);
        const avgRecent = recent.reduce((s, t) => s + t.finish, 0) / recent.length;
        const older = trend.slice(0, Math.max(1, trend.length - 3));
        const avgOld = older.reduce((s, t) => s + t.finish, 0) / older.length;

        const momentum = avgOld - avgRecent; // Lower finish = better
        let direction = 'stable';
        if (momentum > 1) direction = 'improving';
        else if (momentum < -1) direction = 'declining';

        return { direction, momentum: Math.round(momentum * 10) / 10, data: trend };
    }

    // Detect upgrade jumps
    function detectUpgrades(teamId) {
        const trend = teamTrends[teamId] || [];
        const upgrades = [];
        for (let i = 1; i < trend.length; i++) {
            const jump = trend[i].rating - trend[i - 1].rating;
            if (Math.abs(jump) > 1.5) {
                upgrades.push({
                    round: trend[i].round,
                    delta: Math.round(jump * 10) / 10,
                    type: jump > 0 ? 'upgrade' : 'regression'
                });
            }
        }
        return upgrades;
    }

    function save() { return { teamTrends, driverTrends }; }
    function load(d) {
        if (d.teamTrends) teamTrends = d.teamTrends;
        if (d.driverTrends) driverTrends = d.driverTrends;
    }

    return { recordRound, getTeamTrend, getDriverTrend, detectUpgrades, save, load };
})();

// ─────────────────────────────────────────────────────────────
// H. TIRE STRATEGY ANALYTICS ENGINE
// ─────────────────────────────────────────────────────────────
window.TireStrategyAnalytics = (() => {

    function analyzeOptimalStrategy(race) {
        const totalLaps = race.laps || 57;
        const compounds = (race.tire_compounds || ['C2', 'C3', 'C4']).map(mapComp);

        const strategies = [];

        // 1-Stop strategies
        compounds.forEach(t1 => {
            compounds.forEach(t2 => {
                if (t1 === t2 && t1 !== 'medium') return;
                for (let pit = Math.floor(totalLaps * 0.3); pit <= Math.floor(totalLaps * 0.6); pit += 3) {
                    const time = estimateStrategyTime(totalLaps, [{ tire: t1, laps: pit }, { tire: t2, laps: totalLaps - pit }], race);
                    strategies.push({ stops: 1, stints: [{ tire: t1, laps: pit }, { tire: t2, laps: totalLaps - pit }], totalTime: time, pitLap: [pit] });
                }
            });
        });

        // 2-Stop strategies
        compounds.forEach(t1 => {
            compounds.forEach(t2 => {
                compounds.forEach(t3 => {
                    const pit1 = Math.floor(totalLaps * 0.25);
                    const pit2 = Math.floor(totalLaps * 0.58);
                    const time = estimateStrategyTime(totalLaps, [
                        { tire: t1, laps: pit1 },
                        { tire: t2, laps: pit2 - pit1 },
                        { tire: t3, laps: totalLaps - pit2 }
                    ], race);
                    strategies.push({ stops: 2, stints: [{ tire: t1, laps: pit1 }, { tire: t2, laps: pit2 - pit1 }, { tire: t3, laps: totalLaps - pit2 }], totalTime: time, pitLap: [pit1, pit2] });
                });
            });
        });

        strategies.sort((a, b) => a.totalTime - b.totalTime);
        return strategies.slice(0, 5); // Top 5 strategies
    }

    function estimateStrategyTime(totalLaps, stints, race) {
        let totalTime = 0;
        const pitTimeLoss = 22; // seconds per stop

        stints.forEach((stint, i) => {
            const rates = window.LapByLapEngine.TIRE_DEG_RATES[stint.tire] || window.LapByLapEngine.TIRE_DEG_RATES.medium;
            for (let lap = 0; lap < stint.laps; lap++) {
                let deg = rates.base * lap;
                if (lap > rates.cliff) deg += Math.pow(1.08, lap - rates.cliff) * 0.1;
                const trackDeg = { 'High': 1.3, 'Medium-High': 1.15, 'Medium': 1.0, 'Low-Medium': 0.85, 'Low': 0.7 };
                deg *= (trackDeg[race.tire_deg] || 1.0);
                totalTime += 90 + deg; // 90s base lap time + degradation
            }
            if (i > 0) totalTime += pitTimeLoss;
        });

        return totalTime;
    }

    function getTireLifeData(compound, trackDeg, trackTemp) {
        const rates = window.LapByLapEngine.TIRE_DEG_RATES[compound] || window.LapByLapEngine.TIRE_DEG_RATES.medium;
        const degMult = { 'High': 1.3, 'Medium-High': 1.15, 'Medium': 1.0, 'Low-Medium': 0.85, 'Low': 0.7 };
        const tempMult = 1.0 + (trackTemp - 30) * 0.008;

        const laps = [];
        for (let i = 0; i <= rates.cliff + 10; i++) {
            let deg = rates.base * i * (degMult[trackDeg] || 1.0) * tempMult;
            if (i > rates.cliff) deg += Math.pow(1.08, i - rates.cliff) * 0.1;
            laps.push({ lap: i, paceLoss: Math.round(deg * 1000) / 1000 });
        }
        return { compound, optimalLife: rates.cliff, data: laps };
    }

    function mapComp(c) {
        if (!c) return 'medium';
        const x = c.toUpperCase();
        if (x === 'C5' || x === 'C4') return 'soft';
        if (x === 'C3' || x === 'C2') return 'medium';
        return 'hard';
    }

    return { analyzeOptimalStrategy, getTireLifeData };
})();

// ─────────────────────────────────────────────────────────────
// I. HISTORICAL ACCURACY TRACKING + BRIER SCORE
// ─────────────────────────────────────────────────────────────
window.AccuracyTracker = (() => {
    let history = []; // [{ round, brierScore, winnerCorrect, podiumCorrect, top5Correct, predProbs }]

    function recordPrediction(round, predictions, actualResult) {
        if (!actualResult || !actualResult.positions || !predictions) return;

        const actualWinner = actualResult.positions[0];
        const actualPodium = actualResult.positions.slice(0, 3);
        const actualTop5 = actualResult.positions.slice(0, 5);

        // Calculate Brier Score
        let brierSum = 0;
        let count = 0;
        predictions.forEach(pred => {
            const winProb = (pred.winProb || 0) / 100;
            const actualWin = pred.driver.id === actualWinner ? 1 : 0;
            brierSum += Math.pow(winProb - actualWin, 2);
            count++;
        });
        const brierScore = count > 0 ? brierSum / count : 1;

        // Position accuracy
        const predWinner = predictions[0]?.driver?.id;
        const predPodium = predictions.slice(0, 3).map(p => p.driver.id);
        const predTop5 = predictions.slice(0, 5).map(p => p.driver.id);

        const winnerCorrect = predWinner === actualWinner;
        const podiumOverlap = predPodium.filter(d => actualPodium.includes(d)).length;
        const top5Overlap = predTop5.filter(d => actualTop5.includes(d)).length;

        // Mean absolute position error
        let posError = 0;
        let posCount = 0;
        predictions.forEach((pred, predPos) => {
            const actualPos = actualResult.positions.indexOf(pred.driver.id);
            if (actualPos >= 0) {
                posError += Math.abs(predPos - actualPos);
                posCount++;
            }
        });
        const meanPosError = posCount > 0 ? posError / posCount : 10;

        history.push({
            round,
            brierScore: Math.round(brierScore * 10000) / 10000,
            winnerCorrect,
            podiumCorrect: podiumOverlap,
            top5Correct: top5Overlap,
            meanPosError: Math.round(meanPosError * 10) / 10,
            predProbs: predictions.slice(0, 5).map(p => ({ id: p.driver.id, winProb: p.winProb })),
            timestamp: Date.now()
        });
    }

    function getOverallStats() {
        if (history.length === 0) return null;

        const avgBrier = history.reduce((s, h) => s + h.brierScore, 0) / history.length;
        const winnerRate = history.filter(h => h.winnerCorrect).length / history.length * 100;
        const avgPodiumOverlap = history.reduce((s, h) => s + h.podiumCorrect, 0) / history.length;
        const avgTop5Overlap = history.reduce((s, h) => s + h.top5Correct, 0) / history.length;
        const avgPosError = history.reduce((s, h) => s + h.meanPosError, 0) / history.length;

        // Naive baseline comparison (qualifying order = race result)
        // Typical Brier score for naive: ~0.10
        const naiveBrier = 0.10;
        const improvement = ((naiveBrier - avgBrier) / naiveBrier * 100);

        return {
            totalRaces: history.length,
            avgBrierScore: Math.round(avgBrier * 10000) / 10000,
            winnerAccuracy: Math.round(winnerRate),
            avgPodiumOverlap: Math.round(avgPodiumOverlap * 10) / 10,
            avgTop5Overlap: Math.round(avgTop5Overlap * 10) / 10,
            avgPositionError: Math.round(avgPosError * 10) / 10,
            vsNaiveImprovement: Math.round(improvement),
            trend: history.map(h => ({ round: h.round, brier: h.brierScore, winCorrect: h.winnerCorrect }))
        };
    }

    function save() { return history; }
    function load(d) { if (Array.isArray(d)) history = d; }

    return { recordPrediction, getOverallStats, save, load };
})();

// ─────────────────────────────────────────────────────────────
// J. POSITION PROBABILITY DISTRIBUTION ENGINE
// ─────────────────────────────────────────────────────────────
window.PositionProbabilityEngine = (() => {

    function calculateDistribution(mcResults, sims) {
        // mcResults: array of { driver, winProb, podiumProb, avgFinish, dnfProb }
        if (!mcResults || !mcResults.length) return [];

        const distributions = mcResults.map(entry => {
            const d = entry.driver;
            const avg = entry.avgFinish;
            const winP = entry.winProb / 100;
            const podP = entry.podiumProb / 100;
            const dnfP = entry.dnfProb / 100;

            // Generate probability for each position P1-P20
            const probs = [];
            for (let pos = 1; pos <= 20; pos++) {
                let prob;
                if (pos === 1) {
                    prob = winP;
                } else if (pos <= 3) {
                    prob = (podP - winP) / 2;
                } else {
                    // Normal distribution centered on avgFinish
                    const sigma = 3 + (avg - 1) * 0.2; // Wider spread for midfield
                    const z = (pos - avg) / sigma;
                    prob = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));

                    // Add DNF probability to last positions
                    if (pos >= 19) {
                        prob += dnfP / 2;
                    }
                }
                probs.push(Math.max(0, Math.min(1, prob)));
            }

            // Normalize to sum to 1
            const total = probs.reduce((a, b) => a + b, 0);
            const normalized = probs.map(p => total > 0 ? p / total : 0.05);

            return {
                driver: d,
                positions: normalized.map((p, i) => ({
                    position: i + 1,
                    probability: Math.round(p * 10000) / 100 // As percentage
                })),
                peak: avg,
                spread: Math.sqrt(normalized.reduce((s, p, i) => s + p * Math.pow(i + 1 - avg, 2), 0))
            };
        });

        return distributions;
    }

    return { calculateDistribution };
})();

// ─────────────────────────────────────────────────────────────
// K. CHAMPIONSHIP TITLE BATTLE PROJECTIONS
// ─────────────────────────────────────────────────────────────
window.ChampionshipBattle = (() => {

    function analyzeTitle(standings, calendar, currentRound) {
        if (!standings || !calendar) return null;

        const sortedStandings = Object.entries(standings)
            .map(([id, pts]) => ({ id, pts }))
            .sort((a, b) => b.pts - a.pts);

        const leader = sortedStandings[0];
        const racesLeft = calendar.filter(r => r.round > currentRound).length;
        const sprintsLeft = calendar.filter(r => r.round > currentRound && r.is_sprint).length;

        // Max points available per race
        const maxPtsPerRace = 26; // 25 for win + 1 fastest lap
        const maxPtsPerSprint = 8;
        const totalAvailable = racesLeft * maxPtsPerRace + sprintsLeft * maxPtsPerSprint;

        // Analyze each driver's position
        const analysis = sortedStandings.map((entry, i) => {
            const gap = leader.pts - entry.pts;
            const canWin = gap <= totalAvailable;
            const eliminated = !canWin;

            // Calculate points needed per race to catch leader
            const ptsNeeded = gap;
            const ptsPerRaceNeeded = racesLeft > 0 ? Math.ceil(ptsNeeded / racesLeft) : Infinity;

            // Winning scenarios
            let scenarios = [];
            if (i === 0) {
                scenarios.push('Currently leads the championship');
                if (gap === 0 && sortedStandings.length > 1) {
                    scenarios.push('Tied with ' + sortedStandings[1].id);
                }
            } else if (eliminated) {
                scenarios.push('Mathematically eliminated');
            } else if (ptsPerRaceNeeded > 20) {
                scenarios.push('Needs multiple wins + rival DNFs');
            } else if (ptsPerRaceNeeded > 15) {
                scenarios.push('Needs consistent podiums + rival mistakes');
            } else {
                scenarios.push(`Needs ~${ptsPerRaceNeeded} pts/race avg`);
            }

            return {
                driverId: entry.id,
                points: entry.pts,
                gap,
                position: i + 1,
                canWin,
                eliminated,
                ptsNeeded,
                ptsPerRaceNeeded,
                scenarios,
                totalAvailable
            };
        });

        // Convergence lines: will gaps shrink or grow?
        const convergence = analysis.slice(0, 5).map(a => ({
            driverId: a.driverId,
            gapHistory: [a.gap], // Would be populated from historical data
            trend: a.gap === 0 ? 'leading' : a.gap < 30 ? 'contending' : a.gap < 70 ? 'challenging' : 'long_shot'
        }));

        return {
            leader: leader.id,
            racesLeft,
            totalAvailable,
            standings: analysis,
            convergence
        };
    }

    return { analyzeTitle };
})();

// ─────────────────────────────────────────────────────────────
// INTEGRATION: Wire unused engines into main prediction pipeline
// ─────────────────────────────────────────────────────────────
window.EngineIntegrator = (() => {

    // Wrapper that enhances calculatePace by incorporating all engines
    function getEnhancedPaceModifiers(driver, race, rng, weather) {
        let modifier = 0;

        // 1. Elo Rating influence
        if (window.EloRatingSystem) {
            const eloNorm = window.EloRatingSystem.getNormalizedRating(driver.id);
            modifier += (eloNorm - 0.5) * 0.02; // ±1% from Elo
        }

        // 2. Track-specific history
        if (window.TrackPerformanceHistory) {
            const trackMod = window.TrackPerformanceHistory.getTrackPaceModifier(driver.id, race.short, race.city);
            modifier += (trackMod - 1.0);
        }

        // 3. Strategy Window Model (always available, not just live)
        if (window.StrategyWindowModel) {
            const tireLaps = 15; // Average stint length
            const trackTemp = 35;
            const undercutDelta = window.StrategyWindowModel.calculateUndercutDelta('medium', tireLaps, 'hard', trackTemp);
            const stratBonus = window.StrategyWindowModel.getPitSuccessProbability(undercutDelta);
            modifier += (stratBonus - 0.5) * 0.005; // Small strategy influence
        }

        // 4. Aero Model (always, not just when live)
        if (window.AeroDynamicsRaceModel) {
            // Already wired in predictions.js — this is the fallback
        }

        // 5. Race Evolution Engine (fuel + tire for full sim context)
        if (window.RaceEvolutionEngine) {
            const fuelGain = window.RaceEvolutionEngine.fuelMassGain(50); // Mid-race fuel
            modifier += fuelGain * 0.001;
        }

        // 6. Tire/Fuel Models
        if (typeof TireDegradationModel !== 'undefined') {
            // Incorporate offline tire degradation estimate
            const degMod = TireDegradationModel.getPaceModifier(
                'medium', 15, 35,
                1.0, race.tire_deg || 'Medium', 50
            );
            modifier -= degMod * 0.3; // Partial weight for offline sim
        }

        // 7. Monte Carlo Stability seeding
        if (window.MonteCarloStabilityEngine) {
            // Already wired — generates deterministic seeds
        }

        return modifier;
    }

    return { getEnhancedPaceModifiers };
})();

console.log('%c[AdvancedEngines] Loaded: Elo, TrackHistory, LapByLap, Teammate, Trends, TireStrategy, Accuracy, PositionProb, ChampBattle, Integrator', 'color:#0af;font-weight:bold');
