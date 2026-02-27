'use strict';
/* ═══════════════════════════════════════════════════════════════
   LIVE AUTO-UPDATE ENGINE — LiveAutoUpdate.js  v2.0
   Automatically fetches latest F1 race results, standings, and
   schedule data from the Jolpica API (Ergast successor).
   
   v2.0 — RACE DAY MODE:
   - Auto-detects race weekends from calendar
   - Polls every 60 seconds during race day
   - Polls every 5 minutes on race weekends (Fri-Sun)
   - Polls every 30 minutes otherwise
   - Visual "RACE DAY" indicator with live countdown
   - Toast notifications for new data
   ═══════════════════════════════════════════════════════════════ */

window.LiveAutoUpdate = (() => {

    const API_BASE = 'https://api.jolpi.ca/ergast/f1';
    const CACHE_KEY = 'f1_autoupdate_state_v3';
    const CURRENT_SEASON = 2026;
    const PREVIOUS_SEASON = 2025;

    // Polling intervals
    const POLL_NORMAL_MS = 5 * 60 * 1000;   // 5 minutes (normal)
    const POLL_RACEWEEK_MS = 2 * 60 * 1000;   // 2 minutes (race weekend Fri-Sun)
    const POLL_RACEDAY_MS = 60 * 1000;        // 60 seconds (race day — Sunday)
    const POLL_RACEHOUR_MS = 30 * 1000;        // 30 seconds (within 2 hours of race start)
    const POLL_POSTRACE_MS = 45 * 1000;        // 45 seconds (1-3 hours after race start)

    // Driver mapping (Ergast driverId → our app driverId)
    const DRIVER_MAP = {
        'max_verstappen': 'verstappen', 'leclerc': 'leclerc', 'hamilton': 'hamilton',
        'norris': 'norris', 'piastri': 'piastri', 'russell': 'russell',
        'gasly': 'gasly', 'ocon': 'ocon', 'alonso': 'alonso', 'stroll': 'stroll',
        'sainz': 'sainz', 'albon': 'albon', 'bottas': 'bottas', 'perez': 'perez',
        'hulkenberg': 'hulkenberg', 'lawson': 'lawson', 'bearman': 'bearman',
        'colapinto': 'colapinto', 'hadjar': 'hadjar', 'antonelli': 'antonelli',
        'bortoleto': 'bortoleto', 'lindblad': 'lindblad',
        'tsunoda': null, 'ricciardo': null, 'de_vries': null, 'sargeant': null,
        'zhou': null, 'magnussen': null, 'kevin_magnussen': null, 'jack_doohan': null,
        'liam_lawson': 'lawson', 'oliver_bearman': 'bearman',
        'franco_colapinto': 'colapinto', 'nico_hulkenberg': 'hulkenberg',
        'valtteri_bottas': 'bottas', 'pierre_gasly': 'gasly', 'esteban_ocon': 'ocon',
        'carlos_sainz': 'sainz', 'charles_leclerc': 'leclerc', 'lando_norris': 'norris',
        'oscar_piastri': 'piastri', 'george_russell': 'russell', 'lewis_hamilton': 'hamilton',
        'fernando_alonso': 'alonso', 'lance_stroll': 'stroll', 'alexander_albon': 'albon',
        'sergio_perez': 'perez', 'yuki_tsunoda': null, 'guanyu_zhou': null,
        'logan_sargeant': null, 'nyck_de_vries': null, 'daniel_ricciardo': null
    };

    let _state = {
        lastCheckTime: null,
        lastKnownRound: 0,
        autoImportedRounds: [],
        pollTimerId: null,
        isPolling: false,
        errors: [],
        lastStandings: null,
        raceDayMode: false,
        currentPollInterval: POLL_NORMAL_MS,
        nextRace: null,
        checksCount: 0,
        calendar: null
    };

    // ═══ RACE DAY DETECTION ═══
    function setCalendar(calendar) {
        _state.calendar = calendar;
        _updateRaceDayStatus();
    }

    function _updateRaceDayStatus() {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

        if (!_state.calendar || !_state.calendar.length) {
            _state.raceDayMode = false;
            _state.nextRace = null;
            return;
        }

        // Find next upcoming race and current race weekend
        let nextRace = null;
        let isRaceWeekend = false;
        let isRaceDay = false;
        let isRaceHour = false;
        let isPostRace = false;

        for (const race of _state.calendar) {
            const raceDate = new Date(race.date + 'T14:00:00Z'); // Races typically at 14:00 UTC
            const raceDateStr = race.date;
            const diffMs = raceDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            // This race is in the future or just happened
            if (diffDays > -1) {
                if (!nextRace) nextRace = race;

                // Race weekend: Friday to Sunday (within 3 days before race)
                if (diffDays <= 3 && diffDays >= -0.5) {
                    isRaceWeekend = true;
                }

                // Race day: Same day as race
                if (todayStr === raceDateStr) {
                    isRaceDay = true;

                    // Within 2 hours before race start
                    if (diffHours <= 2 && diffHours > 0) {
                        isRaceHour = true;
                    }

                    // 0-3 hours after race start (results being published)
                    if (diffHours <= 0 && diffHours > -3) {
                        isPostRace = true;
                    }
                }

                // Also check day after race (results may come in late)
                const nextDay = new Date(raceDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().split('T')[0];
                if (todayStr === nextDayStr && diffHours > -24) {
                    isPostRace = true;
                }

                break; // Only care about the next/current race
            }
        }

        _state.nextRace = nextRace;

        // Determine optimal polling interval
        if (isPostRace || isRaceHour) {
            _state.currentPollInterval = isPostRace ? POLL_POSTRACE_MS : POLL_RACEHOUR_MS;
            _state.raceDayMode = true;
        } else if (isRaceDay) {
            _state.currentPollInterval = POLL_RACEDAY_MS;
            _state.raceDayMode = true;
        } else if (isRaceWeekend) {
            _state.currentPollInterval = POLL_RACEWEEK_MS;
            _state.raceDayMode = true;
        } else {
            _state.currentPollInterval = POLL_NORMAL_MS;
            _state.raceDayMode = false;
        }
    }

    function forceRaceDayMode(enable) {
        if (enable) {
            _state.raceDayMode = true;
            _state.currentPollInterval = POLL_RACEDAY_MS;
        } else {
            _updateRaceDayStatus(); // Recalculate based on calendar
        }
        // Restart polling with new interval
        if (_state.pollTimerId) {
            const callbacks = _state._callbacks;
            stopPolling();
            if (callbacks) startPolling(callbacks.onImport, callbacks.onStandings);
        }
    }

    // ═══ LOAD/SAVE STATE ═══
    function loadState() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                _state.lastCheckTime = parsed.lastCheckTime || null;
                _state.lastKnownRound = parsed.lastKnownRound || 0;
                _state.autoImportedRounds = parsed.autoImportedRounds || [];
                _state.lastStandings = parsed.lastStandings || null;
                _state.checksCount = parsed.checksCount || 0;
            }
        } catch (e) { /* ignore */ }
    }

    function saveState() {
        try {
            (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify({
                lastCheckTime: _state.lastCheckTime,
                lastKnownRound: _state.lastKnownRound,
                autoImportedRounds: _state.autoImportedRounds,
                lastStandings: _state.lastStandings,
                checksCount: _state.checksCount
            }));
        } catch (e) { /* ignore */ }
    }

    // ═══ API FETCHING ═══
    async function fetchJSON(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (e.name === 'AbortError') {
                console.warn('[AutoUpdate] Request timed out:', url);
            }
            return null;
        }
    }

    async function fetchLatestResult(year) {
        const data = await fetchJSON(`${API_BASE}/${year}/last/results.json`);
        const races = data?.MRData?.RaceTable?.Races || [];
        return races.length > 0 ? races[0] : null;
    }

    async function fetchRound(year, round) {
        const data = await fetchJSON(`${API_BASE}/${year}/${round}/results.json`);
        const races = data?.MRData?.RaceTable?.Races || [];
        return races.length > 0 ? races[0] : null;
    }

    async function fetchDriverStandings(year) {
        const data = await fetchJSON(`${API_BASE}/${year}/driverStandings.json`);
        const lists = data?.MRData?.StandingsTable?.StandingsLists || [];
        return lists.length > 0 ? lists[0].DriverStandings || [] : [];
    }

    async function fetchConstructorStandings(year) {
        const data = await fetchJSON(`${API_BASE}/${year}/constructorStandings.json`);
        const lists = data?.MRData?.StandingsTable?.StandingsLists || [];
        return lists.length > 0 ? lists[0].ConstructorStandings || [] : [];
    }

    // ═══ PROCESS & IMPORT ═══
    function mapDriverId(ergastId) {
        return DRIVER_MAP[ergastId] || DRIVER_MAP[ergastId?.toLowerCase()] || null;
    }

    function processRaceResult(apiRace) {
        if (!apiRace || !apiRace.Results) return null;
        const positions = apiRace.Results
            .sort((a, b) => parseInt(a.position) - parseInt(b.position))
            .map(r => mapDriverId(r.Driver?.driverId))
            .filter(id => id !== null);
        if (positions.length < 3) return null;
        return {
            round: parseInt(apiRace.round, 10),
            raceName: apiRace.raceName,
            date: apiRace.date,
            positions: positions.slice(0, 20)
        };
    }

    function importResult(round, positions, onImport) {
        if (!positions || positions.length < 3) return false;
        if (typeof onImport === 'function') {
            onImport(round, { positions });
            return true;
        }
        return false;
    }

    // ═══ CHECK FOR NEW DATA ═══
    async function checkForUpdates(onImport, onStandings) {
        if (_state.isPolling) return { newRaces: 0, message: 'Already checking...' };
        _state.isPolling = true;
        _state.lastCheckTime = Date.now();
        _state.checksCount++;

        // Re-evaluate race day status
        _updateRaceDayStatus();

        let newRacesImported = 0;
        let messages = [];
        let standingsUpdated = false;

        try {
            // 1. Check current season results
            const latestRace = await fetchLatestResult(CURRENT_SEASON);

            if (latestRace) {
                const result = processRaceResult(latestRace);
                if (result) {
                    const round = result.round;
                    if (!_state.autoImportedRounds.includes(round)) {
                        const success = importResult(round, result.positions, onImport);
                        if (success) {
                            _state.autoImportedRounds.push(round);
                            _state.lastKnownRound = Math.max(_state.lastKnownRound, round);
                            newRacesImported++;
                            messages.push(`R${round} ${result.raceName} imported`);
                        }
                    }

                    // Backfill missed rounds
                    for (let r = _state.lastKnownRound + 1; r < round; r++) {
                        if (!_state.autoImportedRounds.includes(r)) {
                            const missedRace = await fetchRound(CURRENT_SEASON, r);
                            if (missedRace) {
                                const missedResult = processRaceResult(missedRace);
                                if (missedResult) {
                                    const success = importResult(r, missedResult.positions, onImport);
                                    if (success) {
                                        _state.autoImportedRounds.push(r);
                                        newRacesImported++;
                                        messages.push(`R${r} ${missedResult.raceName} (backfill)`);
                                    }
                                }
                            }
                        }
                    }
                    _state.lastKnownRound = Math.max(_state.lastKnownRound, round);
                }
            }

            // 2. Fetch driver standings
            const driverStandings = await fetchDriverStandings(CURRENT_SEASON);
            if (driverStandings.length > 0) {
                _state.lastStandings = {
                    drivers: driverStandings.map(s => ({
                        driverId: mapDriverId(s.Driver?.driverId),
                        points: parseFloat(s.points),
                        position: parseInt(s.position, 10),
                        wins: parseInt(s.wins, 10),
                        name: `${s.Driver?.givenName} ${s.Driver?.familyName}`
                    })).filter(s => s.driverId),
                    timestamp: Date.now()
                };
                standingsUpdated = true;

                // Also fetch constructor standings
                const constructorStandings = await fetchConstructorStandings(CURRENT_SEASON);
                if (constructorStandings.length > 0) {
                    _state.lastStandings.constructors = constructorStandings.map(s => ({
                        constructorId: s.Constructor?.constructorId,
                        name: s.Constructor?.name,
                        points: parseFloat(s.points),
                        position: parseInt(s.position, 10),
                        wins: parseInt(s.wins, 10)
                    }));
                }

                if (typeof onStandings === 'function') {
                    onStandings(_state.lastStandings);
                }
            }

            // 3. Pre-season: fetch previous season standings
            if (!latestRace && !_state.autoImportedRounds.length) {
                const prevStandings = await fetchDriverStandings(PREVIOUS_SEASON);
                if (prevStandings.length > 0) {
                    _state.lastStandings = {
                        drivers: prevStandings.map(s => ({
                            driverId: mapDriverId(s.Driver?.driverId),
                            points: parseFloat(s.points),
                            position: parseInt(s.position, 10),
                            wins: parseInt(s.wins, 10)
                        })).filter(s => s.driverId),
                        timestamp: Date.now(),
                        season: PREVIOUS_SEASON
                    };
                    standingsUpdated = true;
                    messages.push(`Pre-season: ${PREVIOUS_SEASON} standings loaded`);
                    if (typeof onStandings === 'function') onStandings(_state.lastStandings);
                }
            }

        } catch (e) {
            _state.errors.push({ time: Date.now(), error: e.message });
            messages.push(`Error: ${e.message}`);
        }

        _state.isPolling = false;
        saveState();

        return {
            newRaces: newRacesImported,
            standingsUpdated,
            messages,
            lastRound: _state.lastKnownRound,
            timestamp: _state.lastCheckTime
        };
    }

    // ═══ TOAST NOTIFICATION ═══
    function showToast(message, type = 'info') {
        const colors = {
            success: { bg: '#00dc5015', border: '#00dc5044', text: '#00dc50', icon: '\u2705' },
            info: { bg: '#58a6ff15', border: '#58a6ff44', text: '#58a6ff', icon: '\ud83d\udce1' },
            warning: { bg: '#ffd16615', border: '#ffd16644', text: '#ffd166', icon: '\u26a0\ufe0f' },
            error: { bg: '#ff444415', border: '#ff444444', text: '#ff4444', icon: '\u274c' },
            raceday: { bg: '#ff440015', border: '#ff440055', text: '#ff4400', icon: '\ud83c\udfc1' }
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
      position:fixed;top:70px;right:20px;z-index:10000;
      padding:0.8rem 1.2rem;background:${c.bg};border:1px solid ${c.border};
      border-radius:10px;color:${c.text};font-family:'Inter',sans-serif;
      font-size:0.72rem;max-width:380px;backdrop-filter:blur(12px);
      box-shadow:0 8px 32px rgba(0,0,0,0.4);
      transform:translateX(120%);transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
      display:flex;align-items:center;gap:0.5rem;
    `;
        toast.innerHTML = `
      <span style="font-size:1.1rem">${c.icon}</span>
      <div>
        <div style="font-weight:600;margin-bottom:2px">Live Update</div>
        <div style="font-size:0.63rem;opacity:0.85">${message}</div>
      </div>
      <button onclick="this.parentElement.remove()" 
        style="margin-left:auto;background:none;border:none;color:${c.text};cursor:pointer;font-size:0.9rem;padding:0 0.3rem;opacity:0.6">\u00d7</button>
    `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        });
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 500);
        }, 8000);
    }

    // ═══ COUNTDOWN TIMER ═══
    function _getCountdown() {
        if (!_state.nextRace) return null;
        const raceDate = new Date(_state.nextRace.date + 'T14:00:00Z');
        const diff = raceDate.getTime() - Date.now();
        if (diff < 0) return { text: 'RACE STARTED', past: true, diffMs: diff };

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, past: false, diffMs: diff };
        if (hours > 0) return { text: `${hours}h ${mins}m`, past: false, diffMs: diff };
        return { text: `${mins}m`, past: false, diffMs: diff };
    }

    // ═══ RENDER STATUS WIDGET ═══
    function renderStatusWidget() {
        const lastCheck = _state.lastCheckTime
            ? new Date(_state.lastCheckTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'Never';
        const imported = _state.autoImportedRounds.length;
        const isActive = !!_state.pollTimerId;
        const standingsInfo = _state.lastStandings
            ? `${_state.lastStandings.drivers?.length || 0} drivers \u00b7 ${_state.lastStandings.season || CURRENT_SEASON}`
            : 'Not loaded';
        const countdown = _getCountdown();
        const pollSec = Math.round(_state.currentPollInterval / 1000);
        const pollLabel = pollSec < 60 ? `${pollSec}s` : `${Math.round(pollSec / 60)}m`;

        const raceDayBorder = _state.raceDayMode ? '#ff440044' : '#58a6ff22';
        const raceDayGlow = _state.raceDayMode ? 'box-shadow:0 0 20px #ff440011;' : '';

        return `
      <div style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid ${raceDayBorder};border-radius:12px;padding:1rem;margin-bottom:1rem;${raceDayGlow}">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem">
          <span style="font-size:1rem">${isActive ? '\ud83d\udfe2' : '\ud83d\udd34'}</span>
          <span style="color:#58a6ff;font-family:'Orbitron',monospace;font-size:0.75rem;font-weight:bold;letter-spacing:0.5px">LIVE AUTO-UPDATE</span>
          ${_state.raceDayMode ? `
            <span style="padding:0.15rem 0.5rem;background:#ff440022;border:1px solid #ff440055;border-radius:12px;font-size:0.55rem;color:#ff4400;font-family:'Orbitron',monospace;font-weight:bold;animation:pulse 1.5s infinite">
              \ud83c\udfc1 RACE MODE
            </span>
          ` : ''}
          <span style="margin-left:auto;font-size:0.55rem;color:${isActive ? '#00dc50' : '#ff4444'};font-family:monospace">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
        
        ${_state.nextRace && countdown ? `
          <div style="background:linear-gradient(135deg,${_state.raceDayMode ? '#ff440008' : '#58a6ff08'},transparent);border:1px solid ${_state.raceDayMode ? '#ff440022' : '#58a6ff11'};border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:0.8rem;display:flex;align-items:center;gap:0.6rem">
            <span style="font-size:0.9rem">${_state.nextRace.flag || '\ud83c\udfc1'}</span>
            <div style="flex:1">
              <div style="font-size:0.65rem;color:#ddd;font-weight:600">${_state.nextRace.name || 'Next Race'}</div>
              <div style="font-size:0.55rem;color:#888">${_state.nextRace.date} \u00b7 R${_state.nextRace.round}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:0.8rem;color:${countdown.past ? '#00dc50' : '#ffd166'};font-family:'Orbitron',monospace;font-weight:bold">${countdown.text}</div>
              <div style="font-size:0.5rem;color:#666">${countdown.past ? 'Awaiting results...' : 'until lights out'}</div>
            </div>
          </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.8rem">
          <div style="background:#ffffff04;border-radius:8px;padding:0.4rem 0.6rem">
            <div style="font-size:0.5rem;color:#666;text-transform:uppercase;letter-spacing:0.5px">Last Check</div>
            <div style="font-size:0.65rem;color:#aaa;margin-top:0.15rem">${lastCheck}</div>
          </div>
          <div style="background:#ffffff04;border-radius:8px;padding:0.4rem 0.6rem">
            <div style="font-size:0.5rem;color:#666;text-transform:uppercase;letter-spacing:0.5px">Imported</div>
            <div style="font-size:0.65rem;color:#ffd166;margin-top:0.15rem">${imported} race${imported !== 1 ? 's' : ''}</div>
          </div>
          <div style="background:#ffffff04;border-radius:8px;padding:0.4rem 0.6rem">
            <div style="font-size:0.5rem;color:#666;text-transform:uppercase;letter-spacing:0.5px">Poll Rate</div>
            <div style="font-size:0.65rem;color:${_state.raceDayMode ? '#ff4400' : '#aaa'};margin-top:0.15rem;font-weight:${_state.raceDayMode ? 'bold' : 'normal'}">${pollLabel}</div>
          </div>
          <div style="background:#ffffff04;border-radius:8px;padding:0.4rem 0.6rem">
            <div style="font-size:0.5rem;color:#666;text-transform:uppercase;letter-spacing:0.5px">Total Checks</div>
            <div style="font-size:0.65rem;color:#aaa;margin-top:0.15rem">${_state.checksCount}</div>
          </div>
        </div>

        <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">
          <button onclick="PredictionsCenter.checkForUpdates()" 
            style="padding:0.4rem 0.9rem;background:linear-gradient(135deg,#58a6ff18,#58a6ff08);border:1px solid #58a6ff44;color:#58a6ff;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.6rem;transition:all 0.3s"
            onmouseover="this.style.borderColor='#58a6ff';this.style.boxShadow='0 0 12px #58a6ff22'"
            onmouseout="this.style.borderColor='#58a6ff44';this.style.boxShadow='none'">
            \ud83d\udce1 Check Now
          </button>
          <button onclick="PredictionsCenter.toggleAutoUpdate()" 
            style="padding:0.4rem 0.9rem;background:${isActive ? '#ff444418' : '#00dc5018'};border:1px solid ${isActive ? '#ff444444' : '#00dc5044'};color:${isActive ? '#ff4444' : '#00dc50'};border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.6rem;transition:all 0.3s">
            ${isActive ? '\u23f9 Stop' : '\u25b6 Start'} Polling
          </button>
          <button onclick="PredictionsCenter.toggleRaceDayMode()" 
            style="padding:0.4rem 0.9rem;background:${_state.raceDayMode ? '#ff440022' : '#ffffff06'};border:1px solid ${_state.raceDayMode ? '#ff440055' : '#ffffff15'};color:${_state.raceDayMode ? '#ff4400' : '#888'};border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.6rem;transition:all 0.3s"
            onmouseover="this.style.borderColor='#ff4400'"
            onmouseout="this.style.borderColor='${_state.raceDayMode ? '#ff440055' : '#ffffff15'}'">
            \ud83c\udfc1 ${_state.raceDayMode ? 'Exit' : 'Enter'} Race Mode
          </button>
          <span style="font-size:0.48rem;color:#48484a;font-family:monospace;margin-left:auto">Jolpica API \u00b7 auto-detect</span>
        </div>

        ${_state.autoImportedRounds.length > 0 ? `
          <div style="margin-top:0.7rem;padding-top:0.5rem;border-top:1px solid #ffffff08">
            <div style="font-size:0.5rem;color:#666;margin-bottom:0.3rem">Auto-Imported:</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.25rem">
              ${_state.autoImportedRounds.sort((a, b) => a - b).map(r =>
            `<span style="padding:0.12rem 0.35rem;background:#00dc5012;border:1px solid #00dc5033;border-radius:4px;font-size:0.5rem;color:#00dc50;font-family:monospace">R${r}</span>`
        ).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      </style>
    `;
    }

    // ═══ AUTO-POLL MANAGEMENT ═══
    function startPolling(onImport, onStandings) {
        if (_state.pollTimerId) return;

        // Store callbacks for restart
        _state._callbacks = { onImport, onStandings };

        // Re-evaluate interval based on race day status
        _updateRaceDayStatus();

        // Immediate first check
        runUpdate(onImport, onStandings);

        // Dynamic polling — adjusts interval on each tick
        const poll = () => {
            _updateRaceDayStatus(); // Recalculate interval
            runUpdate(onImport, onStandings).then(() => {
                // Refresh the widget to show updated status
                const widgetEl = document.getElementById('pred-autoupdate-widget');
                if (widgetEl) widgetEl.innerHTML = renderStatusWidget();
            });
        };

        // Use adaptive interval
        const adaptivePoll = () => {
            _updateRaceDayStatus();
            _state.pollTimerId = setTimeout(() => {
                poll();
                adaptivePoll(); // Schedule next with potentially different interval
            }, _state.currentPollInterval);
        };

        adaptivePoll();

        const msg = _state.raceDayMode
            ? `Race Mode: polling every ${Math.round(_state.currentPollInterval / 1000)}s`
            : `Normal mode: polling every ${Math.round(_state.currentPollInterval / 60000)}min`;
        console.log('[AutoUpdate] Polling started —', msg);
    }

    function stopPolling() {
        if (_state.pollTimerId) {
            clearTimeout(_state.pollTimerId);
            _state.pollTimerId = null;
            console.log('[AutoUpdate] Polling stopped');
        }
    }

    function togglePolling(onImport, onStandings) {
        if (_state.pollTimerId) {
            stopPolling();
            showToast('Auto-polling stopped', 'warning');
        } else {
            startPolling(onImport, onStandings);
            const msg = _state.raceDayMode
                ? `Race Mode active! Checking every ${Math.round(_state.currentPollInterval / 1000)} seconds`
                : `Polling every ${Math.round(_state.currentPollInterval / 60000)} minutes`;
            showToast(msg, _state.raceDayMode ? 'raceday' : 'info');
        }
    }

    async function runUpdate(onImport, onStandings) {
        const result = await checkForUpdates(onImport, onStandings);

        if (result.newRaces > 0) {
            showToast(
                `${result.newRaces} new race result${result.newRaces > 1 ? 's' : ''} imported! ${result.messages.join(', ')}`,
                'success'
            );
        }

        return result;
    }

    // ═══ INIT ═══
    function init(calendar) {
        loadState();
        if (calendar) setCalendar(calendar);
        console.log(
            '[AutoUpdate] v2.0 initialized —',
            _state.raceDayMode ? 'RACE MODE' : 'normal mode',
            '— interval:', Math.round(_state.currentPollInterval / 1000) + 's',
            '— last check:', _state.lastCheckTime ? new Date(_state.lastCheckTime).toLocaleString() : 'never'
        );
    }

    // Public API
    return {
        init,
        setCalendar,
        checkForUpdates,
        startPolling,
        stopPolling,
        togglePolling,
        forceRaceDayMode,
        runUpdate,
        showToast,
        renderStatusWidget,
        getState: () => ({ ..._state }),
        getStandings: () => _state.lastStandings
    };
})();

console.log('%c[LiveAutoUpdate] v2.0 Ready \u2014 Race Day Mode \u00b7 Adaptive Polling \u00b7 30s\u201330min', 'color:#ff4400;font-weight:bold');
