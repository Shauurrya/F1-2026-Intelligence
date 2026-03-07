'use strict';
/* ========================================================
   LIVE DATA INTELLIGENCE ENGINE — LiveDataEngine.js
   Phases 1-8: Auto-fetch → Track → Detect → Predict → Display
   Integrates on top of existing PredictionsCenter
   ======================================================== */

const LiveIntelligence = (() => {

    // ─────────────────────────────────────────────────────────────
    // CONFIG & STATE
    // ─────────────────────────────────────────────────────────────
    const CONFIG = {
        API_BASE: 'https://api.openf1.org/v1',
        REFRESH_LIVE: 5000,       // 5s during live sessions (sub-5s requirement)
        REFRESH_IDLE: 300000,     // 5min when idle
        CACHE_TTL_LIVE: 4000,     // 4s cache during live (was 60s)
        CACHE_TTL_IDLE: 60000,    // 1min cache when idle
        HIGH_ACCURACY_SIMS: 2000, // Phase 8: double sims when full data
        NEWS_KEYWORDS: ['upgrade', 'penalty', 'grid drop', 'power unit', 'rain', 'technical directive', 'disqualified', 'injury', 'fastest', 'crash', 'red flag'],
        MAX_API_FAILURES: 3,      // After N consecutive failures, switch to sim mode
    };

    const state = {
        isLiveSession: false,
        autoUpdateEnabled: true,
        lastUpdate: null,
        refreshTimer: null,
        sessionStatus: 'idle',     // idle | fp1 | fp2 | fp3 | qualifying | race
        currentMeeting: null,
        currentSession: null,
        qualifyingResults: { Q1: [], Q2: [], Q3: [], finalGrid: [] },
        liveWeather: { temp: null, humidity: null, rainfall: false, wind: null },
        livePositions: [],
        pitStops: [],
        newsAlerts: [],
        techUpgrades: [],
        predictionOverrides: {},   // Temporary team pace modifiers from news
        cache: {},                 // { url: { data, timestamp } }
        highAccuracyMode: false,
        // Graceful degradation state
        apiFailureCount: 0,
        simulationOnlyMode: false, // true when API is unreachable
        autoSimTriggered: false,   // prevent duplicate auto-sim
    };

    // ─────────────────────────────────────────────────────────────
    // PHASE 7: CACHING + RATE LIMITING + FALLBACK
    // ─────────────────────────────────────────────────────────────
    async function cachedFetch(endpoint, params = {}) {
        const qStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const url = `${CONFIG.API_BASE}${endpoint}${qStr ? '?' + qStr : ''}`;
        const cacheKey = url;

        // Check cache — use shorter TTL during live sessions for freshest data
        const cacheTTL = state.isLiveSession ? CONFIG.CACHE_TTL_LIVE : CONFIG.CACHE_TTL_IDLE;
        if (state.cache[cacheKey]) {
            const age = Date.now() - state.cache[cacheKey].timestamp;
            if (age < cacheTTL) return state.cache[cacheKey].data;
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            // Auth failure (401) — OpenF1 now requires sponsor access for live data
            if (resp.status === 401 || resp.status === 403) {
                state.apiFailureCount++;
                if (state.apiFailureCount >= CONFIG.MAX_API_FAILURES && !state.simulationOnlyMode) {
                    state.simulationOnlyMode = true;
                    console.warn('[LiveData] ⚠️ OpenF1 API requires authentication (401). Switching to SIMULATION-ONLY mode.');
                    _triggerAutoSimulation();
                }
                if (typeof window.ApiHealthDashboard !== 'undefined') {
                    window.ApiHealthDashboard.recordError('openf1');
                }
                return state.cache[cacheKey]?.data || null;
            }

            // Rate limit backoff (429) or server overload (503)
            if (resp.status === 429 || resp.status === 503) {
                console.warn(`[LiveData] Rate limited (${resp.status}) — backing off`);
                state._rateLimitBackoff = (state._rateLimitBackoff || 0) + 1;
                CONFIG.REFRESH_LIVE = Math.min(CONFIG.REFRESH_LIVE * 2, 30000);
                return state.cache[cacheKey]?.data || null;
            }

            // Successful response — reset failure tracking
            state.apiFailureCount = 0;
            if (state.simulationOnlyMode) {
                state.simulationOnlyMode = false;
                console.log('[LiveData] ✅ OpenF1 API recovered — exiting simulation-only mode');
            }
            if (state._rateLimitBackoff && state._rateLimitBackoff > 0) {
                state._rateLimitBackoff--;
                if (state._rateLimitBackoff <= 0) {
                    CONFIG.REFRESH_LIVE = 5000;
                    state._rateLimitBackoff = 0;
                }
            }

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            state.cache[cacheKey] = { data, timestamp: Date.now() };
            if (typeof window.ApiHealthDashboard !== 'undefined') {
                window.ApiHealthDashboard.recordSuccess('openf1', Math.round(performance.now()));
            }
            return data;
        } catch (err) {
            state.apiFailureCount++;
            console.warn(`[LiveData] Fetch failed: ${url}`, err.message);
            if (state.apiFailureCount >= CONFIG.MAX_API_FAILURES && !state.simulationOnlyMode) {
                state.simulationOnlyMode = true;
                console.warn('[LiveData] ⚠️ API unreachable after multiple failures. Switching to SIMULATION-ONLY mode.');
                _triggerAutoSimulation();
            }
            if (state.cache[cacheKey]) return state.cache[cacheKey].data;
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: LIVE DATA INGESTION ENGINE
    // ─────────────────────────────────────────────────────────────
    async function fetchLatestSession() {
        const currentYear = new Date().getFullYear();
        // Try Race sessions first
        const sessions = await cachedFetch('/sessions', { session_type: 'Race', year: currentYear });
        if (!sessions || sessions.length === 0) {
            // Try qualifying
            const qSessions = await cachedFetch('/sessions', { session_type: 'Qualifying', year: currentYear });
            if (qSessions && qSessions.length > 0) {
                state.currentSession = qSessions[qSessions.length - 1];
                state.sessionStatus = 'qualifying';
                _detectLiveSession(state.currentSession);
                return;
            }
            // Try practice sessions
            const fpSessions = await cachedFetch('/sessions', { session_type: 'Practice', year: currentYear });
            if (fpSessions && fpSessions.length > 0) {
                state.currentSession = fpSessions[fpSessions.length - 1];
                const name = (state.currentSession.session_name || '').toLowerCase();
                if (name.includes('1')) state.sessionStatus = 'fp1';
                else if (name.includes('2')) state.sessionStatus = 'fp2';
                else state.sessionStatus = 'fp3';
                _detectLiveSession(state.currentSession);
                return;
            }
            state.sessionStatus = 'idle';
            state.isLiveSession = false;
            return;
        }
        state.currentSession = sessions[sessions.length - 1];
        state.sessionStatus = 'race';
        _detectLiveSession(state.currentSession);
    }

    // Detect if the session is currently live (started but not ended)
    function _detectLiveSession(session) {
        if (!session) { state.isLiveSession = false; return; }
        const now = new Date();
        const start = session.date_start ? new Date(session.date_start) : null;
        const end = session.date_end ? new Date(session.date_end) : null;
        state.isLiveSession = !!(start && start <= now && (!end || end >= now));
        if (state.isLiveSession) {
            console.log('[LiveData] 🟢 LIVE SESSION DETECTED:', session.session_name || state.sessionStatus);
        }
    }

    async function fetchLivePositions() {
        if (!state.currentSession) return;
        const data = await cachedFetch('/position', {
            session_key: state.currentSession.session_key,
        });
        if (data && data.length > 0) {
            // Get latest position for each driver
            const latest = {};
            data.forEach(p => {
                if (!latest[p.driver_number] || new Date(p.date) > new Date(latest[p.driver_number].date)) {
                    latest[p.driver_number] = p;
                }
            });
            state.livePositions = Object.values(latest).sort((a, b) => a.position - b.position);
        }
    }

    async function fetchLapData() {
        if (!state.currentSession) return null;
        return await cachedFetch('/laps', {
            session_key: state.currentSession.session_key,
        });
    }

    async function fetchPitStops() {
        if (!state.currentSession) return;
        const data = await cachedFetch('/pit', {
            session_key: state.currentSession.session_key,
        });
        if (data) state.pitStops = data;
    }

    async function fetchStints() {
        if (!state.currentSession) return;
        const data = await cachedFetch('/stints', {
            session_key: state.currentSession.session_key,
        });
        if (data) {
            state.stints = data;
            state.compounds = {};
            state.lapsOnTire = {};
            data.forEach(s => {
                // If it's the current ongoing stint
                if (!s.lap_end || s.lap_end > (state.currentLap || 0)) {
                    state.compounds[s.driver_number] = s.compound ? s.compound.toLowerCase() : 'medium';
                    state.lapsOnTire[s.driver_number] = (s.tyre_age_at_start || 0) + ((state.currentLap || s.lap_start) - s.lap_start);
                }
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: QUALIFYING TRACKER (Regular + Sprint)
    // ─────────────────────────────────────────────────────────────
    const QualifyingTracker = {
        async fetchResults() {
            const sessions = await cachedFetch('/sessions', { session_type: 'Qualifying', year: new Date().getFullYear() });
            if (!sessions || sessions.length === 0) return false;

            const latestQuali = sessions[sessions.length - 1];
            const laps = await cachedFetch('/laps', { session_key: latestQuali.session_key });
            if (!laps || laps.length === 0) return false;

            return this._processQualiLaps(laps, 'qualifying');
        },

        // Sprint Qualifying / Sprint Shootout support
        async fetchSprintResults() {
            const currentYear = new Date().getFullYear();
            // Try Sprint_Shootout first (2024+ format), then Sprint_Qualifying (2023 format)
            let sessions = await cachedFetch('/sessions', { session_type: 'Sprint_Shootout', year: currentYear });
            if (!sessions || sessions.length === 0) {
                sessions = await cachedFetch('/sessions', { session_type: 'Sprint_Qualifying', year: currentYear });
            }
            if (!sessions || sessions.length === 0) return false;

            const latestSprint = sessions[sessions.length - 1];
            const laps = await cachedFetch('/laps', { session_key: latestSprint.session_key });
            if (!laps || laps.length === 0) return false;

            return this._processQualiLaps(laps, 'sprint');
        },

        // Shared lap processing for both qualifying formats
        _processQualiLaps(laps, sessionType) {
            // Group by driver, find best lap per session segment
            const driverBests = {};
            laps.forEach(lap => {
                const dn = lap.driver_number;
                if (!driverBests[dn]) driverBests[dn] = { driver_number: dn, best: Infinity, segments: {} };
                if (lap.lap_duration && lap.lap_duration < driverBests[dn].best) {
                    driverBests[dn].best = lap.lap_duration;
                }
                // Track which segments they participated in
                if (lap.segments) {
                    Object.keys(lap.segments).forEach(s => driverBests[dn].segments[s] = true);
                }
            });

            const sorted = Object.values(driverBests)
                .filter(d => d.best < Infinity)
                .sort((a, b) => a.best - b.best);

            const totalDrivers = sorted.length;

            if (sessionType === 'sprint') {
                // Sprint Shootout uses SQ1→SQ2→SQ3 with different elimination cuts
                // SQ1: All drivers, bottom 5 eliminated (or proportional for < 20 drivers)
                // SQ2: Top 15, bottom 5 eliminated
                // SQ3: Top 10 fight for sprint pole
                const sq1Cut = Math.max(10, totalDrivers - 5);
                const sq2Cut = Math.max(5, sq1Cut - 5);

                state.sprintQualifyingResults = {
                    SQ1: sorted.map((d, i) => ({ ...d, eliminated: i >= sq1Cut })),
                    SQ2: sorted.slice(0, sq1Cut).map((d, i) => ({ ...d, eliminated: i >= sq2Cut })),
                    SQ3: sorted.slice(0, sq2Cut),
                    finalGrid: sorted.map((d, i) => ({
                        position: i + 1,
                        driver_number: d.driver_number,
                        best_lap: d.best,
                        sessionType: 'sprint',
                    })),
                };
                console.log('[LiveData] Sprint qualifying results processed:', sorted.length, 'drivers');
            } else {
                // Regular qualifying: Q1→Q2→Q3
                const q1Cut = Math.max(10, totalDrivers - 5);
                const q2Cut = Math.max(5, q1Cut - 5);

                state.qualifyingResults.Q1 = sorted.map((d, i) => ({ ...d, eliminated: i >= q1Cut }));
                state.qualifyingResults.Q2 = sorted.slice(0, q1Cut).map((d, i) => ({ ...d, eliminated: i >= q2Cut }));
                state.qualifyingResults.Q3 = sorted.slice(0, q2Cut);
                state.qualifyingResults.finalGrid = sorted.map((d, i) => ({
                    position: i + 1,
                    driver_number: d.driver_number,
                    best_lap: d.best,
                    sessionType: 'qualifying',
                }));
            }

            return sorted.length > 0;
        },

        // Push qualifying grid to prediction engine
        pushGridToPredictionEngine() {
            if (state.qualifyingResults.finalGrid.length === 0) return;
            // Store as an override for MonteCarloEngine to use
            state.predictionOverrides.realGrid = state.qualifyingResults.finalGrid;
            console.log('[LiveData] Qualifying grid pushed to prediction engine:', state.qualifyingResults.finalGrid.length, 'drivers');

            // Bridge to QualifyingLiveDisplay for UI rendering
            if (typeof QualifyingLiveDisplay !== 'undefined') {
                const driversMap = typeof PredictionsCenter !== 'undefined' ? PredictionsCenter.getDrivers() : [];
                const enrichedGrid = state.qualifyingResults.finalGrid.map(g => {
                    const dInfo = driversMap.find(d => d.num === g.driver_number);
                    return {
                        ...g,
                        driver: dInfo || null,
                        name: dInfo ? dInfo.name : `#${g.driver_number}`,
                        color: dInfo ? dInfo.color : '#888'
                    };
                });
                QualifyingLiveDisplay.setQualiGrid(enrichedGrid);
                console.log('[LiveData] Qualifying grid bridged to QualifyingLiveDisplay');
            }
        },

        // Push sprint qualifying grid
        pushSprintGridToPredictionEngine() {
            if (!state.sprintQualifyingResults || state.sprintQualifyingResults.finalGrid.length === 0) return;
            state.predictionOverrides.sprintGrid = state.sprintQualifyingResults.finalGrid;
            console.log('[LiveData] Sprint grid pushed to prediction engine:', state.sprintQualifyingResults.finalGrid.length, 'drivers');
        },

        applyPenalties(penalties) {
            // penalties = [{ driver_number, places }]
            if (!state.qualifyingResults.finalGrid.length) return;
            penalties.forEach(pen => {
                const entry = state.qualifyingResults.finalGrid.find(g => g.driver_number === pen.driver_number);
                if (entry) entry.position = Math.min(22, entry.position + pen.places);
            });
            state.qualifyingResults.finalGrid.sort((a, b) => a.position - b.position);
            state.qualifyingResults.finalGrid.forEach((g, i) => g.position = i + 1);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // PHASE 3: NEWS + TECH UPDATE DETECTION
    // ─────────────────────────────────────────────────────────────
    const NewsDetector = {
        // Since we can't scrape actual news sites from browser JS (CORS),
        // we simulate keyword detection from available API data + manual feed
        alerts: [],

        // Detect from driver/meeting info or manual feed
        detect(text, source = 'auto') {
            if (typeof window.NewsVerificationEngine !== 'undefined') {
                const verified = window.NewsVerificationEngine.processNews([{ text, sources: source === 'manual' ? 2 : 2 }]); // Force 2 sources to pass engine for now
                if (verified.length === 0) return null; // Blocked by verification engine
            }
            const lower = text.toLowerCase();
            const found = CONFIG.NEWS_KEYWORDS.filter(kw => lower.includes(kw));
            if (found.length > 0) {
                const alert = {
                    text,
                    keywords: found,
                    source,
                    timestamp: Date.now(),
                    impact: this._assessImpact(found),
                };
                this.alerts.unshift(alert);
                if (this.alerts.length > 20) this.alerts.pop();
                state.newsAlerts = this.alerts;

                // Apply temporary modifiers
                this._applyModifiers(alert);
                return alert;
            }
            return null;
        },

        _assessImpact(keywords) {
            if (keywords.includes('disqualified') || keywords.includes('crash')) return 'high';
            if (keywords.includes('upgrade') || keywords.includes('penalty')) return 'medium';
            return 'low';
        },

        _applyModifiers(alert) {
            const text = alert.text.toLowerCase();
            const teams = ['ferrari', 'mclaren', 'mercedes', 'red bull', 'alpine', 'haas', 'audi', 'racing bulls', 'williams', 'cadillac', 'aston martin'];
            teams.forEach(team => {
                const teamId = team.replace(/\s+/g, '_');
                if (text.includes(team)) {
                    if (alert.keywords.includes('upgrade')) {
                        state.predictionOverrides[teamId] = (state.predictionOverrides[teamId] || 0) + 0.02;
                        console.log(`[NewsDetector] Upgrade detected for ${team} → +2% pace modifier`);
                    }
                    if (alert.keywords.includes('penalty') || alert.keywords.includes('grid drop')) {
                        state.predictionOverrides[teamId] = (state.predictionOverrides[teamId] || 0) - 0.01;
                        console.log(`[NewsDetector] Penalty detected for ${team} → -1% modifier`);
                    }
                }
            });
        },

        // Manual feed for news items (can be called from console or UI)
        addManualNews(text) {
            return this.detect(text, 'manual');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // PHASE 4: WEATHER INTELLIGENCE
    // ─────────────────────────────────────────────────────────────
    async function fetchWeather() {
        if (!state.currentSession) return;
        const data = await cachedFetch('/weather', {
            session_key: state.currentSession.session_key,
        });
        if (data && data.length > 0) {
            const latest = data[data.length - 1];
            state.liveWeather = {
                temp: latest.air_temperature,
                trackTemp: latest.track_temperature,
                humidity: latest.humidity,
                rainfall: latest.rainfall > 0,
                wind: latest.wind_speed,
                windDir: latest.wind_direction,
                pressure: latest.pressure,
            };

            // Auto-adjust rain probability if rain detected
            if (state.liveWeather.rainfall) {
                state.predictionOverrides.weatherAlert = 'RAIN';
                console.log('[Weather] Rain detected! Adjusting predictions...');
            } else {
                state.predictionOverrides.weatherAlert = null;
            }
        }
    }

    let _lastSimTrigger = 0;
    const SIM_THROTTLE_MS = 15000; // Max one re-sim per 15 seconds

    function triggerPredictionUpdate() {
        if (!state.autoUpdateEnabled) return;
        if (typeof PredictionsCenter === 'undefined') return;

        state.lastUpdate = Date.now();

        // Phase 8: High Accuracy Mode when qualifying + weather known
        if (state.qualifyingResults.finalGrid.length > 0 && state.liveWeather.temp !== null) {
            state.highAccuracyMode = true;
        }

        // ═══ CRITICAL: Re-run Monte Carlo sims with fresh live data ═══
        // During live sessions, actually recalculate predictions (throttled)
        if (state.isLiveSession && (Date.now() - _lastSimTrigger) > SIM_THROTTLE_MS) {
            _lastSimTrigger = Date.now();
            setTimeout(() => {
                try {
                    if (typeof PredictionsCenter.runRaceSim === 'function') {
                        console.log('[LiveData] ⚡ Re-running predictions with live data (lap ' + (state.currentLap || '?') + ')');
                        PredictionsCenter.runRaceSim();
                    }
                } catch (e) {
                    console.warn('[LiveData] Prediction re-run failed:', e.message);
                }
            }, 100);
        }

        // Trigger re-render of the live dashboard panel
        renderLiveDashboard();
        updateTimestamp();
    }

    function updateTimestamp() {
        const el = document.getElementById('live-intel-timestamp');
        if (!el) return;
        if (!state.lastUpdate) { el.textContent = 'No data yet'; return; }
        const sec = Math.floor((Date.now() - state.lastUpdate) / 1000);
        if (sec < 5) el.textContent = 'Updated just now';
        else if (sec < 60) el.textContent = `Updated ${sec}s ago`;
        else el.textContent = `Updated ${Math.floor(sec / 60)}m ago`;
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 6: LIVE DASHBOARD PANEL RENDERING
    // ─────────────────────────────────────────────────────────────
    function renderLiveDashboard() {
        const panel = document.getElementById('live-intel-panel');
        if (!panel) return;

        const w = state.liveWeather;
        const hasWeather = w.temp !== null;
        const hasGrid = state.qualifyingResults.finalGrid.length > 0;
        const hasPositions = state.livePositions.length > 0;

        let html = '';

        // Status bar — show simulation mode banner when API is down
        let sessionLabel, statusColor;
        if (state.simulationOnlyMode) {
            sessionLabel = '🧪 SIMULATION MODE — API UNAVAILABLE';
            statusColor = '#a78bfa';
        } else if (state.sessionStatus === 'idle') {
            sessionLabel = 'NO ACTIVE SESSION';
            statusColor = '#666';
        } else {
            sessionLabel = state.sessionStatus.toUpperCase() + (state.isLiveSession ? ' — LIVE' : '');
            statusColor = state.isLiveSession ? '#3fb950' : '#ffd166';
        }
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem">
      <div style="display:flex;align-items:center;gap:0.5rem">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};display:inline-block${state.isLiveSession ? ';animation:pulse 1.5s infinite' : ''}"></span>
        <span style="color:${statusColor};font-weight:bold;font-size:0.75rem;letter-spacing:1px">${sessionLabel}</span>
      </div>
      <span id="live-intel-timestamp" style="color:#666;font-size:0.6rem;font-family:monospace"></span>
    </div>`;
        // Simulation mode explainer banner
        if (state.simulationOnlyMode) {
            html += `<div style="background:#a78bfa12;border:1px solid #a78bfa33;border-radius:8px;padding:0.5rem 0.7rem;margin-bottom:0.6rem;font-size:0.6rem;color:#a78bfa">
        <strong>🔮 Running in Simulation Mode</strong><br>
        <span style="color:#888;font-size:0.55rem">OpenF1 API is unavailable (401 Auth Required). Predictions are generated using our Monte Carlo engine with 1,000+ simulations using Bahrain testing data, driver ratings, and track-specific models. All formulas are fully active.</span>
      </div>`;
        }

        // Weather card
        if (hasWeather) {
            const rainIcon = w.rainfall ? '🌧️' : '☀️';
            html += `<div style="background:#ffffff06;border-radius:8px;padding:0.6rem;margin-bottom:0.6rem;display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
        <span style="font-size:1.4rem">${rainIcon}</span>
        <div><span style="color:#888;font-size:0.6rem">AIR</span><div style="color:#fff;font-size:0.8rem">${w.temp}°C</div></div>
        <div><span style="color:#888;font-size:0.6rem">TRACK</span><div style="color:#f97316;font-size:0.8rem">${w.trackTemp || '—'}°C</div></div>
        <div><span style="color:#888;font-size:0.6rem">HUMIDITY</span><div style="color:#58a6ff;font-size:0.8rem">${w.humidity || '—'}%</div></div>
        <div><span style="color:#888;font-size:0.6rem">WIND</span><div style="color:#aaa;font-size:0.8rem">${w.wind || '—'} km/h</div></div>
        ${w.rainfall ? '<div style="color:#f44;font-weight:bold;font-size:0.7rem;padding:0.2rem 0.5rem;background:#f4433620;border-radius:4px">⚠️ RAIN ACTIVE</div>' : ''}
      </div>`;
        }

        // Grid / Positions
        if (hasGrid) {
            // Use QualifyingLiveDisplay rich panel if available
            if (typeof QualifyingLiveDisplay !== 'undefined' && QualifyingLiveDisplay.getQualiGrid()) {
                const raceName = state.currentSession ? (state.currentSession.circuit_short_name || 'Current Race') : 'Current Race';
                html += QualifyingLiveDisplay.renderQualiPanel(QualifyingLiveDisplay.getQualiGrid(), raceName);
            } else {
                html += `<div style="margin-bottom:0.6rem"><span style="color:#aaa;font-size:0.65rem;font-weight:bold">QUALIFYING GRID</span></div>`;
                html += '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.6rem">';
                state.qualifyingResults.finalGrid.slice(0, 10).forEach(g => {
                    html += `<div style="background:#ffffff08;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.6rem">
              <span style="color:#ffd166">P${g.position}</span> <span style="color:#aaa">#${g.driver_number}</span>
            </div>`;
                });
                html += '</div>';
            }
        } else if (hasPositions) {
            html += `<div style="margin-bottom:0.6rem"><span style="color:#aaa;font-size:0.65rem;font-weight:bold">LIVE POSITIONS</span></div>`;
            html += '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.6rem">';
            state.livePositions.slice(0, 10).forEach(p => {
                html += `<div style="background:#ffffff08;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.6rem">
          <span style="color:#ffd166">P${p.position}</span> <span style="color:#aaa">#${p.driver_number}</span>
        </div>`;
            });
            html += '</div>';
        }

        // Win Probabilities (from predictions engine if available)
        if (typeof PredictionsCenter !== 'undefined') {
            const modeLabel = state.simulationOnlyMode
                ? '<span style="color:#a78bfa;font-size:0.55rem;margin-left:0.5rem;padding:0.1rem 0.4rem;background:#a78bfa15;border-radius:3px">🧪 SIMULATED</span>'
                : state.highAccuracyMode
                    ? '<span style="color:#3fb950;font-size:0.55rem;margin-left:0.5rem;padding:0.1rem 0.4rem;background:#3fb95015;border-radius:3px">🎯 HIGH ACCURACY MODE</span>'
                    : '';
            html += `<div style="margin-bottom:0.4rem;margin-top:0.4rem"><span style="color:#aaa;font-size:0.65rem;font-weight:bold">TOP 5 WIN PROBABILITY</span>${modeLabel}</div>`;
            html += '<div id="live-win-probs" style="font-size:0.65rem;color:#888">' +
                (state.autoSimTriggered ? 'Auto-simulation results displayed below ↓' : 'Click "Run Race Sim" for live probabilities') + '</div>';
        }

        // News Alerts
        if (state.newsAlerts.length > 0) {
            html += `<div style="margin-top:0.6rem;margin-bottom:0.4rem"><span style="color:#aaa;font-size:0.65rem;font-weight:bold">📰 INTELLIGENCE ALERTS</span></div>`;
            state.newsAlerts.slice(0, 5).forEach(a => {
                const impColor = a.impact === 'high' ? '#f44' : a.impact === 'medium' ? '#ffd166' : '#888';
                const ago = Math.floor((Date.now() - a.timestamp) / 60000);
                html += `<div style="background:#ffffff06;border-left:2px solid ${impColor};padding:0.3rem 0.5rem;margin-bottom:0.3rem;font-size:0.6rem;border-radius:0 4px 4px 0">
          <span style="color:${impColor};font-weight:bold">${a.impact.toUpperCase()}</span>
          <span style="color:#ccc;margin-left:0.3rem">${a.text}</span>
          <span style="color:#666;margin-left:0.3rem">${ago < 1 ? 'just now' : ago + 'm ago'}</span>
        </div>`;
            });
        }

        // Tech Upgrade Alerts
        const upgrades = state.newsAlerts.filter(a => a.keywords.includes('upgrade'));
        if (upgrades.length > 0) {
            html += `<div style="margin-top:0.5rem"><span style="color:#3fb950;font-size:0.65rem;font-weight:bold">⬆ UPGRADE ALERTS</span></div>`;
            upgrades.slice(0, 3).forEach(u => {
                html += `<div style="color:#3fb950;font-size:0.6rem;padding:0.15rem 0">\u2022 ${u.text}</div>`;
            });
        }

        // Penalty Alerts
        const penalties = state.newsAlerts.filter(a => a.keywords.includes('penalty') || a.keywords.includes('grid drop'));
        if (penalties.length > 0) {
            html += `<div style="margin-top:0.5rem"><span style="color:#f44;font-size:0.65rem;font-weight:bold">⚠️ PENALTY ALERTS</span></div>`;
            penalties.slice(0, 3).forEach(p => {
                html += `<div style="color:#f44;font-size:0.6rem;padding:0.15rem 0">\u2022 ${p.text}</div>`;
            });
        }

        // Biggest movers (if grid changed from predicted)
        html += `<div style="margin-top:0.8rem;border-top:1px solid #ffffff0a;padding-top:0.5rem">
      <div style="display:flex;gap:0.5rem;align-items:center">
        <button id="live-auto-toggle" onclick="LiveIntelligence.toggleAutoUpdate()" style="padding:0.3rem 0.7rem;background:${state.autoUpdateEnabled ? '#3fb95015' : '#f4433615'};color:${state.autoUpdateEnabled ? '#3fb950' : '#f44'};border:1px solid ${state.autoUpdateEnabled ? '#3fb95033' : '#f4433633'};border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">
          ${state.autoUpdateEnabled ? '● AUTO UPDATE ON' : '○ AUTO UPDATE OFF'}
        </button>
        <button onclick="LiveIntelligence.refresh()" style="padding:0.3rem 0.7rem;background:#58a6ff15;color:#58a6ff;border:1px solid #58a6ff33;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">↻ Refresh Now</button>
      </div>
    </div>`;

        panel.innerHTML = html;
        updateTimestamp();
    }

    // ─────────────────────────────────────────────────────────────
    // MASTER REFRESH LOOP
    // ─────────────────────────────────────────────────────────────
    async function refresh() {
        try {
            await fetchLatestSession();
            await Promise.all([
                fetchLivePositions(),
                fetchWeather(),
                fetchPitStops(),
                fetchStints()
            ]);

            // Phase 1 + 5: Live Lap Delta Learning & Telemetry Fusion
            if (state.sessionStatus === 'race' && typeof window.BayesianPerformanceEngine !== 'undefined') {
                let lapsData = await fetchLapData();
                if (typeof window.DataSanityFilter !== 'undefined' && lapsData) {
                    lapsData = window.DataSanityFilter.filterLaps(lapsData);
                }
                if (lapsData && lapsData.length > 0) {
                    let maxLap = 0;
                    const driversMap = typeof PredictionsCenter !== 'undefined' ? PredictionsCenter.getDrivers() : [];

                    lapsData.forEach(lap => {
                        if (lap.lap_number > maxLap) maxLap = lap.lap_number;
                        const dInfo = driversMap.find(d => d.num === lap.driver_number);
                        if (dInfo) {
                            // Dynamic baseline pace per track (replaces hardcoded 85.0s)
                            // Uses circuit_short_name from session data for accurate Bayesian deltas
                            const TRACK_BASE_PACE = {
                                'AUS': 79, 'MEL': 79, 'CHN': 94, 'SHA': 94, 'JPN': 89, 'SUZ': 89,
                                'BAH': 87, 'SAK': 87, 'KSA': 88, 'JED': 88, 'MIA': 87,
                                'CAN': 73, 'MON': 73, 'ESP': 78, 'BAR': 78, 'AUT': 65, 'RBR': 65,
                                'GBR': 87, 'SIL': 87, 'BEL': 105, 'SPA': 105, 'HUN': 78, 'BUD': 78,
                                'NED': 72, 'ZAN': 72, 'ITA': 79, 'MOZ': 79, 'MAD': 78,
                                'AZE': 103, 'BAK': 103, 'SGP': 94, 'USA': 96, 'COT': 96,
                                'MEX': 78, 'HER': 78, 'BRA': 71, 'INT': 71, 'LAS': 92,
                                'QAT': 85, 'LOS': 85, 'ABU': 85, 'YAS': 85,
                            };
                            const circuitShort = (state.currentSession?.circuit_short_name || '').toUpperCase();
                            let baseLinePace = TRACK_BASE_PACE[circuitShort] || 85.0;
                            window.BayesianPerformanceEngine.processLapDelta(dInfo.id, dInfo.team, lap.lap_duration, baseLinePace, 1.0);
                        }
                    });

                    state.currentLap = maxLap;
                    // Safety car detection: check for laps with significantly slower times
                    // OpenF1 doesn't have a dedicated SC flag, track via lap time anomalies
                    if (maxLap > 5) {
                        const validLaps = lapsData.filter(l => l.lap_duration && l.lap_duration > 0);
                        const median = validLaps.map(l => l.lap_duration).sort((a, b) => a - b)[Math.floor(validLaps.length / 2)] || 85;
                        state.scLaps = validLaps.filter(l => l.lap_duration > median * 1.15).length; // 15%+ slower = likely SC/VSC
                    }

                    // Phase 8: Live Reprojection Loop checking
                    if (typeof window.LiveReprojectionLoop !== 'undefined') {
                        window.LiveReprojectionLoop.checkAndReproject(maxLap, () => {
                            triggerPredictionUpdate();
                        });
                    }
                }
            }

            // Attempt qualifying fetch (regular + sprint)
            const hasQuali = await QualifyingTracker.fetchResults();
            if (hasQuali) {
                QualifyingTracker.pushGridToPredictionEngine();
            }

            // Also attempt sprint qualifying fetch
            const hasSprint = await QualifyingTracker.fetchSprintResults();
            if (hasSprint) {
                QualifyingTracker.pushSprintGridToPredictionEngine();
            }

            triggerPredictionUpdate();

            // Dynamically re-evaluate polling speed when session mode changes
            reevaluateRefreshInterval();
        } catch (err) {
            console.warn('[LiveData] Refresh cycle error:', err.message);
        }
    }

    let _timestampTimer = null;
    let _lastRefreshMode = null; // Track whether we were live or idle
    function startAutoRefresh() {
        const currentMode = state.isLiveSession ? 'live' : 'idle';
        // Skip restart if mode hasn't changed (prevents unnecessary interval churn)
        if (_lastRefreshMode === currentMode && state.refreshTimer) return;
        _lastRefreshMode = currentMode;

        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (_timestampTimer) clearInterval(_timestampTimer);
        const interval = state.isLiveSession ? CONFIG.REFRESH_LIVE : CONFIG.REFRESH_IDLE;
        state.refreshTimer = setInterval(() => {
            if (state.autoUpdateEnabled) refresh();
        }, interval);
        // Separate timestamp updater (no leak)
        _timestampTimer = setInterval(updateTimestamp, 5000);
        console.log(`[LiveData] Auto-refresh: ${interval / 1000}s (${state.isLiveSession ? 'LIVE ⚡' : 'idle'})`);
    }

    // Dynamically re-evaluate the refresh interval after each refresh cycle
    function reevaluateRefreshInterval() {
        const expectedMode = state.isLiveSession ? 'live' : 'idle';
        if (_lastRefreshMode !== expectedMode) {
            console.log(`[LiveData] Session mode changed: ${_lastRefreshMode} → ${expectedMode} — restarting refresh loop`);
            startAutoRefresh();
        }
    }

    function toggleAutoUpdate() {
        state.autoUpdateEnabled = !state.autoUpdateEnabled;
        renderLiveDashboard();
    }

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────
    function init() {
        // Build the live dashboard panel in the predictions view
        injectLiveDashboard();
        // Initial data fetch
        refresh().then(() => {
            // After first refresh, try SSE streaming for sub-second updates
            if (typeof window.LiveStreamEngine !== 'undefined') {
                try {
                    window.LiveStreamEngine.autoIntegrate();
                } catch (e) {
                    console.warn('[LiveData] SSE integration skipped:', e.message);
                }
            }
        });
        // Start auto-refresh loop (polling fallback if SSE not available)
        startAutoRefresh();
        console.log('%c[LiveIntelligence] Initialized — SIM ENGINE v12.0 + LIVE DATA + SSE', 'color:#3fb950;font-weight:bold');

        // Update header badge if in simulation mode
        setTimeout(() => {
            if (state.simulationOnlyMode) {
                const badge = document.getElementById('header-live-badge');
                const label = document.getElementById('header-live-label');
                if (badge) badge.style.background = 'rgba(167,139,250,0.15)';
                if (badge) badge.style.borderColor = '#a78bfa33';
                if (label) { label.textContent = 'SIM MODE'; label.style.color = '#a78bfa'; }
                const dot = badge?.querySelector('.live-dot');
                if (dot) { dot.style.background = '#a78bfa'; dot.style.boxShadow = '0 0 8px #a78bfa55'; }
            }
        }, 5000);
    }

    function injectLiveDashboard() {
        // Find the predictions view and inject panel before sim controls
        const view = document.getElementById('view-predictions');
        if (!view) return;

        // Check if already injected
        if (document.getElementById('live-intel-section')) return;

        const section = document.createElement('div');
        section.id = 'live-intel-section';
        section.innerHTML = `
      <div style="margin:0.8rem 0">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">
          <span style="font-size:1.1rem">🔥</span>
          <span style="color:#f97316;font-weight:bold;font-size:0.85rem;font-family:'Orbitron',monospace;letter-spacing:1px">LIVE RACE INTELLIGENCE</span>
          <span style="color:#48484a;font-size:0.55rem;font-family:monospace;margin-left:auto">OPENF1 API</span>
        </div>
        <div id="live-intel-panel" style="background:linear-gradient(180deg,#0a0e14,#0d1117);border:1px solid #ffffff0a;border-radius:10px;padding:1rem;margin-bottom:1rem;font-family:'Inter',sans-serif"></div>
      </div>
    `;

        // Insert before the sim controls div
        const simControls = view.querySelector('.pred-sim-controls');
        if (simControls) {
            simControls.parentNode.insertBefore(section, simControls);
        } else {
            // Fallback: append to view
            view.appendChild(section);
        }

        renderLiveDashboard();
    }

    // ─────────────────────────────────────────────────────────────
    // AUTO-SIMULATION TRIGGER (when API is unavailable)
    // ─────────────────────────────────────────────────────────────
    function _triggerAutoSimulation() {
        if (state.autoSimTriggered) return;
        state.autoSimTriggered = true;
        console.log('[LiveData] 🧪 Auto-triggering Monte Carlo simulation (API unavailable)...');

        // Wait for PredictionsCenter to be ready, then auto-run
        const tryAutoSim = () => {
            if (typeof PredictionsCenter !== 'undefined' && typeof PredictionsCenter.runRaceSim === 'function') {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        PredictionsCenter.runRaceSim();
                        console.log('[LiveData] ✅ Auto-simulation triggered successfully');
                        // Show toast notification
                        if (typeof window.LiveAutoUpdate !== 'undefined' && window.LiveAutoUpdate.showToast) {
                            window.LiveAutoUpdate.showToast(
                                '🧪 OpenF1 API unavailable — running predictions in Simulation Mode using all 20+ engines',
                                'info'
                            );
                        }
                    } catch (e) {
                        console.warn('[LiveData] Auto-sim failed:', e.message);
                    }
                }, 500);
            } else {
                // Retry after PredictionsCenter loads
                setTimeout(tryAutoSim, 2000);
            }
        };
        tryAutoSim();
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────
    return {
        init,
        refresh,
        toggleAutoUpdate,
        addNews: (text) => NewsDetector.addManualNews(text),
        getState: () => state,
        getOverrides: () => state.predictionOverrides,
        isHighAccuracy: () => state.highAccuracyMode,
        isSimulationMode: () => state.simulationOnlyMode,
        QualifyingTracker,
        NewsDetector,
    };

})();

// Auto-initialize when predictions page loads
(function () {
    function tryInit() {
        // Only inject once PredictionsCenter has rendered its sim controls
        const view = document.getElementById('view-predictions');
        if (!view) return;
        const simControls = view.querySelector('.pred-sim-controls');
        if (simControls && !document.getElementById('live-intel-section')) {
            LiveIntelligence.init();
        } else if (!document.getElementById('live-intel-section')) {
            // Retry in 500ms
            setTimeout(tryInit, 500);
        }
    }

    // Hook into both nav clicks
    ['nav-predictions', 'nav-live-intel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                // Give PredictionsCenter time to render first
                setTimeout(tryInit, 1200);
            });
        }
    });

    // Also try after initial page load
    setTimeout(tryInit, 2000);
})();
