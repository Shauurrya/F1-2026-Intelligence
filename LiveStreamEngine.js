'use strict';
/* ═══════════════════════════════════════════════════════════════
   LIVE STREAM ENGINE — LiveStreamEngine.js (v2.0)
   
   REDESIGNED: OpenF1 does NOT support Server-Sent Events (SSE).
   Previous version created EventSource connections that silently
   failed because the API returns JSON, not SSE event streams.
   
   This v2.0 replaces broken SSE with delta-aware fast polling:
   - Polls OpenF1 every 3-5 seconds during live sessions
   - Only processes NEW data by tracking last-seen timestamps
   - Pushes changes to LiveDataEngine via callbacks
   - Falls back gracefully if API is unavailable
   ═══════════════════════════════════════════════════════════════ */

window.LiveStreamEngine = (() => {
    const API_BASE = 'https://api.openf1.org/v1';

    let _isStreaming = false;
    let _sessionKey = null;
    let _timers = {};
    let _lastSeen = {
        position: null,
        weather: null,
        carData: null,
    };
    let _callbacks = {
        onPosition: null,
        onWeather: null,
        onCarData: null,
    };
    let _retryCount = 0;
    const MAX_RETRIES = 10;
    const POLL_INTERVAL_MS = 3000; // 3s fast polling for live data

    // ─────────────────────────────────────────────────────────────
    // DELTA-AWARE FETCHER
    // Only returns data newer than what we've already processed
    // ─────────────────────────────────────────────────────────────
    async function fetchDelta(endpoint, lastTimestamp) {
        try {
            let url = `${API_BASE}${endpoint}?session_key=${_sessionKey}`;
            if (lastTimestamp) {
                url += `&date>${encodeURIComponent(lastTimestamp)}`;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!resp.ok) return null;
            const data = await resp.json();
            return Array.isArray(data) && data.length > 0 ? data : null;
        } catch (e) {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // STREAM FUNCTIONS (actually fast-poll with delta detection)
    // ─────────────────────────────────────────────────────────────
    function startPositionStream() {
        _timers.position = setInterval(async () => {
            const data = await fetchDelta('/position', _lastSeen.position);
            if (data) {
                _lastSeen.position = data[data.length - 1].date || new Date().toISOString();
                // Deduplicate: only keep latest per driver
                const latest = {};
                data.forEach(d => {
                    if (!latest[d.driver_number] || d.date > latest[d.driver_number].date) {
                        latest[d.driver_number] = d;
                    }
                });
                const positions = Object.values(latest);
                if (_callbacks.onPosition) _callbacks.onPosition(positions);
                _retryCount = 0; // Reset on success
            }
        }, POLL_INTERVAL_MS);
    }

    function startWeatherStream() {
        _timers.weather = setInterval(async () => {
            const data = await fetchDelta('/weather', _lastSeen.weather);
            if (data) {
                _lastSeen.weather = data[data.length - 1].date || new Date().toISOString();
                const latest = data[data.length - 1];
                if (_callbacks.onWeather) _callbacks.onWeather(latest);
                _retryCount = 0;
            }
        }, POLL_INTERVAL_MS * 2); // Weather changes slower, poll at 6s
    }

    function startCarDataStream() {
        _timers.carData = setInterval(async () => {
            const data = await fetchDelta('/car_data', _lastSeen.carData);
            if (data) {
                _lastSeen.carData = data[data.length - 1].date || new Date().toISOString();
                if (_callbacks.onCarData) _callbacks.onCarData(data);
                _retryCount = 0;
            }
        }, POLL_INTERVAL_MS * 2); // Telemetry at 6s
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────
    function startStreaming(sessionKey) {
        if (_isStreaming) stopStreaming();
        _sessionKey = sessionKey;
        if (!_sessionKey) {
            console.warn('[LiveStream] No session key — streaming not started');
            return;
        }

        _isStreaming = true;
        _retryCount = 0;
        _lastSeen = { position: null, weather: null, carData: null };

        startPositionStream();
        startWeatherStream();
        startCarDataStream();

        console.log(`%c[LiveStream] Fast-polling started for session ${_sessionKey} (${POLL_INTERVAL_MS}ms)`, 'color:#3fb950;font-weight:bold');
    }

    function stopStreaming() {
        Object.values(_timers).forEach(t => { if (t) clearInterval(t); });
        _timers = {};
        _isStreaming = false;
        console.log('[LiveStream] Streaming stopped');
    }

    function registerCallback(type, fn) {
        if (['onPosition', 'onWeather', 'onCarData'].includes(type)) {
            _callbacks[type] = fn;
        }
    }

    function isStreaming() { return _isStreaming; }

    // Auto-integrate with LiveDataEngine
    function autoIntegrate() {
        if (typeof window.LiveIntelligence === 'undefined') {
            console.warn('[LiveStream] LiveIntelligence not found — skipping auto-integration');
            return;
        }

        const liveState = window.LiveIntelligence.getState();
        if (!liveState || !liveState.isLiveSession) {
            console.log('[LiveStream] No live session detected — standing by');
            return;
        }

        const sessionKey = liveState.currentSession?.session_key;
        if (!sessionKey) {
            console.warn('[LiveStream] No session key in LiveIntelligence state');
            return;
        }

        // Register callbacks to push data into LiveDataEngine
        registerCallback('onPosition', (positions) => {
            try {
                const state = window.LiveIntelligence.getState();
                if (state) {
                    state.livePositions = positions;
                    state.lastUpdate = new Date();
                }
            } catch (e) { /* ignore */ }
        });

        registerCallback('onWeather', (weather) => {
            try {
                const state = window.LiveIntelligence.getState();
                if (state) {
                    state.liveWeather = {
                        airTemp: weather.air_temperature,
                        trackTemp: weather.track_temperature,
                        humidity: weather.humidity,
                        windSpeed: weather.wind_speed,
                        windDir: weather.wind_direction,
                        rainfall: weather.rainfall > 0,
                    };
                }
            } catch (e) { /* ignore */ }
        });

        startStreaming(sessionKey);
    }

    return {
        startStreaming,
        stopStreaming,
        registerCallback,
        isStreaming,
        autoIntegrate,
        POLL_INTERVAL_MS
    };
})();

console.log('%c[LiveStreamEngine] v2.0 Ready — Delta-aware fast polling (SSE replaced)', 'color:#3fb950;font-weight:bold');
