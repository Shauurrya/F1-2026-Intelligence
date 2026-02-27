'use strict';
/* ═══════════════════════════════════════════════════════════════
   QUALIFYING vs RACE PACE SPLIT — QualifyingRaceSplit.js
   Differentiates qualifying and race performance for each driver.
   Some drivers are quali beasts (Russell, Leclerc) while others
   excel in race trim (Alonso, Verstappen).
   ═══════════════════════════════════════════════════════════════ */

window.QualifyingRaceSplit = (() => {

  // Qualifying modifier: >1.0 means better in qualifying than race
  // Race modifier: >1.0 means better in race than qualifying
  const DRIVER_PROFILES = {
    leclerc: { qualiMod: 1.06, raceMod: 0.98, label: 'Qualifying Specialist', trait: 'quali_beast' },
    hamilton: { qualiMod: 1.02, raceMod: 1.04, label: 'Race Pace Master', trait: 'race_master' },
    norris: { qualiMod: 1.05, raceMod: 1.00, label: 'Strong Qualifier', trait: 'quali_strong' },
    piastri: { qualiMod: 1.01, raceMod: 1.02, label: 'Balanced (Race Lean)', trait: 'balanced' },
    russell: { qualiMod: 1.08, raceMod: 0.96, label: 'Mr. Saturday', trait: 'quali_beast' },
    antonelli: { qualiMod: 1.03, raceMod: 0.98, label: 'Raw Pace', trait: 'quali_strong' },
    verstappen: { qualiMod: 1.04, raceMod: 1.06, label: 'Complete Package', trait: 'race_master' },
    hadjar: { qualiMod: 1.00, raceMod: 0.99, label: 'Developing', trait: 'balanced' },
    gasly: { qualiMod: 1.01, raceMod: 1.01, label: 'Balanced', trait: 'balanced' },
    colapinto: { qualiMod: 0.99, raceMod: 1.00, label: 'Developing', trait: 'balanced' },
    bearman: { qualiMod: 0.98, raceMod: 1.02, label: 'Race Improver', trait: 'race_lean' },
    ocon: { qualiMod: 1.00, raceMod: 1.01, label: 'Consistent', trait: 'balanced' },
    bortoleto: { qualiMod: 1.01, raceMod: 0.99, label: 'Developing', trait: 'balanced' },
    hulkenberg: { qualiMod: 1.04, raceMod: 0.95, label: 'Qualifying Hero', trait: 'quali_beast' },
    lawson: { qualiMod: 1.00, raceMod: 1.01, label: 'Balanced', trait: 'balanced' },
    lindblad: { qualiMod: 1.02, raceMod: 0.98, label: 'Raw Speed', trait: 'quali_strong' },
    sainz: { qualiMod: 1.01, raceMod: 1.03, label: 'Race Craftsman', trait: 'race_lean' },
    albon: { qualiMod: 0.99, raceMod: 1.03, label: 'Tire Whisperer', trait: 'race_master' },
    bottas: { qualiMod: 1.03, raceMod: 0.97, label: 'Saturday Driver', trait: 'quali_strong' },
    perez: { qualiMod: 0.95, raceMod: 1.02, label: 'Race Day Specialist', trait: 'race_lean' },
    alonso: { qualiMod: 0.99, raceMod: 1.06, label: 'Race Wizard', trait: 'race_master' },
    stroll: { qualiMod: 0.96, raceMod: 1.00, label: 'Race Lean', trait: 'race_lean' }
  };

  // Dynamic adjustments based on results
  const _history = {};
  const CACHE_KEY = 'f1_qualivrace_v1';

  function loadHistory() {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) Object.assign(_history, JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }

  function saveHistory() {
    try { (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify(_history)); } catch (e) { /* ignore */ }
  }

  function getQualiModifier(driverId) {
    const profile = DRIVER_PROFILES[driverId];
    if (!profile) return 1.0;
    const hist = _history[driverId];
    const dynamicAdj = hist ? (hist.qualiDelta || 0) * 0.005 : 0;
    return profile.qualiMod + dynamicAdj;
  }

  function getRaceModifier(driverId) {
    const profile = DRIVER_PROFILES[driverId];
    if (!profile) return 1.0;
    const hist = _history[driverId];
    const dynamicAdj = hist ? (hist.raceDelta || 0) * 0.005 : 0;
    return profile.raceMod + dynamicAdj;
  }

  function recordQualiVsRace(driverId, qualiPos, racePos) {
    if (!_history[driverId]) _history[driverId] = { qualiPositions: [], racePositions: [], qualiDelta: 0, raceDelta: 0 };
    _history[driverId].qualiPositions.push(qualiPos);
    _history[driverId].racePositions.push(racePos);

    // Calculate deltas: positive = gains places in race (race_master)
    const gains = qualiPos - racePos;
    const recentGains = _history[driverId].qualiPositions.slice(-5).map((q, i) =>
      q - _history[driverId].racePositions[_history[driverId].racePositions.length - 5 + i]
    ).filter(x => !isNaN(x));

    const avgGain = recentGains.length ? recentGains.reduce((a, b) => a + b, 0) / recentGains.length : 0;
    _history[driverId].raceDelta = avgGain;
    _history[driverId].qualiDelta = -avgGain;

    saveHistory();
  }

  function getProfile(driverId) {
    return DRIVER_PROFILES[driverId] || { qualiMod: 1.0, raceMod: 1.0, label: 'Unknown', trait: 'balanced' };
  }

  function renderComparisonWidget(drivers) {
    let html = '<div class="f1-quali-race-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.4rem">';
    const sorted = [...drivers].sort((a, b) => (DRIVER_PROFILES[b.id]?.qualiMod || 1) - (DRIVER_PROFILES[a.id]?.qualiMod || 1));

    sorted.forEach(d => {
      const p = DRIVER_PROFILES[d.id] || { qualiMod: 1.0, raceMod: 1.0, label: 'Unknown' };
      const qualiBar = Math.round((p.qualiMod - 0.9) * 500);
      const raceBar = Math.round((p.raceMod - 0.9) * 500);

      html += `<div style="background:#ffffff04;border-radius:6px;padding:0.4rem 0.5rem;border-left:2px solid ${d.color}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.6rem;color:${d.color};font-weight:bold">${d.name}</span>
          <span style="font-size:0.5rem;color:#888;background:#ffffff08;padding:0.1rem 0.3rem;border-radius:3px">${p.label}</span>
        </div>
        <div style="margin-top:0.3rem">
          <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.15rem">
            <span style="font-size:0.48rem;color:#a78bfa;width:28px">QUAL</span>
            <div style="flex:1;height:6px;background:#ffffff08;border-radius:3px;overflow:hidden">
              <div style="width:${Math.min(100, qualiBar)}%;height:100%;background:linear-gradient(90deg,#a78bfa,#c4b5fd);border-radius:3px"></div>
            </div>
            <span style="font-size:0.48rem;color:#a78bfa">${(p.qualiMod * 100 - 100).toFixed(0)}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.3rem">
            <span style="font-size:0.48rem;color:#00dc50;width:28px">RACE</span>
            <div style="flex:1;height:6px;background:#ffffff08;border-radius:3px;overflow:hidden">
              <div style="width:${Math.min(100, raceBar)}%;height:100%;background:linear-gradient(90deg,#00dc50,#5ef68a);border-radius:3px"></div>
            </div>
            <span style="font-size:0.48rem;color:#00dc50">${(p.raceMod * 100 - 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  loadHistory();

  return {
    getQualiModifier, getRaceModifier, getProfile, recordQualiVsRace,
    renderComparisonWidget, DRIVER_PROFILES
  };
})();

console.log('%c[QualifyingRaceSplit] Ready — Quali beasts vs race masters', 'color:#a78bfa;font-weight:bold');
