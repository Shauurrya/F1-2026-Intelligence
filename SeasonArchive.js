'use strict';
/* ═══════════════════════════════════════════════════════════════
   MULTI-SEASON ARCHIVE — SeasonArchive.js
   Archives each season's predictions, accuracy, and engine state.
   Enables cross-season accuracy comparison.
   ═══════════════════════════════════════════════════════════════ */

window.SeasonArchive = (() => {

  const CACHE_KEY = 'f1_season_archive_v1';
  let _archives = {};

  function loadState() {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) _archives = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  function saveState() {
    try { (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify(_archives)); } catch (e) { /* ignore */ }
  }

  function archiveSeason(year, data) {
    _archives[year] = {
      year,
      archivedAt: Date.now(),
      results: data.results || {},
      accuracy: data.accuracy || {},
      eloSnapshot: data.elo || {},
      championshipStandings: data.standings || [],
      totalRaces: Object.keys(data.results || {}).length,
      winnerAccuracy: data.winnerAcc || 0,
      podiumAccuracy: data.podiumAcc || 0,
      avgScore: data.avgScore || 0,
      predictions: data.predictions || {}
    };
    saveState();
  }

  function getArchive(year) { return _archives[year] || null; }

  function getAllYears() { return Object.keys(_archives).sort().reverse(); }

  function renderWidget() {
    const years = getAllYears();
    if (!years.length) {
      return `<div style="background:#ffffff04;border-radius:8px;padding:0.6rem;text-align:center">
        <span style="font-size:0.8rem">📦</span>
        <div style="font-size:0.55rem;color:#888;margin-top:0.2rem">No archived seasons yet. Archives are created at season end.</div>
        <button onclick="PredictionsCenter.archiveCurrentSeason()" style="margin-top:0.4rem;padding:0.3rem 0.8rem;background:#3fb95018;border:1px solid #3fb95033;color:#3fb950;border-radius:6px;cursor:pointer;font-size:0.55rem">📦 Archive Current Season</button>
      </div>`;
    }

    let html = '<div style="display:grid;gap:0.5rem">';
    years.forEach(year => {
      const a = _archives[year];
      if (!a) return;

      const scoreColor = a.avgScore > 60 ? '#00dc50' : a.avgScore > 40 ? '#ffd166' : '#ff4444';

      html += `<div style="background:#ffffff04;border:1px solid #ffffff0a;border-radius:8px;padding:0.6rem 0.8rem;display:flex;align-items:center;gap:0.7rem">
        <div style="background:#ffffff08;border-radius:8px;padding:0.3rem 0.6rem;text-align:center">
          <div style="font-size:0.9rem;font-weight:bold;color:#ffd166;font-family:'Orbitron',monospace">${year}</div>
          <div style="font-size:0.45rem;color:#888">${a.totalRaces} races</div>
        </div>
        <div style="flex:1">
          <div style="display:flex;gap:0.6rem;font-size:0.55rem">
            <span style="color:#888">Winner: <span style="color:${a.winnerAccuracy > 30 ? '#00dc50' : '#ffd166'}">${a.winnerAccuracy}%</span></span>
            <span style="color:#888">Podium: <span style="color:#58a6ff">${a.podiumAccuracy}%</span></span>
          </div>
          <div style="font-size:0.48rem;color:#666;margin-top:0.15rem">${new Date(a.archivedAt).toLocaleDateString()}</div>
        </div>
        <div style="text-align:center;background:${scoreColor}15;border-radius:8px;padding:0.3rem 0.5rem">
          <div style="font-size:0.75rem;font-weight:bold;color:${scoreColor};font-family:monospace">${a.avgScore}</div>
          <div style="font-size:0.4rem;color:#888">Score</div>
        </div>
      </div>`;
    });
    html += '</div>';

    // Archive button
    html += `<button onclick="PredictionsCenter.archiveCurrentSeason()" style="margin-top:0.5rem;padding:0.35rem 0.8rem;background:#3fb95018;border:1px solid #3fb95033;color:#3fb950;border-radius:6px;cursor:pointer;font-size:0.55rem;font-family:'Orbitron',monospace;width:100%">📦 Archive 2026 Season</button>`;

    return html;
  }

  loadState();

  return { archiveSeason, getArchive, getAllYears, renderWidget };
})();

console.log('%c[SeasonArchive] Ready — Multi-season archive', 'color:#3fb950;font-weight:bold');
