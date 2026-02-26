'use strict';
/* ═══════════════════════════════════════════════════════════════
   PIT CREW LIVE DATA ENGINE — PitCrewLiveData.js
   
   Fetches actual pit stop times from OpenF1 /pit endpoint and
   builds per-team statistical distributions (mean, stddev).
   Replaces static hardcoded pit crew averages.
   
   During live races: fetches pit data every 30s
   Between races: loads season-long pit data for all teams
   ═══════════════════════════════════════════════════════════════ */

window.PitCrewLiveData = (() => {

    const API_BASE = 'https://api.openf1.org/v1';
    const STORAGE_KEY = 'f1_pit_crew_data_v1';

    // ── STATE ──
    const state = {
        teamStats: {},      // { teamId: { mean, stddev, count, best, worst, times[] } }
        lastFetch: null,
        sessionKey: null,
        initialized: false,
    };

    // Driver number → team ID mapping (2026 grid)
    const DRIVER_TEAM_MAP = {
        16: 'ferrari', 44: 'ferrari',
        4: 'mclaren', 81: 'mclaren',
        12: 'mercedes', 63: 'mercedes',
        1: 'red_bull', 6: 'red_bull',
        10: 'alpine', 43: 'alpine',
        87: 'haas', 31: 'haas',
        5: 'audi', 27: 'audi',
        30: 'racing_bulls', 7: 'racing_bulls',
        55: 'williams', 23: 'williams',
        77: 'cadillac', 11: 'cadillac',
        14: 'aston_martin', 18: 'aston_martin',
    };

    // Default pit crew stats (used before enough real data is collected)
    const DEFAULTS = {
        ferrari: { mean: 2.35, stddev: 0.18 },
        mclaren: { mean: 2.28, stddev: 0.15 },
        mercedes: { mean: 2.40, stddev: 0.20 },
        red_bull: { mean: 2.20, stddev: 0.12 },
        alpine: { mean: 2.55, stddev: 0.25 },
        haas: { mean: 2.60, stddev: 0.30 },
        audi: { mean: 2.70, stddev: 0.35 },
        racing_bulls: { mean: 2.50, stddev: 0.22 },
        williams: { mean: 2.45, stddev: 0.20 },
        cadillac: { mean: 2.80, stddev: 0.40 },
        aston_martin: { mean: 2.48, stddev: 0.22 },
    };

    // ─────────────────────────────────────────────────────────────
    // FETCH PIT DATA FROM OPENF1
    // ─────────────────────────────────────────────────────────────
    async function fetchSeasonPitData(year = 2026) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const resp = await fetch(`${API_BASE}/pit?year=${year}`, { signal: controller.signal });
            clearTimeout(timeout);

            if (!resp.ok) return null;
            const data = await resp.json();
            if (!Array.isArray(data) || data.length === 0) return null;

            processPitData(data);
            state.lastFetch = new Date();
            save();

            console.log(`[PitCrew] Fetched ${data.length} pit stops for ${year}`);
            return data;
        } catch (e) {
            console.warn('[PitCrew] Season pit data fetch failed:', e.message);
            return null;
        }
    }

    async function fetchSessionPitData(sessionKey) {
        if (!sessionKey) return null;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const resp = await fetch(`${API_BASE}/pit?session_key=${sessionKey}`, { signal: controller.signal });
            clearTimeout(timeout);

            if (!resp.ok) return null;
            const data = await resp.json();
            if (!Array.isArray(data) || data.length === 0) return null;

            processPitData(data);
            state.sessionKey = sessionKey;
            state.lastFetch = new Date();
            save();

            return data;
        } catch (e) {
            console.warn('[PitCrew] Session pit data fetch failed:', e.message);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PROCESS PIT DATA INTO TEAM DISTRIBUTIONS
    // ─────────────────────────────────────────────────────────────
    function processPitData(pitStops) {
        // Group by team
        const teamTimes = {};

        pitStops.forEach(pit => {
            const duration = pit.pit_duration;
            if (!duration || duration <= 0 || duration > 60) return; // filter garbage data

            const driverNum = pit.driver_number;
            const teamId = DRIVER_TEAM_MAP[driverNum];
            if (!teamId) return;

            if (!teamTimes[teamId]) teamTimes[teamId] = [];
            teamTimes[teamId].push(duration);
        });

        // Calculate statistics per team
        Object.entries(teamTimes).forEach(([teamId, times]) => {
            if (times.length === 0) return;

            // Remove outliers (> 2 standard deviations from mean)
            const rawMean = times.reduce((a, b) => a + b, 0) / times.length;
            const rawStd = Math.sqrt(times.reduce((a, t) => a + (t - rawMean) ** 2, 0) / times.length);
            const filtered = times.filter(t => Math.abs(t - rawMean) < rawStd * 2);

            if (filtered.length < 2) return;

            const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
            const stddev = Math.sqrt(filtered.reduce((a, t) => a + (t - mean) ** 2, 0) / filtered.length);

            state.teamStats[teamId] = {
                mean: Math.round(mean * 100) / 100,
                stddev: Math.round(stddev * 100) / 100,
                count: filtered.length,
                best: Math.round(Math.min(...filtered) * 100) / 100,
                worst: Math.round(Math.max(...filtered) * 100) / 100,
                times: filtered.slice(-50), // keep last 50 for distribution
                lastUpdated: new Date().toISOString(),
            };
        });

        state.initialized = true;
    }

    // ─────────────────────────────────────────────────────────────
    // GET PIT TIME — Used by prediction engines
    // ─────────────────────────────────────────────────────────────

    /**
     * Get a realistic pit stop time for a team using real data distribution
     * @param {string} teamId - Team ID
     * @param {Object} rng - Seeded RNG instance (for reproducibility in Monte Carlo)
     * @returns {number} Pit stop time in seconds (just the stationary time, not pit lane travel)
     */
    function getTeamPitTime(teamId, rng) {
        const stats = state.teamStats[teamId] || DEFAULTS[teamId] || { mean: 2.5, stddev: 0.25 };

        // Generate from normal distribution using Box-Muller transform
        const u1 = rng ? rng.next() : Math.random();
        const u2 = rng ? rng.next() : Math.random();
        const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);

        let pitTime = stats.mean + z * stats.stddev;

        // Clamp to realistic range (no negative, no >10s unless disaster)
        pitTime = Math.max(1.8, Math.min(10.0, pitTime));

        // Small probability of pit crew error (unsafe release, stuck wheel nut)
        if ((rng ? rng.next() : Math.random()) < 0.03) {
            pitTime += 2 + (rng ? rng.next() : Math.random()) * 8; // 2-10s error
        }

        return pitTime;
    }

    /**
     * Get the full pit lane transit time (including travel through pit lane)
     */
    function getFullPitLoss(teamId, rng) {
        const crewTime = getTeamPitTime(teamId, rng);
        const pitLaneTravel = 18 + (rng ? rng.next() : Math.random()) * 4; // 18-22s pit lane transit
        return crewTime + pitLaneTravel;
    }

    /**
     * Get team stats summary for UI display
     */
    function getTeamStats(teamId) {
        return state.teamStats[teamId] || DEFAULTS[teamId] || null;
    }

    function getAllStats() {
        const result = {};
        const allTeams = Object.keys(DEFAULTS);
        allTeams.forEach(t => {
            result[t] = state.teamStats[t] || { ...DEFAULTS[t], source: 'default' };
        });
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────
    function save() {
        try {
            (window.safeStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify({
                teamStats: state.teamStats,
                lastFetch: state.lastFetch,
            }));
        } catch (e) { /* ignore */ }
    }

    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.teamStats) state.teamStats = data.teamStats;
                if (data.lastFetch) state.lastFetch = data.lastFetch;
                state.initialized = Object.keys(state.teamStats).length > 0;
            }
        } catch (e) { /* ignore */ }
    }

    // ─────────────────────────────────────────────────────────────
    // INIT & AUTO-REFRESH
    // ─────────────────────────────────────────────────────────────
    function init() {
        load();

        // Fetch season data if we haven't recently
        const hoursSinceLastFetch = state.lastFetch
            ? (Date.now() - new Date(state.lastFetch).getTime()) / 3600000
            : 999;

        if (hoursSinceLastFetch > 6) {
            fetchSeasonPitData(2026);
        }

        // During live sessions, fetch session pit data every 30s
        setInterval(() => {
            if (window.LiveIntelligence) {
                const liveState = window.LiveIntelligence.getState();
                if (liveState.isLiveSession && liveState.currentSession?.session_key) {
                    fetchSessionPitData(liveState.currentSession.session_key);
                }
            }
        }, 30000);

        console.log(`[PitCrew] Initialized with ${Object.keys(state.teamStats).length} teams of real data`);
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 2000);
    }

    return {
        getTeamPitTime,
        getFullPitLoss,
        getTeamStats,
        getAllStats,
        fetchSeasonPitData,
        fetchSessionPitData,
        getState: () => ({ ...state }),
    };
})();

console.log('%c[PitCrewLiveData] Ready — Real pit stop distributions from OpenF1', 'color:#f43f5e;font-weight:bold');
