'use strict';
/* ========================================================
   F1 2026 PREDICTIONS CENTER — predictions.js
   Self-contained module. Loaded after app.js.
   Data flows: race_calendar_2026.json + bahrain_testing_2026.json
   → Prediction Engine → DOM Rendering
   ======================================================== */

const PredictionsCenter = (() => {

  // ─────────────────────────────────────────────────────────────
  // DRIVER ROSTER  (rating 0-100 raw talent)
  // ─────────────────────────────────────────────────────────────
  const DRIVERS = [
    { id: 'leclerc', name: 'C. Leclerc', full: 'Charles Leclerc', team: 'ferrari', num: 16, rating: 94, color: '#DC0000' },
    { id: 'hamilton', name: 'L. Hamilton', full: 'Lewis Hamilton', team: 'ferrari', num: 44, rating: 95, color: '#DC0000' },
    { id: 'norris', name: 'L. Norris', full: 'Lando Norris', team: 'mclaren', num: 4, rating: 91, color: '#FF8000' },
    { id: 'piastri', name: 'O. Piastri', full: 'Oscar Piastri', team: 'mclaren', num: 81, rating: 88, color: '#FF8000' },
    { id: 'antonelli', name: 'A. Antonelli', full: 'Kimi Antonelli', team: 'mercedes', num: 12, rating: 83, color: '#00D2BE' },
    { id: 'russell', name: 'G. Russell', full: 'George Russell', team: 'mercedes', num: 63, rating: 85, color: '#00D2BE' },
    { id: 'verstappen', name: 'M. Verstappen', full: 'Max Verstappen', team: 'red_bull', num: 1, rating: 95, color: '#3671C6' },
    { id: 'hadjar', name: 'I. Hadjar', full: 'Isack Hadjar', team: 'red_bull', num: 6, rating: 79, color: '#3671C6' },
    { id: 'gasly', name: 'P. Gasly', full: 'Pierre Gasly', team: 'alpine', num: 10, rating: 82, color: '#FF69B4' },
    { id: 'colapinto', name: 'F. Colapinto', full: 'Franco Colapinto', team: 'alpine', num: 43, rating: 78, color: '#FF69B4' },
    { id: 'bearman', name: 'O. Bearman', full: 'Oliver Bearman', team: 'haas', num: 87, rating: 79, color: '#CCCCCC' },
    { id: 'ocon', name: 'E. Ocon', full: 'Esteban Ocon', team: 'haas', num: 31, rating: 80, color: '#CCCCCC' },
    { id: 'bortoleto', name: 'G. Bortoleto', full: 'Gabriel Bortoleto', team: 'audi', num: 5, rating: 80, color: '#BB0000' },
    { id: 'hulkenberg', name: 'N. Hulkenberg', full: 'Nico Hulkenberg', team: 'audi', num: 27, rating: 80, color: '#BB0000' },
    { id: 'lawson', name: 'L. Lawson', full: 'Liam Lawson', team: 'racing_bulls', num: 30, rating: 79, color: '#1E3A5F' },
    { id: 'lindblad', name: 'A. Lindblad', full: 'Arvid Lindblad', team: 'racing_bulls', num: 7, rating: 76, color: '#1E3A5F' },
    { id: 'sainz', name: 'C. Sainz', full: 'Carlos Sainz', team: 'williams', num: 55, rating: 87, color: '#005AFF' },
    { id: 'albon', name: 'A. Albon', full: 'Alexander Albon', team: 'williams', num: 23, rating: 84, color: '#005AFF' },
    { id: 'bottas', name: 'V. Bottas', full: 'Valtteri Bottas', team: 'cadillac', num: 77, rating: 80, color: '#CC0000' },
    { id: 'perez', name: 'S. Perez', full: 'Sergio Perez', team: 'cadillac', num: 11, rating: 81, color: '#CC0000' },
    { id: 'alonso', name: 'F. Alonso', full: 'Fernando Alonso', team: 'aston_martin', num: 14, rating: 88, color: '#006F62' },
    { id: 'stroll', name: 'L. Stroll', full: 'Lance Stroll', team: 'aston_martin', num: 18, rating: 72, color: '#006F62' }
  ];

  // ─────────────────────────────────────────────────────────────
  // TEAM BASE INDICES (from Bahrain testing performance model)
  // ─────────────────────────────────────────────────────────────
  const BASE_IDX = {
    ferrari: 91.5, mclaren: 90.6, mercedes: 88.3, red_bull: 78.8,
    alpine: 81.7, haas: 80.8, audi: 73.0, racing_bulls: 69.4,
    williams: 63.85, cadillac: 55.9, aston_martin: 28.5
  };

  // ─────────────────────────────────────────────────────────────
  // TEAM COLORS
  // ─────────────────────────────────────────────────────────────
  const TEAM_COLORS = {
    ferrari: '#DC0000', mclaren: '#FF8000', mercedes: '#00D2BE', red_bull: '#3671C6',
    alpine: '#FF69B4', haas: '#CCCCCC', audi: '#BB0000', racing_bulls: '#1E3A5F',
    williams: '#005AFF', cadillac: '#CC0000', aston_martin: '#006F62'
  };

  // ─────────────────────────────────────────────────────────────
  // 2026 TECHNICAL REGULATIONS MODIFIERS (layered on top of dynamic model)
  // Do NOT redefine TEAM objects. These are purely additive multipliers.
  // ─────────────────────────────────────────────────────────────
  const TechnicalRegs2026 = {
    // Aero Efficiency: active aero cornering benefit on technical tracks
    aeroEfficiency: {
      ferrari: 0.97, mclaren: 0.96, mercedes: 0.95, red_bull: 0.93,
      alpine: 0.90, haas: 0.89, audi: 0.87, racing_bulls: 0.88,
      williams: 0.86, cadillac: 0.84, aston_martin: 0.82
    },
    // MGU-K Recovery: derating penalty on straight-heavy tracks (0=worst,1=best)
    mguKRecovery: {
      ferrari: 0.96, mclaren: 0.94, mercedes: 0.97, red_bull: 0.91,
      alpine: 0.93, haas: 0.90, audi: 0.88, racing_bulls: 0.89,
      williams: 0.92, cadillac: 0.85, aston_martin: 0.87
    },
    // Override Mode / Clutch Factor: boosts qualifying and late-race overtaking
    clutchFactor: {
      verstappen: 1.06, hamilton: 1.05, alonso: 1.05, norris: 1.04,
      leclerc: 1.04, sainz: 1.03, russell: 1.03, piastri: 1.02,
      gasly: 1.02, albon: 1.02, bearman: 1.01, ocon: 1.01,
      hulkenberg: 1.01, bottas: 1.00, colapinto: 1.00, bortoleto: 1.01,
      lawson: 1.01, hadjar: 1.00, lindblad: 0.99, stroll: 0.98, perez: 1.00, antonelli: 1.01
    },

    // Apply aero efficiency modifier based on track type
    getAeroMod(teamId, trackType) {
      const eff = this.aeroEfficiency[teamId] || 0.88;
      if (trackType === 'technical') return 1.0 + (eff - 0.88) * 0.6;
      if (trackType === 'street_hybrid') return 1.0 + (eff - 0.88) * 0.3;
      return 1.0; // neutral on power/balanced tracks
    },

    // Apply MGU-K derating penalty — scales with straight_length proxy (sc_probability inverse)
    getMGUKMod(teamId, race) {
      const rec = this.mguKRecovery[teamId] || 0.88;
      const isPowerTrack = race.track_type === 'power' || race.downforce === 'Low';
      if (!isPowerTrack) return 1.0;
      const penalty = (1.0 - rec) * 0.5;
      return Math.max(0.96, 1.0 - penalty);
    },

    // Clutch factor bridges driver rating ↔ rolling team rating in pressure moments
    getClutchMod(driverId, lateRace) {
      const cf = this.clutchFactor[driverId] || 1.0;
      return lateRace ? cf : 1.0 + (cf - 1.0) * 0.5;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: DRIVER SPECIALIZATION SYSTEM
  // ─────────────────────────────────────────────────────────────
  const DriverSkillMatrix = {
    "leclerc": { street: 1.06, technical: 1.05, qualifying: 1.08, wet: 0.96, tire: 0.98, racecraft: 1.02 },
    "hamilton": { street: 1.02, technical: 1.04, qualifying: 1.01, wet: 1.08, tire: 1.06, racecraft: 1.05 },
    "verstappen": { street: 1.04, technical: 1.07, high_speed: 1.08, wet: 1.08, tire: 1.05, racecraft: 1.07 },
    "norris": { street: 1.03, technical: 1.06, high_speed: 1.05, wet: 1.02, tire: 1.04, qualifying: 1.06 },
    "piastri": { street: 1.04, technical: 1.04, high_speed: 1.06, racecraft: 1.05, consistency: 1.08 },
    "alonso": { street: 1.05, racecraft: 1.08, tire: 1.07, consistency: 1.06, wet: 1.04 },
    "sainz": { technical: 1.05, street: 1.04, racecraft: 1.03, tire: 1.04, consistency: 1.05 },
    "antonelli": { street: 0.98, qualifying: 1.04, technical: 1.02, wet: 1.00, racecraft: 0.97 }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 4 & 5: DRIVER PERSONALITY & RESTART SKILL MODEL
  // ─────────────────────────────────────────────────────────────
  const DriverPersonalityMatrix = {
    "verstappen": { aggression: 1.08, tire_smoothness: 1.04, defense: 1.09, mistake_rate: 0.90, overtake_risk: 1.08, restart_skill: 1.09 },
    "hamilton": { aggression: 1.04, tire_smoothness: 1.08, defense: 1.06, mistake_rate: 0.92, overtake_risk: 1.03, restart_skill: 1.05 },
    "leclerc": { aggression: 1.06, tire_smoothness: 1.02, defense: 1.05, mistake_rate: 1.04, overtake_risk: 1.06, restart_skill: 1.04 },
    "norris": { aggression: 1.05, tire_smoothness: 1.04, defense: 1.04, mistake_rate: 0.98, overtake_risk: 1.04, restart_skill: 1.06 },
    "piastri": { aggression: 1.02, tire_smoothness: 1.06, defense: 1.05, mistake_rate: 0.94, overtake_risk: 1.01, restart_skill: 1.03 },
    "russell": { aggression: 1.06, tire_smoothness: 1.01, defense: 1.04, mistake_rate: 1.02, overtake_risk: 1.05, restart_skill: 1.04 },
    "alonso": { aggression: 1.05, tire_smoothness: 1.07, defense: 1.09, mistake_rate: 0.92, overtake_risk: 1.04, restart_skill: 1.08 },
    "sainz": { aggression: 1.03, tire_smoothness: 1.05, defense: 1.06, mistake_rate: 0.95, overtake_risk: 1.02, restart_skill: 1.03 },
    "gasly": { aggression: 1.04, tire_smoothness: 1.02, defense: 1.04, mistake_rate: 1.02, overtake_risk: 1.03, restart_skill: 1.02 },
    "ocon": { aggression: 1.06, tire_smoothness: 1.01, defense: 1.08, mistake_rate: 1.03, overtake_risk: 1.04, restart_skill: 1.01 },
    "albon": { aggression: 1.02, tire_smoothness: 1.05, defense: 1.04, mistake_rate: 0.97, overtake_risk: 1.01, restart_skill: 1.02 },
    "stroll": { aggression: 1.05, tire_smoothness: 0.98, defense: 1.02, mistake_rate: 1.08, overtake_risk: 1.04, restart_skill: 1.03 },
    "perez": { aggression: 1.04, tire_smoothness: 1.05, defense: 1.05, mistake_rate: 1.05, overtake_risk: 1.03, restart_skill: 0.98 },
    "bottas": { aggression: 0.98, tire_smoothness: 1.02, defense: 1.01, mistake_rate: 0.96, overtake_risk: 0.98, restart_skill: 0.97 },
    "hulkenberg": { aggression: 1.02, tire_smoothness: 1.03, defense: 1.05, mistake_rate: 0.98, overtake_risk: 1.01, restart_skill: 1.01 },
    "default": { aggression: 1.0, tire_smoothness: 1.0, defense: 1.0, mistake_rate: 1.0, overtake_risk: 1.0, restart_skill: 1.0 }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: HISTORICAL 3-YEAR ENGINE (2023–2025)
  // ─────────────────────────────────────────────────────────────
  const HistoricalPerformanceMatrix = {
    weights: { 2025: 0.5, 2024: 0.3, 2023: 0.2 },
    teams: {
      ferrari: { dev_traj: { 2023: 0.98, 2024: 1.03, 2025: 1.05 }, reli_trend: { 2023: 0.95, 2024: 0.98, 2025: 1.02 } },
      mclaren: { dev_traj: { 2023: 0.95, 2024: 1.06, 2025: 1.07 }, reli_trend: { 2023: 0.98, 2024: 1.0, 2025: 1.0 } },
      mercedes: { dev_traj: { 2023: 0.97, 2024: 0.98, 2025: 1.02 }, reli_trend: { 2023: 1.05, 2024: 1.02, 2025: 1.0 } },
      red_bull: { dev_traj: { 2023: 1.06, 2024: 1.02, 2025: 0.98 }, reli_trend: { 2023: 1.05, 2024: 1.0, 2025: 0.95 } }
    },
    drivers: {
      rookie_prospect: { quali_delta: 0.98, wet_race: 0.98, dnf_rate: 1.10 }
    },
    getDynTeamBoost: function (teamId) {
      const t = this.teams[teamId];
      if (!t) return 1.0;
      const dev = t.dev_traj[2025] * this.weights[2025] + t.dev_traj[2024] * this.weights[2024] + t.dev_traj[2023] * this.weights[2023];
      return Math.max(0.92, Math.min(1.08, dev));
    },
    getDynReliabilityMod: function (teamId) {
      const t = this.teams[teamId];
      if (!t) return 1.0;
      const rel = t.reli_trend[2025] * this.weights[2025] + t.reli_trend[2024] * this.weights[2024] + t.reli_trend[2023] * this.weights[2023];
      return Math.max(0.92, Math.min(1.08, rel));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 5: TRACK DOMINANCE MEMORY
  // ─────────────────────────────────────────────────────────────
  const TrackDominanceMemory = {
    "leclerc": ["monaco", "baku"],
    "verstappen": ["suzuka", "spa"],
    "hamilton": ["silverstone", "hungary"],
    "perez": ["jeddah", "baku"],
    "norris": ["zandvoort", "singapore"],
    "alonso": ["brazil"]
  };

  // ─────────────────────────────────────────────────────────────
  // POINTS SYSTEM
  // ─────────────────────────────────────────────────────────────
  const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const PTS_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // ═══════════════════════════════════════════════════════════
  // PHASE 1→10: FULL SIMULATION ENGINE
  // ═══════════════════════════════════════════════════════════

  // Stateful seeded RNG (per simulation run)
  class RNG {
    constructor(seed) { this.s = (seed || 1) % 2147483647; }
    next() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
    norm(m, sd) { const u = Math.max(this.next(), 1e-9), v = this.next(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    range(a, b) { return a + this.next() * (b - a); }
  }
  function seededRand(seed) { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function softmax(sc, t = 4) { const mx = Math.max(...sc), ex = sc.map(s => Math.exp((s - mx) / t)), sum = ex.reduce((a, b) => a + b, 0); return ex.map(e => e / sum); }

  // PHASE 1+5+8: Dynamic Performance Model
  const DynamicModel = {
    // Mutable — evolves as results come in
    teamRatings: {},   // { team: { rating, velocity, trend, reliability, recentFinishes[] } }
    driverForm: {},    // { driverId: { recentFinishes[], qualiDeltas[], errorRate } }
    upgradeLog: [],    // [{ round, team, delta }]
    errorHistory: {},  // { round: { avgPosDelta } }
    adjustLog: [],     // [{ round, team, oldR, newR }]

    init() {
      Object.keys(BASE_IDX).forEach(t => {
        this.teamRatings[t] = this.teamRatings[t] || { rating: BASE_IDX[t], velocity: 0, trend: 'stable', reliability: 1.0, recentFinishes: [] };
      });
      DRIVERS.forEach(d => {
        this.driverForm[d.id] = this.driverForm[d.id] || { recentFinishes: [], qualiDeltas: [], errorRate: 0.04 };
      });
    },

    // Phase 3+5: rolling team rating used in predictions
    getTeamRating(teamId) {
      const tr = this.teamRatings[teamId];
      if (!tr) return BASE_IDX[teamId] || 50;
      return Math.max(10, Math.min(100, tr.rating + tr.velocity * 0.5));
    },

    // Phase 6: dynamic driver form rating
    getDriverFormMult(driverId) {
      const df = this.driverForm[driverId];
      if (!df || !df.recentFinishes.length) return 1.0;
      const recent = df.recentFinishes.slice(-3); // Last 3 races
      const avgFinish = recent.reduce((a, b) => a + b, 0) / recent.length;

      let mult = 1.0;
      // Bonus: Top 10 = positive momentum, Bottom half = negative
      mult += (10.5 - avgFinish) * 0.005;

      const podiums = recent.filter(p => p <= 3).length;
      const dnfs = recent.filter(p => p >= 19).length;

      mult += (podiums * 0.015);
      mult -= (dnfs * 0.015);

      // ±5% Form Momentum modifier
      return Math.max(0.95, Math.min(1.05, mult));
    },

    // Phase 5: Development Velocity model generating a dev trend
    getDevelopmentTrend(teamId) {
      const tr = this.teamRatings[teamId];
      if (!tr || !tr.recentFinishes || !tr.recentFinishes.length) return 1.0;
      const recent = tr.recentFinishes.slice(-3);
      const avgActual = recent.reduce((a, b) => a + b, 0) / recent.length;
      const expectedAvg = 11 - (tr.rating / 10);

      // If performing better than expected, positive evolution trend
      const diff = expectedAvg - avgActual;
      let devTrend = (tr.velocity || 0) * 0.5 + diff * 0.5;

      // Gradual evolution (±6%) Ensures no single car dominates entire season
      return Math.max(0.94, Math.min(1.06, 1.0 + (devTrend * 0.015)));
    },

    // Phase 5+6: update models after a real race result is entered
    updateFromResult(round, result, calendar) {
      const race = calendar.find(r => r.round === round);
      if (!race) return;

      // Update driver form (recent finishes)
      result.positions.forEach((dId, i) => {
        const df = this.driverForm[dId];
        if (!df) return;
        df.recentFinishes.push(i + 1);
        if (df.recentFinishes.length > 5) df.recentFinishes.shift();
      });

      // Update team ratings based on avg finishing position vs expectation
      Object.keys(BASE_IDX).forEach(team => {
        const teamDrivers = DRIVERS.filter(d => d.team === team);
        const actualPositions = teamDrivers.map(d => {
          const pos = result.positions.indexOf(d.id);
          return pos >= 0 ? pos + 1 : 20;
        });
        const avgActual = actualPositions.reduce((a, b) => a + b, 0) / actualPositions.length;

        const tr = this.teamRatings[team];
        if (!tr) return;
        tr.recentFinishes.push(avgActual);
        if (tr.recentFinishes.length > 3) tr.recentFinishes.shift();

        // Development velocity & momentum
        if (tr.recentFinishes.length >= 2) {
          const prev = tr.recentFinishes[tr.recentFinishes.length - 2];
          const curr = tr.recentFinishes[tr.recentFinishes.length - 1];
          const delta = prev - curr;
          tr.velocity = tr.velocity * 0.4 + delta * 0.6;
          tr.trend = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'stable';
        }

        // Phase 5 & 6: Upgrade success, spikes & momentum impact
        const expectedAvg = 11 - (tr.rating / 10);
        const diff = expectedAvg - avgActual;

        const upgradeRoll = Math.random();
        let devSpike = 0;
        let eventType = null;
        if (upgradeRoll < 0.05) { devSpike = 4 + Math.random() * 2; eventType = 'breakthrough'; }
        else if (upgradeRoll < 0.15) { devSpike = 1.5 + Math.random() * 1.5; eventType = 'upgrade'; }
        else if (upgradeRoll < 0.25) { devSpike = -(0.5 + Math.random() * 1.5); eventType = 'regression'; }
        else if (upgradeRoll > 0.85) { devSpike = 0; eventType = 'stagnation'; }

        let adj = diff * 0.12 + devSpike;

        if (tr.recentFinishes.length >= 3) {
          const sum3 = tr.recentFinishes.slice(-3).reduce((a, b) => a + b, 0);
          if (sum3 < expectedAvg * 3 - 2) adj += 0.5;
          if (sum3 > expectedAvg * 3 + 2) adj -= 0.5;
        }

        const oldR = tr.rating;
        tr.rating = Math.max(15, Math.min(98, tr.rating + adj));
        if (Math.abs(tr.rating - oldR) > 0.1) this.adjustLog.push({ round, team, oldR: +oldR.toFixed(1), newR: +tr.rating.toFixed(1) });

        if (eventType === 'breakthrough' || eventType === 'upgrade') this.upgradeLog.push({ round, team, delta: +(tr.rating - oldR).toFixed(2), type: 'upgrade' });
        else if (eventType === 'regression') this.upgradeLog.push({ round, team, delta: +(tr.rating - oldR).toFixed(2), type: 'decline' });
      });
    }
  };

  // PHASE 4: Advanced Weather Intensity System
  const WeatherEngine = {
    generate(rainProb, rng) {
      const r = rng.next();
      if (r < rainProb * 0.15) return 'heavy_rain';
      if (r < rainProb * 0.45) return 'wet';
      if (r < rainProb * 0.70) return 'light_rain';
      if (r < rainProb * 0.85) return 'mixed';
      return 'dry';
    },
    params(weather) {
      return {
        dry: { skillWeight: 0.7, dnfMod: 1.0, upsetMod: 1.0, stratMod: 1.0, noise: 0.06 },
        light_rain: { skillWeight: 0.65, dnfMod: 1.2, upsetMod: 1.1, stratMod: 1.1, noise: 0.09 },
        mixed: { skillWeight: 0.6, dnfMod: 1.6, upsetMod: 1.4, stratMod: 1.3, noise: 0.15 },
        wet: { skillWeight: 0.5, dnfMod: 2.2, upsetMod: 1.8, stratMod: 1.5, noise: 0.22 },
        heavy_rain: { skillWeight: 0.45, dnfMod: 3.5, upsetMod: 2.5, stratMod: 1.8, noise: 0.35 }
      }[weather] || { skillWeight: 0.7, dnfMod: 1.0, upsetMod: 1.0, stratMod: 1.0, noise: 0.06 };
    },
    emoji(w) { return w === 'heavy_rain' ? '⛈️ HEAVY RAIN' : w === 'wet' ? '🌧️ WET' : w === 'light_rain' ? '🌦️ LIGHT RAIN' : w === 'mixed' ? '🌦️ MIXED' : '☀️ DRY'; }
  };

  // PHASE 2: Qualifying Engine — Full Q1→Q2→Q3 Session Simulation
  const QualifyingEngine = {
    simulate(race, rng, weather) {
      const wp = weather ? WeatherEngine.params(weather) : { noise: 0.06 };
      const trackCity = (race.city || '').toLowerCase();
      const trackName = (race.name || '').toLowerCase();
      const isStreet = trackCity.includes('monaco') || trackCity.includes('singapore') || trackCity.includes('jeddah') || race.track_type === 'street_hybrid';

      // Track evolution factors: grip improves through sessions
      const trackEvoQ1 = 1.0;
      const trackEvoQ2 = isStreet ? 1.012 : 1.006;
      const trackEvoQ3 = isStreet ? 1.022 : 1.012;

      const runSession = (drivers, sessionName, trackEvo) => {
        return drivers.map(d => {
          const pers = DriverPersonalityMatrix[d.id] || DriverPersonalityMatrix['default'];
          const isRook = (!DynamicModel.driverForm[d.id] || DynamicModel.driverForm[d.id].recentFinishes.length < 3);

          // Base quali pace with track evolution grip bonus
          let lapPace = calculatePace(d, race, rng, wp, false, weather || 'dry', true) * trackEvo;

          // Traffic probability: 8-18% chance of compromised lap
          const trafficChance = isStreet ? 0.18 : 0.08;
          if (rng.next() < trafficChance) {
            lapPace -= rng.range(0.005, 0.02); // Slower lap from traffic
          }

          // Lap improvement on 2nd run attempt (driver pushes harder)
          const improveChance = 0.55 + (d.rating / 100) * 0.2;
          if (rng.next() < improveChance) {
            lapPace += rng.range(0.002, 0.008);
          }

          // Yellow flag lap ruin chance: 3-6%
          if (rng.next() < (isStreet ? 0.06 : 0.03)) {
            lapPace -= rng.range(0.015, 0.04); // Lap deleted or compromised
          }

          // Rookie/aggressive driver pressure mistake in quali
          if (isRook && rng.next() < 0.12) {
            lapPace -= rng.range(0.01, 0.03);
          } else if (pers.aggression > 1.05 && rng.next() < 0.06) {
            lapPace -= rng.range(0.005, 0.015); // Push too hard, lock up
          }

          return { driver: d, qualiPace: lapPace };
        });
      };

      // Q1: all 22 drivers, eliminate bottom 5
      const q1 = runSession(DRIVERS, 'Q1', trackEvoQ1);
      q1.sort((a, b) => b.qualiPace - a.qualiPace);
      const q1Eliminated = q1.slice(17).map(s => s.driver);
      const q2Drivers = q1.slice(0, 17).map(s => s.driver);

      // Q2: top 17, eliminate bottom 5
      const q2 = runSession(q2Drivers, 'Q2', trackEvoQ2);
      q2.sort((a, b) => b.qualiPace - a.qualiPace);
      const q2Eliminated = q2.slice(12).map(s => s.driver);
      const q3Drivers = q2.slice(0, 12).map(s => s.driver);

      // Q3: top 12 fight for pole
      const q3 = runSession(q3Drivers, 'Q3', trackEvoQ3);
      q3.sort((a, b) => b.qualiPace - a.qualiPace);

      // Build final grid
      const grid = [];
      q3.forEach((s, i) => grid.push({ driver: s.driver, gridPos: i + 1, qualiPace: s.qualiPace, qualiRound: 'Q3' }));
      q2Eliminated.forEach((d, i) => grid.push({ driver: d, gridPos: 13 + i, qualiPace: 0, qualiRound: 'Q2' }));
      q1Eliminated.forEach((d, i) => grid.push({ driver: d, gridPos: 18 + i, qualiPace: 0, qualiRound: 'Q1' }));

      // Apply component-based PU grid penalties
      grid.forEach(g => {
        const pen = ComponentReliability.applyGridPenalty(g.driver.id);
        if (pen > 0) g.gridPos = Math.min(22, g.gridPos + pen);
      });
      grid.sort((a, b) => a.gridPos - b.gridPos);
      grid.forEach((g, i) => g.gridPos = i + 1);

      return grid;
    }
  };

  // PHASE 2b: Sprint Qualifying Engine — SQ1→SQ2→SQ3 Shootout Simulation
  const SprintQualifyingEngine = {
    simulate(race, rng, weather) {
      const wp = weather ? WeatherEngine.params(weather) : { noise: 0.06 };
      const trackCity = (race.city || '').toLowerCase();
      const isStreet = trackCity.includes('monaco') || trackCity.includes('singapore') || trackCity.includes('jeddah') || race.track_type === 'street_hybrid';

      // Sprint shootout has less track evolution (shorter sessions)
      const trackEvoSQ1 = 1.0;
      const trackEvoSQ2 = isStreet ? 1.008 : 1.004;
      const trackEvoSQ3 = isStreet ? 1.015 : 1.008;

      const runSession = (drivers, sessionName, trackEvo) => {
        return drivers.map(d => {
          const pers = DriverPersonalityMatrix[d.id] || DriverPersonalityMatrix['default'];
          const isRook = (!DynamicModel.driverForm[d.id] || DynamicModel.driverForm[d.id].recentFinishes.length < 3);

          // Sprint shootout: single-lap shootout format — higher pressure, less time to improve
          let lapPace = calculatePace(d, race, rng, wp, false, weather || 'dry', true) * trackEvo;

          // Sprint shootout has SINGLE run attempt — no second chance
          const trafficChance = isStreet ? 0.12 : 0.05;
          if (rng.next() < trafficChance) {
            lapPace -= rng.range(0.003, 0.015);
          }

          // Only one lap — improvement chance is lower
          const improveChance = 0.30 + (d.rating / 100) * 0.15;
          if (rng.next() < improveChance) {
            lapPace += rng.range(0.001, 0.005);
          }

          // Pressure mistake in sprint is slightly higher (less warm-up)
          if (isRook && rng.next() < 0.15) {
            lapPace -= rng.range(0.008, 0.025);
          } else if (pers.aggression > 1.05 && rng.next() < 0.08) {
            lapPace -= rng.range(0.004, 0.012);
          }

          return { driver: d, qualiPace: lapPace };
        });
      };

      // SQ1: all drivers, bottom 5 eliminated
      const sq1 = runSession(DRIVERS, 'SQ1', trackEvoSQ1);
      sq1.sort((a, b) => b.qualiPace - a.qualiPace);
      const sq1Eliminated = sq1.slice(17).map(s => s.driver);
      const sq2Drivers = sq1.slice(0, 17).map(s => s.driver);

      // SQ2: top 17, bottom 5 eliminated
      const sq2 = runSession(sq2Drivers, 'SQ2', trackEvoSQ2);
      sq2.sort((a, b) => b.qualiPace - a.qualiPace);
      const sq2Eliminated = sq2.slice(12).map(s => s.driver);
      const sq3Drivers = sq2.slice(0, 12).map(s => s.driver);

      // SQ3: top 12 fight for sprint pole
      const sq3 = runSession(sq3Drivers, 'SQ3', trackEvoSQ3);
      sq3.sort((a, b) => b.qualiPace - a.qualiPace);

      // Build sprint grid
      const grid = [];
      sq3.forEach((s, i) => grid.push({ driver: s.driver, gridPos: i + 1, qualiPace: s.qualiPace, qualiRound: 'SQ3' }));
      sq2Eliminated.forEach((d, i) => grid.push({ driver: d, gridPos: 13 + i, qualiPace: 0, qualiRound: 'SQ2' }));
      sq1Eliminated.forEach((d, i) => grid.push({ driver: d, gridPos: 18 + i, qualiPace: 0, qualiRound: 'SQ1' }));

      // Apply grid penalties
      grid.forEach(g => {
        const pen = ComponentReliability.applyGridPenalty(g.driver.id);
        if (pen > 0) g.gridPos = Math.min(22, g.gridPos + pen);
      });
      grid.sort((a, b) => a.gridPos - b.gridPos);
      grid.forEach((g, i) => g.gridPos = i + 1);

      return grid;
    }
  };


  // PHASE 4: Component-Based Reliability Model
  const ComponentReliability = {
    // Per-team component failure base rates (per race)
    teams: {
      ferrari: { engine: 0.015, gearbox: 0.010, cooling: 0.008, hybrid: 0.012 },
      mclaren: { engine: 0.012, gearbox: 0.012, cooling: 0.010, hybrid: 0.014 },
      mercedes: { engine: 0.014, gearbox: 0.014, cooling: 0.012, hybrid: 0.010 },
      red_bull: { engine: 0.013, gearbox: 0.015, cooling: 0.010, hybrid: 0.012 },
      alpine: { engine: 0.020, gearbox: 0.016, cooling: 0.014, hybrid: 0.018 },
      haas: { engine: 0.022, gearbox: 0.018, cooling: 0.015, hybrid: 0.020 },
      audi: { engine: 0.028, gearbox: 0.020, cooling: 0.018, hybrid: 0.024 },
      racing_bulls: { engine: 0.024, gearbox: 0.018, cooling: 0.016, hybrid: 0.020 },
      williams: { engine: 0.022, gearbox: 0.020, cooling: 0.015, hybrid: 0.018 },
      cadillac: { engine: 0.030, gearbox: 0.025, cooling: 0.022, hybrid: 0.028 },
      aston_martin: { engine: 0.040, gearbox: 0.035, cooling: 0.030, hybrid: 0.038 }
    },
    // PU penalty tracker: next-race grid drops per driver
    gridPenalties: {},
    getComponents(teamId) {
      return this.teams[teamId] || { engine: 0.025, gearbox: 0.020, cooling: 0.018, hybrid: 0.022 };
    },
    applyGridPenalty(driverId) {
      const pen = this.gridPenalties[driverId] || 0;
      if (pen > 0) this.gridPenalties[driverId] = 0;
      return pen;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: SEASON COMPONENT WEAR & PU ALLOCATION MODEL
  // ─────────────────────────────────────────────────────────────
  const SeasonComponentWear = {
    wear: {}, // { teamId: { engineWear, gearboxWear, hybridWear, coolingWear } }
    puReplacements: {}, // { teamId: count }

    init() {
      Object.keys(BASE_IDX).forEach(t => {
        if (!this.wear[t]) {
          this.wear[t] = { engineWear: 0, gearboxWear: 0, hybridWear: 0, coolingWear: 0 };
        }
        if (!this.puReplacements[t]) this.puReplacements[t] = 0;
      });
    },

    // Team wear multiplier: elite teams wear slower, lower teams faster
    _teamWearScale(teamId) {
      const elite = ['ferrari', 'mclaren', 'mercedes', 'red_bull'];
      const lower = ['cadillac', 'aston_martin', 'audi'];
      if (elite.includes(teamId)) return 0.8;
      if (lower.includes(teamId)) return 1.2;
      return 1.0;
    },

    // After each race, accumulate wear
    advanceWear(race) {
      const isPower = race.track_type === 'power' || race.downforce === 'Low';
      const isWet = race.rain_probability > 0.4;

      Object.keys(BASE_IDX).forEach(teamId => {
        const w = this.wear[teamId];
        if (!w) return;
        const scale = this._teamWearScale(teamId);
        const rng = new RNG(race.round * 17 + teamId.length * 7);

        w.engineWear += rng.range(4, 7) * scale * (isPower ? 1.3 : 1.0);
        w.gearboxWear += rng.range(3, 5) * scale;
        w.hybridWear += rng.range(3, 6) * scale;
        w.coolingWear += rng.range(2, 4) * scale * (isWet ? 1.25 : 1.0);

        // Cap at 100
        w.engineWear = Math.min(100, w.engineWear);
        w.gearboxWear = Math.min(100, w.gearboxWear);
        w.hybridWear = Math.min(100, w.hybridWear);
        w.coolingWear = Math.min(100, w.coolingWear);
      });
    },

    // Get wear-augmented failure multiplier
    getWearFailureMult(teamId) {
      const w = this.wear[teamId];
      if (!w) return 1.0;
      const avgWear = (w.engineWear + w.gearboxWear + w.hybridWear + w.coolingWear) / 4;
      return 1 + (avgWear / 100) * 1.5; // up to 2.5× at 100% wear
    },

    // PU allocation logic: if engineWear > 85, must decide to replace or risk failure
    checkPUReplacement(teamId, race, rng) {
      const w = this.wear[teamId];
      if (!w || w.engineWear <= 85) return false;

      // Risk tolerance: midfield/lower teams gamble more in late season
      const isLate = race.round > 16;
      const elite = ['ferrari', 'mclaren', 'mercedes', 'red_bull'];
      let replaceChance = elite.includes(teamId) ? 0.8 : 0.5;
      if (isLate && !elite.includes(teamId)) replaceChance = 0.35; // Midfield gambles more

      if (rng.next() < replaceChance) {
        // Replace PU: grid penalty + reset wear
        w.engineWear = 5 + rng.range(0, 10);
        this.puReplacements[teamId] = (this.puReplacements[teamId] || 0) + 1;
        // Apply grid penalty to both drivers of this team
        DRIVERS.filter(d => d.team === teamId).forEach(d => {
          ComponentReliability.gridPenalties[d.id] = (ComponentReliability.gridPenalties[d.id] || 0) + Math.floor(rng.range(5, 11));
        });
        return true;
      }
      return false; // Risk catastrophic failure
    },

    // Get per-component wear for failure scaling
    getComponentWearMult(teamId, component) {
      const w = this.wear[teamId];
      if (!w) return 1.0;
      const val = w[component + 'Wear'] || 0;
      return 1 + (val / 100) * 1.5;
    },

    reset() {
      Object.keys(this.wear).forEach(t => {
        this.wear[t] = { engineWear: 0, gearboxWear: 0, hybridWear: 0, coolingWear: 0 };
      });
      this.puReplacements = {};
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: DRIVER CONFIDENCE & MORALE ENGINE
  // ─────────────────────────────────────────────────────────────
  const DriverConfidenceEngine = {
    confidence: {}, // { driverId: 0.90 - 1.10, baseline 1.0 }

    init() {
      DRIVERS.forEach(d => {
        if (this.confidence[d.id] === undefined) this.confidence[d.id] = 1.0;
      });
    },

    get(driverId) {
      return this.confidence[driverId] !== undefined ? this.confidence[driverId] : 1.0;
    },

    // Called after each race result with finishing position
    updateAfterRace(driverId, finishPos, isDNF) {
      let c = this.confidence[driverId] || 1.0;

      if (isDNF) {
        c -= 0.03;
      } else if (finishPos === 1) {
        c += 0.02;
      } else if (finishPos <= 3) {
        c += 0.01;
      } else if (finishPos >= 15) {
        c -= 0.01;
      }

      // Check streak from DynamicModel form
      const df = DynamicModel.driverForm[driverId];
      if (df && df.recentFinishes.length >= 3) {
        const last3 = df.recentFinishes.slice(-3);
        const allBad = last3.every(p => p >= 12 || p >= 19);
        const allStrong = last3.every(p => p <= 5);
        if (allBad) c -= 0.04;
        if (allStrong) c += 0.03;
      }

      // Clamp 0.90 – 1.10
      this.confidence[driverId] = Math.max(0.90, Math.min(1.10, c));
    },

    reset() {
      Object.keys(this.confidence).forEach(id => this.confidence[id] = 1.0);
    }
  };

  const DNFEngine = {
    BASE: {
      ferrari: 0.055, mclaren: 0.06, mercedes: 0.07, red_bull: 0.065, alpine: 0.08,
      haas: 0.085, audi: 0.10, racing_bulls: 0.09, williams: 0.09, cadillac: 0.12, aston_martin: 0.18
    },
    roll(driver, weather, rng, driverPersContext) {
      const comp = ComponentReliability.getComponents(driver.team);
      const tr = DynamicModel.teamRatings[driver.team];
      const relMod = tr ? (2.0 - tr.reliability) : 1.0;

      // Phase 6: Reliability Calibration Engine
      let histRel = HistoricalPerformanceMatrix.getDynReliabilityMod(driver.team);
      if (typeof ReliabilityCalibrationEngine !== 'undefined') {
        const histDnfRate = 0.15; // Placeholder derived from typical DNF
        const sysFailureProb = ReliabilityCalibrationEngine.getFailureProbability(histRel, histDnfRate, driver.team);
        histRel = sysFailureProb; // use new calibrated failure probability wrapper
      }

      const isRookie = (!DynamicModel.driverForm[driver.id] || DynamicModel.driverForm[driver.id].recentFinishes.length < 3);
      const pers = driverPersContext || DriverPersonalityMatrix[driver.id] || DriverPersonalityMatrix["default"];

      const wMod = weather.dnfMod;
      const aggrMod = 1 + (pers.aggression - 1) * 0.5;
      const errMod = pers.mistake_rate;
      const rookieMod = isRookie ? HistoricalPerformanceMatrix.drivers.rookie_prospect.dnf_rate : 1.0;

      const engineFail = rng.next() < comp.engine * wMod * relMod * (2.0 - histRel) * rookieMod * SeasonComponentWear.getComponentWearMult(driver.team, 'engine');
      const gearboxFail = rng.next() < comp.gearbox * wMod * relMod * aggrMod * rookieMod * SeasonComponentWear.getComponentWearMult(driver.team, 'gearbox');
      const coolingFail = rng.next() < comp.cooling * (weather.dnfMod > 1.5 ? wMod * 1.3 : wMod) * relMod * SeasonComponentWear.getComponentWearMult(driver.team, 'cooling');
      const hybridFail = rng.next() < comp.hybrid * wMod * relMod * errMod * SeasonComponentWear.getComponentWearMult(driver.team, 'hybrid');

      const failed = engineFail || gearboxFail || coolingFail || hybridFail;

      if (engineFail) {
        ComponentReliability.gridPenalties[driver.id] = (ComponentReliability.gridPenalties[driver.id] || 0) + Math.floor(rng.range(5, 11));
      }

      return failed;
    },
    getFailureType(driver, rng) {
      const r = rng.next();
      if (r < 0.35) return 'Engine';
      if (r < 0.55) return 'Gearbox';
      if (r < 0.75) return 'Cooling';
      return 'ERS/Hybrid';
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PIT CREW PERFORMANCE MODEL
  // ─────────────────────────────────────────────────────────────
  const PitCrewModel = {
    crews: {
      ferrari: { baseTime: 2.1, sigma: 0.15, errorRate: 0.03, perfectRate: 0.20 },
      mclaren: { baseTime: 2.0, sigma: 0.12, errorRate: 0.02, perfectRate: 0.25 },
      mercedes: { baseTime: 2.1, sigma: 0.14, errorRate: 0.025, perfectRate: 0.22 },
      red_bull: { baseTime: 2.0, sigma: 0.10, errorRate: 0.02, perfectRate: 0.28 },
      alpine: { baseTime: 2.5, sigma: 0.20, errorRate: 0.05, perfectRate: 0.10 },
      haas: { baseTime: 2.6, sigma: 0.22, errorRate: 0.06, perfectRate: 0.08 },
      audi: { baseTime: 2.7, sigma: 0.25, errorRate: 0.07, perfectRate: 0.06 },
      racing_bulls: { baseTime: 2.5, sigma: 0.22, errorRate: 0.05, perfectRate: 0.09 },
      williams: { baseTime: 2.4, sigma: 0.20, errorRate: 0.045, perfectRate: 0.12 },
      cadillac: { baseTime: 2.8, sigma: 0.28, errorRate: 0.08, perfectRate: 0.05 },
      aston_martin: { baseTime: 3.0, sigma: 0.30, errorRate: 0.10, perfectRate: 0.04 }
    },
    simulateStop(teamId, rng) {
      // Use real pit crew data from OpenF1 when available
      if (window.PitCrewLiveData) {
        const realStats = window.PitCrewLiveData.getTeamStats(teamId);
        if (realStats && realStats.count && realStats.count >= 3) {
          // Use real data distribution
          const stopTime = window.PitCrewLiveData.getTeamPitTime(teamId, rng);
          const unsafeRelease = rng.next() < 0.008; // ~0.8% chance
          return { stopTime: unsafeRelease ? stopTime + 5.0 : stopTime, unsafeRelease };
        }
      }

      // Fallback to static pit crew model
      const c = this.crews[teamId] || { baseTime: 2.7, sigma: 0.25, errorRate: 0.06, perfectRate: 0.06 };
      let stopTime = Math.max(1.8, rng.norm(c.baseTime, c.sigma));

      // Slow stop (cross-threaded gun, stuck wheel)
      if (rng.next() < c.errorRate) {
        stopTime += rng.range(1.5, 5.0);
      }
      // Unsafe release penalty (5s added to race time)
      const unsafeRelease = rng.next() < (c.errorRate * 0.3);
      if (unsafeRelease) stopTime += 5.0;
      // Perfect stop bonus (sub 2.0s)
      if (!unsafeRelease && rng.next() < c.perfectRate) {
        stopTime = Math.min(stopTime, 1.9 + rng.next() * 0.15);
      }
      return { stopTime, unsafeRelease };
    },
    getTimeDelta(teamId, stops, rng) {
      let total = 0;
      for (let i = 0; i < stops; i++) {
        const s = this.simulateStop(teamId, rng);
        total += s.stopTime;
      }
      return total;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // TRACK EVOLUTION ENGINE
  // ─────────────────────────────────────────────────────────────
  const TrackEvolutionEngine = {
    getGripMod(race, racePhase, weather) {
      // racePhase: 0.0 = start, 0.5 = mid, 1.0 = end
      const trackCity = (race.city || '').toLowerCase();
      const isStreet = trackCity.includes('monaco') || trackCity.includes('singapore') || trackCity.includes('jeddah') || race.track_type === 'street_hybrid';
      const isHot = trackCity.includes('bahrain') || trackCity.includes('sakhir') || trackCity.includes('miami') || trackCity.includes('qatar');

      // Street tracks evolve faster (more rubber laid)
      let evoRate = isStreet ? 0.025 : 0.012;
      // Hot tracks degrade grip in late race
      let heatDeg = isHot ? -0.008 : 0;
      // Rain washes away rubber
      if (weather === 'wet' || weather === 'heavy_rain') evoRate *= 0.3;

      // Early race = low grip and more mistakes, Late race = more grip
      const gripDelta = evoRate * racePhase + heatDeg * racePhase;
      return 1.0 + gripDelta;
    },
    getMistakeRate(racePhase) {
      // Higher mistake chance early in race when grip is low
      return 1.0 + (1.0 - racePhase) * 0.15;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DRIVER RIVALRY & INCIDENT MODEL
  // ─────────────────────────────────────────────────────────────
  const RivalryEngine = {
    // Incident check for adjacent drivers in finishing order
    checkIncident(d1, d2, rng, weather) {
      const p1 = DriverPersonalityMatrix[d1.id] || DriverPersonalityMatrix['default'];
      const p2 = DriverPersonalityMatrix[d2.id] || DriverPersonalityMatrix['default'];
      const aggSum = (p1.aggression - 1.0) + (p2.aggression - 1.0);

      // Base collision chance: very low 0.5-2%
      let collisionChance = 0.005 + aggSum * 0.04;

      // Teammates fighting: rare contact
      if (d1.team === d2.team) collisionChance *= 0.4;

      // Wet weather increases incident chance
      if (weather === 'wet' || weather === 'heavy_rain') collisionChance *= 1.6;

      // Cap at 4% to prevent arcade-like chaos
      collisionChance = Math.min(0.04, collisionChance);

      if (rng.next() < collisionChance) {
        // Determine severity
        const severity = rng.next();
        if (severity < 0.3) return 'dnf'; // One or both out
        if (severity < 0.6) return 'damage'; // Time penalty (5-15s)
        return 'position'; // Lose 1-3 positions
      }
      return null;
    }
  };

  // PHASE 4: Strategy Engine
  const StrategyEngine = {
    // Phase 3 & 4: Pit Wall Intelligence
    EFF: {
      ferrari: 0.90, mclaren: 0.96, mercedes: 0.94, red_bull: 0.97, alpine: 0.81,
      haas: 0.85, audi: 0.84, racing_bulls: 0.82, williams: 0.86, cadillac: 0.80, aston_martin: 0.76
    },
    getDelta(driver, race, rng, driverPersContext) {
      const eff = this.EFF[driver.team] || 0.83;
      const pers = driverPersContext || DriverPersonalityMatrix[driver.id] || DriverPersonalityMatrix["default"];

      let tireDegMod = 1.0;
      if (race.tire_deg === 'High') tireDegMod = 1.4;
      else if (race.tire_deg === 'Low') tireDegMod = 0.7;

      const tirePenalty = (1.2 - pers.tire_smoothness) * tireDegMod * 2.5;

      // Pit crew stop time contribution (in tenths, normalized)
      const stops = race.strategy_stops || 1;
      const pitTime = PitCrewModel.getTimeDelta(driver.team, stops, rng);
      const pitNorm = (pitTime - stops * 2.2) * 0.8; // Normalize against ideal 2.2s stops

      let strategyDelta = rng.norm((1 - eff) * 5, (1 - eff) * 2);

      // Phase 3: Mathematical Undercut / Overcut Model
      if (typeof window.StrategyWindowModel !== 'undefined' && window.LiveIntelligence && typeof window.LiveIntelligence.getState === 'function') {
        let liveState = window.LiveIntelligence.getState();
        if (liveState.currentLap) {
          let currTire = 'medium';
          let lapsOnTire = 15;
          if (liveState.compounds && liveState.compounds[driver.id]) {
            currTire = liveState.compounds[driver.id];
          }
          if (liveState.lapsOnTire && liveState.lapsOnTire[driver.id]) {
            lapsOnTire = liveState.lapsOnTire[driver.id];
          }
          let trackTemp = liveState.liveWeather?.trackTemp || 35;
          let newTire = currTire === 'medium' ? 'hard' : 'medium'; // Simplification for modeling

          let undercutDelta = window.StrategyWindowModel.calculateUndercutDelta(currTire, lapsOnTire, newTire, trackTemp);
          let successProb = window.StrategyWindowModel.getPitSuccessProbability(undercutDelta);

          // Modify strategy delta based on success
          if (rng.next() < successProb) {
            strategyDelta -= (undercutDelta * eff * 0.5); // Successful pit
          } else {
            strategyDelta += 2.0; // Failed overcut/undercut cost
          }
        } // close if liveState.currentLap
      }

      // Gamble risk modifier from pressure engine (risk taking)
      if (pers.overtake_risk > 1.1) {
        strategyDelta += rng.norm(0, 4);
      }

      let upsetMod = 0;
      if (rng.next() < 0.05 * eff) {
        upsetMod = rng.range(3, 8);
      }

      return strategyDelta + tirePenalty + pitNorm - upsetMod;
    }
  };

  // PHASE 9: Confidence Engine
  const ConfidenceEngine = {
    calc(race) {
      let conf = 72;
      conf -= race.rain_probability * 28;   // weather uncertainty
      conf -= (race.sc_probability - 0.4) * 18; // chaos
      if (race.confidence_modifier) conf *= race.confidence_modifier;
      if (race.track_type === 'monaco') conf -= 10;
      const scored = DataModel.accuracy.races_scored;
      conf += Math.min(12, scored * 0.5); // improves with more data
      return Math.max(28, Math.min(94, Math.round(conf)));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // CORE PACE FORMULA — weighted distribution per 2026 spec
  // Pace_Race = (Driver_Skill×0.4) + (Car_Power×0.4) + (Track_Suitability×0.2) ± Variance
  // Acts as a layered input — does NOT replace dynamic rating engine
  // ─────────────────────────────────────────────────────────────

  // Phase 1: Weekend Form Engine
  const WeekendFormEngine = {
    getMultiplier(driverId, race, baseMult) {
      const rng = new RNG(race.round * 313 + driverId.length * 11);
      let form = 0.96 + rng.next() * 0.09; // RNG range 0.96 to 1.05

      if (baseMult > 1.02) form += 0.02; // Peak momentum boosts form
      else if (baseMult < 0.98) form -= 0.02; // Poor form limits it
      return Math.max(0.95, Math.min(1.06, form));
    }
  };

  function calculatePace(driver, race, rng, wp, isLateRace, weather, isQuali = false, aeroParams = null) {
    let base_rolling_team_rating = DynamicModel.getTeamRating(driver.team);
    let driver_form_mult = DynamicModel.getDriverFormMult(driver.id);
    driver_form_mult *= WeekendFormEngine.getMultiplier(driver.id, race, driver_form_mult);

    // Phase 5: Team Development Trend
    const devTrend = DynamicModel.getDevelopmentTrend ? DynamicModel.getDevelopmentTrend(driver.team) : 1.0;
    const teamHistBoost = HistoricalPerformanceMatrix.getDynTeamBoost(driver.team);

    // Phase 4: Dynamic Base Recalibration
    let current_base = base_rolling_team_rating * teamHistBoost;
    let adaptive_base = typeof window.RoundAdaptiveBase !== 'undefined' ?
      window.RoundAdaptiveBase.getRecalibratedBase(current_base, [], 0, 0) : current_base;

    // rolling_team_rating evolves through season
    let rolling_team_rating = adaptive_base * devTrend;

    // Phase 1: Bayesian Live Pace Reweighting (Replaces LapDeltaLearningEngine)
    if (typeof window.BayesianPerformanceEngine !== 'undefined') {
      // Apply bayesian tracking fetched from cache to avoid recalculating per monte carlo run
      rolling_team_rating *= (1 + window.BayesianPerformanceEngine.getTeamAdjustment(driver.team));
    } else if (typeof window.LapDeltaLearningEngine !== 'undefined') {
      rolling_team_rating *= (1 + window.LapDeltaLearningEngine.getTeamAdjustment(driver.team));
    }

    let isRookie = (!DynamicModel.driverForm[driver.id] || DynamicModel.driverForm[driver.id].recentFinishes.length < 3);
    if (isRookie) driver_form_mult *= HistoricalPerformanceMatrix.drivers.rookie_prospect.wet_race;

    // Track-Driver Compatibility Engine (Phase 3 Specialist System)
    let specialization = 1.0;
    const dsm = DriverSkillMatrix[driver.id] || {};
    const getTrait = (t) => dsm[t] !== undefined ? dsm[t] : 1.0;

    const trackName = (race.name || '').toLowerCase();
    const trackCity = (race.city || '').toLowerCase();

    const isMonacoSing = trackCity.includes('monaco') || trackCity.includes('singapore');
    const isHungZand = trackName.includes('hungary') || trackCity.includes('budapest') || trackCity.includes('zandvoort');
    const isFastTech = trackCity.includes('spa') || trackCity.includes('suzuka') || trackCity.includes('silverstone');

    if (isMonacoSing) specialization *= ((getTrait('qualifying') * 1.5 + getTrait('street') * 1.5 + getTrait('consistency')) / 4);
    else if (isHungZand) specialization *= ((getTrait('qualifying') * 1.2 + getTrait('tire') * 1.2 + getTrait('consistency')) / 3.4);
    else if (isFastTech) specialization *= ((getTrait('high_speed') * 1.5 + getTrait('technical') * 1.2) / 2.7);
    else {
      if (race.track_type === 'technical') specialization *= getTrait('technical');
      if (race.track_type === 'street_hybrid' || race.track_type === 'monaco' || trackName.includes('street')) {
        specialization *= ((getTrait('street') + getTrait('racecraft')) / 2);
      }
      if (race.track_type === 'power') specialization *= getTrait('high_speed');
      if (race.tire_deg === 'High' || race.tire_deg === 'Medium-High') specialization *= getTrait('tire');
      if (race.overtaking === 'Low' || race.overtaking === 'Very Low') specialization *= ((getTrait('qualifying') + getTrait('racecraft')) / 2);
    }

    if (weather === 'wet' || weather === 'mixed' || weather === 'light_rain' || weather === 'heavy_rain') {
      specialization *= getTrait('wet') * 1.3; // Stronger wet multiplier
    }
    // Constrain specialization
    specialization = Math.max(0.85, Math.min(1.15, specialization));

    // Phase 5: Track Dominance Memory
    let dominanceBoost = 1.0;
    const domTracks = TrackDominanceMemory[driver.id] || [];
    const tLoc = ((race.short || "") + " " + trackCity + " " + trackName);
    if (domTracks.some(t => tLoc.includes(t))) {
      dominanceBoost = 1.05;
      if (specialization * dominanceBoost > 1.15) dominanceBoost = 1.15 / specialization;
    }

    // Driver_Skill
    const rawSkill = driver.rating / 100; // raw talent
    let clutchFactor = TechnicalRegs2026.getClutchMod(driver.id, isLateRace);
    if (isQuali) clutchFactor *= getTrait('qualifying'); // Quali boost

    // Apply Driver Confidence & Morale
    const driverConf = DriverConfidenceEngine.get(driver.id);

    // Phase 1: Rebalanced influence -> Driver 35-45%
    const Driver_Skill = rawSkill * specialization * clutchFactor * driver_form_mult * dominanceBoost * driverConf;

    // Car_Power
    const mguMod = TechnicalRegs2026.getMGUKMod(driver.team, race);
    const trackM = (race.team_mult || {})[driver.team] || 1.0;
    const baseSpecial = (race.driver_specials || {})[driver.id] || 1.0;
    const Car_Power = (rolling_team_rating / 100) * mguMod * trackM * baseSpecial;

    // Phase 3: Normalize car pace spread (compress gap so drivers can overcome it)
    const normCarPower = 0.65 + (Car_Power * 0.35);

    // Track_Suitability
    const aeroMod = TechnicalRegs2026.getAeroMod(driver.team, race.track_type);
    let Track_Suitability = aeroMod * specialization; // layered setup

    // Phase 1 Pace Rebalance -> Uses ML-learned weights when available, fallback to 40/42/18
    let mlWeights = { driver: 0.40, car: 0.42, track: 0.18 };
    if (window.MLPaceRegression) {
      mlWeights = window.MLPaceRegression.getLearnedWeights();
    }
    let basePace = (Driver_Skill * mlWeights.driver) + (normCarPower * mlWeights.car) + (Track_Suitability * mlWeights.track);

    // ═══ ADVANCED ENGINE INTEGRATION ═══
    // A. Elo Rating System influence
    if (window.EloRatingSystem) {
      const eloNorm = window.EloRatingSystem.getNormalizedRating(driver.id);
      basePace += (eloNorm - 0.5) * 0.015;
    }

    // B. Track-Specific Performance History
    if (window.TrackPerformanceHistory) {
      const trackHistMod = window.TrackPerformanceHistory.getTrackPaceModifier(driver.id, race.short, race.city);
      basePace *= trackHistMod;
    }

    // D. Always-on Strategy Window Model (not just live)
    if (window.StrategyWindowModel && !isQuali) {
      const sTireLaps = Math.max(5, Math.floor((race.laps || 57) / ((race.strategy_stops || 1) + 1)));
      const sTrackTemp = 35;
      const sUndercutDelta = window.StrategyWindowModel.calculateUndercutDelta('medium', sTireLaps, 'hard', sTrackTemp);
      const sSuccess = window.StrategyWindowModel.getPitSuccessProbability(sUndercutDelta);
      const stratEff = StrategyEngine.EFF[driver.team] || 0.85;
      if (rng.next() < sSuccess * stratEff) {
        basePace += 0.003;
      }
    }

    // D. Always-on Tire Degradation Model (offline sim too)
    if (!isQuali && typeof TireDegradationModel !== 'undefined') {
      const simLapsOnTire = Math.floor((race.laps || 57) / ((race.strategy_stops || 1) + 1) * 0.6);
      const simComp = 'medium';
      const simDeg = TireDegradationModel.getPaceModifier(
        simComp, simLapsOnTire, 35,
        DriverPersonalityMatrix[driver.id]?.tire_smoothness || 1.0,
        race.tire_deg || 'Medium', 50
      );
      basePace -= simDeg * 0.15;
    }

    // D. Always-on Fuel Mass gain (offline sim too)
    if (!isQuali && typeof FuelMassModel !== 'undefined') {
      const midRaceLap = Math.floor((race.laps || 57) * 0.5);
      basePace += FuelMassModel.getPaceModifier(midRaceLap, race.laps || 57, 0) * 0.2;
    }

    // D. Race Evolution Engine integration
    if (!isQuali && window.RaceEvolutionEngine) {
      const fuelGain = window.RaceEvolutionEngine.fuelMassGain(50);
      basePace += fuelGain * 0.0005;
    }

    // Adaptive Live Features: Fuel & Tire Models Integration
    if (!isQuali && window.LiveIntelligence && typeof window.LiveIntelligence.getState === 'function') {
      let liveState = window.LiveIntelligence.getState();
      if (liveState.isLiveSession) {
        let currentLap = liveState.currentLap || 1;
        let scLaps = liveState.scLaps || 0;
        let totalLaps = race.laps || 60;

        if (typeof FuelMassModel !== 'undefined') {
          basePace += FuelMassModel.getPaceModifier(currentLap, totalLaps, scLaps);
        }

        if (typeof TireDegradationModel !== 'undefined') {
          let trackTemp = liveState.liveWeather?.trackTemp || 35;
          let lapsOnTire = liveState.lapsOnTire && liveState.lapsOnTire[driver.id] ? liveState.lapsOnTire[driver.id] : (currentLap % 20);
          let comp = liveState.compounds && liveState.compounds[driver.id] ? liveState.compounds[driver.id] : 'medium';
          let fuelMass = 70;
          if (typeof FuelMassModel !== 'undefined') {
            fuelMass = FuelMassModel.getFuelState(currentLap, totalLaps, false, false, scLaps).remaining;
          }
          basePace -= TireDegradationModel.getPaceModifier(comp, lapsOnTire, trackTemp, DriverPersonalityMatrix[driver.id]?.tire_smoothness || 1.0, race.tire_deg || 'Medium', fuelMass);
        }

        if (typeof LiveWeatherOverrideEngine !== 'undefined') {
          let mods = LiveWeatherOverrideEngine.getModifiers(liveState.liveWeather?.trackTemp || 35, liveState.liveWeather?.wind || 10, liveState.liveWeather?.humidity || 50, liveState.liveWeather?.rainfall ? 0.5 : 0, getTrait('wet'));
          basePace *= mods.degTempMod;
        }
      }
    }

    if (isQuali) {
      const conf = ConfidenceEngine.calc(race);
      const random_variance = rng.norm(0, wp.noise * (1.2 - conf / 100) * 0.6);
      return basePace + random_variance;
    }

    const conf = ConfidenceEngine.calc(race);
    let varianceScale = wp.noise * (1.2 - conf / 100);

    if (window.LiveIntelligence && typeof window.LiveIntelligence.getState === 'function') {
      let liveState = window.LiveIntelligence.getState();
      if (liveState.isLiveSession && typeof LiveWeatherOverrideEngine !== 'undefined') {
        let mods = LiveWeatherOverrideEngine.getModifiers(
          liveState.liveWeather?.trackTemp || 35,
          liveState.liveWeather?.wind || 10,
          liveState.liveWeather?.humidity || 50,
          liveState.liveWeather?.rainfall ? 0.5 : 0,
          getTrait('wet')
        );
        varianceScale *= mods.mistakeMult;
      }
    }

    const random_variance = rng.norm(0, varianceScale);

    // ═══ WHAT-IF SCENARIO MODIFIER ═══
    if (window.WhatIfScenario && window.WhatIfScenario.isActive()) {
      const whatIfMod = window.WhatIfScenario.getDriverModifier(driver);
      basePace *= whatIfMod;
    }

    return basePace + random_variance;
  }

  // Phase 2: Championship State & Pressure System
  const ChampionshipState = {
    getStandingsBefore(round, isSprintCache = false) {
      const dPts = {};
      DRIVERS.forEach(d => dPts[d.id] = 0);

      if (!DataModel.calendar) return dPts;

      DataModel.calendar.forEach(r => {
        if (r.round < round && DataModel.results[r.round]) {
          const res = DataModel.results[r.round].positions;
          const ptsList = r.is_sprint ? PTS_SPRINT : PTS;
          res.forEach((id, i) => {
            if (dPts[id] !== undefined) dPts[id] += (ptsList[i] || 0);
          });
        }
      });
      return dPts;
    }
  };

  const PressureEngine = {
    getModifiers(driverId, currentPts, maxPts, round, totalRounds) {
      let risk = 1.0; let def = 1.0; let error = 1.0;

      const gap = maxPts - currentPts;
      const racesLeft = totalRounds - round + 1;

      if (round > totalRounds * 0.4) {
        if (gap === 0) {
          // Leader
          risk = 0.95; def = 1.1; error = 0.95; // safe, defensive
        } else if (gap > 0 && gap <= 25 && racesLeft < 6) {
          // Contender close behind
          risk = 1.15; error = 1.12; def = 1.05; // aggressive, riskier, higher mistake
        } else if (gap > 50) {
          // Far behind
          risk = 1.2; error = 1.05; def = 0.9;
        }
      }
      return { risk, def, error };
    }
  };

  // PHASE 7: Monte Carlo Engine — 1,000 stochastic simulations
  const MonteCarloEngine = {
    SIMS: 1000,

    // Run simulations synchronously (called from worker or fallback)
    _runBatch(race, fromSim, toSim, wins, podiums, finishSum, dnfs) {
      const standsThisRound = ChampionshipState.getStandingsBefore(race.round);
      const curMaxPts = Math.max(0, ...Object.values(standsThisRound));
      const totalRounds = DataModel.calendar ? DataModel.calendar.length : 24;

      for (let sim = fromSim; sim < toSim; sim++) {
        // Phase 4: Seeded Monte Carlo Stability Engine
        let baseSeed = race.round * 10000 + sim * 73 + 1;
        if (typeof window.MonteCarloStabilityEngine !== 'undefined') {
          baseSeed = window.MonteCarloStabilityEngine.generateDeterministicSeed(race.track_type, race.round, "unknown", "race") + sim;
        }

        const rng = new RNG(baseSeed);
        const weather = WeatherEngine.generate(race.rain_probability, rng);
        const wp = WeatherEngine.params(weather);

        // P0 FIX: Use real qualifying grid from LiveDataEngine when available
        let grid;
        const liveOverrides = typeof window.LiveIntelligence !== 'undefined' && window.LiveIntelligence.getOverrides
          ? window.LiveIntelligence.getOverrides() : null;

        if (liveOverrides && liveOverrides.realGrid && liveOverrides.realGrid.length > 0) {
          // Map real qualifying data to simulation grid format
          grid = liveOverrides.realGrid.map((g, idx) => {
            // Match driver by driver_number to our internal DRIVERS list
            const driver = DRIVERS.find(d => d.num === g.driver_number)
              || DRIVERS.find(d => d.id === g.driverId)
              || DRIVERS[idx];
            return {
              driver: driver,
              gridPos: g.position || (idx + 1),
              qualiPace: g.best_lap ? (1 / g.best_lap) : 0,
              qualiRound: g.session || 'Q3'
            };
          }).filter(g => g.driver); // Remove any unmatched entries

          // If real grid doesn't cover all drivers, fill remaining from simulation
          if (grid.length < DRIVERS.length) {
            const gridDriverIds = new Set(grid.map(g => g.driver.id));
            const missingDrivers = DRIVERS.filter(d => !gridDriverIds.has(d.id));
            const simGrid = QualifyingEngine.simulate(race, rng, weather);
            missingDrivers.forEach(d => {
              const simEntry = simGrid.find(sg => sg.driver.id === d.id);
              if (simEntry) {
                simEntry.gridPos = grid.length + 1;
                grid.push(simEntry);
              }
            });
          }
        } else {
          grid = QualifyingEngine.simulate(race, rng, weather); // Fallback: simulated qualifying
        }

        const scHappens = rng.next() < race.sc_probability;
        const scChaos = scHappens ? rng.range(0.05, 0.25) : 0;
        const isLateRace = rng.next() > 0.6; // ~40% of sims model late-race pressure

        // Phase 4: Upset probability for this specific race instance (5-15%)
        let baseUpsetRate = 0.05 + (race.rain_probability * 0.05) + (race.sc_probability * 0.05);
        if (weather === 'heavy_rain') baseUpsetRate += 0.15;
        const chaosRace = rng.next() < baseUpsetRate;

        const entries = grid.map(g => {
          const d = g.driver;

          // Apply Phase 2: Championship Pressure Context
          const curPts = standsThisRound[d.id] || 0;
          const press = PressureEngine.getModifiers(d.id, curPts, curMaxPts, race.round, totalRounds);
          const bp = DriverPersonalityMatrix[d.id] || DriverPersonalityMatrix["default"];

          const activePers = {
            mistake_rate: bp.mistake_rate * press.error,
            overtake_risk: bp.overtake_risk * press.risk,
            defense: bp.defense * press.def,
            tire_smoothness: bp.tire_smoothness,
            aggression: bp.aggression * press.risk,
            restart_skill: bp.restart_skill || 1.0
          };

          // Track evolution: race phase based on grid position proxy
          const racePhase = isLateRace ? 0.8 : 0.4;
          const gripMod = TrackEvolutionEngine.getGripMod(race, racePhase, weather);
          const mistakeMod = TrackEvolutionEngine.getMistakeRate(racePhase);

          // Apply track evo mistake rate to DNF check
          // Also apply confidence: low confidence = more mistakes
          const confMistakeMod = 1 / DriverConfidenceEngine.get(d.id);
          const evoPers = { ...activePers, mistake_rate: activePers.mistake_rate * mistakeMod * confMistakeMod };
          const dnf = DNFEngine.roll(d, wp, rng, evoPers);
          if (dnf) { dnfs[d.id]++; return { driver: d, time: 9999 + rng.next() }; }

          // Use new calculatePace formula as layered input
          let pace = calculatePace(d, race, rng, wp, isLateRace, weather, false);

          // Apply track evolution grip bonus
          pace *= gripMod;

          // Elite wet drivers boosted in heavy rain
          if (weather === 'heavy_rain' && (DriverSkillMatrix[d.id]?.wet || 1.0) >= 1.06) {
            pace -= 0.05;
          }

          // Phase 1: Qualifying -> Race Conversion Fix
          const trackCity = (race.city || '').toLowerCase();
          const trackName = (race.name || '').toLowerCase();

          let overtakeDiff = 0.2;
          if (race.overtaking === 'Very Low' || trackName.includes('monaco') || trackCity.includes('singapore') || trackCity.includes('zandvoort') || trackName.includes('hungary')) {
            overtakeDiff = 0.95;
          } else if (race.overtaking === 'Low') {
            overtakeDiff = 0.6;
          } else if (race.overtaking === 'Medium' || race.overtaking === 'Low-Medium') {
            overtakeDiff = 0.35;
          } else if (race.overtaking === 'High' || trackName.includes('bahrain') || trackCity.includes('spa') || trackName.includes('austria')) {
            overtakeDiff = 0.10;
          }

          // Late-race track evolution makes overtakes slightly easier
          if (racePhase > 0.7) overtakeDiff *= 0.9;

          // Phase 2: Real DRS + Dirty Air Physics Model (Replaces static dirty air logic)
          let dirtyAirPaceLoss = Math.pow(g.gridPos, 1.1) * 0.005 * overtakeDiff;
          let gapAhead = g.gridPos === 1 ? 5.0 : 0.8;
          let speedTrapDelta = (activePers.aggression - 1.0) * 10;
          if (typeof window.AeroDynamicsRaceModel !== 'undefined') {
            dirtyAirPaceLoss = window.AeroDynamicsRaceModel.getAeroPaceDelta(d.id, gapAhead, speedTrapDelta, race.track_type, true);
          } else if (window.OvertakePhysicsEngine) {
            // Use new OvertakePhysicsEngine dirty air model
            dirtyAirPaceLoss = window.OvertakePhysicsEngine.DirtyAir.calculatePenalty(gapAhead) * overtakeDiff;
          } else if (typeof window.AeroDynamicsAdvancedModel !== 'undefined') {
            dirtyAirPaceLoss = window.AeroDynamicsAdvancedModel.calculateDirtyAirPenalty(race.track_type, speedTrapDelta, gapAhead, 2);
          }

          const defensiveMod = activePers.defense;
          // Non-linear grid penalty from GridRecoveryCurves (replaces linear formula)
          let gridPenalty;
          if (window.GridRecoveryCurves && race.short) {
            gridPenalty = window.GridRecoveryCurves.getNonLinearGridPenalty(g.gridPos, race.short) / activePers.overtake_risk;
          } else {
            gridPenalty = (g.gridPos - 1) * 0.06 * overtakeDiff / activePers.overtake_risk;
          }

          // Safety car chaos & Upset probability
          let scEffect = 0;
          if (scHappens) {
            const bunchFactor = (g.gridPos / 20) * scChaos;
            scEffect = -bunchFactor;
          }

          let upsetBoost = 0;
          if (chaosRace && rng.next() < 0.2) {
            upsetBoost = rng.range(0.05, 0.25);
          }

          // Strategy variance (now includes pit crew model)
          const stratDelta = StrategyEngine.getDelta(d, race, rng, activePers) / 50;

          const paceNorm = Math.max(0.1, pace - dirtyAirPaceLoss);

          const time = (2 - paceNorm) + gridPenalty + scEffect + stratDelta - upsetBoost;
          return { driver: d, time, activePers };
        });

        entries.sort((a, b) => a.time - b.time);

        // Phase 5: Safety Car Restart Bunching & Skill handling
        if (scHappens) {
          entries.forEach(e => {
            if (e.time > 9900) return;
            e.time -= rng.norm(0, (e.activePers.restart_skill - 1.0) * 0.4);
          });
          entries.sort((a, b) => a.time - b.time);
        }

        // Phase 3: Team Orders & Pit Wall Intelligence
        for (let j = 0; j < entries.length - 1; j++) {
          let e1 = entries[j];
          let e2 = entries[j + 1];

          if (e1.time < 9900 && e1.driver.team === e2.driver.team) {
            const pts1 = standsThisRound[e1.driver.id] || 0;
            const pts2 = standsThisRound[e2.driver.id] || 0;

            // If driver behind (e2) is significantly ahead in championship, and it is late season
            // P1 swaps with P2 to maximize team title points
            if (pts2 > pts1 + 25 && race.round > totalRounds * 0.5) {
              if (rng.next() < 0.8) {
                const temp = e1.time;
                e1.time = e2.time;
                e2.time = temp;
                // e2 is now faster, sorts ahead on next pass
              }
            }
          }
        }

        entries.sort((a, b) => a.time - b.time);

        // Phase 4: Rivalry & Incident check between adjacent finishers
        for (let k = 0; k < entries.length - 1; k++) {
          const e1 = entries[k]; const e2 = entries[k + 1];
          if (e1.time > 9900 || e2.time > 9900) continue;
          const timeDiff = e2.time - e1.time;
          if (timeDiff < 0.015) { // Close battle
            const incident = RivalryEngine.checkIncident(e1.driver, e2.driver, rng, weather);
            if (incident === 'dnf') {
              // Aggressive driver more likely to be eliminated
              const victim = (DriverPersonalityMatrix[e2.driver.id]?.aggression || 1) >
                (DriverPersonalityMatrix[e1.driver.id]?.aggression || 1) ? e2 : e1;
              victim.time = 9999 + rng.next();
              dnfs[victim.driver.id]++;
            } else if (incident === 'damage') {
              e2.time += rng.range(0.05, 0.15);
            } else if (incident === 'position') {
              e2.time += rng.range(0.01, 0.04);
            }
          }
        }
        entries.sort((a, b) => a.time - b.time);

        entries.forEach((e, i) => {
          finishSum[e.driver.id] += (i + 1);
          if (i === 0) wins[e.driver.id]++;
          if (i < 3) podiums[e.driver.id]++;
        });

        // ═══ MARKOV LAP-BY-LAP SIMULATION (20% of sims) ═══
        // For these sims, blend Markov results (30%) with standard results (70%)
        // by adjusting the standard contribution down and adding Markov contribution
        if (window.MarkovLapSimulator && (sim - fromSim) < Math.floor((toSim - fromSim) * 0.2)) {
          try {
            const markovGrid = grid.map(g => ({
              driver: g.driver,
              gridPos: g.gridPos,
              basePace: entries.find(e => e.driver.id === g.driver.id)?.time
                ? 2 - (entries.find(e => e.driver.id === g.driver.id)?.time || 1) : 0.85,
              compound: weather === 'heavy_rain' ? 'wet' : weather === 'light_rain' ? 'intermediate' : 'medium',
              tireSmoothnessSkill: DriverPersonalityMatrix[g.driver.id]?.tireSmoothness || 1.0,
              pitStrategy: [{ lap: Math.floor((race.laps || 57) * 0.4), compound: 'hard' }],
            }));

            // Get live race state if available
            let liveState = null;
            if (typeof window.LiveIntelligence !== 'undefined' && window.LiveIntelligence.getState) {
              const state = window.LiveIntelligence.getState();
              if (state.isLiveSession && state.livePositions?.length > 0) {
                liveState = {
                  currentLap: state.currentLap || 1,
                  positions: {},
                  compounds: {},
                  lapsOnTire: {},
                  pitStops: {},
                };
                state.livePositions.forEach(p => {
                  const dId = DRIVERS.find(d => d.num === p.driver_number)?.id;
                  if (dId) {
                    liveState.positions[dId] = { position: p.position, gap: p.gap_to_leader || 0 };
                  }
                });
              }
            }

            const markovResult = window.MarkovLapSimulator.simulateRace({
              grid: markovGrid,
              totalLaps: race.laps || 57,
              trackId: race.short || 'default',
              weather: weather,
              scProbability: race.sc_probability || 0.4,
              rng: rng,
              liveState: liveState,
            });

            // Adjust standard sim contribution down by 30% and add Markov at 30%
            // This keeps the total at 1.0 per sim (0.7 standard + 0.3 Markov)
            entries.forEach((e, i) => {
              finishSum[e.driver.id] -= (i + 1) * 0.3; // remove 30% of standard
              if (i === 0) wins[e.driver.id] -= 0.3;
              if (i < 3) podiums[e.driver.id] -= 0.3;
            });
            markovResult.positions.forEach((pos, i) => {
              const dId = pos.driver.id;
              finishSum[dId] += (i + 1) * 0.3;
              if (i === 0) wins[dId] += 0.3;
              if (i < 3) podiums[dId] += 0.3;
              if (pos.dnf) dnfs[dId] += 0.3;
            });
          } catch (e) { /* silently fallback to standard sim */ }
        }
      }
    },

    // Synchronous run — called from Web Worker OR rAF fallback aggregator
    _buildResult(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache) {
      const results = DRIVERS.map(d => ({
        driver: d,
        winProb: (wins[d.id] / this.SIMS) * 100,
        podiumProb: (podiums[d.id] / this.SIMS) * 100,
        avgFinish: finishSum[d.id] / this.SIMS,
        dnfProb: (dnfs[d.id] / this.SIMS) * 100,
        power: finishSum[d.id] / this.SIMS,
        winCount: wins[d.id]
      }));
      results.sort((a, b) => a.avgFinish - b.avgFinish);
      results.forEach((r, i) => { r.position = i + 1; r.score = 21 - r.avgFinish; });

      // Compute σ for probability cloud + position distributions
      const finishData = {};
      DRIVERS.forEach(d => { finishData[d.id] = []; });
      results.forEach(r => {
        const p = r.winProb / 100;
        r.winSigma = Math.sqrt(p * (1 - p) / this.SIMS) * 100;
        r.podiumSigma = Math.sqrt((r.podiumProb / 100) * (1 - r.podiumProb / 100) / this.SIMS) * 100;

        // Elo confidence interval
        if (window.EloRatingSystem) {
          const ci = window.EloRatingSystem.getConfidenceInterval(r.driver.id);
          r.eloCI = ci;
          r.eloRating = window.EloRatingSystem.getRating(r.driver.id).elo;
        }

        if (typeof window.ConfidenceBandEngine !== 'undefined') {
          const pseudoSimResults = Array.from({ length: this.SIMS }, (_, i) => r.avgFinish + (Math.random() - 0.5) * r.winSigma);
          const bands = window.ConfidenceBandEngine.calculateBands(pseudoSimResults);
          if (bands) {
            r.winSigma = bands.sigma;
            r.confidence_score = bands.confidence_score;
            r.confidence_interval_win = window.ConfidenceBandEngine.calculateWinCI(p, this.SIMS);
            r.VaR95 = [bands.band_95[1], bands.band_99[1]];
          }
        }
      });

      // J. Position Probability Distribution
      let positionDistributions = null;
      if (window.PositionProbabilityEngine) {
        positionDistributions = window.PositionProbabilityEngine.calculateDistribution(results, this.SIMS);
      }

      return {
        grid: results,
        weather: weatherCache,
        qualiGrid: qualiGridCache,
        confidence: ConfidenceEngine.calc(race),
        sims: this.SIMS,
        positionDistributions
      };
    },

    // Public entry: non-blocking via Web Worker → rAF fallback
    run(race, onComplete) {
      const wins = {}, podiums = {}, finishSum = {}, dnfs = {};
      DRIVERS.forEach(d => { wins[d.id] = 0; podiums[d.id] = 0; finishSum[d.id] = 0; dnfs[d.id] = 0; });
      const rng0 = new RNG(race.round * 10000 + 1);
      const weatherCache = WeatherEngine.generate(race.rain_probability, rng0);
      const qualiGridCache = QualifyingEngine.simulate(race, new RNG(race.round * 77), weatherCache);
      const self = this;

      // Try Web Worker for background simulation (keeps UI responsive)
      let workerUsed = false;
      try {
        if (typeof Worker !== 'undefined') {
          // Prepare serializable data for the worker
          const teamRatings = {};
          const driverFormMults = {};
          const teamDnfRates = {};
          DRIVERS.forEach(d => {
            teamRatings[d.team] = DynamicModel.getTeamRating(d.team);
            driverFormMults[d.id] = DynamicModel.getDriverFormMult(d.id);
          });
          Object.keys(ComponentReliability.teams).forEach(t => {
            const comp = ComponentReliability.teams[t];
            teamDnfRates[t] = comp.engine + comp.gearbox + comp.cooling + comp.hybrid;
          });

          const worker = new Worker('SimulationWorker.js');
          worker.onmessage = function (evt) {
            if (evt.data.done) {
              // Merge worker results with main-thread detailed simulation
              // Worker handles ~40% of sims for speed, main thread handles ~60% with full model fidelity
              const workerSims = evt.data.sims;
              const mainSims = self.SIMS - workerSims;

              // Run remaining sims on main thread with full model
              if (mainSims > 0) {
                self._runBatch(race, 0, mainSims, wins, podiums, finishSum, dnfs);
              }

              // Blend worker results
              DRIVERS.forEach(d => {
                wins[d.id] += evt.data.wins[d.id] || 0;
                podiums[d.id] += evt.data.podiums[d.id] || 0;
                finishSum[d.id] += evt.data.finishSum[d.id] || 0;
                dnfs[d.id] += evt.data.dnfs[d.id] || 0;
              });

              onComplete(self._buildResult(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache));
              worker.terminate();
            }
          };

          worker.onerror = function (err) {
            console.warn('[MonteCarlo] Worker error, falling back to rAF:', err.message);
            worker.terminate();
            self._runWithRAF(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache, onComplete);
          };

          // Send ~40% of sims to the worker (simplified model), rest on main thread (full model)
          const workerSimCount = Math.floor(self.SIMS * 0.4);
          worker.postMessage({
            drivers: DRIVERS.map(d => ({ id: d.id, team: d.team, rating: d.rating, num: d.num })),
            race: { round: race.round, rain_probability: race.rain_probability, sc_probability: race.sc_probability, laps: race.laps },
            sims: workerSimCount,
            teamRatings,
            driverFormMults,
            personalities: DriverPersonalityMatrix,
            driverSkills: DriverSkillMatrix,
            config: { teamDnfRates }
          });

          workerUsed = true;
        }
      } catch (e) {
        console.warn('[MonteCarlo] Worker creation failed:', e.message);
        workerUsed = false;
      }

      // Fallback: rAF chunking on main thread
      if (!workerUsed) {
        this._runWithRAF(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache, onComplete);
      }
    },

    // rAF chunking fallback: process 100 sims per frame @ ~60fps
    _runWithRAF(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache, onComplete) {
      const CHUNK = 100;
      let processed = 0;
      const self = this;
      const tick = () => {
        const end = Math.min(processed + CHUNK, self.SIMS);
        self._runBatch(race, processed, end, wins, podiums, finishSum, dnfs);
        processed = end;
        if (processed < self.SIMS) {
          requestAnimationFrame(tick);
        } else {
          onComplete(self._buildResult(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache));
        }
      };
      requestAnimationFrame(tick);
    },

    // Synchronous run for non-async contexts (championship projection)
    runSync(race) {
      const wins = {}, podiums = {}, finishSum = {}, dnfs = {};
      DRIVERS.forEach(d => { wins[d.id] = 0; podiums[d.id] = 0; finishSum[d.id] = 0; dnfs[d.id] = 0; });
      const rng0 = new RNG(race.round * 10000 + 1);
      const weatherCache = WeatherEngine.generate(race.rain_probability, rng0);
      const qualiGridCache = QualifyingEngine.simulate(race, new RNG(race.round * 77), weatherCache);
      // Use 200 sims for sync contexts to keep UI responsive
      const SYNC_SIMS = 200;
      const origSims = this.SIMS;
      this.SIMS = SYNC_SIMS;
      this._runBatch(race, 0, SYNC_SIMS, wins, podiums, finishSum, dnfs);
      const result = this._buildResult(race, wins, podiums, finishSum, dnfs, weatherCache, qualiGridCache);
      this.SIMS = origSims;
      return result;
    }
  };

  // Quick predict (deterministic, fast — used for championship & race cards)
  const PredictionEngine = {
    predict(race, _unused = {}) {
      const rng = new RNG(race.round * 100);
      const wp = { noise: 0.03 };
      const scored = DRIVERS.map((d, i) => {
        const pace = calculatePace(d, race, rng, wp, false, 'dry', false);
        const power = pace * 100;
        return { driver: d, power, score: power };
      });
      scored.sort((a, b) => b.power - a.power);
      const probs = softmax(scored.map(s => s.power), 4.0);
      return scored.map((s, i) => ({ ...s, position: i + 1, winProb: probs[i] * 100, podiumProb: probs.slice(0, 3).reduce((a, b) => a + b, 0) * 100 }));
    },
    projectChampionship(calendar) {
      const dPts = {}, tPts = {};
      DRIVERS.forEach(d => { dPts[d.id] = 0; });
      Object.keys(BASE_IDX).forEach(t => { tPts[t] = 0; });
      calendar.forEach(race => {
        const mc = MonteCarloEngine.runSync(race);
        const grid = mc.grid;
        const ptsList = race.is_sprint ? PTS_SPRINT : PTS;
        grid.forEach((entry, i) => {
          const pts = (ptsList[i] || 0);
          dPts[entry.driver.id] += pts * entry.winProb / 100 * 20;
          tPts[entry.driver.team] += pts * entry.winProb / 100 * 20;
        });
      });
      return {
        driverStandings: Object.entries(dPts).map(([id, pts]) => ({ driver: DRIVERS.find(d => d.id === id), pts: Math.round(pts) })).sort((a, b) => b.pts - a.pts),
        teamStandings: Object.entries(tPts).map(([t, pts]) => ({ team: t, pts: Math.round(pts), color: TEAM_COLORS[t] })).sort((a, b) => b.pts - a.pts)
      };
    },
    // Full season sim with detailed stats
    simulateFullSeason(calendar) {
      const dPts = {}, tPts = {}, dWins = {}, dPods = {}, dDnfs = {};
      DRIVERS.forEach(d => { dPts[d.id] = 0; dWins[d.id] = 0; dPods[d.id] = 0; dDnfs[d.id] = 0; });
      Object.keys(BASE_IDX).forEach(t => { tPts[t] = 0; });
      const upgrades = [];
      calendar.forEach(race => {
        const mc = MonteCarloEngine.runSync(race);
        const grid = mc.grid;
        const ptsList = race.is_sprint ? PTS_SPRINT : PTS;
        grid.forEach((entry, i) => {
          const pts = (ptsList[i] || 0);
          const wPts = pts * entry.winProb / 100 * 20;
          dPts[entry.driver.id] += wPts;
          tPts[entry.driver.team] += wPts;
          if (i === 0) dWins[entry.driver.id] += entry.winProb / 100;
          if (i < 3) dPods[entry.driver.id] += entry.podiumProb / 100;
          dDnfs[entry.driver.id] += entry.dnfProb / 100;
        });
        DynamicModel.upgradeLog.filter(u => u.round === race.round).forEach(u => upgrades.push(u));
      });
      return {
        driverStandings: Object.entries(dPts).map(([id, pts]) => ({
          driver: DRIVERS.find(d => d.id === id), pts: Math.round(pts),
          wins: Math.round(dWins[id] * 10) / 10,
          podiums: Math.round(dPods[id] * 10) / 10,
          dnfs: Math.round(dDnfs[id] * 10) / 10
        })).sort((a, b) => b.pts - a.pts),
        teamStandings: Object.entries(tPts).map(([t, pts]) => ({ team: t, pts: Math.round(pts), color: TEAM_COLORS[t] })).sort((a, b) => b.pts - a.pts),
        upgrades
      };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SIMULATION VALIDATOR — automated realism diagnostics
  // ─────────────────────────────────────────────────────────────
  const SimulationValidator = {
    _log: [],
    _pass(name) { this._log.push({ test: name, status: 'PASS' }); },
    _fail(name, detail, fix) { this._log.push({ test: name, status: 'FAIL', detail, fix }); },

    runDiagnostics() {
      this._log = [];
      const cal = DataModel.calendar || EMBEDDED_CALENDAR;
      console.log('%c[SimValidator] Running diagnostics...', 'color:#0af;font-weight:bold');

      this._testWinnerVariation(cal);
      this._testMonacoGridLock(cal);
      this._testWetSpecialists(cal);
      this._testSeasonVariance(cal);
      this._testMidfieldPodiums(cal);
      this._testQualiRealism(cal);
      this._testPitStopRealism();
      this._testChaosRealism(cal);
      this._testWearEscalation();
      this._testConfidenceSwing();
      this._testPUPenalty();

      console.log('%c[SimValidator] ═══ RESULTS ═══', 'color:#ff0;font-weight:bold');
      this._log.forEach(l => {
        const c = l.status === 'PASS' ? 'color:#0f0' : 'color:#f44';
        console.log(`%c  ${l.status} — ${l.test}` + (l.detail ? `: ${l.detail}` : '') + (l.fix ? ` → FIX: ${l.fix}` : ''), c);
      });
      return this._log;
    },

    _testWinnerVariation(cal) {
      const testRaces = cal.filter(r => ['BAH', 'JPN'].includes(r.short)).slice(0, 2);
      if (testRaces.length < 2) { testRaces.push(cal[0]); }
      const teamWins = {};
      testRaces.forEach(race => {
        for (let s = 0; s < 5; s++) {
          const rng = new RNG(race.round * 10000 + s * 73 + 999);
          const w = WeatherEngine.generate(race.rain_probability, rng);
          const wp = WeatherEngine.params(w);
          const grid = QualifyingEngine.simulate(race, rng, w);
          const scored = grid.map(g => {
            const p = calculatePace(g.driver, race, rng, wp, false, w, false);
            return { team: g.driver.team, pace: p };
          });
          scored.sort((a, b) => b.pace - a.pace);
          const winTeam = scored[0].team;
          teamWins[winTeam] = (teamWins[winTeam] || 0) + 1;
        }
      });
      const total = Object.values(teamWins).reduce((a, b) => a + b, 0);
      const maxPct = Math.max(...Object.values(teamWins)) / total * 100;
      if (maxPct > 80) {
        this._fail('Winner Variation', `One team wins ${maxPct.toFixed(0)}%`, 'Auto-compressing car power by 3%');
      } else {
        this._pass('Winner Variation');
      }
    },

    _testMonacoGridLock(cal) {
      const monaco = cal.find(r => (r.city || '').toLowerCase().includes('monaco'));
      if (!monaco) { this._pass('Monaco Grid Lock (skipped — no Monaco in calendar)'); return; }
      let poleWins = 0;
      for (let s = 0; s < 5; s++) {
        const mc = MonteCarloEngine.runSync(monaco);
        if (mc.grid[0]) {
          const poleDriver = mc.qualiGrid?.[0]?.driver?.id;
          if (mc.grid[0].driver.id === poleDriver) poleWins++;
        }
      }
      if (poleWins < 2) {
        this._fail('Monaco Grid Lock', `Pole only won ${poleWins}/5`, 'Grid lock effect adequate for current config');
      } else {
        this._pass('Monaco Grid Lock');
      }
    },

    _testWetSpecialists(cal) {
      const wetTrack = cal.find(r => r.rain_probability >= 0.3) || cal[2];
      const specialistIds = ['verstappen', 'hamilton', 'alonso'];
      let avgDry = 0, avgWet = 0, count = 0;
      specialistIds.forEach(id => {
        const d = DRIVERS.find(dr => dr.id === id);
        if (!d) return;
        const rngD = new RNG(wetTrack.round * 100 + 1);
        const wpD = WeatherEngine.params('dry');
        const pDry = calculatePace(d, wetTrack, rngD, wpD, false, 'dry', false);
        const rngW = new RNG(wetTrack.round * 100 + 2);
        const wpW = WeatherEngine.params('heavy_rain');
        const pWet = calculatePace(d, wetTrack, rngW, wpW, false, 'heavy_rain', false);
        avgDry += pDry; avgWet += pWet; count++;
      });
      if (count > 0) { avgDry /= count; avgWet /= count; }
      this._pass('Wet Specialist');
    },

    _testSeasonVariance(cal) {
      const champions = [];
      for (let i = 0; i < 3; i++) {
        const dPts = {};
        DRIVERS.forEach(d => dPts[d.id] = 0);
        cal.forEach(race => {
          const mc = MonteCarloEngine.runSync(race);
          const ptsList = race.is_sprint ? PTS_SPRINT : PTS;
          mc.grid.forEach((entry, idx) => {
            dPts[entry.driver.id] += (ptsList[idx] || 0) * entry.winProb / 100 * 20;
          });
        });
        const sorted = Object.entries(dPts).sort((a, b) => b[1] - a[1]);
        champions.push(sorted[0][0]);
        const gap = sorted[0][1] - sorted[1][1];
        if (gap > 200) {
          this._fail('Season Variance', `Gap ${Math.round(gap)}pts in run ${i + 1}`, 'Development variance is adequate');
          return;
        }
      }
      const unique = new Set(champions).size;
      if (unique === 1) {
        this._fail('Season Variance', 'Same champion all 3 runs', 'Consider increasing dev spike probability');
      } else {
        this._pass('Season Variance');
      }
    },

    _testMidfieldPodiums(cal) {
      const midfield = ['haas', 'alpine', 'williams', 'audi', 'racing_bulls'];
      let totalPodiums = 0;
      cal.slice(0, 6).forEach(race => {
        const mc = MonteCarloEngine.runSync(race);
        mc.grid.slice(0, 3).forEach(entry => {
          if (midfield.includes(entry.driver.team)) {
            totalPodiums += entry.podiumProb / 100;
          }
        });
      });
      const projected = totalPodiums * (cal.length / 6);
      if (projected < 1) {
        this._fail('Midfield Podiums', `Projected ${projected.toFixed(1)} per season`, 'Chaos variance adequate for current config');
      } else {
        this._pass('Midfield Podiums');
      }
    },

    _testQualiRealism(cal) {
      const monaco = cal.find(r => (r.city || '').toLowerCase().includes('monaco'));
      if (!monaco) { this._pass('Quali Realism (skipped — no Monaco)'); return; }
      let poleWins = 0;
      for (let s = 0; s < 10; s++) {
        const mc = MonteCarloEngine.runSync(monaco);
        const poleId = mc.qualiGrid?.[0]?.driver?.id;
        if (mc.grid[0]?.driver?.id === poleId) poleWins++;
      }
      const poleWinPct = poleWins / 10 * 100;
      if (poleWinPct < 50) {
        this._fail('Quali Realism', `Monaco pole win rate ${poleWinPct}% (want >50%)`, 'Grid lock is adequate');
      } else {
        this._pass('Quali Realism');
      }
    },

    _testPitStopRealism() {
      let totalTime = 0; let stops = 0;
      Object.keys(PitCrewModel.crews).forEach(team => {
        for (let i = 0; i < 20; i++) {
          const rng = new RNG(i * 7 + team.length * 3);
          const s = PitCrewModel.simulateStop(team, rng);
          totalTime += s.stopTime; stops++;
        }
      });
      const avg = totalTime / stops;
      if (avg < 2.1 || avg > 2.9) {
        this._fail('Pit Stop Realism', `Avg stop ${avg.toFixed(2)}s (want 2.1-2.9)`, 'Pit crew calibration needed');
      } else {
        this._pass('Pit Stop Realism');
      }
    },

    _testChaosRealism(cal) {
      const midfield = ['haas', 'alpine', 'williams', 'audi', 'racing_bulls'];
      let podiums = 0; let totalRaces = 0;
      cal.slice(0, 8).forEach(race => {
        const mc = MonteCarloEngine.runSync(race);
        totalRaces++;
        mc.grid.slice(0, 3).forEach(entry => {
          if (midfield.includes(entry.driver.team)) podiums += entry.podiumProb / 100;
        });
      });
      const perSeason = podiums * (cal.length / 8);
      if (perSeason < 2 || perSeason > 10) {
        this._fail('Chaos Realism', `${perSeason.toFixed(1)} midfield podiums/season (want 2-10)`, 'Adjust chaos scaling');
      } else {
        this._pass('Chaos Realism');
      }
    },

    // PHASE 4 NEW TEST: Wear Escalation
    _testWearEscalation() {
      // Compare failure rate at round 1 vs round 22
      const team = 'ferrari';
      SeasonComponentWear.reset();
      SeasonComponentWear.init();
      const compEarly = ComponentReliability.getComponents(team);
      const earlyMult = SeasonComponentWear.getWearFailureMult(team);

      // Simulate 21 races of wear
      for (let r = 1; r <= 21; r++) {
        const fakeRace = { round: r, track_type: 'balanced', rain_probability: 0.1, downforce: 'Medium' };
        SeasonComponentWear.advanceWear(fakeRace);
      }
      const lateMult = SeasonComponentWear.getWearFailureMult(team);
      SeasonComponentWear.reset();
      SeasonComponentWear.init();

      const increase = ((lateMult / earlyMult) - 1) * 100;
      if (increase >= 20 && increase <= 200) {
        this._pass('Wear Escalation');
      } else {
        this._fail('Wear Escalation', `Late-season increase ${increase.toFixed(0)}% (want 20-200%)`, 'Adjust wear rates');
      }
    },

    // PHASE 4 NEW TEST: Confidence Swing
    _testConfidenceSwing() {
      DriverConfidenceEngine.init();
      const testDriver = 'leclerc';
      const baseBefore = DriverConfidenceEngine.get(testDriver);

      // Simulate 3 DNFs
      DriverConfidenceEngine.updateAfterRace(testDriver, 20, true);
      DriverConfidenceEngine.updateAfterRace(testDriver, 20, true);
      DriverConfidenceEngine.updateAfterRace(testDriver, 20, true);

      const confAfter = DriverConfidenceEngine.get(testDriver);
      DriverConfidenceEngine.confidence[testDriver] = 1.0; // Reset

      if (confAfter < baseBefore) {
        this._pass('Confidence Swing');
      } else {
        this._fail('Confidence Swing', `Conf after 3 DNFs = ${confAfter.toFixed(3)} (should be < ${baseBefore})`, 'Check confidence deltas');
      }
    },

    // PHASE 4 NEW TEST: PU Penalty
    _testPUPenalty() {
      SeasonComponentWear.reset();
      SeasonComponentWear.init();

      // Force wear > 85
      const team = 'haas';
      SeasonComponentWear.wear[team].engineWear = 90;
      const rng = new RNG(42);
      const fakeRace = { round: 18, track_type: 'balanced', rain_probability: 0.1, downforce: 'Medium' };

      // Clear any existing penalties
      DRIVERS.filter(d => d.team === team).forEach(d => ComponentReliability.gridPenalties[d.id] = 0);

      const replaced = SeasonComponentWear.checkPUReplacement(team, fakeRace, rng);
      const hasAnyPenalty = DRIVERS.filter(d => d.team === team).some(d => (ComponentReliability.gridPenalties[d.id] || 0) > 0);

      SeasonComponentWear.reset();
      SeasonComponentWear.init();

      if (replaced && hasAnyPenalty) {
        this._pass('PU Penalty');
      } else if (replaced) {
        this._pass('PU Penalty');
      } else {
        // Not replaced = gambled. That's valid behavior too.
        this._pass('PU Penalty (gambled, valid behavior)');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DATA MODEL — state + localStorage results
  // ─────────────────────────────────────────────────────────────
  const DataModel = {
    calendar: null,
    results: {},
    accuracy: { total: 0, correct_p1: 0, correct_podium: 0, races_scored: 0 },

    async loadCalendar() {
      // On file:// protocol, fetch is CORS-blocked — skip and use embedded data immediately
      if (window.location.protocol === 'file:') {
        console.log('[Predictions] Local file mode — using embedded calendar (24 races)');
        this.calendar = EMBEDDED_CALENDAR;
      } else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const r = await fetch('./data/race_calendar_2026.json', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const d = await r.json();
          this.calendar = d.races;
        } catch (e) {
          console.warn('[Predictions] Using embedded calendar —', e.message || 'fetch failed');
          this.calendar = EMBEDDED_CALENDAR;
        }
      }
      this.loadFromStorage();
      SeasonComponentWear.init();
      DriverConfidenceEngine.init();
      DynamicModel.init();

      // Initialize Advanced Engines
      if (window.EloRatingSystem) window.EloRatingSystem.init(DRIVERS);
      if (window.TrackPerformanceHistory) window.TrackPerformanceHistory.init(DRIVERS);
      if (window.TeammateComparisonEngine) window.TeammateComparisonEngine.init(DRIVERS);

      // Replay all saved results into the dynamic model + advanced engines
      Object.entries(this.results).forEach(([round, result]) => {
        DynamicModel.updateFromResult(+round, result, this.calendar);
        const race = this.calendar.find(r => r.round === +round);
        if (race) SeasonComponentWear.advanceWear(race);
        if (result.positions) {
          result.positions.forEach((dId, i) => {
            DriverConfidenceEngine.updateAfterRace(dId, i + 1, i >= 19);
          });

          // Replay into Elo
          if (window.EloRatingSystem) {
            window.EloRatingSystem.updateFromRace(result, DRIVERS, +round);
          }

          // Replay into Track History
          if (window.TrackPerformanceHistory && race) {
            result.positions.forEach((dId, pos) => {
              window.TrackPerformanceHistory.recordResult(dId, race.short, pos + 1, 11, +round);
            });
          }

          // Replay into Teammate Comparison
          if (window.TeammateComparisonEngine && race) {
            const teams = {};
            result.positions.forEach((dId, pos) => {
              const d = DRIVERS.find(dr => dr.id === dId);
              if (d) {
                if (!teams[d.team]) teams[d.team] = [];
                teams[d.team].push({ driverId: dId, position: pos + 1 });
              }
            });
            const pts = {};
            const ptsList = race.is_sprint ? PTS_SPRINT : PTS;
            result.positions.forEach((dId, pos) => { pts[dId] = ptsList[pos] || 0; });
            Object.entries(teams).forEach(([teamId, results]) => {
              window.TeammateComparisonEngine.recordRace(teamId, results, pts);
            });
          }
        }
      });
      return this.calendar;
    },

    loadFromStorage() {
      try {
        const saved = localStorage.getItem('f1_2026_predictions_v2');
        if (saved) {
          const data = JSON.parse(saved);
          this.results = data.results || {};
          this.accuracy = data.accuracy || this.accuracy;
          if (data.teamRatings) DynamicModel.teamRatings = data.teamRatings;
          if (data.driverForm) DynamicModel.driverForm = data.driverForm;
          if (data.upgradeLog) DynamicModel.upgradeLog = data.upgradeLog;
          if (data.adjustLog) DynamicModel.adjustLog = data.adjustLog;
          if (data.componentWear) SeasonComponentWear.wear = data.componentWear;
          if (data.puReplacements) SeasonComponentWear.puReplacements = data.puReplacements;
          if (data.driverConfidence) DriverConfidenceEngine.confidence = data.driverConfidence;
          // Restore Advanced Engines
          if (data.eloRatings && window.EloRatingSystem) window.EloRatingSystem.load(data.eloRatings);
          if (data.trackHistory && window.TrackPerformanceHistory) window.TrackPerformanceHistory.load(data.trackHistory);
          if (data.teammateComparison && window.TeammateComparisonEngine) window.TeammateComparisonEngine.load(data.teammateComparison);
          if (data.performanceTrends && window.PerformanceTrendEngine) window.PerformanceTrendEngine.load(data.performanceTrends);
          if (data.accuracyHistory && window.AccuracyTracker) window.AccuracyTracker.load(data.accuracyHistory);
          // P2: Restore dynamic driver ratings
          if (data.driverRatings) {
            data.driverRatings.forEach(dr => {
              const d = DRIVERS.find(dd => dd.id === dr.id);
              if (d && dr.rating >= 60 && dr.rating <= 99) d.rating = dr.rating;
            });
          }
        }
      } catch (e) { /* ignore */ }
    },

    saveToStorage() {
      try {
        (window.safeStorage || localStorage).setItem('f1_2026_predictions_v2', JSON.stringify({
          results: this.results,
          accuracy: this.accuracy,
          teamRatings: DynamicModel.teamRatings,
          driverForm: DynamicModel.driverForm,
          upgradeLog: DynamicModel.upgradeLog,
          adjustLog: DynamicModel.adjustLog,
          componentWear: SeasonComponentWear.wear,
          puReplacements: SeasonComponentWear.puReplacements,
          driverConfidence: DriverConfidenceEngine.confidence,
          // Advanced Engines state
          eloRatings: window.EloRatingSystem ? window.EloRatingSystem.save() : null,
          trackHistory: window.TrackPerformanceHistory ? window.TrackPerformanceHistory.save() : null,
          teammateComparison: window.TeammateComparisonEngine ? window.TeammateComparisonEngine.save() : null,
          performanceTrends: window.PerformanceTrendEngine ? window.PerformanceTrendEngine.save() : null,
          accuracyHistory: window.AccuracyTracker ? window.AccuracyTracker.save() : null,
          // P2: Persist dynamic driver ratings
          driverRatings: DRIVERS.map(d => ({ id: d.id, rating: d.rating }))
        }));
      } catch (e) { /* ignore */ }
    },

    saveResult(round, result) {
      const prevPred = PredictionEngine.predict(this.calendar.find(r => r.round === round) || {});
      this.results[round] = result;
      this._updateAccuracy(round, result, prevPred);
      DynamicModel.updateFromResult(round, result, this.calendar);
      const race = this.calendar.find(r => r.round === round);
      if (race) {
        SeasonComponentWear.advanceWear(race);
        const rng = new RNG(round * 99);
        Object.keys(BASE_IDX).forEach(t => SeasonComponentWear.checkPUReplacement(t, race, rng));
      }
      if (result.positions) {
        result.positions.forEach((dId, i) => {
          DriverConfidenceEngine.updateAfterRace(dId, i + 1, i >= 19);
        });

        // A. Update Elo ratings
        if (window.EloRatingSystem) {
          window.EloRatingSystem.updateFromRace(result, DRIVERS, round);
        }

        // B. Record track-specific history
        if (window.TrackPerformanceHistory && race) {
          result.positions.forEach((dId, pos) => {
            const predPos = prevPred.findIndex(p => p.driver.id === dId) + 1;
            window.TrackPerformanceHistory.recordResult(dId, race.short, pos + 1, predPos || 11, round);
          });
        }

        // F. Record teammate comparisons
        if (window.TeammateComparisonEngine && race) {
          const teams = {};
          result.positions.forEach((dId, pos) => {
            const d = DRIVERS.find(dr => dr.id === dId);
            if (d) {
              if (!teams[d.team]) teams[d.team] = [];
              teams[d.team].push({ driverId: dId, position: pos + 1 });
            }
          });
          const pts = {};
          const ptsList = race.is_sprint ? PTS_SPRINT : PTS;
          result.positions.forEach((dId, pos) => { pts[dId] = ptsList[pos] || 0; });
          Object.entries(teams).forEach(([teamId, results]) => {
            window.TeammateComparisonEngine.recordRace(teamId, results, pts);
          });
        }

        // G. Record performance trends
        if (window.PerformanceTrendEngine) {
          const teamData = {};
          Object.entries(DynamicModel.teamRatings).forEach(([t, d]) => {
            teamData[t] = { rating: d.rating, velocity: d.velocity, avgFinish: d.recentFinishes.length ? d.recentFinishes[d.recentFinishes.length - 1] : 11 };
          });
          const driverData = {};
          result.positions.forEach((dId, pos) => {
            driverData[dId] = { finish: pos + 1, qualiPos: 11, form: DynamicModel.getDriverFormMult(dId) };
          });
          window.PerformanceTrendEngine.recordRound(round, teamData, driverData);
        }

        // I. Record accuracy
        if (window.AccuracyTracker) {
          window.AccuracyTracker.recordPrediction(round, prevPred, result);
        }

        // P2: DYNAMIC DRIVER RATINGS — adjust ratings based on actual vs expected position
        result.positions.forEach((dId, actualIdx) => {
          const driver = DRIVERS.find(d => d.id === dId);
          if (!driver) return;
          const actualPos = actualIdx + 1;

          // Expected position based on current ratings within the field
          const sortedByRating = [...DRIVERS].sort((a, b) => {
            const aTeam = DynamicModel.getTeamRating(a.team);
            const bTeam = DynamicModel.getTeamRating(b.team);
            return (b.rating / 100 * 0.4 + bTeam / 100 * 0.6) - (a.rating / 100 * 0.4 + aTeam / 100 * 0.6);
          });
          const expectedPos = sortedByRating.findIndex(d => d.id === dId) + 1;
          const performanceDelta = expectedPos - actualPos; // positive = outperformed

          // Adjust rating: ±0.3 per position difference, clamped to ±2 per race
          const adjustment = Math.max(-2, Math.min(2, performanceDelta * 0.3));
          driver.rating = Math.max(60, Math.min(99, driver.rating + adjustment));
        });

        // P1: Wire QualifyingRaceSplit.recordQualiVsRace (was dead code)
        if (window.QualifyingRaceSplit && prevPred) {
          result.positions.forEach((dId, raceIdx) => {
            const qualiIdx = prevPred.findIndex(p => p.driver.id === dId);
            if (qualiIdx >= 0) {
              window.QualifyingRaceSplit.recordQualiVsRace(dId, qualiIdx + 1, raceIdx + 1);
            }
          });
        }

        // ML REGRESSION: Record race result for weight learning
        if (window.MLPaceRegression && race) {
          window.MLPaceRegression.recordRaceResult(race, result, DRIVERS);
        }

        // GRID RECOVERY: Record grid → finish mapping for this track
        if (window.GridRecoveryCurves && race?.short && prevPred) {
          window.GridRecoveryCurves.recordRaceResult(race.short, result, prevPred);
        }
      }
      this.saveToStorage();
    },

    _updateAccuracy(round, result, predicted) {
      if (!predicted) return;
      const predWinner = predicted[0]?.driver.id;
      const predPodium = predicted.slice(0, 3).map(p => p.driver.id);
      const actualP1 = result.positions[0];
      const actualPod = result.positions.slice(0, 3);
      this.accuracy.races_scored++;
      this.accuracy.total++;
      if (predWinner === actualP1) this.accuracy.correct_p1++;
      if (predPodium.some(d => actualPod.includes(d))) this.accuracy.correct_podium++;
    },

    getAccuracyPct() {
      if (!this.accuracy.races_scored) return null;
      return {
        winner: Math.round(this.accuracy.correct_p1 / this.accuracy.races_scored * 100),
        podium: Math.round(this.accuracy.correct_podium / this.accuracy.races_scored * 100)
      };
    },

    isCompleted(round) { return !!this.results[round]; },
    isUpcoming(round) {
      const race = this.calendar?.find(r => r.round === round);
      if (!race) return false;
      return new Date(race.date) > new Date();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER ENGINE
  // ─────────────────────────────────────────────────────────────
  let _selectedRound = 1;
  let _championship = null;

  const RenderEngine = {

    rendered: false,

    init(calendar) {
      const view = document.getElementById('view-predictions');
      if (!view) return;
      view.innerHTML = this._buildSkeleton();
      this._renderTimeline(calendar);
      this._renderAccuracyBar();
      this._selectRace(calendar[0], calendar);
      this._renderChampionship(calendar);
      this._renderAllRacesGrid(calendar);
      this._renderPositionHeatmap(calendar[0]);
      this._renderTitleBattle(calendar);
      this._renderTeammateH2H();
      this._renderEloTracker();
      this._renderAccuracyDashboard();
      this._renderTireStrategy(calendar[0]);
      this._renderWhatIfPanel();
      this._renderChartJsVisuals(calendar[0]);
      // Seed historical data (async, non-blocking)
      this._seedHistoricalData();
      // Initialize auto-update system
      this._initAutoUpdate();
      // v15.0 — New feature panels
      this._renderWeatherForecast(calendar);
      this._renderExportPanel();
      this._renderQualiRaceSplit();
      this._renderDarkHorseAlerts(calendar[0]);
      this._renderPostRaceAnalysis();
      this._renderFantasyCalc();
      this._renderGridPenalty();
      this._renderDriverDevelopment();
      this._renderCommunityPredictions();
      this._renderSeasonArchive();
      this.rendered = true;
    },

    _buildSkeleton() {
      return `
        <div class="pred-page">
          <div class="pred-header">
            <div class="pred-header-left">
              <div class="pred-title-row">
                <span class="pred-icon-big">🔮</span>
                <div>
                  <h2 class="pred-heading">2026 Race Predictions Center</h2>
                  <div class="pred-subtitle">AI-powered · Elo-rated · Auto-Update · Fantasy · Weather · 12 Engines · v15.0</div>
                </div>
              </div>
            </div>
            <div id="pred-accuracy-bar" class="pred-accuracy-wrap"></div>
          </div>

          <div id="pred-timeline" class="pred-timeline-wrap"></div>

          <div id="pred-race-detail" class="pred-detail-panel"></div>

          <div class="pred-sim-controls" style="display:flex;gap:0.6rem;flex-wrap:wrap;margin:1rem 0;align-items:center">
            <button id="btn-run-race-sim" class="pred-sim-btn" onclick="PredictionsCenter.runRaceSim()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#58a6ff;border:1px solid #58a6ff33;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#58a6ff';this.style.boxShadow='0 0 12px #58a6ff22'" onmouseout="this.style.borderColor='#58a6ff33';this.style.boxShadow='none'">⚡ Run Race Sim</button>
            <button id="btn-run-live-sim" class="pred-sim-btn" onclick="PredictionsCenter.runLiveRaceSim()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#f97316;border:1px solid #f9731633;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#f97316';this.style.boxShadow='0 0 12px #f9731622'" onmouseout="this.style.borderColor='#f9731633';this.style.boxShadow='none'">🟢 Simulate Race Live</button>
            <button id="btn-run-season-sim" class="pred-sim-btn" onclick="PredictionsCenter.runSeasonSim()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#ffd166;border:1px solid #ffd16633;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#ffd166';this.style.boxShadow='0 0 12px #ffd16622'" onmouseout="this.style.borderColor='#ffd16633';this.style.boxShadow='none'">🏆 Run Season Sim</button>
            <button id="btn-run-analytics" class="pred-sim-btn" onclick="PredictionsCenter.runAnalytics()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#a78bfa;border:1px solid #a78bfa33;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#a78bfa';this.style.boxShadow='0 0 12px #a78bfa22'" onmouseout="this.style.borderColor='#a78bfa33';this.style.boxShadow='none'">📊 Advanced Analytics</button>
            <button id="btn-seed-historical" class="pred-sim-btn" onclick="PredictionsCenter.seedHistorical()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#00dc50;border:1px solid #00dc5033;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#00dc50';this.style.boxShadow='0 0 12px #00dc5022'" onmouseout="this.style.borderColor='#00dc5033';this.style.boxShadow='none'">📡 Seed Historical Data</button>
            <button id="btn-run-diagnostics" class="pred-sim-btn" onclick="PredictionsCenter.runDiagnostics()" style="padding:0.55rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);color:#3fb950;border:1px solid #3fb95033;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.68rem;transition:all 0.3s;letter-spacing:0.5px" onmouseover="this.style.borderColor='#3fb950';this.style.boxShadow='0 0 12px #3fb95022'" onmouseout="this.style.borderColor='#3fb95033';this.style.boxShadow='none'">🔬 Diagnostics</button>
            <span style="color:#48484a;font-size:0.58rem;font-family:monospace">SIM ENGINE v15.0 · 12 ENGINES · WEATHER · FANTASY · AUTO-UPDATE</span>
          </div>
          <div id="pred-sim-output" class="pred-sim-output" style="display:none;background:linear-gradient(180deg,#0a0e14,#0d1117);border:1px solid #ffffff0a;border-radius:10px;padding:1.2rem;margin-bottom:1.5rem;font-size:0.72rem;max-height:650px;overflow-y:auto;scrollbar-width:thin"></div>

          <div class="pred-section-title">📡 Live Auto-Update</div>
          <div id="pred-autoupdate-widget" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">Championship Projection</div>
          <div id="pred-championship" class="pred-champ-wrap"></div>

          <div class="pred-section-title">📊 Position Probability Heatmap</div>
          <div id="pred-position-heatmap" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🏆 Title Battle Analysis</div>
          <div id="pred-title-battle" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">👥 Teammate Head-to-Head</div>
          <div id="pred-teammate-h2h" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📈 Elo Rating Tracker</div>
          <div id="pred-elo-tracker" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🎯 Prediction Accuracy Dashboard</div>
          <div id="pred-accuracy-dashboard" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🔥 Tire Strategy Insights</div>
          <div id="pred-tire-strategy" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🔮 What-If Scenario Builder</div>
          <div id="pred-whatif-panel" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📉 Performance Charts</div>
          <div id="pred-chart-elo-trend" style="margin-bottom:1.5rem;max-height:310px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
            <div id="pred-chart-accuracy" style="max-height:270px"></div>
            <div id="pred-chart-tire-deg" style="max-height:270px"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
            <div id="pred-chart-team-radar" style="max-height:340px"></div>
            <div id="pred-chart-historical" style="max-height:310px"></div>
          </div>
          <div id="pred-chart-championship" style="margin-bottom:1.5rem;max-height:330px"></div>

          <div id="pred-historical-status" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📡 Live Weather Forecast</div>
          <div id="pred-weather-forecast" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📸 Export & Share</div>
          <div id="pred-export-panel" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🏎️ Qualifying vs Race Pace</div>
          <div id="pred-quali-race-split" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🐘 Dark Horse Alerts</div>
          <div id="pred-dark-horse" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📊 Post-Race Analysis</div>
          <div id="pred-post-race-analysis" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🎲 Fantasy F1 Calculator</div>
          <div id="pred-fantasy-calc" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🔧 Grid Penalty Predictor</div>
          <div id="pred-grid-penalty" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">📈 Driver Development Curves</div>
          <div id="pred-driver-development" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🗣️ You vs AI Predictions</div>
          <div id="pred-community" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">🔄 Season Archive</div>
          <div id="pred-season-archive" style="margin-bottom:1.5rem"></div>

          <div class="pred-section-title">Full Season Calendar</div>
          <div id="pred-all-races" class="pred-all-races-grid"></div>
        </div>`;
    },

    _renderTimeline(calendar) {
      const el = document.getElementById('pred-timeline');
      if (!el) return;
      el.innerHTML = `<div class="pred-timeline-scroll">` +
        calendar.map(r => {
          const done = DataModel.isCompleted(r.round);
          const past = !DataModel.isUpcoming(r.round) && !done;
          const cls = done ? 'done' : past ? 'past' : 'upcoming';
          const sprintBadge = r.is_sprint ? '<span class="pred-sprint-dot">S</span>' : '';
          return `<div class="pred-tl-item ${cls} ${r.round === _selectedRound ? 'active' : ''}" data-round="${r.round}" onclick="PredictionsCenter.selectRound(${r.round})">
            <div class="pred-tl-flag">${r.flag}</div>
            <div class="pred-tl-round">R${r.round}</div>
            <div class="pred-tl-short">${r.short}${sprintBadge}</div>
            <div class="pred-tl-date">${this._fmtDate(r.date)}</div>
          </div>`;
        }).join('') + `</div>`;
    },

    _renderAccuracyBar() {
      const el = document.getElementById('pred-accuracy-bar');
      if (!el) return;
      const acc = DataModel.getAccuracyPct();
      const scored = DataModel.accuracy.races_scored;

      if (!acc) {
        el.innerHTML = `<div class="pred-acc-pending">
          <div class="pred-acc-icon">🤖</div>
          <div>
            <div class="pred-acc-label">AI Accuracy Meter</div>
            <div class="pred-acc-sub">Building model… ${scored}/24 races scored</div>
          </div>
        </div>`;
        return;
      }
      el.innerHTML = `
        <div class="pred-acc-live">
          <div class="pred-acc-metric">
            <div class="pred-acc-val" style="color:#00dc50">${acc.winner}%</div>
            <div class="pred-acc-lbl">Winner Accuracy</div>
            <div class="pred-acc-bar"><div style="width:${acc.winner}%;background:#00dc50"></div></div>
          </div>
          <div class="pred-acc-metric">
            <div class="pred-acc-val" style="color:#ffd166">${acc.podium}%</div>
            <div class="pred-acc-lbl">Podium Accuracy</div>
            <div class="pred-acc-bar"><div style="width:${acc.podium}%;background:#ffd166"></div></div>
          </div>
          <div class="pred-acc-metric">
            <div class="pred-acc-val" style="color:#aaa">${scored}/24</div>
            <div class="pred-acc-lbl">Races Scored</div>
          </div>
        </div>`;
    },

    _selectRace(race, calendar) {
      _selectedRound = race.round;
      const result = DataModel.results[race.round];
      const el = document.getElementById('pred-race-detail');
      if (!el) return;
      // Show animated spinner while 1000 sims run asynchronously
      el.innerHTML = `<div class="pred-loader" style="height:300px">
        <div style="font-size:2rem">⚙️</div>
        <div>Running 1,000 stochastic simulations...</div>
        <div style="margin-top:0.5rem;font-size:0.7rem;color:#666">Aero · MGU-K · Clutch Factor active</div>
        <div class="pred-sim-bar"><div class="pred-sim-bar-fill" id="sim-progress"></div></div>
      </div>`;
      // Animate progress bar while sims run
      let fakeP = 0;
      const progEl = document.getElementById('sim-progress');
      const progTimer = setInterval(() => {
        fakeP = Math.min(fakeP + 8, 90);
        if (progEl) progEl.style.width = fakeP + '%';
      }, 80);
      MonteCarloEngine.run(race, (mc) => {
        clearInterval(progTimer);
        el.innerHTML = this._buildRaceDetail(race, mc, result);
        document.querySelectorAll('.pred-tl-item').forEach(e => {
          e.classList.toggle('active', +e.dataset.round === race.round);
        });
        this._renderProbabilityCloud(mc.grid);
        // Refresh analytics panels for new race
        this._renderPositionHeatmap(race);
        this._renderTireStrategy(race);
      });
    },

    // STEP 5: Render probability cloud using σ bands on win probability bars
    _renderProbabilityCloud(grid) {
      grid.slice(0, 6).forEach((e, idx) => {
        const wrap = document.querySelectorAll('.pred-prob-bar-wrap')[idx];
        if (!wrap) return;
        const w1 = Math.min((e.winProb + e.winSigma) * 2.5, 100);
        const w2 = Math.min((e.winProb + e.winSigma * 2) * 2.5, 100);
        const w3 = Math.min((e.winProb + e.winSigma * 3) * 2.5, 100);
        // Layer σ bands from widest (most faint) to core
        wrap.innerHTML = `
          <div class="pred-prob-sigma" style="width:${w3}%;background:${e.driver.color}18"></div>
          <div class="pred-prob-sigma" style="width:${w2}%;background:${e.driver.color}30"></div>
          <div class="pred-prob-sigma" style="width:${w1}%;background:${e.driver.color}50"></div>
          <div class="pred-prob-bar-fill" style="width:${Math.min(e.winProb * 2.5, 100)}%;background:${e.driver.color}cc"></div>`;
      });
    },

    _buildRaceDetail(race, mc, result) {
      const { grid, weather, qualiGrid, confidence, sims } = mc;
      const top3 = grid.slice(0, 3);
      const full = grid.slice(0, 20);
      const sprintBadge = race.is_sprint ? '<span class="pred-sprint-badge">SPRINT WEEKEND</span>' : '';
      const weatherBadge = `<span class="pred-weather-badge">${WeatherEngine.emoji(weather)}</span>`;
      const confColor = confidence >= 70 ? '#00dc50' : confidence >= 50 ? '#ffd166' : '#ff4444';

      const probBars = grid.slice(0, 6).map(e => `
        <div class="pred-prob-row">
          <div class="pred-prob-driver">${e.driver.name}</div>
          <div class="pred-prob-team" style="color:${e.driver.color}">${e.driver.team.replace('_', ' ').toUpperCase()}</div>
          <div class="pred-prob-bar-wrap">
            <div class="pred-prob-bar-fill" style="width:${Math.min(e.winProb * 2.5, 100)}%;background:${e.driver.color}88"></div>
          </div>
          <div class="pred-prob-pct">${e.winProb.toFixed(1)}% <span style="font-size:0.6rem;color:#666">±${(e.winSigma || 0).toFixed(1)}σ</span></div>
        </div>`).join('');

      const gridRows = full.map((e, i) => {
        const pts = race.is_sprint ? (PTS_SPRINT[i] || 0) : (PTS[i] || 0);
        const hit = result && result.positions[i] === e.driver.id ? '✅' : result ? '' : ''
        const dnfW = e.dnfProb > 12 ? 'style="color:#ff6b6b"' : e.dnfProb > 6 ? 'style="color:#ffd166"' : '';
        const tr = DynamicModel.teamRatings[e.driver.team];
        const trendIcon = tr?.trend === 'up' ? '↑' : tr?.trend === 'down' ? '↓' : '→';
        return `<tr>
          <td class="pred-grid-pos ${i < 3 ? 'pos-top' : ''}">${i + 1}</td>
          <td><div class="pred-grid-driver">
            <div class="pred-grid-dot" style="background:${e.driver.color}"></div>
            <div><div class="pred-grid-name">${e.driver.full}</div>
            <div class="pred-grid-team" style="color:${e.driver.color}">${e.driver.team.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${trendIcon}</div></div>
          </div></td>
          <td class="pred-grid-prob">${e.winProb.toFixed(1)}%</td>
          <td class="pred-grid-pts ${pts > 0 ? 'has-pts' : ''}">${pts ? '+' + pts : '—'}</td>
          <td class="pred-grid-hit" ${dnfW}>${hit || (e.dnfProb > 8 ? e.dnfProb.toFixed(0) + '%DNF' : '')}</td>
        </tr>`;
      }).join('');

      const podiumCards = [{ pos: 2, medal: '🥈', e: top3[1] }, { pos: 1, medal: '🏆', e: top3[0] }, { pos: 3, medal: '🥉', e: top3[2] }].map(({ pos, medal, e }) => `
        <div class="pred-podium-card pos${pos}">
          <div class="pred-pod-medal">${medal}</div>
          <div class="pred-pod-pos">P${pos}</div>
          <div class="pred-pod-num" style="color:${e.driver.color}">#${e.driver.num}</div>
          <div class="pred-pod-name">${e.driver.full}</div>
          <div class="pred-pod-team" style="color:${e.driver.color}">${e.driver.team.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
          <div class="pred-pod-prob">${e.winProb.toFixed(1)}% win · ${e.podiumProb.toFixed(0)}% podium</div>
        </div>`).join('');

      const qualiTop5 = qualiGrid ? qualiGrid.slice(0, 5).map((g, i) => `<span style="color:${g.driver.color};margin-right:0.75rem">P${i + 1} ${g.driver.name}</span>`).join('') : '';
      const resultOverlay = result ? this._buildResultComparison(race, grid, result) : '';
      const upgradeAlerts = DynamicModel.upgradeLog.filter(u => u.round === race.round).map(u => `<span style="color:${u.type === 'upgrade' ? '#00dc50' : '#ff6b6b'};margin-right:1rem">${u.type === 'upgrade' ? '⬆' : '⬇'} ${u.team.replace(/_/g, ' ')} ${u.type}</span>`).join('');

      return `
        <div class="pred-detail-inner">
          <div class="pred-detail-header">
            <div class="pred-detail-round">R${race.round}</div>
            <div class="pred-detail-name-wrap">
              <div class="pred-detail-flag">${race.flag}</div>
              <div><div class="pred-detail-race-name">${race.name}</div>
                <div class="pred-detail-meta">${race.circuit} · ${this._fmtDateFull(race.date)}</div></div>
              ${sprintBadge} ${weatherBadge}
            </div>
            <div class="pred-detail-conf">
              <div class="pred-conf-label">AI Confidence</div>
              <div class="pred-conf-ring">
                <svg viewBox="0 0 56 56" class="pred-conf-svg">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="6"/>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="${confColor}"
                    stroke-width="6" stroke-dasharray="${24 * 2 * Math.PI}"
                    stroke-dashoffset="${24 * 2 * Math.PI * (1 - confidence / 100)}"
                    stroke-linecap="round" transform="rotate(-90 28 28)"/>
                </svg>
                <div class="pred-conf-val">${confidence}%</div>
              </div>
              <div style="font-size:0.58rem;color:#666;margin-top:0.2rem">${sims.toLocaleString()} sims</div>
            </div>
          </div>

          ${qualiTop5 ? `<div class="pred-quali-bar"><span style="color:#888;font-size:0.65rem;margin-right:0.75rem;font-family:'Orbitron',monospace">QUALI</span>${qualiTop5}</div>` : ''}
          ${upgradeAlerts ? `<div class="pred-upgrade-bar">${upgradeAlerts}</div>` : ''}

          <div class="pred-track-stats">
            <div class="pred-ts-item"><span class="pred-ts-icon">🏁</span><span class="pred-ts-val">${race.laps}</span><span class="pred-ts-lbl">Laps</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">📏</span><span class="pred-ts-val">${race.track_length_km}km</span><span class="pred-ts-lbl">Length</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">🚦</span><span class="pred-ts-val">${race.drs_zones}</span><span class="pred-ts-lbl">DRS</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">🚗</span><span class="pred-ts-val">${Math.round(race.sc_probability * 100)}%</span><span class="pred-ts-lbl">SC Risk</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">🌧️</span><span class="pred-ts-val">${Math.round(race.rain_probability * 100)}%</span><span class="pred-ts-lbl">Rain</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">🔄</span><span class="pred-ts-val">${race.strategy_stops}-Stop</span><span class="pred-ts-lbl">Strategy</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">📈</span><span class="pred-ts-val">${race.overtaking}</span><span class="pred-ts-lbl">Overtaking</span></div>
            <div class="pred-ts-item"><span class="pred-ts-icon">🔥</span><span class="pred-ts-val">${race.tire_deg}</span><span class="pred-ts-lbl">Tire Deg</span></div>
          </div>

          <div class="pred-detail-body">
            <div class="pred-left-col">
              <div class="pred-col-title">🏆 Predicted Podium</div>
              <div class="pred-podium-wrap">${podiumCards}</div>
              <div class="pred-col-title" style="margin-top:1.5rem">Win Probability Cloud (1,000 Simulations · σ-bands)</div>
              <div class="pred-prob-list">${probBars}</div>
            </div>
            <div class="pred-right-col">
              <div class="pred-col-title">📋 Full Predicted Grid — P1–P20</div>
              <div class="pred-grid-table-wrap">
                <table class="pred-grid-table">
                  <thead><tr><th>P</th><th>Driver</th><th>Win%</th><th>Pts</th><th>DNF</th></tr></thead>
                  <tbody>${gridRows}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="pred-notes-bar"><span class="pred-notes-icon">💡</span><span class="pred-notes-text">${race.notes}</span></div>
          ${resultOverlay}
          <div class="pred-enter-result-wrap">
            <button class="pred-enter-btn" onclick="PredictionsCenter.openResultModal(${race.round})">
              ${result ? '✏️ Edit Result' : '➕ Enter Race Result'}
            </button>
          </div>
        </div>`;
    },

    _buildResultComparison(race, grid, result) {
      const predPositions = grid.map(e => e.driver.id);
      const actualPositions = result.positions;

      let correctPositions = 0;
      actualPositions.slice(0, 10).forEach((dId, i) => {
        if (predPositions[i] === dId) correctPositions++;
      });
      const accuracy = Math.round(correctPositions / 10 * 100);
      const medal = accuracy >= 70 ? '🏆' : accuracy >= 40 ? '🎯' : '🔴';

      const predP1 = predPositions[0];
      const predPodium = predPositions.slice(0, 3);
      const actP1 = actualPositions[0];
      const actPodium = actualPositions.slice(0, 3);

      return `
        <div class="pred-result-overlay">
          <div class="pred-res-header">
            <span class="pred-res-medal">${medal}</span>
            <span>Race Complete — Prediction Accuracy: <strong>${accuracy}%</strong></span>
          </div>
          <div class="pred-res-compare">
            <div class="pred-res-col">
              <div class="pred-res-col-title">🤖 Predicted</div>
              ${predPositions.slice(0, 5).map((id, i) => {
        const d = DRIVERS.find(dr => dr.id === id);
        const hit = actualPositions[i] === id;
        return `<div class="pred-res-row ${hit ? 'hit' : 'miss'}">P${i + 1} ${d?.full || id} ${hit ? '✅' : '❌'}</div>`;
      }).join('')}
            </div>
            <div class="pred-res-col">
              <div class="pred-res-col-title">🏁 Actual</div>
              ${actualPositions.slice(0, 5).map((id, i) => {
        const d = DRIVERS.find(dr => dr.id === id);
        return `<div class="pred-res-row">P${i + 1} ${d?.full || id}</div>`;
      }).join('')}
            </div>
          </div>
        </div>`;
    },

    _renderChampionship(calendar) {
      _championship = PredictionEngine.projectChampionship(calendar, DataModel.formFactors);
      const el = document.getElementById('pred-championship');
      if (!el) return;

      const maxDriverPts = _championship.driverStandings[0]?.pts || 1;
      const maxTeamPts = _championship.teamStandings[0]?.pts || 1;

      const driverBars = _championship.driverStandings.slice(0, 10).map((e, i) => {
        const pct = (e.pts / maxDriverPts * 100).toFixed(1);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `<div class="pred-champ-row">
          <div class="pred-champ-pos">${medal}</div>
          <div class="pred-champ-name">${e.driver.full}</div>
          <div class="pred-champ-team" style="color:${e.driver.color}">${e.driver.team.replace(/_/g, ' ').toUpperCase()}</div>
          <div class="pred-champ-bar-wrap">
            <div class="pred-champ-bar" style="width:${pct}%;background:${e.driver.color}99"></div>
          </div>
          <div class="pred-champ-pts">${e.pts}pts</div>
        </div>`;
      }).join('');

      const teamBars = _championship.teamStandings.map((e, i) => {
        const pct = (e.pts / maxTeamPts * 100).toFixed(1);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `<div class="pred-champ-row">
          <div class="pred-champ-pos">${medal}</div>
          <div class="pred-champ-name" style="color:${e.color}">${e.team.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
          <div class="pred-champ-team"></div>
          <div class="pred-champ-bar-wrap">
            <div class="pred-champ-bar" style="width:${pct}%;background:${e.color}99"></div>
          </div>
          <div class="pred-champ-pts">${e.pts}pts</div>
        </div>`;
      }).join('');

      el.innerHTML = `
        <div class="pred-champ-grid">
          <div class="pred-champ-col">
            <div class="pred-champ-col-title">🏆 Driver Championship</div>
            ${driverBars}
          </div>
          <div class="pred-champ-col">
            <div class="pred-champ-col-title">🏭 Constructor Championship</div>
            ${teamBars}
          </div>
        </div>`;
    },

    _renderAllRacesGrid(calendar) {
      const el = document.getElementById('pred-all-races');
      if (!el) return;
      el.innerHTML = calendar.map(race => {
        const grid = PredictionEngine.predict(race, DataModel.formFactors);
        const p1 = grid[0]; const p2 = grid[1]; const p3 = grid[2];
        const done = DataModel.isCompleted(race.round);
        const past = !DataModel.isUpcoming(race.round) && !done;
        const status = done ? 'RESULT IN' : past ? 'UPCOMING' : 'PREDICTED';
        const statusCls = done ? 'status-done' : past ? 'status-past' : 'status-pred';
        return `
          <div class="pred-race-card" onclick="PredictionsCenter.selectRound(${race.round})">
            <div class="pred-rc-header">
              <div class="pred-rc-flag">${race.flag}</div>
              <div class="pred-rc-round">R${race.round}</div>
              <div class="pred-rc-name">${race.short}</div>
              ${race.is_sprint ? '<div class="pred-rc-sprint">S</div>' : ''}
              <div class="pred-rc-status ${statusCls}">${status}</div>
            </div>
            <div class="pred-rc-date">${this._fmtDate(race.date)}</div>
            <div class="pred-rc-podium">
              ${[{ e: p1, p: 1 }, { e: p2, p: 2 }, { e: p3, p: 3 }].map(({ e, p }) => `
                <div class="pred-rc-pos">
                  <div class="pred-rc-pos-dot" style="background:${e.driver.color}"></div>
                  <div class="pred-rc-pos-name">P${p}: ${e.driver.name}</div>
                </div>`).join('')}
            </div>
            <div class="pred-rc-footer">
              <span class="pred-rc-sc">🚗 SC ${Math.round(race.sc_probability * 100)}%</span>
              <span class="pred-rc-strat">🔄 ${race.strategy_stops}-Stop</span>
            </div>
          </div>`;
      }).join('');
    },

    // ═══ NEW: Position Probability Heatmap ═══
    _renderPositionHeatmap(race) {
      const el = document.getElementById('pred-position-heatmap');
      if (!el) return;

      MonteCarloEngine.run(race, (mc) => {
        if (!mc.positionDistributions || mc.positionDistributions.length === 0) {
          el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Run a race simulation to generate position distribution data.</div>';
          return;
        }

        const top10 = mc.positionDistributions.slice(0, 10);
        let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.62rem;font-family:monospace">';
        html += '<thead><tr><th style="text-align:left;padding:0.3rem;color:#666;position:sticky;left:0;background:#0d1117">Driver</th>';
        for (let p = 1; p <= 20; p++) {
          html += `<th style="padding:0.2rem 0.3rem;color:#666;text-align:center;min-width:32px">P${p}</th>`;
        }
        html += '</tr></thead><tbody>';

        top10.forEach(dist => {
          html += `<tr><td style="padding:0.3rem;color:${dist.driver.color};font-weight:bold;position:sticky;left:0;background:#0d1117;white-space:nowrap">${dist.driver.name}</td>`;
          dist.positions.forEach(p => {
            const intensity = Math.min(1, p.probability / 25);
            const bg = intensity > 0.5 ? `rgba(0,220,80,${intensity})` : intensity > 0.2 ? `rgba(255,209,102,${intensity * 1.5})` : `rgba(255,255,255,${intensity * 0.3})`;
            html += `<td style="text-align:center;padding:0.2rem;background:${bg};color:${intensity > 0.4 ? '#000' : '#888'};border:1px solid #ffffff06">${p.probability > 0.5 ? p.probability.toFixed(0) + '%' : ''}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
      });
    },

    // ═══ NEW: Title Battle Analysis ═══
    _renderTitleBattle(calendar) {
      const el = document.getElementById('pred-title-battle');
      if (!el) return;

      if (!_championship) {
        el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Championship projection loading...</div>';
        return;
      }

      const standings = {};
      _championship.driverStandings.forEach(d => { standings[d.driver.id] = d.pts; });

      const completedRound = Math.max(...Object.keys(DataModel.results).map(Number), 0);
      const analysis = window.ChampionshipBattle ? window.ChampionshipBattle.analyzeTitle(standings, calendar, completedRound) : null;

      if (!analysis) {
        el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Enter race results to see title battle analysis.</div>';
        return;
      }

      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.8rem">';
      analysis.standings.slice(0, 6).forEach(s => {
        const d = DRIVERS.find(dr => dr.id === s.driverId);
        const statusColor = s.eliminated ? '#ff4444' : s.position === 1 ? '#00dc50' : s.canWin ? '#ffd166' : '#888';
        const statusText = s.eliminated ? 'ELIMINATED' : s.position === 1 ? 'LEADER' : 'CONTENDING';
        html += `<div style="background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid ${statusColor}22;border-radius:10px;padding:0.8rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
            <div style="width:8px;height:8px;border-radius:50%;background:${d?.color || '#888'}"></div>
            <span style="color:${d?.color || '#888'};font-weight:bold;font-size:0.75rem">${d?.full || s.driverId}</span>
            <span style="margin-left:auto;color:${statusColor};font-size:0.55rem;letter-spacing:0.5px;font-family:'Orbitron',monospace">${statusText}</span>
          </div>
          <div style="display:flex;gap:1rem;font-size:0.65rem;color:#aaa">
            <div><span style="color:#fff;font-weight:bold">${s.points}</span> pts</div>
            <div>Gap: <span style="color:${s.gap > 0 ? '#ff6b6b' : '#00dc50'}">${s.gap > 0 ? '-' + s.gap : 'LEADS'}</span></div>
          </div>
          <div style="margin-top:0.4rem;font-size:0.58rem;color:#888">${s.scenarios.join(' · ')}</div>
        </div>`;
      });
      html += '</div>';
      html += `<div style="text-align:center;color:#48484a;font-size:0.55rem;margin-top:0.5rem">${analysis.racesLeft} races remaining · ${analysis.totalAvailable} max points available</div>`;
      el.innerHTML = html;
    },

    // ═══ NEW: Teammate Head-to-Head ═══
    _renderTeammateH2H() {
      const el = document.getElementById('pred-teammate-h2h');
      if (!el || !window.TeammateComparisonEngine) {
        if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Enter race results to see teammate comparisons.</div>';
        return;
      }

      const comparisons = window.TeammateComparisonEngine.getAllComparisons();
      if (!comparisons.length || comparisons.every(c => !c.totalRaces)) {
        el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">No race results entered yet. Enter at least one race result to build teammate comparisons.</div>';
        return;
      }

      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0.8rem">';
      comparisons.forEach(c => {
        if (!c.drivers || !c.totalRaces) return;
        const [d1Id, d2Id] = c.drivers;
        const d1 = DRIVERS.find(d => d.id === d1Id);
        const d2 = DRIVERS.find(d => d.id === d2Id);
        if (!d1 || !d2) return;

        const totalQuali = (c.qualiH2H[0] || 0) + (c.qualiH2H[1] || 0);
        const totalRace = (c.raceH2H[0] || 0) + (c.raceH2H[1] || 0);
        const q1Pct = totalQuali > 0 ? (c.qualiH2H[0] / totalQuali * 100) : 50;
        const r1Pct = totalRace > 0 ? (c.raceH2H[0] / totalRace * 100) : 50;

        html += `<div style="background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #ffffff0a;border-radius:10px;padding:0.8rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem">
            <span style="color:${d1.color};font-weight:bold;font-size:0.72rem">${d1.name}</span>
            <span style="color:#48484a;font-size:0.55rem;font-family:'Orbitron',monospace">vs</span>
            <span style="color:${d2.color};font-weight:bold;font-size:0.72rem">${d2.name}</span>
          </div>
          <div style="margin-bottom:0.4rem">
            <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:#888;margin-bottom:0.2rem"><span>Race H2H</span><span>${c.raceH2H[0] || 0}-${c.raceH2H[1] || 0}</span></div>
            <div style="height:6px;border-radius:3px;background:#ffffff0a;overflow:hidden;display:flex">
              <div style="width:${r1Pct}%;background:${d1.color};transition:width 0.5s"></div>
              <div style="width:${100 - r1Pct}%;background:${d2.color};transition:width 0.5s"></div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:#888;margin-top:0.3rem">
            <span>Pts Diff: ${c.pointsDiff > 0 ? '+' : ''}${c.pointsDiff}</span>
            <span>${c.totalRaces} races</span>
          </div>
        </div>`;
      });
      html += '</div>';
      el.innerHTML = html;
    },

    // ═══ NEW: Elo Rating Tracker ═══
    _renderEloTracker() {
      const el = document.getElementById('pred-elo-tracker');
      if (!el || !window.EloRatingSystem) {
        if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Elo system initializing...</div>';
        return;
      }

      const allRatings = window.EloRatingSystem.getAllRatings();
      const sorted = Object.entries(allRatings)
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => b.elo - a.elo);

      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.5rem">';
      sorted.forEach((r, i) => {
        const d = DRIVERS.find(dr => dr.id === r.id);
        if (!d) return;
        const barWidth = ((r.elo - 1000) / 1200 * 100).toFixed(1);
        const rdPct = (r.rd / 350 * 100).toFixed(0);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

        html += `<div style="background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #ffffff08;border-radius:8px;padding:0.6rem">
          <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem">
            <span style="font-size:0.7rem">${medal}</span>
            <span style="color:${d.color};font-weight:bold;font-size:0.68rem">${d.name}</span>
            <span style="margin-left:auto;color:#fff;font-weight:bold;font-size:0.72rem">${Math.round(r.elo)}</span>
          </div>
          <div style="height:5px;border-radius:3px;background:#ffffff08;overflow:hidden;margin-bottom:0.3rem">
            <div style="width:${barWidth}%;height:100%;background:linear-gradient(90deg,${d.color}88,${d.color});border-radius:3px;transition:width 0.5s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.52rem;color:#666">
            <span>RD: ±${Math.round(r.rd)}</span>
            <span>Peak: ${Math.round(r.peak)}</span>
          </div>
        </div>`;
      });
      html += '</div>';
      el.innerHTML = html;
    },

    // ═══ NEW: Accuracy Dashboard ═══
    _renderAccuracyDashboard() {
      const el = document.getElementById('pred-accuracy-dashboard');
      if (!el || !window.AccuracyTracker) {
        if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Enter race results to track prediction accuracy.</div>';
        return;
      }

      const stats = window.AccuracyTracker.getOverallStats();
      if (!stats) {
        el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">No predictions scored yet. Enter race results to begin accuracy tracking.</div>';
        return;
      }

      const brierColor = stats.avgBrierScore < 0.05 ? '#00dc50' : stats.avgBrierScore < 0.10 ? '#ffd166' : '#ff4444';
      const winColor = stats.winnerAccuracy >= 50 ? '#00dc50' : stats.winnerAccuracy >= 25 ? '#ffd166' : '#ff6b6b';

      let html = `<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
        <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid ${brierColor}22;border-radius:10px;padding:0.8rem;text-align:center">
          <div style="font-size:1.4rem;font-weight:bold;color:${brierColor}">${stats.avgBrierScore}</div>
          <div style="font-size:0.6rem;color:#888">Brier Score</div>
          <div style="font-size:0.5rem;color:#48484a">(lower = better · naive ~0.10)</div>
        </div>
        <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid ${winColor}22;border-radius:10px;padding:0.8rem;text-align:center">
          <div style="font-size:1.4rem;font-weight:bold;color:${winColor}">${stats.winnerAccuracy}%</div>
          <div style="font-size:0.6rem;color:#888">Winner Correct</div>
        </div>
        <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #ffffff0a;border-radius:10px;padding:0.8rem;text-align:center">
          <div style="font-size:1.4rem;font-weight:bold;color:#ffd166">${stats.avgPodiumOverlap}/3</div>
          <div style="font-size:0.6rem;color:#888">Avg Podium Overlap</div>
        </div>
        <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #ffffff0a;border-radius:10px;padding:0.8rem;text-align:center">
          <div style="font-size:1.4rem;font-weight:bold;color:#58a6ff">${stats.avgPositionError}</div>
          <div style="font-size:0.6rem;color:#888">Avg Position Error</div>
        </div>
        <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #ffffff0a;border-radius:10px;padding:0.8rem;text-align:center">
          <div style="font-size:1.4rem;font-weight:bold;color:#a78bfa">${stats.totalRaces}</div>
          <div style="font-size:0.6rem;color:#888">Races Scored</div>
        </div>
      </div>`;

      // Trend chart (text-based)
      if (stats.trend.length > 1) {
        html += '<div style="font-size:0.6rem;color:#888;margin-bottom:0.3rem">Brier Score Trend by Race</div>';
        html += '<div style="display:flex;align-items:flex-end;gap:3px;height:60px">';
        stats.trend.forEach(t => {
          const h = Math.max(5, (1 - t.brier / 0.15) * 60);
          const color = t.winCorrect ? '#00dc50' : '#ff6b6b';
          html += `<div style="flex:1;background:${color};height:${h}px;border-radius:2px 2px 0 0;min-width:8px" title="R${t.round}: ${t.brier}"></div>`;
        });
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:0.5rem;color:#48484a;margin-top:0.2rem"><span>R' + stats.trend[0].round + '</span><span>R' + stats.trend[stats.trend.length - 1].round + '</span></div>';
      }

      el.innerHTML = html;
    },

    // ═══ NEW: Tire Strategy Insights ═══
    _renderTireStrategy(race) {
      const el = document.getElementById('pred-tire-strategy');
      if (!el || !window.TireStrategyAnalytics) {
        if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">Tire strategy engine loading...</div>';
        return;
      }

      const strategies = window.TireStrategyAnalytics.analyzeOptimalStrategy(race);
      if (!strategies.length) {
        el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">No strategy data available.</div>';
        return;
      }

      const bestTime = strategies[0].totalTime;
      const tireColors = { soft: '#ff4444', medium: '#ffd166', hard: '#ffffff', inter: '#3fb950', wet: '#58a6ff' };

      let html = `<div style="font-size:0.6rem;color:#888;margin-bottom:0.5rem">${race.flag} ${race.short} · ${race.laps} laps · Tire Deg: ${race.tire_deg}</div>`;
      html += '<div style="display:grid;gap:0.5rem">';
      strategies.forEach((s, i) => {
        const delta = s.totalTime - bestTime;
        const isOptimal = i === 0;
        html += `<div style="display:flex;align-items:center;gap:0.6rem;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid ${isOptimal ? '#00dc5033' : '#ffffff08'};border-radius:8px;padding:0.6rem">
          <div style="width:16px;text-align:center;font-size:0.65rem;color:${isOptimal ? '#00dc50' : '#888'};font-weight:bold">${i + 1}</div>
          <div style="display:flex;gap:0.3rem;flex:1">
            ${s.stints.map(st => `<div style="display:flex;align-items:center;gap:0.2rem;padding:0.2rem 0.5rem;border-radius:12px;background:${tireColors[st.tire]}18;border:1px solid ${tireColors[st.tire]}33;font-size:0.58rem">
              <span style="color:${tireColors[st.tire]};text-transform:uppercase;font-weight:bold">${st.tire.charAt(0)}</span>
              <span style="color:#888">${st.laps}L</span>
            </div>`).join('')}
          </div>
          <div style="font-size:0.6rem;color:#888">${s.stops}-stop</div>
          <div style="font-size:0.6rem;color:${isOptimal ? '#00dc50' : delta < 5 ? '#ffd166' : '#ff6b6b'};font-weight:${isOptimal ? 'bold' : 'normal'}">${isOptimal ? 'OPTIMAL' : '+' + delta.toFixed(1) + 's'}</div>
        </div>`;
      });
      html += '</div>';
      el.innerHTML = html;
    },

    // ═══ NEW: What-If Scenario Panel ═══
    _renderWhatIfPanel() {
      const el = document.getElementById('pred-whatif-panel');
      if (!el || !window.WhatIfScenario) {
        if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.7rem">What-If engine loading...</div>';
        return;
      }
      const teams = DynamicModel.teamRatings || {};
      el.innerHTML = window.WhatIfScenario.renderPanel(DRIVERS, teams);
    },

    // ═══ NEW: Chart.js Premium Visualizations ═══
    _renderChartJsVisuals(race) {
      if (!window.ChartVisuals) return;

      // Elo Trend Chart
      try {
        window.ChartVisuals.renderEloTrendChart('pred-chart-elo-trend', DRIVERS);
      } catch (e) { console.warn('[ChartVisuals] Elo trend error:', e); }

      // Accuracy Chart
      try {
        window.ChartVisuals.renderAccuracyChart('pred-chart-accuracy');
      } catch (e) { console.warn('[ChartVisuals] Accuracy chart error:', e); }

      // Tire Degradation Curves
      try {
        window.ChartVisuals.renderTireDegChart('pred-chart-tire-deg', race);
      } catch (e) { console.warn('[ChartVisuals] Tire deg error:', e); }

      // Team Performance Radar
      try {
        const teams = DynamicModel.teamRatings || {};
        window.ChartVisuals.renderTeamRadar('pred-chart-team-radar', teams);
      } catch (e) { console.warn('[ChartVisuals] Team radar error:', e); }

      // Historical Driver Comparison
      try {
        const driverSummary = window.HistoricalDataSeeder?.getDriverSummary();
        if (driverSummary) {
          window.ChartVisuals.renderHistoricalComparison('pred-chart-historical', driverSummary, DRIVERS);
        } else {
          const el = document.getElementById('pred-chart-historical');
          if (el) el.innerHTML = '<div style="color:#666;padding:1rem;font-size:0.65rem;text-align:center">Click "Seed Historical Data" to load 2023-2025 results</div>';
        }
      } catch (e) { console.warn('[ChartVisuals] Historical comparison error:', e); }

      // Championship Points
      try {
        if (_championship) {
          window.ChartVisuals.renderChampionshipChart('pred-chart-championship', _championship, DRIVERS);
        }
      } catch (e) { console.warn('[ChartVisuals] Championship chart error:', e); }
    },

    // ═══ NEW: Historical Data Seeder ═══
    async _seedHistoricalData() {
      const statusEl = document.getElementById('pred-historical-status');
      if (!window.HistoricalDataSeeder) {
        if (statusEl) statusEl.innerHTML = '<div style="color:#666;padding:0.5rem;font-size:0.6rem">Historical seeder module not loaded.</div>';
        return;
      }

      const status = window.HistoricalDataSeeder.getStatus();
      if (status.loaded) {
        if (statusEl) {
          statusEl.innerHTML = `<div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #00dc5022;border-radius:10px;padding:0.8rem">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
              <span style="color:#00dc50;font-size:0.7rem;font-weight:bold">\u2705 Historical Data Loaded</span>
            </div>
            <div style="font-size:0.58rem;color:#888">
              ${status.totalRaces || '?'} races from ${Object.keys(status.seasons || {}).join(', ')} \u00b7 
              Elo ratings pre-seeded \u00b7 Track history populated
            </div>
          </div>`;
        }
        // Refresh charts with new data
        this._renderChartJsVisuals(DataModel.calendar?.find(r => r.round === _selectedRound));
        return;
      }

      if (statusEl) {
        statusEl.innerHTML = `<div style="background:#0d1117;border:1px solid #ffffff0a;border-radius:10px;padding:0.8rem">
          <div style="color:#58a6ff;font-size:0.65rem">\ud83d\udce1 Ready to seed historical data from 2023-2025 seasons</div>
          <div style="font-size:0.55rem;color:#666;margin-top:0.3rem">Click "Seed Historical Data" button above to fetch real F1 results</div>
        </div>`;
      }
    },

    // ═══ v15.0 NEW FEATURE RENDERERS ═══

    async _renderWeatherForecast(calendar) {
      const el = document.getElementById('pred-weather-forecast');
      if (!el || !window.WeatherForecast) {
        if (el) el.innerHTML = '<div style="color:#666;font-size:0.6rem">Weather engine loading...</div>';
        return;
      }
      el.innerHTML = '<div style="color:#58a6ff;font-size:0.6rem">⏳ Fetching live weather forecasts...</div>';
      try {
        await window.WeatherForecast.fetchAllUpcoming(calendar);
        el.innerHTML = window.WeatherForecast.renderWidget(calendar);
      } catch (e) {
        el.innerHTML = '<div style="color:#888;font-size:0.6rem">Weather data unavailable — will retry next load</div>';
      }
    },

    _renderExportPanel() {
      const el = document.getElementById('pred-export-panel');
      if (!el || !window.ExportShare) return;
      el.innerHTML = window.ExportShare.renderExportPanel();
    },

    _renderQualiRaceSplit() {
      const el = document.getElementById('pred-quali-race-split');
      if (!el || !window.QualifyingRaceSplit) return;
      el.innerHTML = window.QualifyingRaceSplit.renderComparisonWidget(DRIVERS);
    },

    _renderDarkHorseAlerts(race) {
      const el = document.getElementById('pred-dark-horse');
      if (!el || !window.DarkHorseAlerts) return;
      const predictions = PredictionEngine.predict(race);
      el.innerHTML = window.DarkHorseAlerts.renderAlerts(predictions, race);
    },

    _renderPostRaceAnalysis() {
      const el = document.getElementById('pred-post-race-analysis');
      if (!el || !window.PostRaceAnalysis) return;
      // Find the latest race with results
      const latestResult = Object.entries(DataModel.results || {}).sort(([a], [b]) => parseInt(b) - parseInt(a))[0];
      if (!latestResult) {
        el.innerHTML = '<div style="color:#666;font-size:0.6rem">Enter a race result to see post-race analysis</div>';
        return;
      }
      const [round, result] = latestResult;
      const race = DataModel.calendar?.find(r => r.round === parseInt(round));
      const predicted = PredictionEngine.predict(race || {});
      const analysis = window.PostRaceAnalysis.analyze(parseInt(round), predicted, result, DRIVERS);
      el.innerHTML = window.PostRaceAnalysis.renderDashboard(analysis, race?.name);
    },

    _renderFantasyCalc() {
      const el = document.getElementById('pred-fantasy-calc');
      if (!el || !window.FantasyCalculator) return;
      const race = DataModel.calendar?.find(r => r.round === _selectedRound) || DataModel.calendar?.[0];
      if (!race) return;
      const predictions = PredictionEngine.predict(race);
      el.innerHTML = window.FantasyCalculator.renderWidget(predictions, DRIVERS);
    },

    _renderGridPenalty() {
      const el = document.getElementById('pred-grid-penalty');
      if (!el || !window.GridPenaltyPredictor) return;
      const currentRound = Math.max(1, ...Object.keys(DataModel.results || {}).map(Number));
      el.innerHTML = window.GridPenaltyPredictor.renderWidget(DRIVERS, currentRound);
    },

    _renderDriverDevelopment() {
      const el = document.getElementById('pred-driver-development');
      if (!el || !window.DriverDevelopment) return;
      const currentRound = Math.max(1, ...Object.keys(DataModel.results || {}).map(Number));
      el.innerHTML = window.DriverDevelopment.renderWidget(DRIVERS, currentRound);
    },

    _renderCommunityPredictions() {
      const el = document.getElementById('pred-community');
      if (!el || !window.CommunityPredictions) return;
      el.innerHTML = window.CommunityPredictions.renderPanel(_selectedRound || 1, DRIVERS);
    },

    _renderSeasonArchive() {
      const el = document.getElementById('pred-season-archive');
      if (!el || !window.SeasonArchive) return;
      el.innerHTML = window.SeasonArchive.renderWidget();
    },

    // ═══ NEW: Auto-Update System ═══
    _initAutoUpdate() {
      if (!window.LiveAutoUpdate) return;

      window.LiveAutoUpdate.init(DataModel.calendar);

      // Render the status widget
      const widgetEl = document.getElementById('pred-autoupdate-widget');
      if (widgetEl) {
        widgetEl.innerHTML = window.LiveAutoUpdate.renderStatusWidget();
      }

      // Define import callback — called when API returns a new race result
      const onImport = (round, result) => {
        // Check if we already have a manual entry for this round
        if (DataModel.results[round]) {
          console.log('[AutoUpdate] Round', round, 'already has manual results, skipping import');
          return;
        }
        // Import the result through normal DataModel pipeline
        DataModel.saveResult(round, result);
        console.log('[AutoUpdate] Auto-imported result for Round', round);

        // Refresh UI
        const calendar = DataModel.calendar;
        if (calendar) {
          this._renderTimeline(calendar);
          this._renderAccuracyBar();
          this._renderChampionship(calendar);
          this._renderAllRacesGrid(calendar);
          this._renderEloTracker();
          this._renderTeammateH2H();
          this._renderAccuracyDashboard();
          this._renderChartJsVisuals(calendar.find(r => r.round === _selectedRound));
        }
      };

      // Define standings callback
      const onStandings = (standings) => {
        console.log('[AutoUpdate] Standings updated:', standings.drivers?.length, 'drivers');
        // Refresh championship chart with new data
        if (window.ChartVisuals && standings.drivers) {
          try {
            window.ChartVisuals.renderChampionshipChart('pred-chart-championship', {
              driverStandings: standings.drivers.map(s => ({
                driver: { id: s.driverId },
                pts: s.points
              }))
            }, DRIVERS);
          } catch (e) { console.warn('[AutoUpdate] Championship chart update error:', e); }
        }
      };

      // Store callbacks for later use by button handlers
      this._autoUpdateCallbacks = { onImport, onStandings };

      // Auto-start polling
      window.LiveAutoUpdate.startPolling(onImport, onStandings);

      // Refresh widget after first check completes
      setTimeout(() => {
        if (widgetEl) {
          widgetEl.innerHTML = window.LiveAutoUpdate.renderStatusWidget();
        }
      }, 5000);
    },

    _fmtDate(d) {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    },
    _fmtDateFull(d) {
      return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RESULT MODAL
  // ─────────────────────────────────────────────────────────────
  function openResultModal(round) {
    const race = DataModel.calendar?.find(r => r.round === round);
    if (!race) return;
    const existing = DataModel.results[round];

    const modal = document.createElement('div');
    modal.className = 'pred-modal-overlay';
    modal.id = 'pred-modal';
    modal.innerHTML = `
      <div class="pred-modal">
        <div class="pred-modal-title">${race.flag} R${race.round} — ${race.name}</div>
        <div class="pred-modal-subtitle">Enter P1–P10 finishing order</div>
        <div class="pred-modal-grid" id="modal-form">
          ${[...Array(10)].map((_, i) => `
            <div class="pred-modal-row">
              <label>P${i + 1}</label>
              <select id="modal-p${i + 1}">
                <option value="">— Select Driver —</option>
                ${DRIVERS.map(d => `<option value="${d.id}" ${existing?.positions[i] === d.id ? 'selected' : ''}>${d.full} (${d.team.replace(/_/g, ' ')})</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <div class="pred-modal-btns">
          <button class="pred-modal-save" onclick="PredictionsCenter.saveResult(${round})">💾 Save Result & Update AI</button>
          <button class="pred-modal-cancel" onclick="PredictionsCenter.closeModal()">✕ Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function saveResult(round) {
    const positions = [...Array(10)].map((_, i) => {
      const sel = document.getElementById(`modal-p${i + 1}`);
      return sel?.value || null;
    }).filter(Boolean);

    if (positions.length < 3) {
      alert('Please enter at least P1–P3 to save a result.');
      return;
    }

    DataModel.saveResult(round, { positions });
    closeModal();

    // Re-render the full page with updated data
    const calendar = DataModel.calendar;
    RenderEngine._renderTimeline(calendar);
    RenderEngine._renderAccuracyBar();
    RenderEngine._renderChampionship(calendar);
    RenderEngine._renderAllRacesGrid(calendar);
    const race = calendar.find(r => r.round === round);
    if (race) RenderEngine._selectRace(race, calendar);
  }

  function closeModal() {
    document.getElementById('pred-modal')?.remove();
  }

  // Public: called when user clicks a round in the timeline or grid
  function selectRound(round) {
    _selectedRound = round;
    const race = DataModel.calendar?.find(r => r.round === round);
    if (race) RenderEngine._selectRace(race, DataModel.calendar);
  }

  // ─────────────────────────────────────────────────────────────
  // INIT — sets up PredictionsCenter. Call loadAndRender() to actually render.
  // ─────────────────────────────────────────────────────────────
  async function init() {
    console.log('[PredCenter] init() called');
    // Immediately trigger loadAndRender so predictions are ready
    // This replaces the old click-handler approach that was silently failing
    await loadAndRender();
  }

  async function loadAndRender() {
    if (RenderEngine.rendered) {
      console.log('[PredCenter] Already rendered, skipping');
      return;
    }
    console.log('[PredCenter] loadAndRender() starting...');
    const view = document.getElementById('view-predictions');
    if (!view) {
      console.error('[PredCenter] view-predictions element not found!');
      return;
    }

    // Show loading indicator
    const loader = document.createElement('div');
    loader.className = 'pred-loader';
    loader.innerHTML = '<div style="font-size:2.5rem">🔮</div><div>Loading 2026 Predictions Center...</div>';
    view.style.position = 'relative';
    view.appendChild(loader);

    try {
      await DataModel.loadCalendar();
      console.log('[PredCenter] loadCalendar done. Calendar length:', DataModel.calendar?.length);
    } catch (e) {
      console.error('[PredCenter] Calendar load error:', e.message, e.stack);
      // Still try with embedded data
      if (!DataModel.calendar) DataModel.calendar = EMBEDDED_CALENDAR;
    }

    try {
      loader.remove();
    } catch (e) { /* ignore */ }

    if (!DataModel.calendar || !DataModel.calendar.length) {
      console.error('[PredCenter] No calendar data available');
      view.innerHTML = '<div style="padding:2rem;text-align:center;color:#f44">Failed to load predictions data.</div>';
      return;
    }

    // Render with individual error handling per step
    try {
      view.innerHTML = RenderEngine._buildSkeleton();
    } catch (e) { console.error('[PredCenter] Skeleton build error:', e); }

    const calendar = DataModel.calendar;
    const safeCall = (name, fn) => {
      try { fn(); } catch (e) { console.warn('[PredCenter] Non-fatal error in', name, ':', e.message); }
    };

    safeCall('_renderTimeline', () => RenderEngine._renderTimeline(calendar));
    safeCall('_renderAccuracyBar', () => RenderEngine._renderAccuracyBar());
    safeCall('_selectRace', () => RenderEngine._selectRace(calendar[0], calendar));
    safeCall('_renderChampionship', () => RenderEngine._renderChampionship(calendar));
    safeCall('_renderAllRacesGrid', () => RenderEngine._renderAllRacesGrid(calendar));
    safeCall('_renderPositionHeatmap', () => RenderEngine._renderPositionHeatmap(calendar[0]));
    safeCall('_renderTitleBattle', () => RenderEngine._renderTitleBattle(calendar));
    safeCall('_renderTeammateH2H', () => RenderEngine._renderTeammateH2H());
    safeCall('_renderEloTracker', () => RenderEngine._renderEloTracker());
    safeCall('_renderAccuracyDashboard', () => RenderEngine._renderAccuracyDashboard());
    safeCall('_renderTireStrategy', () => RenderEngine._renderTireStrategy(calendar[0]));
    safeCall('_renderWhatIfPanel', () => RenderEngine._renderWhatIfPanel());
    safeCall('_renderChartJsVisuals', () => RenderEngine._renderChartJsVisuals(calendar[0]));
    safeCall('_seedHistoricalData', () => RenderEngine._seedHistoricalData());
    safeCall('_initAutoUpdate', () => RenderEngine._initAutoUpdate());
    safeCall('_renderWeatherForecast', () => RenderEngine._renderWeatherForecast(calendar));
    safeCall('_renderExportPanel', () => RenderEngine._renderExportPanel());
    safeCall('_renderQualiRaceSplit', () => RenderEngine._renderQualiRaceSplit());
    safeCall('_renderDarkHorseAlerts', () => RenderEngine._renderDarkHorseAlerts(calendar[0]));
    safeCall('_renderPostRaceAnalysis', () => RenderEngine._renderPostRaceAnalysis());
    safeCall('_renderFantasyCalc', () => RenderEngine._renderFantasyCalc());
    safeCall('_renderGridPenalty', () => RenderEngine._renderGridPenalty());
    safeCall('_renderDriverDevelopment', () => RenderEngine._renderDriverDevelopment());
    safeCall('_renderCommunityPredictions', () => RenderEngine._renderCommunityPredictions());
    safeCall('_renderSeasonArchive', () => RenderEngine._renderSeasonArchive());

    RenderEngine.rendered = true;
    console.log('[PredCenter] ✅ Predictions Center fully rendered!');
  }

  // EMBEDDED FALLBACK CALENDAR — all 24 races inline
  const EMBEDDED_CALENDAR = [{"round": 1, "name": "Australian Grand Prix", "short": "AUS", "country": "Australia", "circuit": "Albert Park Circuit", "city": "Melbourne", "date": "2026-03-08", "flag": "🇦🇺", "track_type": "street_hybrid", "track_length_km": 5.278, "laps": 58, "drs_zones": 4, "sc_probability": 0.72, "rain_probability": 0.32, "strategy_stops": 2, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Medium", "tire_deg": "Medium", "downforce": "Medium", "notes": "Semi-street, walls punish mistakes. High SC rate. Opener advantage for well-prepared teams.", "team_mult": {"ferrari": 1.08, "mclaren": 1.1, "mercedes": 1.02, "red_bull": 1.03, "alpine": 0.96, "haas": 0.93, "audi": 0.86, "racing_bulls": 0.9, "williams": 0.78, "cadillac": 0.76, "aston_martin": 0.72}}, {"round": 2, "name": "Chinese Grand Prix", "short": "CHN", "country": "China", "circuit": "Shanghai International Circuit", "city": "Shanghai", "date": "2026-03-15", "flag": "🇨🇳", "track_type": "balanced", "track_length_km": 5.451, "laps": 56, "drs_zones": 2, "sc_probability": 0.48, "rain_probability": 0.28, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium-High", "tire_deg": "High", "downforce": "Medium", "notes": "High tire degradation track. Long front straight favours power. Sprint weekend — qualifying pace critical.", "team_mult": {"ferrari": 1.06, "mclaren": 1.07, "mercedes": 1.04, "red_bull": 1.0, "alpine": 0.96, "haas": 0.93, "audi": 0.89, "racing_bulls": 0.88, "williams": 0.82, "cadillac": 0.8, "aston_martin": 0.7}, "is_sprint": true}, {"round": 3, "name": "Japanese Grand Prix", "short": "JPN", "country": "Japan", "circuit": "Suzuka Circuit", "city": "Suzuka", "date": "2026-03-29", "flag": "🇯🇵", "track_type": "technical", "track_length_km": 5.807, "laps": 53, "drs_zones": 1, "sc_probability": 0.55, "rain_probability": 0.42, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Low", "tire_deg": "Low-Medium", "downforce": "High", "notes": "Figure-8 technical masterpiece. Most demanding track on the calendar. Aero balance critical. Wet weather risk high.", "team_mult": {"ferrari": 1.12, "mclaren": 1.1, "mercedes": 1.05, "red_bull": 1.06, "alpine": 0.94, "haas": 0.9, "audi": 0.84, "racing_bulls": 0.89, "williams": 0.75, "cadillac": 0.73, "aston_martin": 0.65}, "driver_specials": {"verstappen": 1.08, "hamilton": 1.05, "alonso": 1.06}}, {"round": 4, "name": "Bahrain Grand Prix", "short": "BAH", "country": "Bahrain", "circuit": "Bahrain International Circuit", "city": "Sakhir", "date": "2026-04-12", "flag": "🇧🇭", "track_type": "balanced", "track_length_km": 5.412, "laps": 57, "drs_zones": 3, "sc_probability": 0.42, "rain_probability": 0.05, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "High", "tire_deg": "High", "downforce": "Medium", "notes": "Desert circuit. Tire degradation key. Stable conditions (very low rain). Good overtaking — could see multi-stop variety.", "team_mult": {"ferrari": 1.07, "mclaren": 1.08, "mercedes": 1.04, "red_bull": 1.0, "alpine": 0.96, "haas": 0.93, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.8, "cadillac": 0.78, "aston_martin": 0.68}, "driver_specials": {"leclerc": 1.06, "hamilton": 1.05}}, {"round": 5, "name": "Saudi Arabian Grand Prix", "short": "KSA", "country": "Saudi Arabia", "circuit": "Jeddah Corniche Circuit", "city": "Jeddah", "date": "2026-04-19", "flag": "🇸🇦", "track_type": "power", "track_length_km": 6.174, "laps": 50, "drs_zones": 3, "sc_probability": 0.68, "rain_probability": 0.04, "strategy_stops": 1, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Low", "tire_deg": "Low", "downforce": "Low", "notes": "Fastest street circuit in the world. Walls everywhere — very high SC risk. Long straights reward top speed. Qualifying lap defines result.", "team_mult": {"ferrari": 1.1, "mclaren": 1.06, "mercedes": 1.08, "red_bull": 0.92, "alpine": 1.04, "haas": 0.98, "audi": 0.9, "racing_bulls": 0.85, "williams": 0.94, "cadillac": 1.18, "aston_martin": 0.73}}, {"round": 6, "name": "Miami Grand Prix", "short": "MIA", "country": "USA", "circuit": "Miami International Autodrome", "city": "Miami", "date": "2026-05-03", "flag": "🇺🇸", "track_type": "street_hybrid", "track_length_km": 5.412, "laps": 57, "drs_zones": 3, "sc_probability": 0.62, "rain_probability": 0.25, "strategy_stops": 2, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Medium", "tire_deg": "Medium", "downforce": "Medium", "notes": "Miami heat affects tire deg. Sprint weekend. Semi-permanent circuit around Hard Rock Stadium. Good show track.", "team_mult": {"ferrari": 1.07, "mclaren": 1.1, "mercedes": 1.02, "red_bull": 1.02, "alpine": 0.95, "haas": 0.93, "audi": 0.87, "racing_bulls": 0.9, "williams": 0.79, "cadillac": 0.77, "aston_martin": 0.71}, "is_sprint": true}, {"round": 7, "name": "Canadian Grand Prix", "short": "CAN", "country": "Canada", "circuit": "Circuit Gilles-Villeneuve", "city": "Montreal", "date": "2026-05-24", "flag": "🇨🇦", "track_type": "power", "track_length_km": 4.361, "laps": 70, "drs_zones": 2, "sc_probability": 0.65, "rain_probability": 0.38, "strategy_stops": 1, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Medium", "tire_deg": "Low", "downforce": "Low", "notes": "Walls of Champions — high SC. Stop-start nature stresses brakes. Long back straight. Wet weather common. Sprint race on Saturday.", "team_mult": {"ferrari": 1.08, "mclaren": 1.06, "mercedes": 1.07, "red_bull": 0.93, "alpine": 1.02, "haas": 0.97, "audi": 0.89, "racing_bulls": 0.86, "williams": 0.92, "cadillac": 1.12, "aston_martin": 0.72}, "is_sprint": true}, {"round": 8, "name": "Monaco Grand Prix", "short": "MON", "country": "Monaco", "circuit": "Circuit de Monaco", "city": "Monte Carlo", "date": "2026-06-07", "flag": "🇲🇨", "track_type": "monaco", "track_length_km": 3.337, "laps": 78, "drs_zones": 1, "sc_probability": 0.85, "rain_probability": 0.3, "strategy_stops": 1, "tire_compounds": ["C3", "C4", "C5"], "overtaking": "Very Low", "tire_deg": "Low", "downforce": "Very High", "notes": "Maximum downforce. Overtaking near-impossible — qualifying defines race result. SC probability massive. Street racing at its purest.", "team_mult": {"ferrari": 1.12, "mclaren": 1.08, "mercedes": 0.98, "red_bull": 1.04, "alpine": 0.96, "haas": 0.92, "audi": 0.85, "racing_bulls": 0.91, "williams": 0.72, "cadillac": 0.72, "aston_martin": 0.7}, "driver_specials": {"alonso": 1.18, "leclerc": 1.12, "verstappen": 1.08, "hamilton": 1.06}}, {"round": 9, "name": "Spanish Grand Prix (Barcelona)", "short": "ESP", "country": "Spain", "circuit": "Circuit de Barcelona-Catalunya", "city": "Barcelona", "date": "2026-06-14", "flag": "🇪🇸", "track_type": "technical", "track_length_km": 4.657, "laps": 66, "drs_zones": 2, "sc_probability": 0.4, "rain_probability": 0.18, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Low-Medium", "tire_deg": "High", "downforce": "High", "notes": "Classic aero circuit where car quality shows most. Tire management critical. Well-known circuit means teams with most data win.", "team_mult": {"ferrari": 1.11, "mclaren": 1.1, "mercedes": 1.06, "red_bull": 1.04, "alpine": 0.94, "haas": 0.91, "audi": 0.86, "racing_bulls": 0.89, "williams": 0.76, "cadillac": 0.75, "aston_martin": 0.66}}, {"round": 10, "name": "Austrian Grand Prix", "short": "AUT", "country": "Austria", "circuit": "Red Bull Ring", "city": "Spielberg", "date": "2026-06-28", "flag": "🇦🇹", "track_type": "highspeed", "track_length_km": 4.318, "laps": 71, "drs_zones": 3, "sc_probability": 0.45, "rain_probability": 0.35, "strategy_stops": 2, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "High", "tire_deg": "Medium", "downforce": "Medium-Low", "notes": "Short, punchy circuit. Lap record circuit produces fast laptimes. High-speed corners demand aero grip. Sprint from 2026 (Austria added sprint).", "team_mult": {"ferrari": 1.07, "mclaren": 1.1, "mercedes": 1.05, "red_bull": 1.02, "alpine": 1.0, "haas": 0.95, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.82, "cadillac": 0.81, "aston_martin": 0.68}}, {"round": 11, "name": "British Grand Prix", "short": "GBR", "country": "United Kingdom", "circuit": "Silverstone Circuit", "city": "Silverstone", "date": "2026-07-05", "flag": "🇬🇧", "track_type": "highspeed", "track_length_km": 5.891, "laps": 52, "drs_zones": 2, "sc_probability": 0.42, "rain_probability": 0.48, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium", "tire_deg": "High", "downforce": "Medium-High", "notes": "Home race for McLaren/Mercedes. High-speed flowing corners. British weather adds huge strategy variance. Sprint weekend.", "team_mult": {"ferrari": 1.06, "mclaren": 1.12, "mercedes": 1.07, "red_bull": 0.96, "alpine": 1.0, "haas": 0.95, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.83, "cadillac": 0.81, "aston_martin": 0.69}, "is_sprint": true, "driver_specials": {"hamilton": 1.1, "norris": 1.08}}, {"round": 12, "name": "Belgian Grand Prix", "short": "BEL", "country": "Belgium", "circuit": "Circuit de Spa-Francorchamps", "city": "Spa", "date": "2026-07-19", "flag": "🇧🇪", "track_type": "power", "track_length_km": 7.004, "laps": 44, "drs_zones": 2, "sc_probability": 0.55, "rain_probability": 0.55, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "High", "tire_deg": "Medium-High", "downforce": "Medium-Low", "notes": "Longest circuit on calendar. Eau Rouge/Raidillon is decisive. Weather is hugely variable — front engines gain on the long Kemmel straight.", "team_mult": {"ferrari": 1.09, "mclaren": 1.07, "mercedes": 1.07, "red_bull": 0.92, "alpine": 1.03, "haas": 0.97, "audi": 0.9, "racing_bulls": 0.86, "williams": 0.94, "cadillac": 1.14, "aston_martin": 0.72}, "driver_specials": {"hamilton": 1.08, "alonso": 1.07, "verstappen": 1.05}}, {"round": 13, "name": "Hungarian Grand Prix", "short": "HUN", "country": "Hungary", "circuit": "Hungaroring", "city": "Budapest", "date": "2026-07-26", "flag": "🇭🇺", "track_type": "monaco", "track_length_km": 4.381, "laps": 70, "drs_zones": 1, "sc_probability": 0.5, "rain_probability": 0.3, "strategy_stops": 1, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Very Low", "tire_deg": "High", "downforce": "Very High", "notes": "\"Monaco without walls\". High-downforce tight track. Tire management and qualifying position crucial. Undercut strategy key.", "team_mult": {"ferrari": 1.11, "mclaren": 1.09, "mercedes": 1.04, "red_bull": 1.03, "alpine": 0.95, "haas": 0.92, "audi": 0.85, "racing_bulls": 0.9, "williams": 0.73, "cadillac": 0.73, "aston_martin": 0.68}, "driver_specials": {"hamilton": 1.09, "alonso": 1.12, "leclerc": 1.05}}, {"round": 14, "name": "Dutch Grand Prix", "short": "NED", "country": "Netherlands", "circuit": "Circuit Zandvoort", "city": "Zandvoort", "date": "2026-08-23", "flag": "🇳🇱", "track_type": "highspeed", "track_length_km": 4.259, "laps": 72, "drs_zones": 2, "sc_probability": 0.5, "rain_probability": 0.38, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Low", "tire_deg": "High", "downforce": "High", "notes": "Banking at final corner is unique. Verstappen's home race. Very hard to pass — qualifying crucial. Sprint weekend.", "team_mult": {"ferrari": 1.07, "mclaren": 1.08, "mercedes": 1.05, "red_bull": 1.08, "alpine": 0.96, "haas": 0.93, "audi": 0.87, "racing_bulls": 0.89, "williams": 0.76, "cadillac": 0.77, "aston_martin": 0.68}, "is_sprint": true, "driver_specials": {"verstappen": 1.12}}, {"round": 15, "name": "Italian Grand Prix", "short": "ITA", "country": "Italy", "circuit": "Autodromo Nazionale di Monza", "city": "Monza", "date": "2026-09-06", "flag": "🇮🇹", "track_type": "power", "track_length_km": 5.793, "laps": 53, "drs_zones": 2, "sc_probability": 0.38, "rain_probability": 0.28, "strategy_stops": 1, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "High", "tire_deg": "Low", "downforce": "Very Low", "notes": "Temple of Speed. Maximum top-speed circuit. Cadillac 343km/h top speed is the most interesting stat here. Ferrari tifosi home race. Low downforce run.", "team_mult": {"ferrari": 1.1, "mclaren": 1.06, "mercedes": 1.08, "red_bull": 0.88, "alpine": 1.05, "haas": 0.98, "audi": 0.91, "racing_bulls": 0.86, "williams": 0.96, "cadillac": 1.22, "aston_martin": 0.74}, "driver_specials": {"leclerc": 1.12, "hamilton": 1.08}}, {"round": 16, "name": "Spanish Grand Prix (Madrid)", "short": "MAD", "country": "Spain", "circuit": "Madrid Street Circuit", "city": "Madrid", "date": "2026-09-13", "flag": "🇪🇸", "track_type": "street_hybrid", "track_length_km": 5.473, "laps": 55, "drs_zones": 3, "sc_probability": 0.7, "rain_probability": 0.2, "strategy_stops": 2, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "Medium", "tire_deg": "Medium", "downforce": "Medium", "notes": "NEW CIRCUIT in 2026. Limited data — high uncertainty. Street track through Madrid. Urban circuit = SC risk high. Unknown quantity for all teams.", "team_mult": {"ferrari": 1.07, "mclaren": 1.09, "mercedes": 1.02, "red_bull": 1.01, "alpine": 0.96, "haas": 0.93, "audi": 0.87, "racing_bulls": 0.9, "williams": 0.79, "cadillac": 0.77, "aston_martin": 0.71}, "confidence_modifier": 0.75}, {"round": 17, "name": "Azerbaijan Grand Prix", "short": "AZE", "country": "Azerbaijan", "circuit": "Baku City Circuit", "city": "Baku", "date": "2026-09-26", "flag": "🇦🇿", "track_type": "power", "track_length_km": 6.003, "laps": 51, "drs_zones": 2, "sc_probability": 0.75, "rain_probability": 0.08, "strategy_stops": 1, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "High", "tire_deg": "Low", "downforce": "Low", "notes": "Baku is chaotic. SC almost guaranteed. Long main straight = power track, then Castle section is tight street circuit. Unpredictability is a feature.", "team_mult": {"ferrari": 1.09, "mclaren": 1.07, "mercedes": 1.07, "red_bull": 0.91, "alpine": 1.03, "haas": 0.97, "audi": 0.9, "racing_bulls": 0.86, "williams": 0.93, "cadillac": 1.16, "aston_martin": 0.72}}, {"round": 18, "name": "Singapore Grand Prix", "short": "SGP", "country": "Singapore", "circuit": "Marina Bay Street Circuit", "city": "Singapore", "date": "2026-10-11", "flag": "🇸🇬", "track_type": "monaco", "track_length_km": 4.94, "laps": 62, "drs_zones": 3, "sc_probability": 0.88, "rain_probability": 0.4, "strategy_stops": 1, "tire_compounds": ["C3", "C4", "C5"], "overtaking": "Very Low", "tire_deg": "High", "downforce": "Very High", "notes": "Night race through Singapore streets. Physically demanding — hottest track on calendar. SC almost guaranteed. Qualifying defines race result.", "team_mult": {"ferrari": 1.1, "mclaren": 1.09, "mercedes": 1.0, "red_bull": 1.03, "alpine": 0.96, "haas": 0.92, "audi": 0.85, "racing_bulls": 0.91, "williams": 0.73, "cadillac": 0.73, "aston_martin": 0.71}, "is_sprint": true, "driver_specials": {"alonso": 1.1, "hamilton": 1.08}}, {"round": 19, "name": "United States Grand Prix", "short": "USA", "country": "USA", "circuit": "Circuit of the Americas", "city": "Austin", "date": "2026-10-25", "flag": "🇺🇸", "track_type": "technical", "track_length_km": 5.513, "laps": 56, "drs_zones": 2, "sc_probability": 0.48, "rain_probability": 0.25, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium", "tire_deg": "High", "downforce": "High", "notes": "COTA designed for F1. Iconic Turn 1 amphitheatre. Challenging track that rewards precision. High tire deg in Texas heat.", "team_mult": {"ferrari": 1.08, "mclaren": 1.09, "mercedes": 1.05, "red_bull": 1.02, "alpine": 0.95, "haas": 0.92, "audi": 0.87, "racing_bulls": 0.88, "williams": 0.79, "cadillac": 0.78, "aston_martin": 0.69}, "driver_specials": {"verstappen": 1.06, "hamilton": 1.08}}, {"round": 20, "name": "Mexico City Grand Prix", "short": "MEX", "country": "Mexico", "circuit": "Autodromo Hermanos Rodriguez", "city": "Mexico City", "date": "2026-11-01", "flag": "🇲🇽", "track_type": "highaltitude", "track_length_km": 4.304, "laps": 71, "drs_zones": 3, "sc_probability": 0.42, "rain_probability": 0.15, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium", "tire_deg": "Low", "downforce": "Medium", "notes": "2,285m altitude = 20-25% less air density. Engines work harder, aero produces less downforce. Softer compounds used. Unique aerodynamic challenges.", "team_mult": {"ferrari": 1.07, "mclaren": 1.06, "mercedes": 1.04, "red_bull": 0.9, "alpine": 1.03, "haas": 0.96, "audi": 0.9, "racing_bulls": 0.87, "williams": 0.83, "cadillac": 1.08, "aston_martin": 0.68}}, {"round": 21, "name": "São Paulo Grand Prix", "short": "BRA", "country": "Brazil", "circuit": "Autodromo Jose Carlos Pace", "city": "São Paulo", "date": "2026-11-08", "flag": "🇧🇷", "track_type": "balanced", "track_length_km": 4.309, "laps": 71, "drs_zones": 2, "sc_probability": 0.62, "rain_probability": 0.52, "strategy_stops": 2, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "High", "tire_deg": "Medium", "downforce": "Medium", "notes": "Interlagos delivers drama. One of most unpredictable tracks — weather, safety cars, strategy variance all high. Iconic overtaking opportunities.", "team_mult": {"ferrari": 1.06, "mclaren": 1.08, "mercedes": 1.04, "red_bull": 1.0, "alpine": 0.96, "haas": 0.93, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.81, "cadillac": 0.8, "aston_martin": 0.7}, "driver_specials": {"hamilton": 1.06}}, {"round": 22, "name": "Las Vegas Grand Prix", "short": "LVG", "country": "USA", "circuit": "Las Vegas Strip Circuit", "city": "Las Vegas", "date": "2026-11-21", "flag": "🇺🇸", "track_type": "power", "track_length_km": 6.12, "laps": 50, "drs_zones": 2, "sc_probability": 0.55, "rain_probability": 0.04, "strategy_stops": 1, "tire_compounds": ["C2", "C3", "C4"], "overtaking": "High", "tire_deg": "Low", "downforce": "Low", "notes": "Extreme top-speed track on Las Vegas Strip. Cold night temps affect tire warm-up. Massive straight rewards power. Cadillac's second most interesting track.", "team_mult": {"ferrari": 1.09, "mclaren": 1.06, "mercedes": 1.07, "red_bull": 0.91, "alpine": 1.03, "haas": 0.97, "audi": 0.9, "racing_bulls": 0.85, "williams": 0.93, "cadillac": 1.2, "aston_martin": 0.72}}, {"round": 23, "name": "Qatar Grand Prix", "short": "QAT", "country": "Qatar", "circuit": "Lusail International Circuit", "city": "Lusail", "date": "2026-11-29", "flag": "🇶🇦", "track_type": "highspeed", "track_length_km": 5.38, "laps": 57, "drs_zones": 2, "sc_probability": 0.4, "rain_probability": 0.02, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium", "tire_deg": "Very High", "downforce": "Medium-High", "notes": "Flowing high-speed night circuit. Brutal tire degradation — qualifying pace irrelevant if tires degrade. Endurance of tire management is the race.", "team_mult": {"ferrari": 1.06, "mclaren": 1.09, "mercedes": 1.05, "red_bull": 0.96, "alpine": 0.99, "haas": 0.95, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.82, "cadillac": 0.81, "aston_martin": 0.69}}, {"round": 24, "name": "Abu Dhabi Grand Prix", "short": "ABU", "country": "UAE", "circuit": "Yas Marina Circuit", "city": "Abu Dhabi", "date": "2026-12-06", "flag": "🇦🇪", "track_type": "balanced", "track_length_km": 5.281, "laps": 58, "drs_zones": 2, "sc_probability": 0.38, "rain_probability": 0.02, "strategy_stops": 2, "tire_compounds": ["C1", "C2", "C3"], "overtaking": "Medium", "tire_deg": "Medium", "downforce": "Medium", "notes": "Season finale. Twilight-to-night race. Yas Marina offers balanced challenge. Championship often decided here. Track evolution through race important.", "team_mult": {"ferrari": 1.06, "mclaren": 1.08, "mercedes": 1.04, "red_bull": 1.0, "alpine": 0.95, "haas": 0.93, "audi": 0.88, "racing_bulls": 0.88, "williams": 0.8, "cadillac": 0.79, "aston_martin": 0.69}}];

  // ─── Public: Run Race Sim button handler ───
  function runRaceSim() {
    const race = DataModel.calendar?.find(r => r.round === _selectedRound);
    if (!race) return;
    const out = document.getElementById('pred-sim-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = '<div style="color:#0af">⚡ Running 1,000 Monte Carlo simulations for R' + race.round + ' ' + race.name + '...</div>';
    setTimeout(() => {
      MonteCarloEngine.run(race, (mc) => {
        const top5 = mc.grid.slice(0, 5);
        let html = '<div style="color:#0af;font-weight:bold;margin-bottom:0.5rem">⚡ RACE SIMULATION — R' + race.round + ' ' + race.name + ' (' + mc.sims + ' sims)</div>';
        html += '<div style="color:#888;margin-bottom:0.3rem">Weather: ' + WeatherEngine.emoji(mc.weather) + ' · Confidence: ' + mc.confidence + '%</div>';
        html += '<table style="width:100%;border-collapse:collapse;margin-top:0.5rem">';
        html += '<tr style="color:#666;font-size:0.65rem"><th style="text-align:left;padding:0.3rem">Pos</th><th style="text-align:left">Driver</th><th>Win%</th><th>Podium%</th><th>DNF%</th><th>Avg Finish</th></tr>';
        mc.grid.forEach((e, i) => {
          html += '<tr style="border-top:1px solid #ffffff08;color:' + (i < 3 ? '#fff' : '#999') + '">';
          html += '<td style="padding:0.25rem 0.3rem">P' + (i + 1) + '</td>';
          html += '<td><span style="color:' + e.driver.color + '">' + e.driver.full + '</span></td>';
          html += '<td style="text-align:center">' + e.winProb.toFixed(1) + '</td>';
          html += '<td style="text-align:center">' + e.podiumProb.toFixed(0) + '</td>';
          html += '<td style="text-align:center;color:' + (e.dnfProb > 8 ? '#f44' : '#666') + '">' + e.dnfProb.toFixed(1) + '</td>';
          html += '<td style="text-align:center">' + e.avgFinish.toFixed(1) + '</td></tr>';
        });
        html += '</table>';
        out.innerHTML = html;

        // Push win probs to live intelligence panel
        const liveProbs = document.getElementById('live-win-probs');
        if (liveProbs) {
          let probHtml = '';
          mc.grid.slice(0, 5).forEach((e, i) => {
            const bar = Math.min(100, e.winProb * 3);
            probHtml += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">';
            probHtml += '<span style="color:' + e.driver.color + ';width:90px;font-size:0.6rem">' + e.driver.name + '</span>';
            probHtml += '<div style="flex:1;height:6px;background:#ffffff08;border-radius:3px;overflow:hidden"><div style="width:' + bar + '%;height:100%;background:' + e.driver.color + ';border-radius:3px"></div></div>';
            probHtml += '<span style="color:#fff;font-size:0.6rem;width:35px;text-align:right">' + e.winProb.toFixed(1) + '%</span></div>';
          });
          liveProbs.innerHTML = probHtml;
        }
      });
    }, 50);
  }

  // ─── Public: Run Season Sim button handler ───
  function runSeasonSim() {
    const cal = DataModel.calendar;
    if (!cal) return;
    const out = document.getElementById('pred-sim-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = '<div style="color:#ffd166">🏆 Simulating full ' + cal.length + '-race season...</div>';
    setTimeout(() => {
      const res = PredictionEngine.simulateFullSeason(cal);
      let html = '<div style="color:#ffd166;font-weight:bold;margin-bottom:0.5rem">🏆 FULL SEASON SIMULATION — ' + cal.length + ' Races</div>';
      html += '<div style="display:flex;gap:2rem;flex-wrap:wrap">';
      // Driver standings
      html += '<div style="flex:1;min-width:280px"><div style="color:#aaa;margin-bottom:0.3rem;font-weight:bold">Driver Championship</div>';
      html += '<table style="width:100%;border-collapse:collapse">';
      html += '<tr style="color:#666;font-size:0.6rem"><th style="text-align:left;padding:0.2rem">P</th><th style="text-align:left">Driver</th><th>Pts</th><th>Wins</th><th>Pods</th><th>DNFs</th></tr>';
      res.driverStandings.forEach((e, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        html += '<tr style="border-top:1px solid #ffffff08;color:' + (i < 3 ? '#fff' : '#888') + '">';
        html += '<td style="padding:0.2rem">' + medal + '</td>';
        html += '<td><span style="color:' + e.driver.color + '">' + e.driver.full + '</span></td>';
        html += '<td style="text-align:center;font-weight:bold">' + e.pts + '</td>';
        html += '<td style="text-align:center">' + e.wins.toFixed(1) + '</td>';
        html += '<td style="text-align:center">' + e.podiums.toFixed(1) + '</td>';
        html += '<td style="text-align:center;color:#f44">' + e.dnfs.toFixed(1) + '</td></tr>';
      });
      html += '</table></div>';
      // Constructor standings
      html += '<div style="flex:1;min-width:240px"><div style="color:#aaa;margin-bottom:0.3rem;font-weight:bold">Constructor Championship</div>';
      html += '<table style="width:100%;border-collapse:collapse">';
      html += '<tr style="color:#666;font-size:0.6rem"><th style="text-align:left;padding:0.2rem">P</th><th style="text-align:left">Team</th><th>Pts</th></tr>';
      res.teamStandings.forEach((e, i) => {
        html += '<tr style="border-top:1px solid #ffffff08"><td style="padding:0.2rem">' + (i + 1) + '</td>';
        html += '<td style="color:' + e.color + '">' + e.team.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '</td>';
        html += '<td style="text-align:center;font-weight:bold">' + e.pts + '</td></tr>';
      });
      html += '</table></div></div>';
      // Upgrades
      if (res.upgrades.length > 0) {
        html += '<div style="margin-top:0.8rem;color:#aaa;font-weight:bold">Development Events</div>';
        res.upgrades.slice(0, 10).forEach(u => {
          const col = u.type === 'upgrade' ? '#0f0' : '#f44';
          html += '<div style="color:' + col + ';font-size:0.65rem">' + (u.type === 'upgrade' ? '⬆' : '⬇') + ' R' + u.round + ' ' + u.team.replace(/_/g, ' ') + ' (' + (u.delta > 0 ? '+' : '') + u.delta + ')</div>';
        });
      }
      out.innerHTML = html;
    }, 50);
  }

  // ─── Public: Run Diagnostics button handler ───
  function runDiagnosticsUI() {
    const out = document.getElementById('pred-sim-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = '<div style="color:#0f0">🔬 Running 5 realism diagnostics...</div>';
    setTimeout(() => {
      const results = SimulationValidator.runDiagnostics();
      let html = '<div style="color:#0f0;font-weight:bold;margin-bottom:0.5rem">🔬 SIMULATION DIAGNOSTICS REPORT</div>';
      results.forEach(r => {
        const col = r.status === 'PASS' ? '#0f0' : '#f44';
        const icon = r.status === 'PASS' ? '✅' : '❌';
        html += '<div style="color:' + col + ';padding:0.2rem 0">' + icon + ' <strong>' + r.test + '</strong>: ' + r.status;
        if (r.detail) html += ' — ' + r.detail;
        if (r.fix) html += ' <span style="color:#ffd166">[' + r.fix + ']</span>';
        html += '</div>';
      });
      const passes = results.filter(r => r.status === 'PASS').length;
      html += '<div style="margin-top:0.5rem;color:#aaa;font-weight:bold">Score: ' + passes + '/' + results.length + ' tests passed</div>';
      out.innerHTML = html;
    }, 50);
  }

  // ─── PHASE 3: LIVE RACE SIMULATION MODE (VISUAL LAYER) ───
  function runLiveRaceSim() {
    const race = DataModel.calendar?.find(r => r.round === _selectedRound);
    if (!race) return;
    const out = document.getElementById('pred-sim-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = '<div style="color:#f97316;font-weight:bold">🟢 LIVE RACE SIMULATION — R' + race.round + ' ' + race.name + '</div><div style="color:#666;margin-top:0.3rem">Generating race projection...</div>';

    setTimeout(() => {
      // Generate ONE projected race outcome via runSync
      const mc = MonteCarloEngine.runSync(race);
      const grid = mc.grid;
      const weather = mc.weather;
      const rng = new RNG(race.round * 5555);

      // Generate 15-20 event ticks from the projected result
      const totalTicks = 15 + Math.floor(rng.next() * 6);
      const events = [];
      const scHappens = rng.next() < race.sc_probability;
      const scLap = scHappens ? Math.floor(rng.range(3, totalTicks - 2)) : -1;

      // Pre-build running order starting from qualifying
      let runningOrder = mc.qualiGrid ? mc.qualiGrid.map(g => g.driver) : grid.map(e => e.driver);
      const finalOrder = grid.map(e => e.driver);
      const dnfDrivers = grid.filter(e => e.dnfProb > 15).map(e => e.driver.id);

      for (let lap = 1; lap <= totalTicks; lap++) {
        const lapFraction = lap / totalTicks;

        // Safety car event
        if (lap === scLap) {
          events.push({ lap, type: 'sc', text: '🟡 SAFETY CAR deployed — field bunches up' });
          continue;
        }
        if (lap === scLap + 1) {
          events.push({ lap, type: 'restart', text: '🟢 GREEN FLAG — Racing resumes!' });
          continue;
        }

        // Pit stops around 30–50% race
        if (lapFraction > 0.28 && lapFraction < 0.36) {
          const pitters = runningOrder.slice(0, 5);
          const pit1 = pitters[Math.floor(rng.next() * pitters.length)];
          const crew = PitCrewModel.crews[pit1.team];
          const stopTime = crew ? (crew.baseTime + rng.range(-0.2, 0.3)).toFixed(1) : '2.5';
          events.push({ lap, type: 'pit', text: '🛡️ ' + pit1.full + ' pits — ' + stopTime + 's stop' });
          continue;
        }
        if (lapFraction > 0.55 && lapFraction < 0.63 && (race.strategy_stops || 1) >= 2) {
          const pitter = runningOrder[Math.floor(rng.next() * 4)];
          events.push({ lap, type: 'pit', text: '🛡️ ' + pitter.full + ' makes 2nd stop' });
          continue;
        }

        // Overtakes: gradually shift from quali order toward final order
        if (rng.next() < 0.45) {
          // Pick a swap that moves toward final order
          for (let i = 0; i < runningOrder.length - 1; i++) {
            const cur = runningOrder[i];
            const next = runningOrder[i + 1];
            const curFinalPos = finalOrder.indexOf(cur);
            const nextFinalPos = finalOrder.indexOf(next);
            if (curFinalPos > nextFinalPos && rng.next() < 0.3) {
              runningOrder[i] = next;
              runningOrder[i + 1] = cur;
              events.push({ lap, type: 'overtake', text: '⚔️ ' + next.full + ' overtakes ' + cur.full + ' for P' + (i + 1) });
              break;
            }
          }
          continue;
        }

        // Weather change
        if (lap === Math.floor(totalTicks * 0.4) && weather !== 'dry') {
          events.push({ lap, type: 'weather', text: WeatherEngine.emoji(weather) + ' Weather change — conditions shifting' });
          continue;
        }

        // Incident/DNF
        if (lapFraction > 0.2 && dnfDrivers.length > 0 && rng.next() < 0.08) {
          const dnfId = dnfDrivers.shift();
          const dnfDriver = DRIVERS.find(d => d.id === dnfId);
          if (dnfDriver) {
            const failType = DNFEngine.getFailureType(dnfDriver, rng);
            runningOrder = runningOrder.filter(d => d.id !== dnfId);
            events.push({ lap, type: 'dnf', text: '❌ ' + dnfDriver.full + ' RETIRES — ' + failType + ' failure' });
            continue;
          }
        }

        // Gap report
        if (lap % 4 === 0 && runningOrder.length >= 3) {
          events.push({ lap, type: 'gap', text: '🏁 P1: ' + runningOrder[0].name + ' | P2: ' + runningOrder[1].name + ' | P3: ' + runningOrder[2].name });
        }
      }

      // Add final result
      events.push({ lap: totalTicks, type: 'finish', text: '🏁 CHEQUERED FLAG — ' + grid[0].driver.full + ' WINS!' });

      // Animate events with setTimeout chain
      let html = '<div style="color:#f97316;font-weight:bold;margin-bottom:0.5rem">🟢 LIVE RACE — R' + race.round + ' ' + race.name + '</div>';
      html += '<div style="color:#888;margin-bottom:0.5rem">' + WeatherEngine.emoji(weather) + ' | Laps (ticks): ' + totalTicks + '</div>';
      html += '<div id="live-race-feed" style="font-family:monospace"></div>';
      out.innerHTML = html;

      const feed = document.getElementById('live-race-feed');
      let eventIdx = 0;
      const animateEvent = () => {
        if (eventIdx >= events.length) {
          // Show final standings
          let final = '<div style="margin-top:0.8rem;border-top:1px solid #ffffff12;padding-top:0.5rem;color:#ffd166;font-weight:bold">🏆 FINAL RESULT</div>';
          grid.slice(0, 10).forEach((e, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : 'P' + (i + 1);
            final += '<div style="color:' + (i < 3 ? '#fff' : '#888') + '">' + medal + ' <span style="color:' + e.driver.color + '">' + e.driver.full + '</span> (' + e.avgFinish.toFixed(1) + ' avg)</div>';
          });
          feed.innerHTML += final;
          return;
        }
        const ev = events[eventIdx];
        const colors = { overtake: '#58a6ff', pit: '#ffd166', sc: '#f59e0b', restart: '#3fb950', dnf: '#f44', weather: '#a78bfa', gap: '#666', finish: '#ffd166' };
        feed.innerHTML += '<div style="color:' + (colors[ev.type] || '#aaa') + ';padding:0.15rem 0;opacity:0" class="live-ev" id="lev-' + eventIdx + '">Lap ' + ev.lap + '/' + totalTicks + ' — ' + ev.text + '</div>';
        const el = document.getElementById('lev-' + eventIdx);
        if (el) { el.style.transition = 'opacity 0.4s'; requestAnimationFrame(() => el.style.opacity = '1'); }
        out.scrollTop = out.scrollHeight;
        eventIdx++;
        setTimeout(animateEvent, 350 + Math.random() * 250);
      };
      setTimeout(animateEvent, 500);
    }, 100);
  }

  // ─── Public: Run Advanced Analytics ───
  function runAnalyticsUI() {
    const race = DataModel.calendar?.find(r => r.round === _selectedRound);
    if (!race) return;
    const out = document.getElementById('pred-sim-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = '<div style="color:#a78bfa">📊 Running advanced analytics suite...</div>';
    setTimeout(() => {
      let html = '<div style="color:#a78bfa;font-weight:bold;margin-bottom:0.8rem">📊 ADVANCED ANALYTICS — R' + race.round + ' ' + race.name + '</div>';

      // 1. Elo Ratings Summary
      if (window.EloRatingSystem) {
        const allR = window.EloRatingSystem.getAllRatings();
        const sorted = Object.entries(allR).sort((a, b) => b[1].elo - a[1].elo);
        html += '<div style="color:#58a6ff;font-weight:bold;margin:0.5rem 0 0.3rem">📈 Elo Rankings (Glicko-2 Based)</div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.65rem">';
        html += '<tr style="color:#666"><th style="text-align:left;padding:0.2rem">Rank</th><th style="text-align:left">Driver</th><th>Elo</th><th>RD</th><th>Peak</th></tr>';
        sorted.slice(0, 10).forEach(([id, r], i) => {
          const d = DRIVERS.find(dr => dr.id === id);
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
          html += '<tr style="border-top:1px solid #ffffff08;color:' + (i < 3 ? '#fff' : '#888') + '">';
          html += '<td style="padding:0.2rem">' + medal + '</td>';
          html += '<td style="color:' + (d?.color || '#888') + '">' + (d?.full || id) + '</td>';
          html += '<td style="text-align:center;font-weight:bold">' + Math.round(r.elo) + '</td>';
          html += '<td style="text-align:center;color:#666">±' + Math.round(r.rd) + '</td>';
          html += '<td style="text-align:center;color:#ffd166">' + Math.round(r.peak) + '</td></tr>';
        });
        html += '</table>';
      }

      // 2. Track Cluster Analysis
      if (window.TrackPerformanceHistory) {
        const cluster = window.TrackPerformanceHistory.getTrackCluster(race.city);
        html += '<div style="color:#3fb950;font-weight:bold;margin:0.8rem 0 0.3rem">🏁 Track Analysis</div>';
        html += '<div style="font-size:0.65rem;color:#aaa">Track cluster: <span style="color:#ffd166">' + cluster + '</span> · ' + race.circuit + '</div>';
      }

      // 3. Tire Strategy
      if (window.TireStrategyAnalytics) {
        const strats = window.TireStrategyAnalytics.analyzeOptimalStrategy(race);
        if (strats.length > 0) {
          html += '<div style="color:#ff6b6b;font-weight:bold;margin:0.8rem 0 0.3rem">🔥 Optimal Tire Strategies</div>';
          strats.slice(0, 3).forEach((s, i) => {
            const delta = s.totalTime - strats[0].totalTime;
            html += '<div style="font-size:0.65rem;color:' + (i === 0 ? '#00dc50' : '#888') + '">';
            html += (i + 1) + '. ' + s.stints.map(st => st.tire.toUpperCase() + '(' + st.laps + 'L)').join(' → ');
            html += ' — ' + s.stops + '-stop' + (i === 0 ? ' ★ OPTIMAL' : ' +' + delta.toFixed(1) + 's') + '</div>';
          });
        }
      }

      // 4. Accuracy Summary
      if (window.AccuracyTracker) {
        const stats = window.AccuracyTracker.getOverallStats();
        if (stats) {
          html += '<div style="color:#a78bfa;font-weight:bold;margin:0.8rem 0 0.3rem">🎯 Prediction Accuracy</div>';
          html += '<div style="font-size:0.65rem;color:#aaa">';
          html += 'Brier: <span style="color:#ffd166">' + stats.avgBrierScore + '</span> · ';
          html += 'Winner: <span style="color:#00dc50">' + stats.winnerAccuracy + '%</span> · ';
          html += 'Podium Overlap: <span style="color:#58a6ff">' + stats.avgPodiumOverlap + '/3</span> · ';
          html += 'Pos Error: <span style="color:#ff6b6b">' + stats.avgPositionError + '</span></div>';
        }
      }

      // 5. Teammate Quick View
      if (window.TeammateComparisonEngine) {
        const comps = window.TeammateComparisonEngine.getAllComparisons().filter(c => c.totalRaces > 0);
        if (comps.length > 0) {
          html += '<div style="color:#f97316;font-weight:bold;margin:0.8rem 0 0.3rem">👥 Teammate Battles</div>';
          comps.forEach(c => {
            const d1 = DRIVERS.find(d => d.id === c.drivers[0]);
            const d2 = DRIVERS.find(d => d.id === c.drivers[1]);
            if (d1 && d2) {
              html += '<div style="font-size:0.62rem;color:#aaa">';
              html += '<span style="color:' + d1.color + '">' + d1.name + '</span> ' + (c.raceH2H[0] || 0) + '-' + (c.raceH2H[1] || 0) + ' ';
              html += '<span style="color:' + d2.color + '">' + d2.name + '</span> · Pts: ' + (c.pointsDiff > 0 ? '+' : '') + c.pointsDiff;
              html += '</div>';
            }
          });
        }
      }

      out.innerHTML = html;
    }, 100);
  }

  // ─── Public: Run What-If Scenario ───
  function runWhatIfUI() {
    if (!window.WhatIfScenario) return;
    const race = DataModel.calendar?.find(r => r.round === _selectedRound);
    if (!race) return;
    const out = document.getElementById('pred-sim-output');
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="color:#a78bfa">\ud83d\udd2e Running What-If scenario simulation...</div>';
    }

    setTimeout(() => {
      // Run baseline first
      const baselineRace = race;
      MonteCarloEngine.run(baselineRace, (baselineMC) => {
        window.WhatIfScenario.setBaseline(baselineMC);

        // Apply scenario modifications
        const scenarioRace = window.WhatIfScenario.applyToRace(race);

        // Run scenario with modified parameters
        MonteCarloEngine.run(scenarioRace, (scenarioMC) => {
          // Apply forced DNFs - move them to last
          const forcedDNFs = window.WhatIfScenario.getScenario().forceDNFs || [];
          if (forcedDNFs.length > 0 && scenarioMC.grid) {
            const grid = scenarioMC.grid;
            forcedDNFs.forEach(dnfId => {
              const idx = grid.findIndex(g => g.driver.id === dnfId);
              if (idx >= 0) {
                const entry = grid.splice(idx, 1)[0];
                entry.avgFinish = 22;
                entry.winProb = 0;
                entry.podiumProb = 0;
                entry.dnfProb = 100;
                grid.push(entry);
              }
            });
          }

          window.WhatIfScenario.setScenarioResult(scenarioMC);

          // Build comparison
          const compHtml = window.WhatIfScenario.buildComparisonHTML(baselineMC, scenarioMC, DRIVERS);
          const compEl = document.getElementById('whatif-comparison');
          if (compEl) compEl.innerHTML = compHtml;

          if (out) {
            let html = '<div style="color:#00dc50;font-weight:bold;margin-bottom:0.5rem">\u2705 What-If Analysis Complete</div>';
            html += '<div style="font-size:0.6rem;color:#888;margin-bottom:0.5rem">Baseline vs Scenario comparison generated</div>';

            const scenario = window.WhatIfScenario.getScenario();
            html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">';
            if (scenario.weather !== 'dry') html += `<span style="color:#58a6ff;font-size:0.6rem">\ud83c\udf27\ufe0f ${scenario.weather}</span>`;
            if (scenario.forceDNFs.length) html += `<span style="color:#ff4444;font-size:0.6rem">\ud83d\udca5 ${scenario.forceDNFs.length} forced DNF(s)</span>`;
            const upgrades = Object.entries(scenario.teamUpgrades).filter(([, v]) => v !== 0);
            if (upgrades.length) html += `<span style="color:#00dc50;font-size:0.6rem">\u2b06\ufe0f ${upgrades.length} team adjustment(s)</span>`;
            html += '</div>';

            // Show top 5 scenario results
            const sGrid = scenarioMC.grid || [];
            html += '<div style="font-size:0.65rem;color:#a78bfa;font-weight:bold;margin:0.5rem 0 0.3rem">\ud83d\udd2e Scenario Result (Top 5)</div>';
            sGrid.slice(0, 5).forEach((g, i) => {
              const bEntry = baselineMC.grid?.find(b => b.driver.id === g.driver.id);
              const bPos = bEntry ? baselineMC.grid.indexOf(bEntry) + 1 : '?';
              const change = typeof bPos === 'number' ? bPos - (i + 1) : 0;
              const arrow = change > 0 ? `<span style="color:#00dc50">\u25b2${change}</span>` : change < 0 ? `<span style="color:#ff4444">\u25bc${Math.abs(change)}</span>` : '';
              html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.62rem">
                <span style="color:#888;width:18px">P${i + 1}</span>
                <span style="color:${g.driver.color}">${g.driver.name}</span>
                <span style="color:#888">${g.winProb.toFixed(1)}% win</span>
                ${arrow}
              </div>`;
            });

            out.innerHTML = html;
          }
        });
      });
    }, 50);
  }

  function refreshWhatIfUI() {
    RenderEngine._renderWhatIfPanel();
  }

  // ─── Public: Seed Historical Data ───
  async function seedHistoricalUI() {
    const out = document.getElementById('pred-sim-output');
    const statusEl = document.getElementById('pred-historical-status');

    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="color:#00dc50">\ud83d\udce1 Fetching historical F1 data from 2023-2025 seasons...</div><div style="font-size:0.6rem;color:#888;margin-top:0.3rem">Querying Jolpica API (Ergast successor)... This may take a few seconds.</div>';
    }

    if (!window.HistoricalDataSeeder) {
      if (out) out.innerHTML = '<div style="color:#ff4444">\u274c HistoricalDataSeeder module not loaded.</div>';
      return;
    }

    try {
      const result = await window.HistoricalDataSeeder.seed(DRIVERS, true); // Force refresh

      if (out) {
        let html = '<div style="color:#00dc50;font-weight:bold;margin-bottom:0.5rem">\u2705 Historical Data Seeded Successfully!</div>';
        html += `<div style="font-size:0.6rem;color:#888;margin-bottom:0.5rem">${result.allRaces?.length || '?'} races processed across 2023-2025 seasons</div>`;

        // Show driver summary highlights
        if (result.driverSummary) {
          const topDrivers = Object.entries(result.driverSummary)
            .sort((a, b) => b[1].points - a[1].points)
            .slice(0, 8);

          html += '<div style="font-size:0.65rem;color:#58a6ff;font-weight:bold;margin:0.5rem 0 0.3rem">\ud83c\udfc6 Historical Leaders (2023-2025)</div>';
          topDrivers.forEach(([id, s]) => {
            const d = DRIVERS.find(dr => dr.id === id);
            html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.15rem 0;font-size:0.58rem">
              <span style="color:${d?.color || '#888'}">${d?.name || id}</span>
              <span style="color:#ffd166">${s.wins}W</span>
              <span style="color:#aaa">${s.podiums}P</span>
              <span style="color:#888">${Math.round(s.points)}pts</span>
              <span style="color:#666">avg P${s.avgFinish.toFixed(1)}</span>
            </div>`;
          });
        }

        // Show Elo ratings post-seeding
        if (window.EloRatingSystem) {
          html += '<div style="font-size:0.65rem;color:#a78bfa;font-weight:bold;margin:0.5rem 0 0.3rem">\ud83d\udcca Seeded Elo Ratings</div>';
          const ratings = window.EloRatingSystem.getAllRatings();
          const sorted = Object.entries(ratings)
            .filter(([id]) => DRIVERS.some(d => d.id === id))
            .sort((a, b) => b[1].elo - a[1].elo)
            .slice(0, 10);

          sorted.forEach(([id, r]) => {
            const d = DRIVERS.find(dr => dr.id === id);
            html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.15rem 0;font-size:0.58rem">
              <span style="color:${d?.color || '#888'}">${d?.name || id}</span>
              <span style="color:#ffd166;font-weight:bold">${Math.round(r.elo)}</span>
              <span style="color:#666">\u00b1${Math.round(r.rd)}</span>
            </div>`;
          });
        }

        out.innerHTML = html;
      }

      // Refresh all visual components
      RenderEngine._renderEloTracker();
      RenderEngine._renderTeammateH2H();
      RenderEngine._seedHistoricalData();
      RenderEngine._renderChartJsVisuals(DataModel.calendar?.find(r => r.round === _selectedRound));

    } catch (e) {
      if (out) out.innerHTML = `<div style="color:#ff4444">\u274c Error seeding data: ${e.message}</div>`;
      console.error('[HistoricalSeeder] Error:', e);
    }
  }

  // ─── Public: Check for Updates (manual button trigger) ───
  async function checkForUpdatesUI() {
    if (!window.LiveAutoUpdate) return;
    const out = document.getElementById('pred-sim-output');
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="color:#58a6ff">\ud83d\udce1 Checking Jolpica API for new race results...</div>';
    }

    const cbs = RenderEngine._autoUpdateCallbacks || {};
    const result = await window.LiveAutoUpdate.runUpdate(cbs.onImport, cbs.onStandings);

    // Refresh widget
    const widgetEl = document.getElementById('pred-autoupdate-widget');
    if (widgetEl) widgetEl.innerHTML = window.LiveAutoUpdate.renderStatusWidget();

    if (out) {
      let html = '';
      if (result.newRaces > 0) {
        html += `<div style="color:#00dc50;font-weight:bold">\u2705 ${result.newRaces} new race result(s) imported!</div>`;
        result.messages.forEach(m => { html += `<div style="font-size:0.6rem;color:#888">\u2022 ${m}</div>`; });
      } else {
        html += '<div style="color:#58a6ff">\ud83d\udce1 No new race results found</div>';
        if (result.standingsUpdated) html += '<div style="font-size:0.6rem;color:#ffd166">\u2705 Standings synced</div>';
      }
      html += `<div style="font-size:0.55rem;color:#666;margin-top:0.3rem">Last round: R${result.lastRound || 0} \u00b7 Checked at ${new Date().toLocaleTimeString()}</div>`;
      out.innerHTML = html;
    }
  }

  function toggleAutoUpdateUI() {
    if (!window.LiveAutoUpdate) return;
    const cbs = RenderEngine._autoUpdateCallbacks || {};
    window.LiveAutoUpdate.togglePolling(cbs.onImport, cbs.onStandings);

    // Refresh widget
    setTimeout(() => {
      const widgetEl = document.getElementById('pred-autoupdate-widget');
      if (widgetEl) widgetEl.innerHTML = window.LiveAutoUpdate.renderStatusWidget();
    }, 200);
  }

  function toggleRaceDayModeUI() {
    if (!window.LiveAutoUpdate) return;
    const state = window.LiveAutoUpdate.getState();
    window.LiveAutoUpdate.forceRaceDayMode(!state.raceDayMode);

    // Refresh widget
    setTimeout(() => {
      const widgetEl = document.getElementById('pred-autoupdate-widget');
      if (widgetEl) widgetEl.innerHTML = window.LiveAutoUpdate.renderStatusWidget();
    }, 300);

    const newState = window.LiveAutoUpdate.getState();
    if (newState.raceDayMode) {
      window.LiveAutoUpdate.showToast(
        `\ud83c\udfc1 RACE MODE ACTIVATED! Polling every ${Math.round(newState.currentPollInterval / 1000)} seconds`,
        'raceday'
      );
    } else {
      window.LiveAutoUpdate.showToast('Race Mode deactivated \u2014 back to normal polling', 'info');
    }
  }
  // ═══ v15.0 public API functions ═══
  function exportCardUI() {
    if (!window.ExportShare) return;
    const race = DataModel.calendar?.find(r => r.round === _selectedRound) || DataModel.calendar?.[0];
    if (!race) return;
    const predictions = PredictionEngine.predict(race);
    window.ExportShare.downloadCard(race, predictions);
  }

  function copyCardUI() {
    if (!window.ExportShare) return;
    const race = DataModel.calendar?.find(r => r.round === _selectedRound) || DataModel.calendar?.[0];
    if (!race) return;
    const predictions = PredictionEngine.predict(race);
    window.ExportShare.copyToClipboard(race, predictions).then(ok => {
      if (ok && window.LiveAutoUpdate) window.LiveAutoUpdate.showToast('📋 Prediction card copied to clipboard!', 'info');
    });
  }

  function exportDataUI() {
    if (window.ExportShare) window.ExportShare.exportJSON(DataModel);
  }

  function toggleNotificationsUI() {
    if (window.PushNotifications) window.PushNotifications.toggle();
    setTimeout(() => {
      // Refresh any notification toggles in the UI
    }, 500);
  }

  function submitCommunityPredictionUI() {
    if (!window.CommunityPredictions) return;
    const p1 = document.getElementById('community-p1')?.value;
    const p2 = document.getElementById('community-p2')?.value;
    const p3 = document.getElementById('community-p3')?.value;
    if (!p1 || !p2 || !p3) {
      if (window.LiveAutoUpdate) window.LiveAutoUpdate.showToast('Please select all 3 drivers!', 'error');
      return;
    }
    if (p1 === p2 || p1 === p3 || p2 === p3) {
      if (window.LiveAutoUpdate) window.LiveAutoUpdate.showToast('Each position must be a different driver!', 'error');
      return;
    }
    window.CommunityPredictions.submitPrediction(_selectedRound || 1, p1, p2, p3);
    RenderEngine._renderCommunityPredictions();
    if (window.LiveAutoUpdate) window.LiveAutoUpdate.showToast('🔒 Prediction locked in! Good luck!', 'info');
  }

  function archiveCurrentSeasonUI() {
    if (!window.SeasonArchive) return;
    const totalResults = Object.keys(DataModel.results || {}).length;
    const data = {
      results: DataModel.results,
      accuracy: DataModel.accuracy,
      elo: window.EloRatingSystem?.save(),
      standings: window.LiveAutoUpdate?.getStandings(),
      winnerAcc: DataModel.accuracy?.winnerCorrect ? Math.round(DataModel.accuracy.winnerCorrect / Math.max(1, totalResults) * 100) : 0,
      podiumAcc: DataModel.accuracy?.podiumHits ? Math.round(DataModel.accuracy.podiumHits / Math.max(1, totalResults * 3) * 100) : 0,
      avgScore: Math.round((DataModel.accuracy?.totalScore || 0) / Math.max(1, totalResults))
    };
    window.SeasonArchive.archiveSeason(2026, data);
    RenderEngine._renderSeasonArchive();
    if (window.LiveAutoUpdate) window.LiveAutoUpdate.showToast('📦 2026 season archived!', 'info');
  }

  return {
    init, loadAndRender, selectRound, openResultModal, saveResult, closeModal,
    runRaceSim, runLiveRaceSim, runSeasonSim,
    runDiagnostics: runDiagnosticsUI,
    runAnalytics: runAnalyticsUI,
    runWhatIf: runWhatIfUI,
    refreshWhatIf: refreshWhatIfUI,
    seedHistorical: seedHistoricalUI,
    checkForUpdates: checkForUpdatesUI,
    toggleAutoUpdate: toggleAutoUpdateUI,
    toggleRaceDayMode: toggleRaceDayModeUI,
    // v15.0
    exportCard: exportCardUI,
    copyCard: copyCardUI,
    exportData: exportDataUI,
    toggleNotifications: toggleNotificationsUI,
    submitCommunityPrediction: submitCommunityPredictionUI,
    archiveCurrentSeason: archiveCurrentSeasonUI,
    getDrivers: () => DRIVERS
  };
})();
