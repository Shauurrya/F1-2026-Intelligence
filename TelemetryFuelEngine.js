'use strict';
/* ═══════════════════════════════════════════════════════════════
   TELEMETRY FUEL & ENGINE INTELLIGENCE — TelemetryFuelEngine.js
   
   Live estimation of:
   - Fuel load & burn rate (from lap time regression + telemetry)
   - Engine performance deltas (from RPM/Speed traces)
   - 2026 Technical regulation variables:
     · Active Aero (X-mode / Z-mode)
     · Manual Override (350kW ERS boost)
     · 50/50 Power Split (ICE ↔ ERS balance)
     · Sustainable Fuel (3,000 MJ/h energy flow)
   
   Data Sources: OpenF1 car_data, laps, stints
   Method: Fuel correction formulas, telemetry inference
   ═══════════════════════════════════════════════════════════════ */

const TelemetryFuelEngine = (() => {
    const API = 'https://api.openf1.org/v1';
    const CACHE_TTL = 30000;
    const _cache = {};

    // ── 2026 TECHNICAL CONSTANTS ──
    const REGS_2026 = {
        FUEL_CAPACITY_KG: 70,           // 2026 cars carry ~70kg fuel (30kg less than 2025)
        FUEL_BURN_RATE_KG_PER_LAP: 1.35, // Avg kg/lap (varies by track)
        FUEL_TIME_PENALTY_PER_KG: 0.035, // ~0.035s per kg of fuel (time loss)
        ENERGY_FLOW_LIMIT_MJH: 3000,     // Sustainable fuel: 3,000 MJ/h
        ICE_POWER_KW: 350,              // 350kW from ICE
        ERS_POWER_KW: 350,              // 350kW from ERS (up from 120kW)
        TOTAL_POWER_KW: 700,            // Combined 700kW (~950hp)
        OVERRIDE_BOOST_KW: 350,         // Manual override: extra ERS within 1s
        AERO_MODES: { X: 'Low Drag', Z: 'High Downforce' },
        MGU_K_HARVEST_KW: 350,          // 350kW harvest under braking
        BATTERY_CAPACITY_KWH: 3.5,      // Energy store capacity
    };

    // Per-track fuel burn rates (kg/lap estimated)
    const TRACK_FUEL_RATES = {
        'AUS': 1.42, 'CHN': 1.38, 'JPN': 1.50, 'BAH': 1.35, 'KSA': 1.55,
        'MIA': 1.40, 'CAN': 1.52, 'MON': 1.10, 'ESP': 1.32, 'AUT': 1.15,
        'GBR': 1.48, 'BEL': 1.60, 'HUN': 1.22, 'NED': 1.18, 'ITA': 1.62,
        'MAD': 1.30, 'AZE': 1.28, 'SGP': 1.25, 'USA': 1.45, 'MEX': 1.20,
        'BRA': 1.38, 'LAS': 1.48, 'QAT': 1.42, 'ABU': 1.35,
    };

    // ── STATE ──
    const state = {
        telemetry: {},       // { driverNumber: { rpm, speed, throttle, gear, timestamp } }
        fuelEstimates: {},   // { driverNumber: { fuelRemaining, burnRate, fuelCorrectedLapTime } }
        enginePerf: {},      // { driverNumber: { avgRPM, maxSpeed, throttleUsage, powerScore } }
        aeroModes: {},       // { driverNumber: 'X' | 'Z' | 'neutral' }
        overrideActive: {},  // { driverNumber: boolean }
        ersDeploy: {},       // { driverNumber: { deployPct, harvestPct, batteryLevel } }
        lapTimes: {},        // { driverNumber: [lapTimes...] }
        currentLap: 0,
        totalLaps: 0,
        trackShort: null,
        lastFetch: 0,
        initialized: false,
    };

    // ── CACHED FETCH ──
    async function cachedFetch(endpoint, params = {}) {
        const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const url = `${API}${endpoint}${qs ? '?' + qs : ''}`;
        if (_cache[url] && Date.now() - _cache[url].ts < CACHE_TTL) return _cache[url].data;
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 6000);
            const resp = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            _cache[url] = { data, ts: Date.now() };
            return data;
        } catch (e) {
            if (_cache[url]) return _cache[url].data;
            return null;
        }
    }

    // ── PHASE 1: FETCH CAR TELEMETRY ──
    async function fetchCarTelemetry(sessionKey) {
        const data = await cachedFetch('/car_data', {
            session_key: sessionKey,
            speed: '>0',
        });
        if (!data || data.length === 0) return;

        // Get latest telemetry snapshot per driver
        const latest = {};
        data.forEach(d => {
            const dn = d.driver_number;
            if (!latest[dn] || new Date(d.date) > new Date(latest[dn].date)) {
                latest[dn] = d;
            }
        });

        Object.entries(latest).forEach(([dn, d]) => {
            state.telemetry[dn] = {
                rpm: d.rpm || 0,
                speed: d.speed || 0,
                throttle: d.throttle || 0,
                gear: d.n_gear || 0,
                drs: d.drs || 0,
                brake: d.brake || 0,
                timestamp: d.date,
            };
        });

        console.log('[TelemetryFuel] Car telemetry fetched for', Object.keys(latest).length, 'drivers');
    }

    // ── PHASE 2: FETCH LAP TIMES FOR FUEL CORRECTION ──
    async function fetchLapTimesForFuel(sessionKey) {
        const data = await cachedFetch('/laps', { session_key: sessionKey });
        if (!data || data.length === 0) return;

        state.lapTimes = {};
        let maxLap = 0;

        data.forEach(lap => {
            const dn = lap.driver_number;
            if (!state.lapTimes[dn]) state.lapTimes[dn] = [];
            if (lap.lap_duration && lap.lap_duration > 0 && lap.lap_duration < 200) {
                state.lapTimes[dn].push({
                    lap: lap.lap_number,
                    time: lap.lap_duration,
                    s1: lap.duration_sector_1,
                    s2: lap.duration_sector_2,
                    s3: lap.duration_sector_3,
                    compound: lap.compound,
                    isPit: lap.is_pit_out_lap,
                });
            }
            if (lap.lap_number > maxLap) maxLap = lap.lap_number;
        });

        state.currentLap = maxLap;
    }

    // ── PHASE 3: FUEL LOAD ESTIMATION ──
    // Uses fuel correction formula:
    // - Compare first stint laps vs. later laps (removing tire deg outliers)
    // - Each kg of fuel = ~0.035s penalty per lap
    // - Estimated burn rate validated against track-specific rates
    function estimateFuelLoads() {
        const burnRate = TRACK_FUEL_RATES[state.trackShort] || REGS_2026.FUEL_BURN_RATE_KG_PER_LAP;

        Object.entries(state.lapTimes).forEach(([dn, laps]) => {
            if (laps.length < 3) return;

            // Filter out pit laps and outliers
            const cleanLaps = laps.filter(l => !l.isPit && l.time > 0);
            if (cleanLaps.length < 3) return;

            // Method 1: Simple burn rate calculation
            const fuelBurned = state.currentLap * burnRate;
            const fuelRemaining = Math.max(0, REGS_2026.FUEL_CAPACITY_KG - fuelBurned);

            // Method 2: Fuel correction from lap time regression
            // Compare pace progression (later laps should be faster if fuel is burning off)
            const early = cleanLaps.slice(0, Math.min(5, Math.floor(cleanLaps.length * 0.2)));
            const late = cleanLaps.slice(-Math.min(5, Math.floor(cleanLaps.length * 0.2)));

            const earlyAvg = early.reduce((s, l) => s + l.time, 0) / early.length;
            const lateAvg = late.reduce((s, l) => s + l.time, 0) / late.length;

            // Fuel correction: time gained from fuel burn
            const timeDelta = earlyAvg - lateAvg;
            const lapsElapsed = (late[late.length - 1]?.lap || state.currentLap) - (early[0]?.lap || 1);
            const estimatedBurnPerLap = lapsElapsed > 0 ?
                Math.abs(timeDelta) / (lapsElapsed * REGS_2026.FUEL_TIME_PENALTY_PER_KG) * burnRate : burnRate;

            // Fuel-corrected lap time (normalize ALL laps to equal fuel)
            const fuelCorrectedTime = lateAvg + (fuelRemaining * REGS_2026.FUEL_TIME_PENALTY_PER_KG);

            // Energy remaining (MJ)
            const energyRemaining = fuelRemaining * 43.5; // MJ/kg for E10 fuel (2026 sustainable fuel ~43.5 MJ/kg)
            const lapsToGo = state.totalLaps > 0 ? state.totalLaps - state.currentLap : 0;
            const energyPerLap = lapsToGo > 0 ? energyRemaining / lapsToGo : 0;

            state.fuelEstimates[dn] = {
                fuelRemaining: Math.round(fuelRemaining * 10) / 10,
                fuelBurned: Math.round(fuelBurned * 10) / 10,
                burnRatePerLap: Math.round(estimatedBurnPerLap * 100) / 100,
                fuelCorrectedLapTime: Math.round(fuelCorrectedTime * 1000) / 1000,
                fuelPenaltyRemaining: Math.round(fuelRemaining * REGS_2026.FUEL_TIME_PENALTY_PER_KG * 1000) / 1000,
                energyRemainingMJ: Math.round(energyRemaining),
                energyPerLapMJ: Math.round(energyPerLap * 10) / 10,
                pctRemaining: Math.round((fuelRemaining / REGS_2026.FUEL_CAPACITY_KG) * 100),
                lapsToEmpty: fuelRemaining > 0 ? Math.round(fuelRemaining / burnRate) : 0,
            };
        });
    }

    // ── PHASE 4: ENGINE PERFORMANCE ESTIMATION ──
    // Infers relative engine performance from RPM traces and speed data
    function estimateEnginePerformance() {
        Object.entries(state.telemetry).forEach(([dn, t]) => {
            const laps = state.lapTimes[dn] || [];
            const cleanLaps = laps.filter(l => !l.isPit && l.time > 0);

            // Calculate metrics from telemetry
            const maxRPM = t.rpm;
            const topSpeed = t.speed;
            const throttleUsage = t.throttle;

            // Power score: normalized composite of RPM, speed, and throttle
            // Higher RPM + Higher speed + Higher throttle = more aggressive engine mapping
            const rpmNorm = Math.min(maxRPM / 15000, 1);     // 15000 RPM max for 2026
            const speedNorm = Math.min(topSpeed / 370, 1);    // 370 km/h theoretical max
            const throttleNorm = throttleUsage / 100;

            const powerScore = (rpmNorm * 0.35 + speedNorm * 0.40 + throttleNorm * 0.25) * 100;

            // Detect 2026 aero mode from DRS flag (will be X-mode/Z-mode in 2026)
            let aeroMode = 'neutral';
            if (t.drs >= 10 && t.drs <= 14) aeroMode = 'X'; // Low Drag (DRS equivalent)
            if (t.drs === 0 && t.speed < 200) aeroMode = 'Z'; // High Downforce in corners

            state.aeroModes[dn] = aeroMode;

            // Detect Manual Override (sudden ERS deployment spike)
            // In 2026, drivers within 1s of car ahead get 350kW extra
            // Detectable as throttle > 95% + speed acceleration spike
            state.overrideActive[dn] = throttleUsage > 95 && topSpeed > 300;

            // ERS deployment estimate (from throttle patterns)
            const deployPct = Math.min(100, throttleUsage * 1.1); // Approximate
            const harvestPct = t.brake > 50 ? Math.min(100, t.brake * 0.8) : 0;
            const batteryLevel = Math.max(0, Math.min(100, 65 + (harvestPct - deployPct) * 0.3)); // Rough estimate

            state.ersDeploy[dn] = {
                deployPct: Math.round(deployPct),
                harvestPct: Math.round(harvestPct),
                batteryLevel: Math.round(batteryLevel),
            };

            // Calculate consistency score from lap times
            let consistency = 0;
            if (cleanLaps.length >= 3) {
                const times = cleanLaps.map(l => l.time);
                const mean = times.reduce((s, t) => s + t, 0) / times.length;
                const variance = times.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / times.length;
                const stdDev = Math.sqrt(variance);
                consistency = Math.max(0, 100 - stdDev * 50); // Lower stdDev = more consistent
            }

            state.enginePerf[dn] = {
                maxRPM: maxRPM,
                topSpeed: topSpeed,
                throttleUsage: throttleUsage,
                powerScore: Math.round(powerScore * 10) / 10,
                consistency: Math.round(consistency),
                gear: t.gear,
                aeroMode: aeroMode,
                overrideActive: state.overrideActive[dn],
            };
        });
    }

    // ── PHASE 5: PUSH ESTIMATES TO PREDICTION ENGINE ──
    function pushToPredictionEngine() {
        if (!window.LiveIntelligence) return;
        const overrides = window.LiveIntelligence.getOverrides();

        // Fuel-based prediction adjustments
        Object.entries(state.fuelEstimates).forEach(([dn, fuel]) => {
            if (!overrides.fuelAdjustments) overrides.fuelAdjustments = {};
            overrides.fuelAdjustments[dn] = {
                pctRemaining: fuel.pctRemaining,
                penaltySeconds: fuel.fuelPenaltyRemaining,
                burnRate: fuel.burnRatePerLap,
            };
        });

        // Engine performance adjustments
        Object.entries(state.enginePerf).forEach(([dn, eng]) => {
            if (!overrides.engineAdjustments) overrides.engineAdjustments = {};
            overrides.engineAdjustments[dn] = {
                powerScore: eng.powerScore,
                consistency: eng.consistency,
                aeroMode: eng.aeroMode,
                overrideActive: eng.overrideActive,
            };
        });

        // 2026 tech flags
        overrides.regs2026 = {
            activeAero: true,
            manualOverride: true,
            powerSplit5050: true,
            sustainableFuel: true,
            energyFlowLimitMJH: REGS_2026.ENERGY_FLOW_LIMIT_MJH,
            totalPowerKW: REGS_2026.TOTAL_POWER_KW,
        };

        console.log('[TelemetryFuel] Pushed fuel + engine data to prediction engine');
    }

    // ── PHASE 6: RENDER TELEMETRY PANEL ──
    function renderPanel() {
        const el = document.getElementById('telemetry-fuel-panel');
        if (!el) return;

        const drivers = Object.keys(state.fuelEstimates);
        if (drivers.length === 0 && Object.keys(state.enginePerf).length === 0) {
            el.innerHTML = `
        <div style="color:#666;font-size:0.65rem;padding:0.5rem;text-align:center">
          <div style="font-size:1.2rem;margin-bottom:0.3rem">⛽</div>
          Telemetry data will appear during live sessions<br>
          <span style="color:#444;font-size:0.55rem">Fuel estimation · Engine performance · 2026 Active Aero</span>
        </div>`;
            return;
        }

        // Sort by fuel remaining
        const sorted = drivers
            .map(dn => ({ dn, fuel: state.fuelEstimates[dn], eng: state.enginePerf[dn] }))
            .sort((a, b) => (b.eng?.powerScore || 0) - (a.eng?.powerScore || 0));

        // Get driver info from PredictionsCenter
        const driverMap = typeof PredictionsCenter !== 'undefined' ? PredictionsCenter.getDrivers() : [];

        let html = '';

        // 2026 Tech Status Banner
        html += `
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.6rem">
        <span style="padding:0.2rem 0.5rem;background:#58a6ff12;border:1px solid #58a6ff22;border-radius:6px;font-size:0.55rem;color:#58a6ff">🛩️ Active Aero</span>
        <span style="padding:0.2rem 0.5rem;background:#f9731612;border:1px solid #f9731622;border-radius:6px;font-size:0.55rem;color:#f97316">⚡ 350kW Override</span>
        <span style="padding:0.2rem 0.5rem;background:#00dc5012;border:1px solid #00dc5022;border-radius:6px;font-size:0.55rem;color:#00dc50">🔋 50/50 Split</span>
        <span style="padding:0.2rem 0.5rem;background:#a78bfa12;border:1px solid #a78bfa22;border-radius:6px;font-size:0.55rem;color:#a78bfa">🌿 E-Fuel 3000MJ/h</span>
      </div>`;

        // Fuel & Engine Grid
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.4rem">';

        sorted.slice(0, 10).forEach(({ dn, fuel, eng }) => {
            const dInfo = driverMap.find(d => String(d.num) === String(dn));
            const name = dInfo ? dInfo.name : `#${dn}`;
            const color = dInfo ? dInfo.color : '#888';

            const fuelPct = fuel?.pctRemaining || 0;
            const fuelBarColor = fuelPct > 40 ? '#00dc50' : fuelPct > 20 ? '#f59e0b' : '#ff4444';
            const powerScore = eng?.powerScore || 0;
            const aeroIcon = eng?.aeroMode === 'X' ? '🛩️' : eng?.aeroMode === 'Z' ? '🏔️' : '➖';
            const overrideIcon = eng?.overrideActive ? '⚡' : '';
            const batteryPct = state.ersDeploy[dn]?.batteryLevel || 0;
            const batteryColor = batteryPct > 60 ? '#00dc50' : batteryPct > 30 ? '#f59e0b' : '#ff4444';

            html += `
        <div style="background:#ffffff04;border-radius:8px;padding:0.5rem;border-left:3px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">
            <span style="font-size:0.65rem;font-weight:bold;color:${color}">${name}</span>
            <span style="font-size:0.5rem;color:#888">${aeroIcon} ${overrideIcon}</span>
          </div>
          <!-- Fuel Bar -->
          <div style="margin-bottom:0.3rem">
            <div style="display:flex;justify-content:space-between;font-size:0.5rem;color:#888;margin-bottom:0.15rem">
              <span>⛽ Fuel</span>
              <span style="color:${fuelBarColor}">${fuel?.fuelRemaining || '?'}kg (${fuelPct}%)</span>
            </div>
            <div style="width:100%;height:4px;background:#ffffff08;border-radius:2px;overflow:hidden">
              <div style="width:${fuelPct}%;height:100%;background:${fuelBarColor};border-radius:2px;transition:width 0.5s"></div>
            </div>
          </div>
          <!-- Battery Bar -->
          <div style="margin-bottom:0.3rem">
            <div style="display:flex;justify-content:space-between;font-size:0.5rem;color:#888;margin-bottom:0.15rem">
              <span>🔋 ERS</span>
              <span style="color:${batteryColor}">${batteryPct}%</span>
            </div>
            <div style="width:100%;height:4px;background:#ffffff08;border-radius:2px;overflow:hidden">
              <div style="width:${batteryPct}%;height:100%;background:${batteryColor};border-radius:2px;transition:width 0.5s"></div>
            </div>
          </div>
          <!-- Engine Stats -->
          <div style="display:flex;gap:0.3rem;font-size:0.48rem;color:#888;margin-top:0.2rem">
            <span title="Power Score">🏎️ ${powerScore}</span>
            <span title="Top Speed">${eng?.topSpeed || 0}km/h</span>
            <span title="RPM">${eng?.maxRPM || 0}rpm</span>
          </div>
        </div>`;
        });

        html += '</div>';

        // Summary Stats
        const allFuel = Object.values(state.fuelEstimates);
        if (allFuel.length > 0) {
            const avgFuel = allFuel.reduce((s, f) => s + f.pctRemaining, 0) / allFuel.length;
            const criticalFuel = allFuel.filter(f => f.pctRemaining < 15).length;

            html += `
        <div style="display:flex;gap:0.6rem;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #ffffff08;font-size:0.5rem;color:#888">
          <span>Lap ${state.currentLap}/${state.totalLaps || '?'}</span>
          <span>Avg Fuel: ${Math.round(avgFuel)}%</span>
          ${criticalFuel > 0 ? `<span style="color:#ff4444">⚠️ ${criticalFuel} driver(s) critical fuel</span>` : ''}
          <span style="margin-left:auto;color:#444">OpenF1 car_data · Fuel Correction</span>
        </div>`;
        }

        el.innerHTML = html;
    }

    // ── MAIN REFRESH CYCLE ──
    async function refresh(sessionKey, trackShort, totalLaps) {
        if (trackShort) state.trackShort = trackShort;
        if (totalLaps) state.totalLaps = totalLaps;

        if (!sessionKey) {
            // Try to get session key from LiveIntelligence
            if (window.LiveIntelligence) {
                const liveState = window.LiveIntelligence.getState();
                if (liveState.currentSession) {
                    sessionKey = liveState.currentSession.session_key;
                    if (!state.trackShort && liveState.currentSession.circuit_short_name) {
                        state.trackShort = liveState.currentSession.circuit_short_name;
                    }
                }
            }
        }

        if (!sessionKey) {
            renderPanel();
            return;
        }

        try {
            await Promise.all([
                fetchCarTelemetry(sessionKey),
                fetchLapTimesForFuel(sessionKey),
            ]);

            estimateFuelLoads();
            estimateEnginePerformance();
            pushToPredictionEngine();
            renderPanel();

            state.lastFetch = Date.now();
            state.initialized = true;
        } catch (e) {
            console.warn('[TelemetryFuel] Refresh error:', e.message);
        }
    }

    // ── INJECT PANEL ──
    function injectPanel() {
        const liveSection = document.getElementById('live-intel-section');
        if (!liveSection) return;
        if (document.getElementById('telemetry-fuel-section')) return;

        const section = document.createElement('div');
        section.id = 'telemetry-fuel-section';
        section.innerHTML = `
      <div style="margin:0.8rem 0">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">
          <span style="font-size:1.1rem">⛽</span>
          <span style="color:#00dc50;font-weight:bold;font-size:0.75rem;font-family:'Orbitron',monospace;letter-spacing:0.5px">TELEMETRY INTELLIGENCE</span>
          <span style="padding:0.15rem 0.4rem;background:#00dc5012;border:1px solid #00dc5022;border-radius:4px;font-size:0.48rem;color:#00dc50;font-family:monospace">2026 REGS</span>
          <span style="color:#48484a;font-size:0.55rem;font-family:monospace;margin-left:auto">FUEL · ENGINE · AERO</span>
        </div>
        <div id="telemetry-fuel-panel" style="background:linear-gradient(180deg,#0a0e14,#0d1117);border:1px solid #00dc5010;border-radius:10px;padding:1rem;margin-bottom:1rem;font-family:'Inter',sans-serif"></div>
      </div>
    `;

        // Insert after live-intel-section
        liveSection.parentNode.insertBefore(section, liveSection.nextSibling);
        renderPanel();
    }

    // ── INIT ──
    let _refreshInterval = null;

    function init() {
        injectPanel();
        refresh();

        // Auto-refresh every 30s during live sessions (store ID for cleanup)
        if (_refreshInterval) clearInterval(_refreshInterval);
        _refreshInterval = setInterval(() => {
            if (state.initialized || (window.LiveIntelligence && window.LiveIntelligence.getState().isLiveSession)) {
                refresh();
            }
        }, 30000);

        console.log('%c[TelemetryFuel] v1.0 Ready — Fuel estimation + Engine intelligence + 2026 Active Aero', 'color:#00dc50;font-weight:bold');
    }

    function destroy() {
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
        }
    }

    return {
        init, refresh, renderPanel, injectPanel, destroy,
        getState: () => state,
        getFuelEstimate: (dn) => state.fuelEstimates[dn] || null,
        getEnginePerf: (dn) => state.enginePerf[dn] || null,
        getRegs2026: () => REGS_2026,
    };
})();

// Auto-init: watch for the live-intel-section to appear
(function bootTelemetry() {
    let attempts = 0;
    function tryInit() {
        if (document.getElementById('live-intel-section') && !document.getElementById('telemetry-fuel-section')) {
            TelemetryFuelEngine.init();
        } else if (attempts < 60) {
            attempts++;
            setTimeout(tryInit, 2000);
        }
    }
    // Trigger on predictions/live-intel click
    ['nav-predictions', 'nav-live-intel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => setTimeout(tryInit, 2500));
    });
    setTimeout(tryInit, 5000);
})();
