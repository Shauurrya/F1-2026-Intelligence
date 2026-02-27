'use strict';
/* ═══════════════════════════════════════════════════════════════
   SCHEDULE VIEW + MOBILE NAV — ScheduleView.js  v2.0
   Renders the full 24-race 2026 calendar with predictions,
   countdown timer, filters, and handles mobile hamburger menu.
   
   v2.0 FIXES:
   - Hamburger menu now properly opens/closes
   - Drawer links properly trigger view initialization
   - Predictions & Live Intel init from drawer works
   - Schedule view init from drawer works
   - Body scroll lock/unlock on drawer open/close
   ═══════════════════════════════════════════════════════════════ */

// ── MOBILE NAVIGATION HANDLER ──
const MobileNav = (() => {
    let isOpen = false;
    let _initialized = false;

    function init() {
        if (_initialized) return;
        _initialized = true;

        const hamburger = document.getElementById('hamburger-btn');
        const overlay = document.getElementById('mobile-nav-overlay');
        const drawer = document.getElementById('mobile-nav-drawer');
        if (!hamburger || !overlay || !drawer) {
            console.warn('[MobileNav] Missing DOM elements, retrying in 500ms...');
            _initialized = false;
            setTimeout(init, 500);
            return;
        }

        // Hamburger click
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });

        // Overlay click closes drawer
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            close();
        });

        // Each drawer link: navigate + close drawer
        drawer.querySelectorAll('.drawer-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (!view) return;

                // Update active state in drawer
                drawer.querySelectorAll('.drawer-nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Update active state in desktop nav
                document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
                const desktopLink = document.querySelector(`.nav-link[data-view="${view}"]`);
                if (desktopLink) desktopLink.classList.add('active');

                // Close drawer first
                close();

                // Navigate — use AppRouter if available
                if (typeof AppRouter !== 'undefined' && AppRouter.goView) {
                    AppRouter.goView(view);
                } else {
                    // Fallback: directly toggle view visibility
                    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                    const el = document.getElementById('view-' + view);
                    if (el) el.classList.add('active');
                }

                // CRITICAL: Trigger PredictionsCenter init for predictions/live-intel views
                if (view === 'predictions') {
                    _triggerPredictionsInit();
                    // Also trigger LiveIntelligence if navigating via Live Intel link
                    if (link.id === 'drawer-live-intel') {
                        setTimeout(() => {
                            if (typeof LiveIntelligence !== 'undefined' && LiveIntelligence.init) {
                                LiveIntelligence.refresh();
                            }
                        }, 300);
                    }
                }

                // Trigger Schedule init for schedule view
                if (view === 'schedule') {
                    _triggerScheduleInit();
                }

                // Trigger Testing view init
                if (view === 'testing') {
                    setTimeout(() => {
                        const navTest = document.getElementById('nav-testing');
                        if (navTest) {
                            const evt = new Event('click', { bubbles: true });
                            navTest.dispatchEvent(evt);
                        }
                    }, 150);
                }
            });
        });

        // Sync drawer active state when desktop nav is used
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const view = link.dataset.view;
                if (drawer) {
                    drawer.querySelectorAll('.drawer-nav-link').forEach(l => {
                        l.classList.toggle('active', l.dataset.view === view);
                    });
                }
            });
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) close();
        });

        console.log('[MobileNav] Initialized — hamburger menu ready');
    }

    function _triggerPredictionsInit() {
        // Directly trigger the PredictionsCenter click handler on the desktop nav element
        // We need a small delay to let the view become visible first
        setTimeout(() => {
            const navPred = document.getElementById('nav-predictions');
            if (navPred) {
                // Fire click event which predictions.js is listening to
                const evt = new Event('click', { bubbles: true });
                navPred.dispatchEvent(evt);
            }
        }, 150);
    }

    function _triggerScheduleInit() {
        // Directly init schedule view
        setTimeout(() => {
            ScheduleView.init(null);
        }, 100);
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    function open() {
        isOpen = true;
        const hamburger = document.getElementById('hamburger-btn');
        const overlay = document.getElementById('mobile-nav-overlay');
        const drawer = document.getElementById('mobile-nav-drawer');

        if (hamburger) hamburger.classList.add('active');
        if (overlay) overlay.classList.add('visible');
        if (drawer) drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        isOpen = false;
        const hamburger = document.getElementById('hamburger-btn');
        const overlay = document.getElementById('mobile-nav-overlay');
        const drawer = document.getElementById('mobile-nav-drawer');

        if (hamburger) hamburger.classList.remove('active');
        if (overlay) overlay.classList.remove('visible');
        if (drawer) drawer.classList.remove('open');
        document.body.style.overflow = '';
    }

    return { init, toggle, open, close };
})();


// ── SCHEDULE VIEW ──
const ScheduleView = (() => {
    let _calendar = null;
    let _currentFilter = 'all';
    let _countdownInterval = null;
    let _initialized = false;

    // Full 24-race schedule data
    const SCHEDULE_2026 = [
        { round: 1, gp: 'Australia', venue: 'Melbourne', date: '2026-03-08', flag: '🇦🇺', sprint: false },
        { round: 2, gp: 'China', venue: 'Shanghai', date: '2026-03-15', flag: '🇨🇳', sprint: true },
        { round: 3, gp: 'Japan', venue: 'Suzuka', date: '2026-03-29', flag: '🇯🇵', sprint: false },
        { round: 4, gp: 'Bahrain', venue: 'Sakhir', date: '2026-04-12', flag: '🇧🇭', sprint: false },
        { round: 5, gp: 'Saudi Arabia', venue: 'Jeddah', date: '2026-04-19', flag: '🇸🇦', sprint: false },
        { round: 6, gp: 'Miami', venue: 'Miami', date: '2026-05-03', flag: '🇺🇸', sprint: true },
        { round: 7, gp: 'Canada', venue: 'Montreal', date: '2026-05-24', flag: '🇨🇦', sprint: true },
        { round: 8, gp: 'Monaco', venue: 'Monaco', date: '2026-06-07', flag: '🇲🇨', sprint: false },
        { round: 9, gp: 'Barcelona-Catalunya', venue: 'Barcelona', date: '2026-06-14', flag: '🇪🇸', sprint: false },
        { round: 10, gp: 'Austria', venue: 'Spielberg', date: '2026-06-28', flag: '🇦🇹', sprint: false },
        { round: 11, gp: 'Great Britain', venue: 'Silverstone', date: '2026-07-05', flag: '🇬🇧', sprint: true },
        { round: 12, gp: 'Belgium', venue: 'Spa-Francorchamps', date: '2026-07-19', flag: '🇧🇪', sprint: false },
        { round: 13, gp: 'Hungary', venue: 'Budapest', date: '2026-07-26', flag: '🇭🇺', sprint: false },
        { round: 14, gp: 'Netherlands', venue: 'Zandvoort', date: '2026-08-23', flag: '🇳🇱', sprint: true },
        { round: 15, gp: 'Italy', venue: 'Monza', date: '2026-09-06', flag: '🇮🇹', sprint: false },
        { round: 16, gp: 'Spain (Madrid)', venue: 'Madrid', date: '2026-09-13', flag: '🇪🇸', sprint: false },
        { round: 17, gp: 'Azerbaijan', venue: 'Baku', date: '2026-09-26', flag: '🇦🇿', sprint: false },
        { round: 18, gp: 'Singapore', venue: 'Marina Bay', date: '2026-10-11', flag: '🇸🇬', sprint: true },
        { round: 19, gp: 'United States', venue: 'Austin', date: '2026-10-25', flag: '🇺🇸', sprint: false },
        { round: 20, gp: 'Mexico City', venue: 'Mexico City', date: '2026-11-01', flag: '🇲🇽', sprint: false },
        { round: 21, gp: 'São Paulo', venue: 'São Paulo', date: '2026-11-08', flag: '🇧🇷', sprint: false },
        { round: 22, gp: 'Las Vegas', venue: 'Las Vegas', date: '2026-11-21', flag: '🇺🇸', sprint: false },
        { round: 23, gp: 'Qatar', venue: 'Lusail', date: '2026-11-29', flag: '🇶🇦', sprint: false },
        { round: 24, gp: 'Abu Dhabi', venue: 'Yas Marina', date: '2026-12-06', flag: '🇦🇪', sprint: false }
    ];

    function getNextRace() {
        const now = new Date();
        return SCHEDULE_2026.find(r => new Date(r.date) > now) || SCHEDULE_2026[0];
    }

    function isCompleted(race) {
        return new Date(race.date) < new Date();
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    function getCalendarRace(round) {
        if (!_calendar) return null;
        return _calendar.find(r => r.round === round);
    }

    function getPrediction(round) {
        const calRace = getCalendarRace(round);
        if (!calRace) return null;
        try {
            if (typeof PredictionsCenter !== 'undefined' && PredictionsCenter.getDrivers) {
                const mults = calRace.team_mult || {};
                const drivers = PredictionsCenter.getDrivers();
                if (!drivers || !drivers.length) return null;

                const scored = drivers.map(d => {
                    const teamMult = mults[d.team] || 0.85;
                    return { ...d, score: d.rating * teamMult };
                }).sort((a, b) => b.score - a.score);

                return scored.slice(0, 3);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function renderCountdown() {
        const el = document.getElementById('schedule-countdown');
        if (!el) return;

        const nextRace = getNextRace();
        const raceDate = new Date(nextRace.date);
        const now = new Date();
        const diff = raceDate - now;

        if (diff <= 0) {
            el.innerHTML = `
        <div class="schedule-countdown">
          <div>
            <div class="countdown-label">Race Weekend Live</div>
            <div class="countdown-race">${nextRace.flag} ${nextRace.gp} Grand Prix</div>
          </div>
          <div style="font-size:1.2rem">🟢 RACE WEEKEND</div>
        </div>`;
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        el.innerHTML = `
      <div class="schedule-countdown">
        <div>
          <div class="countdown-label">Next Race</div>
          <div class="countdown-race">${nextRace.flag} ${nextRace.gp} Grand Prix</div>
          <div style="font-size:0.65rem;color:#888;margin-top:0.2rem">${formatDate(nextRace.date)} · ${nextRace.venue}</div>
        </div>
        <div class="countdown-timer">
          <div class="countdown-segment">
            <span class="countdown-num">${days}</span>
            <span class="countdown-unit">Days</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-num">${String(hours).padStart(2, '0')}</span>
            <span class="countdown-unit">Hrs</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-num">${String(mins).padStart(2, '0')}</span>
            <span class="countdown-unit">Min</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-num">${String(secs).padStart(2, '0')}</span>
            <span class="countdown-unit">Sec</span>
          </div>
        </div>
      </div>`;
    }

    function renderGrid(filter) {
        const grid = document.getElementById('schedule-grid');
        if (!grid) return;

        _currentFilter = filter || 'all';
        const nextRace = getNextRace();

        let races = SCHEDULE_2026;
        if (filter === 'sprint') races = races.filter(r => r.sprint);
        else if (filter === 'upcoming') races = races.filter(r => !isCompleted(r));
        else if (filter === 'completed') races = races.filter(r => isCompleted(r));

        if (races.length === 0) {
            grid.innerHTML = '<div style="color:#666;font-size:0.8rem;text-align:center;padding:2rem">No races match this filter</div>';
            return;
        }

        grid.innerHTML = races.map(race => {
            const completed = isCompleted(race);
            const isNext = race.round === nextRace.round;
            const calRace = getCalendarRace(race.round);
            const prediction = getPrediction(race.round);

            let cardClass = 'schedule-race-card';
            if (race.sprint) cardClass += ' sprint-race';
            if (completed) cardClass += ' completed';
            if (isNext) cardClass += ' next-race';

            let badges = '';
            if (race.sprint) badges += '<span class="sched-badge sprint">SPRINT</span> ';
            if (isNext) badges += '<span class="sched-badge next">NEXT RACE</span> ';
            if (completed) badges += '<span class="sched-badge done">COMPLETED</span> ';

            let metaHtml = `
        <div class="sched-meta">
          <span class="sched-meta-item"><span class="meta-icon">📍</span> ${race.venue}</span>
          <span class="sched-meta-item"><span class="meta-icon">📅</span> ${formatDate(race.date)}</span>`;

            if (calRace) {
                metaHtml += `
          <span class="sched-meta-item"><span class="meta-icon">🏁</span> ${calRace.laps || '?'} Laps</span>
          <span class="sched-meta-item"><span class="meta-icon">⚡</span> ${calRace.track_type || 'N/A'}</span>`;
                if (calRace.rain_probability) {
                    const rainPct = Math.round(calRace.rain_probability * 100);
                    metaHtml += `<span class="sched-meta-item"><span class="meta-icon">🌧️</span> ${rainPct}% Rain</span>`;
                }
            }
            metaHtml += '</div>';

            let predHtml = '';
            if (prediction && prediction.length >= 3) {
                predHtml = `
          <div class="sched-prediction">
            <div class="sched-pred-title">🔮 AI Predicted Podium</div>
            <div class="sched-pred-drivers">
              <span class="sched-pred-chip" style="color:${prediction[0].color};border-color:${prediction[0].color}40">🥇 ${prediction[0].name}</span>
              <span class="sched-pred-chip" style="color:${prediction[1].color};border-color:${prediction[1].color}40">🥈 ${prediction[1].name}</span>
              <span class="sched-pred-chip" style="color:${prediction[2].color};border-color:${prediction[2].color}40">🥉 ${prediction[2].name}</span>
            </div>
          </div>`;
            }

            return `
        <div class="${cardClass}" onclick="if(typeof PredictionsCenter!=='undefined'){AppRouter.goView('predictions');PredictionsCenter.selectRound(${race.round});}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">
            <div>
              <div class="sched-round">R${String(race.round).padStart(2, '0')}</div>
              <div class="sched-name"><span class="sched-flag">${race.flag}</span> ${race.gp} Grand Prix</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;justify-content:flex-end">${badges}</div>
          </div>
          ${metaHtml}
          ${predHtml}
        </div>`;
        }).join('');
    }

    function initFilters() {
        document.querySelectorAll('.schedule-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.schedule-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderGrid(btn.dataset.filter);
            });
        });
    }

    async function init(calendar) {
        if (_initialized) return;
        _initialized = true;
        _calendar = calendar;

        // If no calendar passed, try to load it (skip on file:// to avoid CORS errors)
        if (!_calendar && window.location.protocol !== 'file:') {
            try {
                const res = await fetch('./data/race_calendar_2026.json');
                if (res.ok) {
                    const data = await res.json();
                    _calendar = data.races || data;
                }
            } catch (e) { /* proceed with embedded schedule only */ }
        }

        renderCountdown();
        renderGrid('all');
        initFilters();

        if (_countdownInterval) clearInterval(_countdownInterval);
        _countdownInterval = setInterval(renderCountdown, 1000);
    }

    function render(calendar) {
        _calendar = calendar;
        renderGrid(_currentFilter);
        renderCountdown();
    }

    return { init, render, SCHEDULE_2026 };
})();

// ── QUALIFYING LIVE DATA DISPLAY ──
const QualifyingLiveDisplay = (() => {
    let _qualiData = null;

    function setQualiGrid(data) {
        _qualiData = data;
        updatePredictionsTicker();
    }

    function getQualiGrid() {
        return _qualiData;
    }

    function updatePredictionsTicker() {
        if (!_qualiData) return;
        const ticker = document.getElementById('ticker-content');
        if (!ticker) return;

        let qualiStr = '🏁 QUALIFYING RESULTS: ';
        _qualiData.slice(0, 10).forEach((entry, i) => {
            const pos = i + 1;
            const name = entry.driver?.name || entry.name || `P${pos}`;
            qualiStr += `P${pos} ${name} · `;
        });
        qualiStr += ' 🔄 Predictions updated with grid positions';

        const existing = ticker.textContent;
        ticker.textContent = qualiStr + ' ║ ' + existing;
    }

    function renderQualiPanel(qualiResults, raceName) {
        if (!qualiResults || !qualiResults.length) return '';

        let html = `<div style="background:#0d1117;border:1px solid #ffffff0a;border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:'Orbitron',monospace;font-size:0.75rem;font-weight:700;color:#ffd166;letter-spacing:0.1em;margin-bottom:0.6rem">
        🏁 LIVE QUALIFYING GRID — ${raceName || 'Current Race'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem">`;

        qualiResults.forEach((entry, i) => {
            const pos = i + 1;
            const name = entry.driver?.name || entry.name || 'TBD';
            const color = entry.driver?.color || entry.color || '#888';
            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `P${pos}`;

            html += `<div style="display:flex;align-items:center;gap:0.3rem;padding:0.3rem 0.4rem;background:#ffffff04;border-radius:6px;border-left:2px solid ${color}">
        <span style="font-size:0.6rem;color:#888;width:24px">${medal}</span>
        <span style="font-size:0.6rem;color:${color};font-weight:bold">${name}</span>
      </div>`;
        });

        html += `</div>
      <div style="font-size:0.5rem;color:#666;margin-top:0.5rem">
        Grid positions from qualifying are used to update race predictions for more accurate results
      </div>
    </div>`;

        return html;
    }

    return { setQualiGrid, getQualiGrid, renderQualiPanel, updatePredictionsTicker };
})();


// ── BOOT ──
// Use multiple strategies to ensure init runs after DOM is ready
function _bootMobileNav() {
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
        MobileNav.init();
    } else {
        // DOM not ready yet, retry
        setTimeout(_bootMobileNav, 200);
    }
}

// Strategy 1: DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootMobileNav);
} else {
    // DOM already loaded (script loaded late)
    _bootMobileNav();
}

// Strategy 2: Also try on window load as fallback
window.addEventListener('load', () => {
    _bootMobileNav();

    // Setup schedule lazy-init from desktop nav
    const scheduleNav = document.getElementById('nav-schedule');
    if (scheduleNav) {
        scheduleNav.addEventListener('click', () => {
            ScheduleView.init(null);
        });
    }
});

console.log('%c[ScheduleView] v2.0 Ready — 24-race calendar + mobile nav', 'color:#f97316;font-weight:bold');
console.log('%c[QualifyingLiveDisplay] Ready — qualifying grid display engine', 'color:#a78bfa;font-weight:bold');
