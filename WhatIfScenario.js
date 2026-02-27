'use strict';
/* ═══════════════════════════════════════════════════════════════
   WHAT-IF SCENARIO BUILDER — WhatIfScenario.js
   Interactive scenario builder letting users explore "what if"
   conditions: weather changes, driver DNFs, team upgrades,
   etc. Re-runs simulations with modified parameters and shows
   comparison between baseline and scenario results.
   ═══════════════════════════════════════════════════════════════ */

window.WhatIfScenario = (() => {

  const DEFAULT_SCENARIO = {
    weather: 'dry',
    forceDNFs: [],
    teamUpgrades: {},
    scProbOverride: null,
    tireCompounds: null,
    penaltyGridDrops: {},
    driverBoosts: {},
    active: false
  };

  let _currentScenario = { ...DEFAULT_SCENARIO };
  let _baselineResult = null;
  let _scenarioResult = null;

  function reset() {
    _currentScenario = { ...DEFAULT_SCENARIO, forceDNFs: [], teamUpgrades: {}, penaltyGridDrops: {}, driverBoosts: {} };
    _scenarioResult = null;
  }

  function setWeather(weather) { _currentScenario.weather = weather; _currentScenario.active = true; }
  function addDNF(driverId) {
    if (!_currentScenario.forceDNFs.includes(driverId)) {
      _currentScenario.forceDNFs.push(driverId);
      _currentScenario.active = true;
    }
  }
  function removeDNF(driverId) {
    _currentScenario.forceDNFs = _currentScenario.forceDNFs.filter(id => id !== driverId);
    if (!_currentScenario.forceDNFs.length && _currentScenario.weather === 'dry' && Object.keys(_currentScenario.teamUpgrades).length === 0) {
      _currentScenario.active = false;
    }
  }
  function setTeamUpgrade(teamId, delta) {
    _currentScenario.teamUpgrades[teamId] = delta;
    _currentScenario.active = true;
  }
  function removeTeamUpgrade(teamId) {
    delete _currentScenario.teamUpgrades[teamId];
  }
  function setSCOverride(prob) { _currentScenario.scProbOverride = prob; _currentScenario.active = true; }
  function setGridPenalty(driverId, positions) { _currentScenario.penaltyGridDrops[driverId] = positions; _currentScenario.active = true; }
  function setDriverBoost(driverId, mult) { _currentScenario.driverBoosts[driverId] = mult; _currentScenario.active = true; }
  function getScenario() { return { ..._currentScenario }; }
  function isActive() { return _currentScenario.active; }

  function applyToRace(race) {
    const modified = { ...race };
    if (_currentScenario.weather !== 'dry') {
      modified.weather = _currentScenario.weather;
      if (_currentScenario.weather === 'wet' || _currentScenario.weather === 'heavy_rain') {
        modified.sc_probability = Math.max(modified.sc_probability || 0.3, 0.65);
      } else if (_currentScenario.weather === 'damp') {
        modified.sc_probability = Math.max(modified.sc_probability || 0.3, 0.45);
      }
    }
    if (_currentScenario.scProbOverride !== null) {
      modified.sc_probability = _currentScenario.scProbOverride;
    }
    return modified;
  }

  function getDriverModifier(driver) {
    let modifier = 1.0;
    const teamDelta = _currentScenario.teamUpgrades[driver.team];
    if (teamDelta) {
      modifier += teamDelta * 0.01;
    }
    const driverBoost = _currentScenario.driverBoosts[driver.id];
    if (driverBoost) {
      modifier *= driverBoost;
    }
    if (_currentScenario.weather === 'wet' || _currentScenario.weather === 'heavy_rain') {
      const wetDrivers = {
        'verstappen': 1.08, 'hamilton': 1.08, 'alonso': 1.05, 'norris': 1.03,
        'sainz': 1.02, 'russell': 1.01, 'gasly': 1.01, 'ocon': 1.01,
        'piastri': 1.00, 'leclerc': 0.97
      };
      modifier *= (wetDrivers[driver.id] || 0.99);
    }
    return modifier;
  }

  function isForcedDNF(driverId) {
    return _currentScenario.forceDNFs.includes(driverId);
  }

  function getGridPenalty(driverId) {
    return _currentScenario.penaltyGridDrops[driverId] || 0;
  }

  function setBaseline(result) { _baselineResult = result; }
  function setScenarioResult(result) { _scenarioResult = result; }
  function getBaseline() { return _baselineResult; }
  function getScenarioResult() { return _scenarioResult; }

  function buildComparisonHTML(baseline, scenario, drivers) {
    if (!baseline || !scenario) return '<div style="color:#666;padding:1rem;font-size:0.7rem">Run both baseline and scenario to see comparison.</div>';

    let html = '<div style="margin-top:0.8rem">';
    html += '<div style="font-size:0.75rem;color:#a78bfa;font-weight:bold;margin-bottom:0.5rem">\ud83d\udcca SCENARIO vs BASELINE COMPARISON</div>';

    html += '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.8rem">';
    if (_currentScenario.weather !== 'dry') {
      const weatherIcons = { damp: '\ud83c\udf26\ufe0f', wet: '\ud83c\udf27\ufe0f', heavy_rain: '\u26c8\ufe0f' };
      html += `<span style="padding:0.2rem 0.6rem;border-radius:12px;font-size:0.6rem;background:#58a6ff18;color:#58a6ff;border:1px solid #58a6ff33">${weatherIcons[_currentScenario.weather] || '\u2600\ufe0f'} ${_currentScenario.weather.toUpperCase()}</span>`;
    }
    _currentScenario.forceDNFs.forEach(id => {
      const d = drivers.find(dr => dr.id === id);
      html += `<span style="padding:0.2rem 0.6rem;border-radius:12px;font-size:0.6rem;background:#ff444418;color:#ff4444;border:1px solid #ff444433">\ud83d\udca5 ${d?.name || id} DNF</span>`;
    });
    Object.entries(_currentScenario.teamUpgrades).forEach(([team, delta]) => {
      html += `<span style="padding:0.2rem 0.6rem;border-radius:12px;font-size:0.6rem;background:#00dc5018;color:#00dc50;border:1px solid #00dc5033">\u2b06\ufe0f ${team} ${delta > 0 ? '+' : ''}${delta}</span>`;
    });
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;font-size:0.65rem">';
    html += '<tr style="color:#666;border-bottom:1px solid #ffffff0a"><th style="text-align:left;padding:0.3rem">Driver</th><th>Baseline</th><th>Scenario</th><th>Change</th><th>Win %</th></tr>';

    const baseGrid = baseline.grid || [];
    const scenGrid = scenario.grid || [];

    baseGrid.slice(0, 20).forEach((b, i) => {
      const sEntry = scenGrid.find(s => s.driver.id === b.driver.id);
      if (!sEntry) return;

      const bPos = i + 1;
      const sPos = scenGrid.indexOf(sEntry) + 1;
      const change = bPos - sPos;
      const changeColor = change > 0 ? '#00dc50' : change < 0 ? '#ff4444' : '#666';
      const changeIcon = change > 0 ? '\u25b2' : change < 0 ? '\u25bc' : '\u2013';
      const winDelta = (sEntry.winProb - b.winProb).toFixed(1);
      const winColor = parseFloat(winDelta) > 0 ? '#00dc50' : parseFloat(winDelta) < 0 ? '#ff4444' : '#666';

      html += `<tr style="border-bottom:1px solid #ffffff06${change !== 0 ? ';background:#ffffff04' : ''}">
        <td style="padding:0.3rem;color:${b.driver.color}">${b.driver.name}</td>
        <td style="text-align:center">P${bPos}</td>
        <td style="text-align:center;font-weight:bold">P${sPos}</td>
        <td style="text-align:center;color:${changeColor};font-weight:bold">${changeIcon}${Math.abs(change) || ''}</td>
        <td style="text-align:center;color:${winColor}">${parseFloat(winDelta) > 0 ? '+' : ''}${winDelta}%</td>
      </tr>`;
    });

    html += '</table></div>';
    return html;
  }

  function renderPanel(drivers, teams) {
    return `
      <div id="whatif-panel" style="background:linear-gradient(135deg,#0a0e14,#0d1117);border:1px solid #a78bfa22;border-radius:12px;padding:1.2rem;margin-bottom:1.5rem">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <span style="font-size:1.2rem">\ud83d\udd2e</span>
          <span style="color:#a78bfa;font-family:'Orbitron',monospace;font-size:0.8rem;font-weight:bold;letter-spacing:0.5px">WHAT-IF SCENARIO BUILDER</span>
          <button onclick="WhatIfScenario.reset();PredictionsCenter.refreshWhatIf()" style="margin-left:auto;padding:0.3rem 0.8rem;background:#ff444418;border:1px solid #ff444433;color:#ff4444;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">RESET</button>
        </div>

        <!-- Weather -->
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.62rem;color:#888;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.5px">Weather Condition</div>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap" id="whatif-weather">
            ${['dry', 'damp', 'wet', 'heavy_rain'].map(w => {
      const icons = { dry: '\u2600\ufe0f', damp: '\ud83c\udf26\ufe0f', wet: '\ud83c\udf27\ufe0f', heavy_rain: '\u26c8\ufe0f' };
      const labels = { dry: 'Dry', damp: 'Damp', wet: 'Wet', heavy_rain: 'Storm' };
      const active = _currentScenario.weather === w;
      return `<button onclick="WhatIfScenario.setWeather('${w}');PredictionsCenter.refreshWhatIf()" 
                style="padding:0.35rem 0.7rem;border-radius:8px;cursor:pointer;font-size:0.62rem;border:1px solid ${active ? '#58a6ff' : '#ffffff12'};background:${active ? '#58a6ff18' : '#0d1117'};color:${active ? '#58a6ff' : '#888'};font-family:'Inter',sans-serif;transition:all 0.2s">
                ${icons[w]} ${labels[w]}
              </button>`;
    }).join('')}
          </div>
        </div>

        <!-- Force DNFs -->
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.62rem;color:#888;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.5px">Force Driver DNF</div>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap" id="whatif-dnfs">
            ${drivers.map(d => {
      const isDNF = _currentScenario.forceDNFs.includes(d.id);
      return `<button onclick="WhatIfScenario.${isDNF ? 'removeDNF' : 'addDNF'}('${d.id}');PredictionsCenter.refreshWhatIf()"
                style="padding:0.2rem 0.5rem;border-radius:6px;cursor:pointer;font-size:0.55rem;border:1px solid ${isDNF ? '#ff4444' : '#ffffff0a'};background:${isDNF ? '#ff444418' : 'transparent'};color:${isDNF ? '#ff4444' : d.color};font-family:'Inter',sans-serif;transition:all 0.2s" 
                title="${d.full}">
                ${isDNF ? '\ud83d\udca5' : ''} ${d.name}
              </button>`;
    }).join('')}
          </div>
        </div>

        <!-- Team Upgrades -->
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.62rem;color:#888;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.5px">Team Performance Adjustment</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.5rem" id="whatif-upgrades">
            ${Object.keys(teams || {}).map(teamId => {
      const currentDelta = _currentScenario.teamUpgrades[teamId] || 0;
      const valColor = currentDelta > 0 ? '#00dc50' : currentDelta < 0 ? '#ff4444' : '#666';
      return `<div style="padding:0.4rem 0.6rem;background:#ffffff04;border-radius:8px;border:1px solid #ffffff08">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">
                  <span style="font-size:0.62rem;color:#ccc;font-weight:600;text-transform:capitalize">${teamId.replace('_', ' ')}</span>
                  <span style="font-size:0.65rem;color:${valColor};font-weight:bold;font-family:'Orbitron',monospace;padding:0.15rem 0.5rem;background:${valColor}15;border:1px solid ${valColor}33;border-radius:4px;min-width:36px;text-align:center">${currentDelta > 0 ? '+' : ''}${currentDelta}</span>
                </div>
                <input type="range" min="-5" max="5" step="0.5" value="${currentDelta}" 
                  oninput="WhatIfScenario.setTeamUpgrade('${teamId}', parseFloat(this.value));var v=this.value;var s=this.parentElement.querySelector('span:last-of-type');if(s){s.textContent=(v>0?'+':'')+v;s.style.color=v>0?'#00dc50':v<0?'#ff4444':'#666';s.style.background=(v>0?'#00dc50':v<0?'#ff4444':'#666')+'15';s.style.borderColor=(v>0?'#00dc50':v<0?'#ff4444':'#666')+'33'}"
                  style="width:100%;height:6px;accent-color:#a78bfa;cursor:pointer;border-radius:3px">
              </div>`;
    }).join('')}
          </div>
        </div>

        <!-- Safety Car Override -->
        <div style="margin-bottom:1rem">
          <div style="font-size:0.62rem;color:#888;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.5px">Safety Car Probability</div>
          <div style="display:flex;align-items:center;gap:0.8rem">
            <input type="range" min="0" max="100" step="5" value="${(_currentScenario.scProbOverride || 0.3) * 100}"
              oninput="WhatIfScenario.setSCOverride(this.value/100);this.nextElementSibling.textContent=this.value+'%'"
              style="flex:1;height:6px;accent-color:#f59e0b;cursor:pointer;border-radius:3px" id="whatif-sc-slider">
            <span style="font-size:0.72rem;color:#f59e0b;font-weight:bold;min-width:45px;font-family:'Orbitron',monospace;text-align:center;padding:0.2rem 0.4rem;background:#f59e0b15;border:1px solid #f59e0b33;border-radius:6px">${Math.round((_currentScenario.scProbOverride || 0.3) * 100)}%</span>
          </div>
        </div>

        <!-- Run What-If Button -->
        <div style="display:flex;gap:0.6rem;align-items:center">
          <button onclick="PredictionsCenter.runWhatIf()" 
            style="padding:0.6rem 1.5rem;background:linear-gradient(135deg,#a78bfa22,#a78bfa11);border:1px solid #a78bfa55;color:#a78bfa;border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:0.72rem;font-weight:bold;letter-spacing:0.5px;transition:all 0.3s"
            onmouseover="this.style.borderColor='#a78bfa';this.style.boxShadow='0 0 15px #a78bfa33'"
            onmouseout="this.style.borderColor='#a78bfa55';this.style.boxShadow='none'">
            \ud83d\udd2e Run What-If Simulation
          </button>
          <span style="color:#48484a;font-size:0.55rem;font-family:monospace">${_currentScenario.active ? '\u26a1 Scenario active' : '\u2014 No modifications'}</span>
        </div>

        <!-- Comparison Output -->
        <div id="whatif-comparison"></div>
      </div>
    `;
  }

  return {
    reset, setWeather, addDNF, removeDNF, setTeamUpgrade, removeTeamUpgrade,
    setSCOverride, setGridPenalty, setDriverBoost, getScenario, isActive,
    applyToRace, getDriverModifier, isForcedDNF, getGridPenalty,
    setBaseline, setScenarioResult, getBaseline, getScenarioResult,
    buildComparisonHTML, renderPanel
  };
})();

console.log('%c[WhatIfScenario] Ready \u2014 Interactive scenario builder loaded', 'color:#a78bfa;font-weight:bold');
