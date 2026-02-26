'use strict';
/* ═══════════════════════════════════════════════════════════════
   MARKOV LAP-BY-LAP RACE SIMULATOR — MarkovLapSimulator.js
   
   Replaces single-event race simulation with a full lap-by-lap
   Markov chain model. Each lap is a state transition where:
   - Positions evolve based on pace deltas and gap dynamics
   - Overtakes happen probabilistically per lap
   - Tire degradation compounds exponentially
   - Fuel mass decreases linearly
   - Safety cars bunch the field and reset gaps
   - Pit stops create position shuffles
   
   Integrates with LiveDataEngine for real-time lap state updates.
   ═══════════════════════════════════════════════════════════════ */

window.MarkovLapSimulator = (() => {

    // ─────────────────────────────────────────────────────────────
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────────
    const CONFIG = {
        GAP_CLOSE_RATE: 0.35,       // % of pace delta converted to gap closure per lap
        DRS_SPEED_GAIN: 0.3,        // seconds gained per lap when DRS active
        DRS_ACTIVATION_GAP: 1.0,    // max gap in seconds for DRS activation
        DIRTY_AIR_THRESHOLD: 1.5,   // seconds behind to suffer dirty air
        DIRTY_AIR_PENALTY: 0.15,    // seconds lost per lap in dirty air
        OVERTAKE_BASE_PROB: 0.08,   // base probability per lap when pace > car ahead
        SC_BUNCH_RESET: 0.8,       // gap to leader after SC restart (seconds)
        PIT_STOP_STATIC_LOSS: 22.0, // average pit lane transit time in seconds
        FUEL_KG_PER_LAP: 1.55,     // kg of fuel burned per lap
        FUEL_TIME_PER_KG: 0.035,   // seconds per kg of fuel (lighter = faster)
        TOTAL_FUEL_KG: 110,        // starting fuel load
    };

    // Track overtake difficulty profiles
    const TRACK_OVERTAKE_PROFILES = {
        // format: { zones: number of DRS zones, difficulty: 0-1 (0=easy, 1=hard), scProb: per-lap SC probability }
        'bahrain': { zones: 2, difficulty: 0.25, scProb: 0.01 },
        'jeddah': { zones: 3, difficulty: 0.30, scProb: 0.025 },
        'melbourne': { zones: 2, difficulty: 0.45, scProb: 0.02 },
        'suzuka': { zones: 1, difficulty: 0.55, scProb: 0.015 },
        'shanghai': { zones: 2, difficulty: 0.30, scProb: 0.015 },
        'miami': { zones: 2, difficulty: 0.35, scProb: 0.02 },
        'imola': { zones: 1, difficulty: 0.55, scProb: 0.015 },
        'monaco': { zones: 1, difficulty: 0.92, scProb: 0.03 },
        'montreal': { zones: 2, difficulty: 0.30, scProb: 0.025 },
        'barcelona': { zones: 1, difficulty: 0.50, scProb: 0.01 },
        'spielberg': { zones: 2, difficulty: 0.20, scProb: 0.015 },
        'silverstone': { zones: 2, difficulty: 0.35, scProb: 0.015 },
        'budapest': { zones: 1, difficulty: 0.65, scProb: 0.01 },
        'spa': { zones: 2, difficulty: 0.25, scProb: 0.02 },
        'zandvoort': { zones: 1, difficulty: 0.70, scProb: 0.015 },
        'monza': { zones: 2, difficulty: 0.20, scProb: 0.015 },
        'baku': { zones: 2, difficulty: 0.25, scProb: 0.03 },
        'singapore': { zones: 2, difficulty: 0.55, scProb: 0.035 },
        'austin': { zones: 2, difficulty: 0.30, scProb: 0.02 },
        'mexico': { zones: 2, difficulty: 0.25, scProb: 0.02 },
        'interlagos': { zones: 2, difficulty: 0.25, scProb: 0.025 },
        'las_vegas': { zones: 2, difficulty: 0.25, scProb: 0.02 },
        'lusail': { zones: 2, difficulty: 0.30, scProb: 0.015 },
        'yas_marina': { zones: 2, difficulty: 0.35, scProb: 0.015 },
        'default': { zones: 2, difficulty: 0.40, scProb: 0.018 },
    };

    // ─────────────────────────────────────────────────────────────
    // TIRE DEGRADATION MODEL (per-compound, per-lap)
    // ─────────────────────────────────────────────────────────────
    const TIRE_COMPOUNDS = {
        soft: { baseGrip: 1.00, degRate: 0.045, cliff: 18, peakLap: 2 },
        medium: { baseGrip: 0.97, degRate: 0.028, cliff: 28, peakLap: 3 },
        hard: { baseGrip: 0.93, degRate: 0.018, cliff: 40, peakLap: 5 },
        intermediate: { baseGrip: 0.88, degRate: 0.035, cliff: 25, peakLap: 2 },
        wet: { baseGrip: 0.80, degRate: 0.020, cliff: 35, peakLap: 3 },
    };

    function getTirePace(compound, lapsOnTire, tireSmoothnessSkill) {
        const tire = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.medium;
        const smoothnessMod = tireSmoothnessSkill || 1.0;

        // Exponential degradation with cliff
        let degradation;
        if (lapsOnTire <= tire.peakLap) {
            // Tire is warming up — slight improvement
            degradation = -0.02 * (tire.peakLap - lapsOnTire);
        } else if (lapsOnTire < tire.cliff) {
            // Normal degradation phase
            degradation = tire.degRate * Math.pow(lapsOnTire - tire.peakLap, 1.15) / smoothnessMod;
        } else {
            // Cliff phase — exponential degradation
            const overCliff = lapsOnTire - tire.cliff;
            degradation = tire.degRate * Math.pow(tire.cliff - tire.peakLap, 1.15) / smoothnessMod
                + overCliff * 0.12; // 0.12s per lap penalty after cliff
        }

        return tire.baseGrip - Math.min(degradation * 0.01, 0.15);
    }

    // ─────────────────────────────────────────────────────────────
    // CORE MARKOV LAP SIMULATOR
    // ─────────────────────────────────────────────────────────────

    /**
     * Simulate a full race lap-by-lap using Markov chain state transitions.
     * @param {Object} params
     * @param {Array} params.grid - Starting grid [{driver, gridPos, basePace, compound, tireSmoothnessSkill, pitStrategy}]
     * @param {number} params.totalLaps - Race distance in laps
     * @param {string} params.trackId - Track short name for overtake profile
     * @param {string} params.weather - 'dry' | 'wet' | 'mixed'
     * @param {number} params.scProbability - Overall SC probability for the race
     * @param {Object} params.rng - Seeded RNG instance
     * @param {Object} params.liveState - Optional live race state to start from mid-race
     * @returns {Object} { positions, lapData, events }
     */
    function simulateRace(params) {
        const { grid, totalLaps, trackId, weather, scProbability, rng, liveState } = params;
        const profile = TRACK_OVERTAKE_PROFILES[trackId] || TRACK_OVERTAKE_PROFILES.default;

        // Initialize race state
        const cars = grid.map((g, i) => ({
            driver: g.driver,
            position: g.gridPos || (i + 1),
            gapToLeader: i * 1.2,  // Initial gaps (seconds)
            lapTime: 0,
            basePace: g.basePace || 0.85,
            compound: g.compound || 'medium',
            lapsOnTire: 0,
            fuel: CONFIG.TOTAL_FUEL_KG,
            pitStops: 0,
            pitStrategy: g.pitStrategy || [{ lap: Math.floor(totalLaps * 0.4), compound: 'hard' }],
            tireSmoothnessSkill: g.tireSmoothnessSkill || 1.0,
            dnf: false,
            dnfLap: null,
            totalTime: 0,
            overtakes: 0,
            positionsGained: 0,
        }));

        // If we have live race state, override from current lap
        let startLap = 1;
        if (liveState && liveState.currentLap > 1) {
            startLap = liveState.currentLap;
            cars.forEach(car => {
                const livePos = liveState.positions?.[car.driver.id];
                if (livePos) {
                    car.position = livePos.position || car.position;
                    car.gapToLeader = livePos.gap || car.gapToLeader;
                }
                if (liveState.compounds?.[car.driver.id]) {
                    car.compound = liveState.compounds[car.driver.id];
                }
                if (liveState.lapsOnTire?.[car.driver.id]) {
                    car.lapsOnTire = liveState.lapsOnTire[car.driver.id];
                }
                car.fuel = CONFIG.TOTAL_FUEL_KG - (startLap * CONFIG.FUEL_KG_PER_LAP);
                car.pitStops = liveState.pitStops?.[car.driver.id] || 0;
            });
        }

        const events = [];
        let scActive = false;
        let scLapsRemaining = 0;

        // ─── LAP-BY-LAP MARKOV CHAIN ─────────────────────
        for (let lap = startLap; lap <= totalLaps; lap++) {
            const raceProgress = lap / totalLaps; // 0 → 1

            // Safety Car check
            if (!scActive && rng.next() < profile.scProb * (scProbability / 0.4)) {
                scActive = true;
                scLapsRemaining = Math.floor(rng.next() * 4) + 2; // 2-5 laps
                events.push({ lap, type: 'safety_car', laps: scLapsRemaining });

                // Bunch up the field
                const leader = cars.find(c => c.position === 1 && !c.dnf);
                if (leader) {
                    cars.forEach(c => {
                        if (!c.dnf && c.position > 1) {
                            c.gapToLeader = (c.position - 1) * CONFIG.SC_BUNCH_RESET;
                        }
                    });
                }
            }

            if (scActive) {
                scLapsRemaining--;
                if (scLapsRemaining <= 0) scActive = false;
            }

            // Per-car state transition for this lap
            cars.forEach(car => {
                if (car.dnf) return;

                // Pit stop check
                const shouldPit = car.pitStrategy.some(s => s.lap === lap);
                if (shouldPit) {
                    const strategy = car.pitStrategy.find(s => s.lap === lap);
                    const pitTime = window.PitCrewLiveData?.getTeamPitTime(car.driver.team, rng)
                        ?? (CONFIG.PIT_STOP_STATIC_LOSS + (rng.next() - 0.5) * 3);
                    car.gapToLeader += pitTime;
                    car.compound = strategy?.compound || 'hard';
                    car.lapsOnTire = 0;
                    car.pitStops++;
                    events.push({ lap, type: 'pit', driver: car.driver.id, compound: car.compound, time: pitTime });
                }

                car.lapsOnTire++;
                car.fuel = Math.max(0, car.fuel - CONFIG.FUEL_KG_PER_LAP);

                // Calculate lap time
                const tireGrip = getTirePace(car.compound, car.lapsOnTire, car.tireSmoothnessSkill);
                const fuelEffect = (CONFIG.TOTAL_FUEL_KG - car.fuel) * CONFIG.FUEL_TIME_PER_KG;
                const weatherMod = weather === 'wet' ? 0.92 : weather === 'mixed' ? 0.96 : 1.0;

                if (scActive) {
                    // Under safety car — all cars go slowly, no position changes from pace
                    car.lapTime = 1.4; // normalized slow lap
                } else {
                    car.lapTime = (2 - car.basePace * tireGrip * weatherMod) + fuelEffect * 0.001
                        + (rng.next() - 0.5) * 0.015; // small random variance per lap
                }

                car.totalTime += car.lapTime;
            });

            // Position changes (not during SC)
            if (!scActive) {
                resolveOvertakes(cars, profile, weather, rng, lap, events);
            }

            // DNF check (per-lap probability)
            cars.forEach(car => {
                if (car.dnf) return;
                const dnfProb = 0.0008 + (raceProgress > 0.7 ? 0.0004 : 0); // slightly higher late-race
                if (rng.next() < dnfProb) {
                    car.dnf = true;
                    car.dnfLap = lap;
                    car.totalTime = 99999;
                    events.push({ lap, type: 'dnf', driver: car.driver.id });
                }
            });
        }

        // Final positions
        cars.sort((a, b) => {
            if (a.dnf && !b.dnf) return 1;
            if (!a.dnf && b.dnf) return -1;
            if (a.dnf && b.dnf) return (a.dnfLap || 0) - (b.dnfLap || 0);
            return a.totalTime - b.totalTime;
        });

        cars.forEach((car, i) => {
            car.position = i + 1;
            car.positionsGained = (grid.findIndex(g => g.driver.id === car.driver.id) + 1) - car.position;
        });

        return {
            positions: cars.map(c => ({
                driver: c.driver,
                position: c.position,
                dnf: c.dnf,
                dnfLap: c.dnfLap,
                totalTime: c.totalTime,
                pitStops: c.pitStops,
                overtakes: c.overtakes,
                positionsGained: c.positionsGained,
                finalCompound: c.compound,
            })),
            events,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // OVERTAKE RESOLUTION (per-lap, position-pair basis)
    // ─────────────────────────────────────────────────────────────
    function resolveOvertakes(cars, profile, weather, rng, lap, events) {
        // Sort by current total time to get actual running order
        const running = cars.filter(c => !c.dnf).sort((a, b) => a.totalTime - b.totalTime);

        for (let i = 1; i < running.length; i++) {
            const behind = running[i];
            const ahead = running[i - 1];

            // Calculate gap
            const gap = behind.totalTime - ahead.totalTime;

            // Only attempt overtake if behind car is faster (lower lap time)
            const paceDelta = ahead.lapTime - behind.lapTime;
            if (paceDelta <= 0) continue; // Car ahead is faster, no overtake attempt

            // DRS availability
            const drsActive = gap < CONFIG.DRS_ACTIVATION_GAP && gap > 0;
            const drsZones = profile.zones || 1;

            // Calculate overtake probability
            let overtakeProb = CONFIG.OVERTAKE_BASE_PROB;

            // Pace advantage increases probability
            overtakeProb += paceDelta * 2.5;

            // DRS boost (more zones = more opportunities)
            if (drsActive) {
                overtakeProb += 0.12 * drsZones;
            }

            // Track difficulty reduces probability
            overtakeProb *= (1 - profile.difficulty);

            // Wet weather makes overtaking harder
            if (weather === 'wet') overtakeProb *= 0.6;

            // Tire compound advantage (fresher tires help)
            if (behind.lapsOnTire < ahead.lapsOnTire * 0.5) {
                overtakeProb += 0.05; // significant tire advantage
            }

            // Use OvertakePhysicsEngine if available for more precise calculation
            if (window.OvertakePhysicsEngine) {
                const physicsProb = window.OvertakePhysicsEngine.calculateOvertakeProbability({
                    paceDelta,
                    gap,
                    drsActive,
                    drsZones,
                    trackDifficulty: profile.difficulty,
                    weather,
                    tireDelta: ahead.lapsOnTire - behind.lapsOnTire,
                    lapsRemaining: 0, // not used here
                });
                overtakeProb = (overtakeProb + physicsProb) / 2; // blend both models
            }

            // Clamp probability
            overtakeProb = Math.max(0.01, Math.min(0.65, overtakeProb));

            // Attempt overtake
            if (rng.next() < overtakeProb) {
                // Successful overtake — swap total times slightly
                const tempTime = ahead.totalTime;
                ahead.totalTime = behind.totalTime + 0.3; // car that was ahead drops back
                behind.totalTime = tempTime;
                behind.overtakes++;

                events.push({
                    lap, type: 'overtake',
                    attacker: behind.driver.id,
                    defender: ahead.driver.id,
                    drs: drsActive,
                    prob: overtakeProb.toFixed(3),
                });
            } else if (gap < 0.5 && rng.next() < 0.015) {
                // Very close battle — small incident risk
                ahead.totalTime += 0.5 + rng.next() * 1.5; // time loss from defending
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────
    return {
        simulateRace,
        getTirePace,
        getTrackProfile: (trackId) => TRACK_OVERTAKE_PROFILES[trackId] || TRACK_OVERTAKE_PROFILES.default,
        CONFIG,
    };
})();

console.log('%c[MarkovLapSimulator] Ready — Lap-by-lap Markov chain race simulation', 'color:#f97316;font-weight:bold');
