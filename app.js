'use strict';
/* ===== F1 2026 TECHNICAL INTELLIGENCE SYSTEM — APP.JS ===== */

// ============================================================
// DATA LOADER MODULE
// Loads from JSON file (needs local server) OR falls back to
// embedded inline data (works with file:// protocol directly)
// ============================================================
const DataLoader = (() => {
  let _data = null;

  // ── INLINE FALLBACK DATA ──────────────────────────────────
  // This mirrors data/f1_2026_cars.json so the dashboard works
  // when opened directly from the filesystem (no server needed).
  const INLINE_DATA = {
    "meta": { "season": 2026, "last_updated": "2026-02-22", "update_frequency": "weekly", "data_version": "1.0.0", "notes": "Values marked (E) are estimated. (C) = confirmed." },
    "regulations": { "min_weight_kg": 768, "max_wheelbase_mm": 3400, "max_width_mm": 1900, "engine_displacement_L": 1.6, "engine_config": "V6 Turbo Hybrid", "ice_power_kw": 400, "ice_power_bhp": 536, "mgu_k_power_kw": 350, "mgu_k_power_bhp": 469, "total_power_kw": 750, "total_power_bhp": 1005, "fuel_type": "100% Sustainable", "mgu_h_removed": true, "active_aero": true, "overtake_mode": true, "rpm_limit": 15000, "fuel_flow_limit_kg_hr": 70 },
    "teams": [
      { "id": "alpine", "name": "Alpine", "full_name": "BWT Alpine F1 Team", "chassis": "A526", "color": "#FF69B4", "secondary_color": "#0032A0", "is_works_team": false, "power_unit": { "manufacturer": "Mercedes", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3400, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 355, "race_pace_avg": "estimated mid-field", "quali_pace": "estimated mid-field", "straight_line_rank": 4, "data_status": "estimated" }, "reliability": { "dnfs_2025": 3, "engine_failures_2025": 1, "grid_penalties_pu_2025": 2, "avg_race_completion_pct": 87, "data_status": "historical" }, "drivers": ["Franco Colapinto", "Pierre Gasly"], "notable_changes": "Switched from Alpine/Renault power unit to Mercedes for 2026. Significant regulation reset opportunity." },
      { "id": "aston_martin", "name": "Aston Martin", "full_name": "Aston Martin Aramco F1 Team", "chassis": "AMR26", "color": "#006F62", "secondary_color": "#CEDC00", "is_works_team": false, "power_unit": { "manufacturer": "Honda (HRC)", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed", "notes": "Exclusive Honda works partnership" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3400, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 356, "race_pace_avg": "estimated midfield-upper", "quali_pace": "estimated midfield-upper", "straight_line_rank": 3, "data_status": "estimated" }, "reliability": { "dnfs_2025": 2, "engine_failures_2025": 0, "grid_penalties_pu_2025": 1, "avg_race_completion_pct": 92, "data_status": "historical" }, "drivers": ["Fernando Alonso", "Lance Stroll"], "notable_changes": "Full Honda works partnership. Honda returning as exclusive engine supplier with major investment in 2026 regs." },
      { "id": "audi", "name": "Audi", "full_name": "Audi Revolut F1 Team", "chassis": "R26", "color": "#BB0000", "secondary_color": "#C0C0C0", "is_works_team": true, "power_unit": { "manufacturer": "Audi", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 540, "mgu_k_power_bhp": 469, "total_power_bhp": 1009, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "partial", "notes": "Audi ICE reportedly exceeded 400kW mark in dyno testing" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3350, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.4, "top_speed_kmh": 352, "race_pace_avg": "estimated lower-midfield (first year PU)", "quali_pace": "estimated lower-midfield", "straight_line_rank": 7, "data_status": "estimated" }, "reliability": { "dnfs_2025": 4, "engine_failures_2025": 2, "grid_penalties_pu_2025": 4, "avg_race_completion_pct": 82, "data_status": "historical" }, "drivers": ["Gabriel Bortoleto", "Nico Hulkenberg"], "notable_changes": "New works team entry. First-year Audi power unit. Acquired Sauber. Major regulation reset could help close gap." },
      { "id": "cadillac", "name": "Cadillac", "full_name": "Cadillac F1 Team", "chassis": "CA01", "color": "#CC0000", "secondary_color": "#FFFFFF", "is_works_team": false, "power_unit": { "manufacturer": "Ferrari", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3380, "weight_kg": 770, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.4, "top_speed_kmh": 351, "race_pace_avg": "estimated back of midfield (new team)", "quali_pace": "estimated lower midfield", "straight_line_rank": 9, "data_status": "estimated" }, "reliability": { "dnfs_2025": null, "engine_failures_2025": null, "grid_penalties_pu_2025": null, "avg_race_completion_pct": null, "data_status": "new_team" }, "drivers": ["Valtteri Bottas", "Sergio Perez"], "notable_changes": "Brand new F1 team (formerly Andretti). First season with Ferrari customer power unit. 11th team on the grid." },
      { "id": "ferrari", "name": "Ferrari", "full_name": "Scuderia Ferrari HP", "chassis": "SF-26", "color": "#DC0000", "secondary_color": "#FFF200", "is_works_team": true, "power_unit": { "manufacturer": "Ferrari", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 545, "mgu_k_power_bhp": 469, "total_power_bhp": 1014, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "partial", "notes": "Ferrari innovative cylinder head materials for efficiency gains" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3390, "weight_kg": 770, "cooling": "Side-pod cooling", "drag_coefficient": 0.78, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.2, "top_speed_kmh": 362, "race_pace_avg": "estimated top 2-3", "quali_pace": "estimated top 3", "straight_line_rank": 1, "data_status": "estimated" }, "reliability": { "dnfs_2025": 2, "engine_failures_2025": 1, "grid_penalties_pu_2025": 2, "avg_race_completion_pct": 91, "data_status": "historical" }, "drivers": ["Lewis Hamilton", "Charles Leclerc"], "notable_changes": "Lewis Hamilton joins from Mercedes. Innovative cylinder head design. Strong regulation reset position. Hamilton/Leclerc dream lineup." },
      { "id": "haas", "name": "Haas", "full_name": "TGR Haas F1 Team", "chassis": "VF-26", "color": "#FFFFFF", "secondary_color": "#E8002D", "is_works_team": false, "power_unit": { "manufacturer": "Ferrari", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3360, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 354, "race_pace_avg": "estimated midfield", "quali_pace": "estimated midfield", "straight_line_rank": 5, "data_status": "estimated" }, "reliability": { "dnfs_2025": 3, "engine_failures_2025": 0, "grid_penalties_pu_2025": 1, "avg_race_completion_pct": 88, "data_status": "historical" }, "drivers": ["Oliver Bearman", "Esteban Ocon"], "notable_changes": "Toyota partnership (TGR Haas). Continued Ferrari customer relationship. Young driver lineup with Bearman." },
      { "id": "mclaren", "name": "McLaren", "full_name": "McLaren Mastercard F1 Team", "chassis": "MCL40", "color": "#FF8000", "secondary_color": "#000000", "is_works_team": false, "power_unit": { "manufacturer": "Mercedes", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3395, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": 0.76, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.2, "top_speed_kmh": 358, "race_pace_avg": "estimated top 2", "quali_pace": "estimated top 2-3", "straight_line_rank": 2, "data_status": "estimated" }, "reliability": { "dnfs_2025": 1, "engine_failures_2025": 0, "grid_penalties_pu_2025": 1, "avg_race_completion_pct": 96, "data_status": "historical" }, "drivers": ["Lando Norris", "Oscar Piastri"], "notable_changes": "Defending constructors form. MCL40 represents step from MCL38/39 platform. World-class aerodynamics team. Mercedes PU." },
      { "id": "mercedes", "name": "Mercedes", "full_name": "Mercedes AMG Petronas F1 Team", "chassis": "F1 W17", "color": "#00D2BE", "secondary_color": "#000000", "is_works_team": true, "power_unit": { "manufacturer": "Mercedes", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 545, "mgu_k_power_bhp": 469, "total_power_bhp": 1014, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "partial", "notes": "Reports suggest Mercedes found clever MGU-K interpretations. Strong dyno numbers." }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3400, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": 0.77, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.2, "top_speed_kmh": 360, "race_pace_avg": "estimated top 3", "quali_pace": "estimated top 3", "straight_line_rank": 2, "data_status": "estimated" }, "reliability": { "dnfs_2025": 1, "engine_failures_2025": 0, "grid_penalties_pu_2025": 0, "avg_race_completion_pct": 97, "data_status": "historical" }, "drivers": ["Kimi Antonelli", "George Russell"], "notable_changes": "Lost Hamilton to Ferrari. Promoted Antonelli. Works Mercedes PU advantage potential. Strong 2026 regulation philosophy." },
      { "id": "racing_bulls", "name": "Racing Bulls", "full_name": "Visa Cash App Racing Bulls F1 Team", "chassis": "VCARB 03", "color": "#1E3A5F", "secondary_color": "#FFFFFF", "is_works_team": false, "power_unit": { "manufacturer": "Red Bull Ford", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3360, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 353, "race_pace_avg": "estimated midfield", "quali_pace": "estimated midfield", "straight_line_rank": 6, "data_status": "estimated" }, "reliability": { "dnfs_2025": 3, "engine_failures_2025": 1, "grid_penalties_pu_2025": 2, "avg_race_completion_pct": 86, "data_status": "historical" }, "drivers": ["Liam Lawson", "Arvid Lindblad"], "notable_changes": "Red Bull junior team. Red Bull Ford PU development trickle-down. New driver lineup." },
      { "id": "red_bull", "name": "Red Bull", "full_name": "Oracle Red Bull Racing", "chassis": "RB22", "color": "#3671C6", "secondary_color": "#CC1E4A", "is_works_team": true, "power_unit": { "manufacturer": "Red Bull Ford", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 540, "mgu_k_power_bhp": 469, "total_power_bhp": 1009, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "partial", "notes": "First-year works PU with Ford collaboration. RB22 reportedly struggling with weight limit." }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3380, "weight_kg": 772, "cooling": "Side-pod cooling", "drag_coefficient": 0.79, "downforce_n": null, "active_aero": true, "data_status": "partial", "notes": "Weight compliance concerns reported" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 355, "race_pace_avg": "estimated top 3-4", "quali_pace": "estimated top 4", "straight_line_rank": 4, "data_status": "estimated" }, "reliability": { "dnfs_2025": 2, "engine_failures_2025": 1, "grid_penalties_pu_2025": 2, "avg_race_completion_pct": 90, "data_status": "historical" }, "drivers": ["Isack Hadjar", "Max Verstappen"], "notable_changes": "First Red Bull Powertrains / Ford works PU. New PU regs create risk. RB22 weight concerns. Verstappen still driving." },
      { "id": "williams", "name": "Williams", "full_name": "Atlassian Williams F1 Team", "chassis": "FW48", "color": "#005AFF", "secondary_color": "#FFFFFF", "is_works_team": false, "power_unit": { "manufacturer": "Mercedes", "architecture": "1.6L V6 Turbo Hybrid", "ice_power_bhp": 536, "mgu_k_power_bhp": 469, "total_power_bhp": 1005, "rpm_limit": 15000, "fuel_flow_limit": "70 kg/hr", "hybrid_spec": "MGU-K 350kW, No MGU-H", "turbo_config": "Single Turbo", "data_status": "confirmed" }, "chassis_aero": { "monocoque": "Carbon fibre composite", "suspension_front": "Push-rod", "suspension_rear": "Pull-rod", "wheelbase_mm": 3370, "weight_kg": 768, "cooling": "Side-pod cooling", "drag_coefficient": null, "downforce_n": null, "active_aero": true, "data_status": "partial" }, "performance": { "zero_to_100_kmh_s": 2.3, "top_speed_kmh": 353, "race_pace_avg": "estimated midfield", "quali_pace": "estimated midfield", "straight_line_rank": 6, "data_status": "estimated" }, "reliability": { "dnfs_2025": 2, "engine_failures_2025": 0, "grid_penalties_pu_2025": 1, "avg_race_completion_pct": 90, "data_status": "historical" }, "drivers": ["Alexander Albon", "Carlos Sainz"], "notable_changes": "Carlos Sainz joins from Ferrari. Atlassian title sponsor. Continued Mercedes customer relationship. Strong driver lineup upgrade." }
    ],
    "engine_suppliers": [
      { "manufacturer": "Mercedes", "teams": ["Mercedes", "McLaren", "Williams", "Alpine"], "works_team": "Mercedes", "customer_teams": ["McLaren", "Williams", "Alpine"] },
      { "manufacturer": "Ferrari", "teams": ["Ferrari", "Haas", "Cadillac"], "works_team": "Ferrari", "customer_teams": ["Haas", "Cadillac"] },
      { "manufacturer": "Red Bull Ford", "teams": ["Red Bull", "Racing Bulls"], "works_team": "Red Bull", "customer_teams": ["Racing Bulls"] },
      { "manufacturer": "Honda (HRC)", "teams": ["Aston Martin"], "works_team": "Aston Martin", "customer_teams": [] },
      { "manufacturer": "Audi", "teams": ["Audi"], "works_team": "Audi", "customer_teams": [] }
    ],
    "weekly_updates": [
      { "week": "2026-W08", "date": "2026-02-22", "summary": "Initial data compilation. Pre-season testing period. All teams revealed 2026 liveries. Red Bull weight concerns emerge.", "news": ["Red Bull RB22 over minimum weight limit per technical director", "Ferrari SF-26 unveiled with Hamilton in Maranello", "Audi ICE exceeded 400kW benchmark on dyno", "Mercedes reports strong MGU-K integration results", "Cadillac (formerly Andretti) confirmed as 11th team", "Alpine switches to Mercedes PU from Renault/Alpine", "Honda exclusive works deal with Aston Martin confirmed", "FIA confirms 768kg minimum weight for 2026 cars", "Active aero system replacing DRS now mandatory for all cars", "McLaren MCL40 revealed ahead of pre-season testing"] }
    ]
  };
  // ─────────────────────────────────────────────────────────

  async function load() {
    // Try fetching the external JSON first (works with a local server)
    try {
      const res = await fetch('./data/f1_2026_cars.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _data = await res.json();
      console.log('[DataLoader] ✅ Loaded from JSON file');
      return _data;
    } catch (err) {
      // Fallback to inline data (handles file:// CORS restriction)
      console.warn('[DataLoader] JSON fetch failed, using inline data:', err.message);
      _data = JSON.parse(JSON.stringify(INLINE_DATA)); // deep clone
      return _data;
    }
  }

  function get() { return _data; }

  return { load, get };
})();

// ============================================================
// UTILITY MODULE
// ============================================================
const Utils = (() => {
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function now() {
    return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
  function pwr(team) {
    const pu = team.power_unit;
    const ch = team.chassis_aero;
    if (!pu || !ch) return 0;
    return (pu.total_power_bhp / (ch.weight_kg || 768)).toFixed(3);
  }
  function rankLabel(n) {
    if (n === 1) return '🥇';
    if (n === 2) return '🥈';
    if (n === 3) return '🥉';
    return `#${n}`;
  }
  function capitalize(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function dataBadge(status) {
    if (!status) return '';
    const map = {
      'confirmed': 'confirmed',
      'partial': 'partial',
      'estimated': 'estimated',
      'historical': 'estimated',
      'new_team': 'estimated'
    };
    const cls = map[status] || 'estimated';
    const label = status === 'confirmed' ? 'Confirmed' : status === 'partial' ? 'Partial' : 'Estimated';
    return `<span class="data-badge badge-${cls}">${label}</span>`;
  }
  return { formatDate, now, clamp, pwr, rankLabel, capitalize, dataBadge };
})();

// ============================================================
// CHART MODULE
// ============================================================
const ChartModule = (() => {
  const instances = {};

  Chart.defaults.color = '#888';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'Rajdhani', sans-serif";

  const gradientPlugin = {};

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function barChart(id, labels, datasets, opts = {}) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: opts.legend || false, labels: { color: '#aaa', font: { family: "'Rajdhani', sans-serif", weight: '600' }, boxWidth: 12 } },
          tooltip: { backgroundColor: 'rgba(5,8,16,0.95)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, titleFont: { family: "'Orbitron', monospace", size: 11 }, bodyFont: { family: "'Rajdhani', sans-serif", size: 13 } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#aaa', font: { size: 11, weight: '600', family: "'Rajdhani', sans-serif" } } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888' }, beginAtZero: opts.beginAtZero !== false, ...opts.yAxis }
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
        ...opts.extra
      }
    });
    return instances[id];
  }

  function horizontalBarChart(id, labels, datasets, opts = {}) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: opts.legend || false, labels: { color: '#aaa' } },
          tooltip: { backgroundColor: 'rgba(5,8,16,0.95)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, titleFont: { family: "'Orbitron', monospace", size: 11 }, bodyFont: { family: "'Rajdhani', sans-serif", size: 13 } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888' }, beginAtZero: opts.beginAtZero !== false, ...opts.xAxis },
          y: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 11, weight: '600', family: "'Rajdhani', sans-serif" } } }
        },
        animation: { duration: 900, easing: 'easeOutQuart' }
      }
    });
    return instances[id];
  }

  function pieChart(id, labels, data, colors, opts = {}) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: colors.map(c => c + '99'), borderWidth: 2, hoverOffset: 12 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: '#aaa', font: { family: "'Rajdhani', sans-serif", weight: '600' }, boxWidth: 14, padding: 14 } },
          tooltip: { backgroundColor: 'rgba(5,8,16,0.95)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, titleFont: { family: "'Orbitron', monospace", size: 11 }, bodyFont: { family: "'Rajdhani', sans-serif", size: 13 }, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} team${ctx.raw > 1 ? 's' : ''}` } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' }
      }
    });
    return instances[id];
  }

  function radarChart(id, labels, datasets, opts = {}) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#aaa', font: { family: "'Rajdhani', sans-serif", weight: '600' } } },
          tooltip: { backgroundColor: 'rgba(5,8,16,0.95)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, titleFont: { family: "'Orbitron', monospace", size: 11 }, bodyFont: { family: "'Rajdhani', sans-serif", size: 13 } }
        },
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,0.08)' },
            angleLines: { color: 'rgba(255,255,255,0.06)' },
            pointLabels: { color: '#aaa', font: { size: 11, family: "'Rajdhani', sans-serif", weight: '600' } },
            ticks: { display: false, backdropColor: 'transparent' },
            suggestedMin: 0, suggestedMax: 100
          }
        },
        animation: { duration: 900, easing: 'easeOutCubic' }
      }
    });
    return instances[id];
  }

  return { barChart, horizontalBarChart, pieChart, radarChart, destroy };
})();

// ============================================================
// ANALYTICS ENGINE
// ============================================================
const Analytics = (() => {
  function powerToWeightAll(teams) {
    return teams.map(t => ({
      name: t.name,
      pwr: parseFloat(Utils.pwr(t)),
      color: t.color
    })).sort((a, b) => b.pwr - a.pwr);
  }

  function supplierDominance(teams) {
    const map = {};
    teams.forEach(t => {
      const m = t.power_unit.manufacturer;
      map[m] = (map[m] || 0) + 1;
    });
    return map;
  }

  function predictedScore(team) {
    let score = 0;
    const pu = team.power_unit;
    const ch = team.chassis_aero;
    const rel = team.reliability;
    const perf = team.performance;
    // Power unit score (max 30)
    score += Utils.clamp(((pu.total_power_bhp - 1000) / 14) * 30, 0, 30);
    // Works team bonus (10)
    if (team.is_works_team) score += 10;
    // Reliability (max 25) - based on 2025 historical avg completion
    if (rel.avg_race_completion_pct) score += Utils.clamp(((rel.avg_race_completion_pct - 80) / 20) * 25, 0, 25);
    else score += 10; // new team neutral
    // Speed (max 20)
    score += Utils.clamp(((perf.top_speed_kmh - 350) / 15) * 20, 0, 20);
    // Power to weight (max 15)
    const p2w = parseFloat(Utils.pwr(team));
    score += Utils.clamp(((p2w - 1.3) / 0.05) * 15, 0, 15);
    return Math.round(score);
  }

  function teamComparison(teamA, teamB) {
    const metrics = [
      { label: 'Total Power (BHP)', keyA: teamA.power_unit.total_power_bhp, keyB: teamB.power_unit.total_power_bhp, unit: 'BHP', higherIsBetter: true },
      { label: 'ICE Power (BHP)', keyA: teamA.power_unit.ice_power_bhp, keyB: teamB.power_unit.ice_power_bhp, unit: 'BHP', higherIsBetter: true },
      { label: 'Weight (kg)', keyA: teamA.chassis_aero.weight_kg, keyB: teamB.chassis_aero.weight_kg, unit: 'kg', higherIsBetter: false },
      { label: 'Wheelbase (mm)', keyA: teamA.chassis_aero.wheelbase_mm, keyB: teamB.chassis_aero.wheelbase_mm, unit: 'mm', higherIsBetter: null },
      { label: 'Top Speed (km/h)', keyA: teamA.performance.top_speed_kmh, keyB: teamB.performance.top_speed_kmh, unit: 'km/h', higherIsBetter: true },
      { label: '0–100 km/h (s)', keyA: teamA.performance.zero_to_100_kmh_s, keyB: teamB.performance.zero_to_100_kmh_s, unit: 's', higherIsBetter: false },
      { label: 'Race Completion %', keyA: teamA.reliability.avg_race_completion_pct, keyB: teamB.reliability.avg_race_completion_pct, unit: '%', higherIsBetter: true },
      { label: 'PU Penalties 2025', keyA: teamA.reliability.grid_penalties_pu_2025, keyB: teamB.reliability.grid_penalties_pu_2025, unit: '', higherIsBetter: false },
      { label: 'Power/Weight', keyA: parseFloat(Utils.pwr(teamA)), keyB: parseFloat(Utils.pwr(teamB)), unit: 'BHP/kg', higherIsBetter: true },
      { label: 'Pred. Score', keyA: predictedScore(teamA), keyB: predictedScore(teamB), unit: 'pts', higherIsBetter: true }
    ];
    return metrics;
  }

  return { powerToWeightAll, supplierDominance, predictedScore, teamComparison };
})();

// ============================================================
// TICKER MODULE
// ============================================================
const Ticker = (() => {
  function build(data) {
    if (!data) return;
    const updates = [];
    data.teams.forEach(t => {
      updates.push(`🏎️ ${t.name} | ${t.chassis} | Engine: ${t.power_unit.manufacturer} | ${t.power_unit.total_power_bhp} BHP | ${t.drivers.join(' / ')}`);
    });
    if (data.weekly_updates && data.weekly_updates.length) {
      data.weekly_updates[0].news.forEach(n => updates.push('📰 ' + n));
    }
    const el = document.getElementById('ticker-content');
    if (el) {
      el.textContent = updates.join('   •   ');
    }
  }
  return { build };
})();

// ============================================================
// DASHBOARD VIEW
// ============================================================
const DashboardView = (() => {
  function renderTeamGrid(teams) {
    const grid = document.getElementById('team-grid');
    if (!grid) return;
    grid.innerHTML = teams.map(t => {
      const pu = t.power_unit;
      const ch = t.chassis_aero;
      const perf = t.performance;
      return `
        <div class="team-card" style="border-color: ${t.color}22" onclick="AppRouter.goTeam('${t.id}')" id="card-${t.id}">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${t.color};border-radius:14px 0 0 14px;"></div>
          ${Utils.dataBadge(pu.data_status)}
          <div class="team-card-header">
            <div class="team-color-dot" style="background:${t.color}; box-shadow:0 0 8px ${t.color}88"></div>
            <div class="team-name-wrap">
              <div class="team-name">${t.name}</div>
              <div class="team-chassis">${t.chassis} · ${t.full_name}</div>
            </div>
            ${t.is_works_team ? '<span class="team-works-badge">Works</span>' : ''}
          </div>
          <div class="team-specs">
            <div class="spec-item">
              <div class="spec-label">Engine</div>
              <div class="spec-value">${pu.manufacturer}</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Total Power</div>
              <div class="spec-value highlight">${pu.total_power_bhp} BHP</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Weight</div>
              <div class="spec-value">${ch.weight_kg} kg</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Top Speed (E)</div>
              <div class="spec-value">${perf.top_speed_kmh} km/h</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Wheelbase</div>
              <div class="spec-value">${ch.wheelbase_mm} mm</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">P/W Ratio</div>
              <div class="spec-value">${Utils.pwr(t)} BHP/kg</div>
            </div>
          </div>
          <div class="team-drivers">
            ${t.drivers.map(d => `<span class="driver-chip">👤 ${d}</span>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderPowerChart(teams) {
    const labels = teams.map(t => t.name);
    const data = teams.map(t => t.power_unit.total_power_bhp);
    const colors = teams.map(t => t.color + 'bb');
    ChartModule.barChart('chart-power', labels, [{
      label: 'Total BHP',
      data,
      backgroundColor: colors,
      borderColor: teams.map(t => t.color),
      borderWidth: 1,
      borderRadius: 6,
    }], { beginAtZero: false, yAxis: { min: 990, max: 1020 } });
  }

  function renderWeightChart(teams) {
    const labels = teams.map(t => t.name);
    const data = teams.map(t => t.chassis_aero.weight_kg);
    ChartModule.barChart('chart-weight', labels, [{
      label: 'Weight (kg)',
      data,
      backgroundColor: 'rgba(0, 160, 255, 0.25)',
      borderColor: 'rgba(0, 160, 255, 0.8)',
      borderWidth: 1,
      borderRadius: 6,
    }], { beginAtZero: false, yAxis: { min: 766, max: 775 } });
  }

  function renderSupplierGrid(data) {
    const grid = document.getElementById('supplier-grid');
    if (!grid) return;
    const colors = {
      'Mercedes': '#00d2be',
      'Ferrari': '#dc0000',
      'Red Bull Ford': '#3671c6',
      'Honda (HRC)': '#e8002d',
      'Audi': '#bb0000'
    };
    grid.innerHTML = data.engine_suppliers.map(s => {
      const colorFg = colors[s.manufacturer] || '#fff';
      return `
        <div class="supplier-card" style="border-color: ${colorFg}33">
          <div style="height:3px;background:${colorFg};border-radius:2px;margin-bottom:0.75rem;"></div>
          <div class="supplier-name" style="color:${colorFg}">${s.manufacturer}</div>
          <div class="supplier-team-count">${s.teams.length} team${s.teams.length > 1 ? 's' : ''}</div>
          <div class="supplier-teams">
            ${s.teams.map(name => {
        const team = data.teams.find(t => t.name === name);
        const isWorks = s.works_team === name;
        return `<div class="supplier-team ${isWorks ? 'supplier-works' : ''}">
                <div class="supplier-dot" style="background:${team ? team.color : '#888'}"></div>
                ${name}${isWorks ? ' ★' : ''}
              </div>`;
      }).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderWeeklyReport(data) {
    const el = document.getElementById('weekly-report');
    if (!el || !data.weekly_updates || !data.weekly_updates.length) return;
    const report = data.weekly_updates[0];
    el.innerHTML = `
      <div class="report-date">WEEK ${report.week} · ${Utils.formatDate(report.date)}</div>
      <div class="report-summary">${report.summary}</div>
      <ul class="report-news">
        ${report.news.map(n => `<li>${n}</li>`).join('')}
      </ul>`;
  }

  function render(data) {
    renderTeamGrid(data.teams);
    renderPowerChart(data.teams);
    renderWeightChart(data.teams);
    renderSupplierGrid(data);
    renderWeeklyReport(data);
  }

  return { render };
})();

// ============================================================
// TEAMS VIEW
// ============================================================
const TeamsView = (() => {
  function renderSelector(teams) {
    const sel = document.getElementById('team-selector');
    if (!sel) return;
    sel.innerHTML = teams.map(t => `
      <button class="team-sel-btn" data-id="${t.id}" id="sel-${t.id}">
        <div class="sel-dot" style="background:${t.color}"></div>
        ${t.name}
      </button>`).join('');
    sel.querySelectorAll('.team-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sel.querySelectorAll('.team-sel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.style.borderColor = btn.querySelector('.sel-dot').style.background;
        btn.style.background = btn.querySelector('.sel-dot').style.background + '18';
        renderDetail(DataLoader.get().teams.find(t => t.id === btn.dataset.id));
      });
    });
  }

  function renderDetail(team) {
    const panel = document.getElementById('team-detail-panel');
    if (!panel || !team) return;
    const pu = team.power_unit;
    const ch = team.chassis_aero;
    const perf = team.performance;
    const rel = team.reliability;
    const pred = Analytics.predictedScore(team);

    panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-color-bar" style="background: linear-gradient(180deg, ${team.color}, ${team.secondary_color || '#333'})"></div>
        <div>
          <div class="detail-title">${team.name}</div>
          <div class="detail-subtitle">${team.full_name} · Chassis: ${team.chassis}</div>
        </div>
        <div style="margin-left:auto; display:flex; align-items:center; gap:1rem;">
          ${team.is_works_team ? '<span class="team-works-badge">Works Team</span>' : ''}
          <div style="text-align:center;">
            <div style="font-family:'Orbitron',monospace;font-size:1.8rem;font-weight:900;color:${team.color}">${pred}</div>
            <div style="font-size:0.6rem;color:#888;text-transform:uppercase;letter-spacing:0.08em">Pred. Score</div>
          </div>
        </div>
      </div>
      <div class="detail-body">

        <div class="detail-section">
          <div class="detail-section-title">⚡ Power Unit</div>
          <div class="spec-table">
            ${specRow('Manufacturer', pu.manufacturer, pu.data_status)}
            ${specRow('Architecture', pu.architecture)}
            ${specRow('ICE Power', pu.ice_power_bhp + ' BHP / ' + Math.round(pu.ice_power_bhp * 0.7457) + ' kW', pu.data_status)}
            ${specRow('MGU-K Power', pu.mgu_k_power_bhp + ' BHP / 350 kW', pu.data_status)}
            ${specRow('Total Output', '<strong style="color:#e10600">' + pu.total_power_bhp + ' BHP</strong>', pu.data_status)}
            ${specRow('RPM Limit', pu.rpm_limit ? pu.rpm_limit.toLocaleString() + ' rpm' : '15,000 rpm')}
            ${specRow('Fuel Flow', pu.fuel_flow_limit)}
            ${specRow('Hybrid Spec', pu.hybrid_spec)}
            ${specRow('Turbo Config', pu.turbo_config)}
          </div>
          ${pu.notes ? `<div class="notes-box">ℹ️ ${pu.notes}</div>` : ''}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">🏗️ Chassis & Aerodynamics</div>
          <div class="spec-table">
            ${specRow('Monocoque', ch.monocoque)}
            ${specRow('Front Suspension', ch.suspension_front)}
            ${specRow('Rear Suspension', ch.suspension_rear)}
            ${specRow('Wheelbase', ch.wheelbase_mm + ' mm')}
            ${specRow('Min Weight', ch.weight_kg + ' kg', ch.data_status)}
            ${specRow('Drag Coefficient', ch.drag_coefficient ? 'Cd ' + ch.drag_coefficient : 'N/A')}
            ${specRow('Active Aero', ch.active_aero ? '✅ Yes (2026 Regs)' : '❌ No')}
            ${specRow('Cooling', ch.cooling)}
          </div>
          ${ch.data_status === 'partial' ? `<div class="notes-box">⚠️ Partial chassis data. Full spec to be disclosed post-launch.</div>` : ''}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">📊 Performance Metrics</div>
          <div class="spec-table">
            ${specRow('0–100 km/h', perf.zero_to_100_kmh_s + 's', perf.data_status)}
            ${specRow('Top Speed', perf.top_speed_kmh + ' km/h', perf.data_status)}
            ${specRow('Race Pace', Utils.capitalize(perf.race_pace_avg), perf.data_status)}
            ${specRow('Qualifying', Utils.capitalize(perf.quali_pace), perf.data_status)}
            ${specRow('Speed Rank', '#' + perf.straight_line_rank + ' on grid', perf.data_status)}
            ${specRow('Power/Weight', Utils.pwr(team) + ' BHP/kg', perf.data_status)}
          </div>
          <div class="notes-box">⚠️ All performance figures are pre-season analyst estimates using FIA reg data. Official times TBD post-testing.</div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">🔧 Reliability (2025 Historical)</div>
          <div class="spec-table">
            ${specRow('DNFs', rel.dnfs_2025 !== null ? rel.dnfs_2025 : 'N/A (new team)', rel.data_status)}
            ${specRow('Engine Failures', rel.engine_failures_2025 !== null ? rel.engine_failures_2025 : 'N/A', rel.data_status)}
            ${specRow('PU Grid Penalties', rel.grid_penalties_pu_2025 !== null ? rel.grid_penalties_pu_2025 : 'N/A', rel.data_status)}
            ${specRow('Avg Race Completion', rel.avg_race_completion_pct !== null ? rel.avg_race_completion_pct + '%' : 'N/A', rel.data_status)}
          </div>
          <div class="notes-box">ℹ️ Based on 2025 season data. New team figures show no prior data. 2026 reliability data pending first race.</div>
        </div>

        <div class="detail-section" style="grid-column: 1 / -1; border-right: none;">
          <div class="detail-section-title">🏎️ Drivers & Key Changes</div>
          <div style="display:flex;gap:2rem;flex-wrap:wrap;">
            <div>
              <div class="spec-label" style="margin-bottom:0.5rem">Driver Lineup</div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                ${team.drivers.map(d => `<span class="driver-chip" style="font-size:0.9rem;padding:0.3rem 0.8rem">🏎️ ${d}</span>`).join('')}
              </div>
            </div>
            <div style="flex:1;min-width:250px;">
              <div class="spec-label" style="margin-bottom:0.5rem">Notable Changes for 2026</div>
              <div style="font-size:0.82rem;color:#b0b8c8;line-height:1.6">${team.notable_changes}</div>
            </div>
          </div>
        </div>

      </div>`;
  }

  function specRow(label, value, status) {
    let cls = '';
    if (status === 'confirmed') cls = 'confirmed';
    else if (status === 'estimated' || status === 'historical') cls = 'estimated';
    return `<div class="spec-row">
      <div class="spec-key">${label}</div>
      <div class="spec-val ${cls}">${value || 'N/A'}</div>
    </div>`;
  }

  function render(data, targetTeamId) {
    renderSelector(data.teams);
    if (targetTeamId) {
      const btn = document.getElementById('sel-' + targetTeamId);
      if (btn) {
        btn.classList.add('active');
        const team = data.teams.find(t => t.id === targetTeamId);
        if (team) {
          btn.style.borderColor = team.color;
          btn.style.background = team.color + '18';
          renderDetail(team);
        }
      }
    }
  }

  return { render };
})();

// ============================================================
// ANALYTICS VIEW
// ============================================================
const AnalyticsView = (() => {
  function render(data) {
    const teams = data.teams;

    // Power-to-Weight
    const pwrData = Analytics.powerToWeightAll(teams);
    ChartModule.horizontalBarChart('chart-pwr',
      pwrData.map(d => d.name),
      [{
        label: 'BHP/kg',
        data: pwrData.map(d => d.pwr),
        backgroundColor: pwrData.map(d => d.color + 'bb'),
        borderColor: pwrData.map(d => d.color),
        borderWidth: 1, borderRadius: 4
      }],
      { beginAtZero: false, xAxis: { min: 1.29, max: 1.33 } }
    );

    // Top Speed
    const sorted = [...teams].sort((a, b) => b.performance.top_speed_kmh - a.performance.top_speed_kmh);
    ChartModule.horizontalBarChart('chart-topspeed',
      sorted.map(t => t.name),
      [{
        label: 'Top Speed (km/h)',
        data: sorted.map(t => t.performance.top_speed_kmh),
        backgroundColor: sorted.map(t => t.color + 'bb'),
        borderColor: sorted.map(t => t.color),
        borderWidth: 1, borderRadius: 4
      }],
      { beginAtZero: false, xAxis: { min: 348, max: 365 } }
    );

    // Supplier Pie
    const dom = Analytics.supplierDominance(teams);
    ChartModule.pieChart('chart-supplier-pie',
      Object.keys(dom),
      Object.values(dom),
      ['#00d2be', '#dc0000', '#3671c6', '#e8002d', '#bb0000']
    );

    // Reliability
    const relTeams = teams.filter(t => t.reliability.avg_race_completion_pct !== null);
    ChartModule.barChart('chart-reliability',
      relTeams.map(t => t.name),
      [{
        label: 'Avg Race Completion %',
        data: relTeams.map(t => t.reliability.avg_race_completion_pct),
        backgroundColor: relTeams.map(t => t.color + 'aa'),
        borderColor: relTeams.map(t => t.color),
        borderWidth: 1, borderRadius: 6
      }],
      { beginAtZero: false, yAxis: { min: 75, max: 100 }, legend: false }
    );

    // Predicted Performance
    const predScores = [...teams]
      .map(t => ({ name: t.name, score: Analytics.predictedScore(t), color: t.color }))
      .sort((a, b) => b.score - a.score);
    ChartModule.barChart('chart-predict',
      predScores.map(d => d.name),
      [{
        label: 'Predicted Performance Score',
        data: predScores.map(d => d.score),
        backgroundColor: predScores.map(d => d.color + 'bb'),
        borderColor: predScores.map(d => d.color),
        borderWidth: 1, borderRadius: 6
      }],
      { beginAtZero: true, yAxis: { max: 100 }, legend: false }
    );
  }

  return { render };
})();

// ============================================================
// COMPARE VIEW
// ============================================================
const CompareView = (() => {
  function populateSelects(teams) {
    ['compare-a', 'compare-b'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">Select Team...</option>' +
        teams.map(t => `<option value="${t.id}">${t.name} (${t.chassis})</option>`).join('');
    });
  }

  function compare(data, idA, idB) {
    const teamA = data.teams.find(t => t.id === idA);
    const teamB = data.teams.find(t => t.id === idB);
    if (!teamA || !teamB) return;

    const metrics = Analytics.teamComparison(teamA, teamB);
    const barMetrics = [
      { label: 'Total Power', a: teamA.power_unit.total_power_bhp, b: teamB.power_unit.total_power_bhp, max: 1020, unit: 'BHP', higherIsBetter: true },
      { label: 'Top Speed', a: teamA.performance.top_speed_kmh, b: teamB.performance.top_speed_kmh, max: 370, unit: 'km/h', higherIsBetter: true },
      { label: 'Race Completion', a: teamA.reliability.avg_race_completion_pct || 75, b: teamB.reliability.avg_race_completion_pct || 75, max: 100, unit: '%', higherIsBetter: true },
      { label: 'Pred. Score', a: Analytics.predictedScore(teamA), b: Analytics.predictedScore(teamB), max: 100, unit: 'pts', higherIsBetter: true },
    ];

    const result = document.getElementById('compare-result');
    if (!result) return;

    result.innerHTML = `
      <div class="compare-layout">
        <div class="compare-team-col">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <div style="width:16px;height:16px;border-radius:50%;background:${teamA.color};box-shadow:0 0 10px ${teamA.color}88"></div>
            <div class="compare-team-name" style="color:${teamA.color}">${teamA.name}</div>
          </div>
          <div class="compare-chassis">${teamA.chassis} · ${teamA.power_unit.manufacturer}</div>
          <div class="compare-spec-grid">
            ${metrics.map(m => renderMetricRow(m.label, m.keyA, m.keyB, m.higherIsBetter, m.unit, 'A')).join('')}
          </div>
        </div>
        <div class="compare-vs-col">VS</div>
        <div class="compare-team-col">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <div style="width:16px;height:16px;border-radius:50%;background:${teamB.color};box-shadow:0 0 10px ${teamB.color}88"></div>
            <div class="compare-team-name" style="color:${teamB.color}">${teamB.name}</div>
          </div>
          <div class="compare-chassis">${teamB.chassis} · ${teamB.power_unit.manufacturer}</div>
          <div class="compare-spec-grid">
            ${metrics.map(m => renderMetricRow(m.label, m.keyB, m.keyA, m.higherIsBetter, m.unit, 'B')).join('')}
          </div>
        </div>
      </div>
      <div class="compare-chart-row">
        <div class="compare-chart-title">Visual Comparison</div>
        <div class="compare-bars">
          ${barMetrics.map(m => renderBarRow(m, teamA, teamB)).join('')}
        </div>
      </div>`;
  }

  function renderMetricRow(label, val, opp, higherIsBetter, unit, side) {
    let winClass = '';
    if (val !== null && opp !== null) {
      if (higherIsBetter === true && val > opp) winClass = 'win';
      if (higherIsBetter === false && val < opp) winClass = 'win';
    }
    const display = val !== null ? val + (unit ? ' ' + unit : '') : 'N/A';
    return `<div class="cmp-row">
      <div class="cmp-label">${label}</div>
      <div class="cmp-val ${winClass}">${display}</div>
    </div>`;
  }

  function renderBarRow(m, teamA, teamB) {
    const pctA = Utils.clamp(((m.a - (m.max * 0.7)) / (m.max * 0.3)) * 50, 0, 50);
    const pctB = Utils.clamp(((m.b - (m.max * 0.7)) / (m.max * 0.3)) * 50, 0, 50);
    const winA = m.higherIsBetter ? m.a > m.b : m.a < m.b;
    return `<div class="cmp-bar-row">
      <div class="cmp-val-label" style="text-align:right;color:${winA ? '#00dc50' : '#aaa'}">${m.a} ${m.unit}</div>
      <div>
        <div style="font-size:0.65rem;color:#666;text-align:center;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">${m.label}</div>
        <div class="cmp-bar-track">
          <div class="cmp-bar-a" style="width:${pctA}%;background:${teamA.color};margin-left:auto"></div>
          <div class="cmp-bar-b" style="width:${pctB}%;background:${teamB.color}"></div>
        </div>
      </div>
      <div class="cmp-val-label" style="color:${!winA ? '#00dc50' : '#aaa'}">${m.b} ${m.unit}</div>
    </div>`;
  }

  function render(data) {
    populateSelects(data.teams);
    document.getElementById('compare-go')?.addEventListener('click', () => {
      const a = document.getElementById('compare-a').value;
      const b = document.getElementById('compare-b').value;
      if (a && b && a !== b) compare(data, a, b);
      else if (a === b) alert('Please select two different teams.');
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.a;
        const b = btn.dataset.b;
        document.getElementById('compare-a').value = a;
        document.getElementById('compare-b').value = b;
        compare(data, a, b);
      });
    });
  }

  return { render, compare };
})();

// ============================================================
// RANKINGS VIEW
// ============================================================
const RankingsView = (() => {
  function render(data) {
    const grid = document.getElementById('rankings-grid');
    if (!grid) return;
    const teams = data.teams;

    const categories = [
      {
        title: '⚡ Most Powerful Engine (Total BHP)',
        key: t => t.power_unit.total_power_bhp,
        format: v => v + ' BHP',
        desc: 'ICE + MGU-K combined output',
        badge: 'est',
        higher: true
      },
      {
        title: '⚖️ Best Power-to-Weight Ratio (BHP/kg)',
        key: t => parseFloat(Utils.pwr(t)),
        format: v => v.toFixed(3) + ' BHP/kg',
        desc: 'Critical metric for acceleration and cornering speed',
        badge: 'est',
        higher: true
      },
      {
        title: '🚀 Highest Top Speed (km/h)',
        key: t => t.performance.top_speed_kmh,
        format: v => v + ' km/h',
        desc: 'Straight-line speed capability (estimated pre-season)',
        badge: 'est',
        higher: true
      },
      {
        title: '✅ Best Reliability — Race Completion % (2025)',
        key: t => t.reliability.avg_race_completion_pct || 0,
        format: v => v > 0 ? v + '%' : 'N/A (new)',
        desc: 'Historical race completion percentage from 2025 season',
        badge: 'conf',
        higher: true
      },
      {
        title: '🔮 Overall Predicted Performance Score',
        key: t => Analytics.predictedScore(t),
        format: v => v + ' / 100',
        desc: 'Composite score based on power, reliability, aero & regulation alignment',
        badge: 'est',
        higher: true
      },
      {
        title: '🛡️ Fewest Engine Grid Penalties (2025)',
        key: t => t.reliability.grid_penalties_pu_2025 !== null ? t.reliability.grid_penalties_pu_2025 : 99,
        format: (v, t) => t.reliability.grid_penalties_pu_2025 !== null ? t.reliability.grid_penalties_pu_2025 + ' penalties' : 'N/A (new)',
        desc: 'Grid penalties taken due to power unit component changes in 2025',
        badge: 'conf',
        higher: false
      }
    ];

    grid.innerHTML = categories.map(cat => {
      const sorted = [...teams].sort((a, b) => {
        const va = cat.key(a), vb = cat.key(b);
        return cat.higher ? vb - va : va - vb;
      });
      return `
        <div class="ranking-category">
          <div class="ranking-title">${cat.title} · <span style="font-weight:400;color:#888;font-size:0.75em">${cat.desc}</span></div>
          <table class="ranking-table">
            <thead><tr>
              <th>Pos</th><th>Team</th><th>Engine</th><th>Value</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${sorted.map((t, i) => {
        const pos = i + 1;
        const posClass = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
        const val = cat.key(t);
        const display = typeof cat.format === 'function' ? cat.format(val, t) : val;
        return `<tr>
                  <td><span class="rank-pos ${posClass}">${Utils.rankLabel(pos)}</span></td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:0.5rem">
                      <span style="width:10px;height:10px;border-radius:50%;background:${t.color};display:inline-block;flex-shrink:0;"></span>
                      <span class="rank-team-name">${t.name}</span>
                      ${t.is_works_team ? '<span class="team-works-badge" style="padding:0.1rem 0.35rem;font-size:0.5rem">W</span>' : ''}
                    </span>
                  </td>
                  <td style="color:#888;font-size:0.75rem">${t.power_unit.manufacturer}</td>
                  <td><span class="rank-value ${pos <= 3 ? 'top' : ''}">${display}</span></td>
                  <td><span class="rank-badge ${cat.badge}">${cat.badge === 'conf' ? '✓ Confirmed' : '~ Estimated'}</span></td>
                </tr>`;
      }).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');
  }

  return { render };
})();

// ============================================================
// ROUTER + MOBILE GESTURES
// ============================================================
const AppRouter = (() => {
  const VIEWS_ORDER = ['dashboard', 'teams', 'analytics', 'compare', 'rankings', 'testing', 'predictions', 'schedule'];
  const STORAGE_KEY = 'f1intel_active_view';
  let _currentView = 'dashboard';
  let _data = null;
  let _analyticsRendered = false;

  function goView(view) {
    _currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    const el = document.getElementById('view-' + view);
    const nav = document.getElementById('nav-' + view);
    if (el) el.classList.add('active');
    if (nav) nav.classList.add('active');

    // Sync mobile drawer active state
    document.querySelectorAll('.drawer-nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === view);
    });

    // Persist active view
    try { (window.safeStorage || localStorage).setItem(STORAGE_KEY, view); } catch (e) { /* ignore */ }

    if (view === 'analytics' && !_analyticsRendered && _data) {
      setTimeout(() => { AnalyticsView.render(_data); _analyticsRendered = true; }, 100);
    }
    if (view === 'predictions' && typeof PredictionsCenter !== 'undefined') {
      PredictionsCenter.loadAndRender();
    }
  }

  function goTeam(id) {
    goView('teams');
    if (_data) TeamsView.render(_data, id);
  }

  // Restore last active view from localStorage
  function restoreView() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && document.getElementById('view-' + saved)) {
        setTimeout(() => {
          goView(saved);
          // goView now handles lazy-loading for predictions directly
          if (saved === 'schedule') {
            if (typeof ScheduleView !== 'undefined') ScheduleView.init(null);
          }
        }, 800);
      }
    } catch (e) { /* ignore */ }
  }

  // ── SWIPE GESTURES (mobile) ──
  function initSwipeGestures() {
    let startX = 0, startY = 0, swiping = false;
    const SWIPE_THRESHOLD = 80;
    const SWIPE_MAX_Y = 60; // Max vertical movement for horizontal swipe

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!swiping) return;
      swiping = false;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = Math.abs(endY - startY);

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(diffX) > SWIPE_THRESHOLD && diffY < SWIPE_MAX_Y) {
        // Don't swipe if drawer is open or we're on an interactive element
        const drawer = document.getElementById('mobile-nav-drawer');
        if (drawer && drawer.classList.contains('open')) return;

        const currentIdx = VIEWS_ORDER.indexOf(_currentView);
        if (currentIdx === -1) return;

        if (diffX < 0 && currentIdx < VIEWS_ORDER.length - 1) {
          // Swipe left → next view
          goView(VIEWS_ORDER[currentIdx + 1]);
          triggerViewInit(VIEWS_ORDER[currentIdx + 1]);
        } else if (diffX > 0 && currentIdx > 0) {
          // Swipe right → previous view
          goView(VIEWS_ORDER[currentIdx - 1]);
          triggerViewInit(VIEWS_ORDER[currentIdx - 1]);
        }
      }
    }, { passive: true });
  }

  function triggerViewInit(view) {
    // goView already handles predictions rendering directly
    if (view === 'schedule') {
      setTimeout(() => {
        if (typeof ScheduleView !== 'undefined') ScheduleView.init(null);
      }, 200);
    }
  }

  // ── PULL-TO-REFRESH (mobile) ──
  function initPullToRefresh() {
    let startY = 0, refreshing = false;
    let indicator = null;
    const PULL_THRESHOLD = 120;

    function createIndicator() {
      if (indicator) return;
      indicator = document.createElement('div');
      indicator.id = 'pull-refresh-indicator';
      indicator.style.cssText = 'position:fixed;top:-50px;left:50%;transform:translateX(-50%);z-index:9999;' +
        'padding:0.5rem 1.2rem;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #e1060033;' +
        'border-radius:20px;color:#f97316;font-size:0.65rem;font-family:"Orbitron",monospace;' +
        'transition:top 0.3s ease;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.5)';
      indicator.innerHTML = '↻ Pull to refresh';
      document.body.appendChild(indicator);
    }

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY <= 5 && !refreshing) {
        startY = e.touches[0].clientY;
        createIndicator();
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!indicator || refreshing || startY === 0) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 0 && diff < 250 && window.scrollY <= 5) {
        const progress = Math.min(diff / PULL_THRESHOLD, 1);
        indicator.style.top = Math.min(diff * 0.4, 60) + 'px';
        indicator.style.opacity = progress;
        if (progress >= 1) {
          indicator.innerHTML = '↻ Release to refresh';
          indicator.style.borderColor = '#00dc5066';
          indicator.style.color = '#00dc50';
        } else {
          indicator.innerHTML = '↻ Pull to refresh';
          indicator.style.borderColor = '#e1060033';
          indicator.style.color = '#f97316';
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!indicator || refreshing) { startY = 0; return; }
      const lastTop = parseFloat(indicator.style.top);
      if (lastTop >= 48) {
        // Trigger refresh
        refreshing = true;
        indicator.innerHTML = '🔄 Refreshing...';
        indicator.style.color = '#58a6ff';
        indicator.style.borderColor = '#58a6ff33';

        // Trigger the refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) refreshBtn.click();
        if (typeof LiveIntelligence !== 'undefined') LiveIntelligence.refresh();
        if (typeof TelemetryFuelEngine !== 'undefined') TelemetryFuelEngine.refresh();

        setTimeout(() => {
          indicator.style.top = '-50px';
          refreshing = false;
        }, 1500);
      } else {
        indicator.style.top = '-50px';
      }
      startY = 0;
    }, { passive: true });
  }

  function init(data) {
    _data = data;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) goView(view);
      });
    });

    // Mobile features
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      initSwipeGestures();
      initPullToRefresh();
      console.log('[AppRouter] Mobile gestures initialized — swipe + pull-to-refresh');
    }

    // Restore last active view
    restoreView();
  }

  return { goView, goTeam, init };
})();

// ============================================================
// AUTO REFRESH MODULE
// ============================================================
const AutoRefresh = (() => {
  const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
  let _timer = null;

  function start(callback) {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(callback, INTERVAL_MS);
  }

  function updateTimestamp() {
    const el = document.getElementById('last-update');
    if (el) el.textContent = Utils.now();
    const footer = document.getElementById('footer-date');
    if (footer) footer.textContent = 'Last updated: ' + Utils.now();
  }

  return { start, updateTimestamp };
})();

// ============================================================
// BOOT
// ============================================================
(async () => {
  try {
    // Update timestamps
    AutoRefresh.updateTimestamp();

    // Load data
    const data = await DataLoader.load();
    if (!data) {
      console.error('[App] Failed to load F1 data.');
      return;
    }

    // Ticker
    Ticker.build(data);

    // Init router
    AppRouter.init(data);

    // Render all views (dashboard immediately, others on demand)
    DashboardView.render(data);

    // Teams view - init selector only
    TeamsView.render(data, null);

    // Compare view - init selects
    CompareView.render(data);

    // Rankings view
    RankingsView.render(data);

    // Testing Intelligence view — load async
    TestingView.init();

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refresh-btn');
      if (btn) { btn.textContent = '↻ Loading...'; btn.disabled = true; }
      const fresh = await DataLoader.load();
      if (fresh) {
        Ticker.build(fresh);
        DashboardView.render(fresh);
        RankingsView.render(fresh);
        AutoRefresh.updateTimestamp();
      }
      if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
    });

    // Auto refresh every week
    AutoRefresh.start(async () => {
      const fresh = await DataLoader.load();
      if (fresh) {
        Ticker.build(fresh);
        DashboardView.render(fresh);
        AutoRefresh.updateTimestamp();
      }
    });

    console.log('[F1 Intelligence] ✅ System loaded. Season 2026 | Teams:', data.teams.length);

    // Predictions Center — wait for predictions.js to load (defer scripts may still be executing)
    // On fast CDNs like Vercel Edge, DataLoader.load() resolves in <10ms which can outrace defer scripts
    function waitForPredictions(retries) {
      if (typeof PredictionsCenter !== 'undefined') {
        PredictionsCenter.init();
      } else if (retries > 0) {
        setTimeout(() => waitForPredictions(retries - 1), 100);
      } else {
        console.error('[App] PredictionsCenter never loaded after 2s');
      }
    }
    waitForPredictions(20);
  } catch (err) {
    console.error('[F1 Intelligence] Fatal boot error:', err);
  }
})();

// ============================================================
// TESTING INTELLIGENCE MODULE
// Loads bahrain_testing_2026.json and renders full view
// ============================================================
const TestingView = (() => {
  let _td = null; // testing data

  // ── INLINE FALLBACK (mirrors bahrain_testing_2026.json) ──
  const INLINE_TESTING = { "meta": { "title": "F1 2026 Bahrain Pre-Season Testing Intelligence", "sessions": ["Test 1: Feb 11-13, 2026", "Test 2: Feb 18-20, 2026"], "venue": "Bahrain International Circuit, Sakhir", "circuit_length_km": 5.412, "generated": "2026-02-22", "data_sources": ["formula1.com", "the-race.com", "motorsport.com", "racingnews365.com", "planetf1.com", "crash.net", "givemesport.com", "news.gp", "pitdebrief.com"], "notes": "All lap times verified from official timesheets. Long-run estimates derived from analyst sector data." }, "overall_fastest_lap": { "driver": "Charles Leclerc", "team": "Ferrari", "time": "1:31.992", "day": "Day 3 (Test 2 — Feb 20)", "tire_compound": "C4 (Soft)", "fuel_load_estimate": "Low (quali sim)", "note": "Only driver to break 1:32 across both test sessions" }, "teams": [{ "id": "ferrari", "name": "Ferrari", "color": "#DC0000", "chassis": "SF-26", "engine": "Ferrari", "lap_times": { "best_lap": "1:31.992", "best_lap_ms": 91992, "best_driver": "Charles Leclerc", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "1:33.408", "second_driver": "Lewis Hamilton", "gap_to_fastest": 0, "compound_on_best": "C4", "fuel_estimate_on_best": "Low" }, "long_run": { "avg_race_pace_est": "1:37.4", "long_run_consistency": "High", "degradation_rating": "Low-Medium", "laps_on_single_stint_avg": 18, "long_run_score": 88, "notes": "Ferrari long runs strong. Hamilton adapting quickly. Strong PU deployment." }, "top_speed": { "peak_kmh": 330, "rank": 2, "note": "Innovative rotating rear wing for active aero efficiency gain" }, "reliability": { "total_laps_both_tests": 744, "mileage_km": 4027, "issues": "Minor. No stoppages reported.", "reliability_score": 88, "dnf_equivalent": 0, "ranking_laps": 4 }, "performance_index": { "race_pace_score": 90, "quali_pace_score": 100, "top_speed_score": 84, "reliability_score": 88, "consistency_score": 88, "weighted_total": 91.5, "rank": 1 }, "driver_feedback": { "leclerc": "Extremely positive. Car feels like a complete package. Comfortable on all compounds.", "hamilton": "In adaptation phase. Massive step forward from what I knew. Ferrari PU is exceptional." }, "testing_verdict": "DOMINANT. Ferrari led outright pace by 0.811s over nearest rival. Best combined package.", "testing_grade": "A+" }, { "id": "mclaren", "name": "McLaren", "color": "#FF8000", "chassis": "MCL40", "engine": "Mercedes", "lap_times": { "best_lap": "1:32.861", "best_lap_ms": 92861, "best_driver": "Oscar Piastri", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "1:32.871", "second_driver": "Lando Norris", "gap_to_fastest": 0.869, "compound_on_best": "C4", "fuel_estimate_on_best": "Low-Medium" }, "long_run": { "avg_race_pace_est": "1:37.9", "long_run_consistency": "Very High", "degradation_rating": "Low", "laps_on_single_stint_avg": 22, "long_run_score": 94, "notes": "Piastri effectively won the long-run race sim on Day 3 per The Race analysts. Highest total laps (817)." }, "top_speed": { "peak_kmh": 326, "rank": 4, "note": "Low-drag efficient setup. Aero balance superior." }, "reliability": { "total_laps_both_tests": 817, "mileage_km": 4422, "issues": "Small chassis issue on Day 3 delayed Norris. No engine issues.", "reliability_score": 95, "dnf_equivalent": 0, "ranking_laps": 1 }, "performance_index": { "race_pace_score": 94, "quali_pace_score": 88, "top_speed_score": 76, "reliability_score": 95, "consistency_score": 96, "weighted_total": 90.6, "rank": 2 }, "driver_feedback": { "norris": "Stimulating and exciting. Energy management is key differentiator.", "piastri": "Car responds well to different setups. Completed the best long-run of any driver." }, "testing_verdict": "STRONGEST RACE PACKAGE. Most laps, best long-run data. McLaren is the most race-ready team.", "testing_grade": "A" }, { "id": "mercedes", "name": "Mercedes", "color": "#00D2BE", "chassis": "F1 W17", "engine": "Mercedes", "lap_times": { "best_lap": "1:32.803", "best_lap_ms": 92803, "best_driver": "Kimi Antonelli", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "1:33.197", "second_driver": "George Russell", "gap_to_fastest": 0.811, "compound_on_best": "C4", "fuel_estimate_on_best": "Low" }, "long_run": { "avg_race_pace_est": "1:37.7", "long_run_consistency": "High", "degradation_rating": "Low-Medium", "laps_on_single_stint_avg": 20, "long_run_score": 91, "notes": "Led all teams in total mileage (1,204 laps across all tests). Antonelli impressive in rookie debut." }, "top_speed": { "peak_kmh": 327, "rank": 3, "note": "Clever MGU-K energy deployment interpretations giving straight-line edge." }, "reliability": { "total_laps_both_tests": 714, "mileage_km": 3864, "issues": "Pneumatic issue Day 2. Antonelli PU issue cut final day short.", "reliability_score": 82, "dnf_equivalent": 1, "ranking_laps": 6 }, "performance_index": { "race_pace_score": 91, "quali_pace_score": 91, "top_speed_score": 78, "reliability_score": 82, "consistency_score": 87, "weighted_total": 88.3, "rank": 3 }, "driver_feedback": { "antonelli": "Positive but cautious. PU issue frustrating on final day. Rookie impressing everyone.", "russell": "Confident. We know what we have and we know the direction." }, "testing_verdict": "STRONG CONTENDER. Second quickest car. Minor reliability concern. Antonelli is a revelation.", "testing_grade": "A-" }, { "id": "red_bull", "name": "Red Bull", "color": "#3671C6", "chassis": "RB22", "engine": "Red Bull Ford", "lap_times": { "best_lap": "1:33.109", "best_lap_ms": 93109, "best_driver": "Max Verstappen", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "Limited (Hadjar water leak)", "second_driver": "Isack Hadjar", "gap_to_fastest": 1.117, "compound_on_best": "C3", "fuel_estimate_on_best": "Low-Medium" }, "long_run": { "avg_race_pace_est": "1:38.3", "long_run_consistency": "Medium-High", "degradation_rating": "Medium", "laps_on_single_stint_avg": 17, "long_run_score": 80, "notes": "'Sharper than anticipated' PU. Improved significantly in Test 2. Hadjar water leak restricted to 13 laps Test 2 Day 1." }, "top_speed": { "peak_kmh": 322, "rank": 7, "note": "Weight concerns reported. RB22 running higher downforce to compensate." }, "reliability": { "total_laps_both_tests": 672, "mileage_km": 3638, "issues": "Test 1 car problems. Hadjar water leak Test 2 Day 1 (13 laps only).", "reliability_score": 78, "dnf_equivalent": 1, "ranking_laps": 9 }, "performance_index": { "race_pace_score": 80, "quali_pace_score": 80, "top_speed_score": 68, "reliability_score": 78, "consistency_score": 76, "weighted_total": 78.8, "rank": 4 }, "driver_feedback": { "verstappen": "Critical of 2026 regs. Called cars 'not a lot of fun' — heavy feel in corners, anti-racing battery rules.", "hadjar": "Limited running. Positive about car basics." }, "testing_verdict": "UNDERWHELMING vs EXPECTATIONS. 4th on pace, 9th on total laps. Verstappen frustrated. However Test 2 improvement curve is positive.", "testing_grade": "B" }, { "id": "alpine", "name": "Alpine", "color": "#FF69B4", "chassis": "A526", "engine": "Mercedes", "lap_times": { "best_lap": "1:33.421", "best_lap_ms": 93421, "best_driver": "Pierre Gasly", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:33.8 (est.)", "second_driver": "Franco Colapinto", "gap_to_fastest": 1.429, "compound_on_best": "C3-C4", "fuel_estimate_on_best": "Low" }, "long_run": { "avg_race_pace_est": "1:38.6", "long_run_consistency": "High", "degradation_rating": "Low-Medium", "laps_on_single_stint_avg": 18, "long_run_score": 82, "notes": "Both drivers improved 3+ seconds from Week 1 to Week 2. Over 1,000 laps across all tests inc. Barcelona." }, "top_speed": { "peak_kmh": 324, "rank": 5, "note": "Mercedes PU straight-line benefit confirmed. Major jump from 2025 Renault power." }, "reliability": { "total_laps_both_tests": 677, "mileage_km": 3665, "issues": "No major issues. Both drivers completed strong mileage.", "reliability_score": 86, "dnf_equivalent": 0, "ranking_laps": 8 }, "performance_index": { "race_pace_score": 82, "quali_pace_score": 78, "top_speed_score": 74, "reliability_score": 86, "consistency_score": 86, "weighted_total": 81.7, "rank": 5 }, "driver_feedback": { "gasly": "Very encouraged. Mercedes PU is a massive step. P5 on Day 3 — team best result in years.", "colapinto": "Feeling more prepared than ever. This is a very different Alpine." }, "testing_verdict": "MOST IMPROVED. Sacrificed 2025 for 2026 reset. Mercedes PU + new aero = legitimate midfield contender.", "testing_grade": "B+" }, { "id": "haas", "name": "Haas", "color": "#E8E8E8", "chassis": "VF-26", "engine": "Ferrari", "lap_times": { "best_lap": "1:33.487", "best_lap_ms": 93487, "best_driver": "Oliver Bearman", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:33.9 (est.)", "second_driver": "Esteban Ocon", "gap_to_fastest": 1.495, "compound_on_best": "C3-C4", "fuel_estimate_on_best": "Low" }, "long_run": { "avg_race_pace_est": "1:38.8", "long_run_consistency": "Very High", "degradation_rating": "Low", "laps_on_single_stint_avg": 20, "long_run_score": 84, "notes": "794 total laps — 2nd most among all teams. Zero major issues. Ferrari PU energy mgmt praised." }, "top_speed": { "peak_kmh": 323, "rank": 6, "note": "Ferrari customer PU — slightly lower spec than works Ferrari." }, "reliability": { "total_laps_both_tests": 794, "mileage_km": 4297, "issues": "None reported. Best midfield reliability.", "reliability_score": 96, "dnf_equivalent": 0, "ranking_laps": 2 }, "performance_index": { "race_pace_score": 78, "quali_pace_score": 76, "top_speed_score": 72, "reliability_score": 96, "consistency_score": 92, "weighted_total": 80.8, "rank": 6 }, "driver_feedback": { "bearman": "6th fastest Day 3. Significant progress from where we were.", "ocon": "Positive. Ferrari PU energy management praised. Clear direction." }, "testing_verdict": "EXCELLENT SURPRISE. VF-26 reliable, consistent, quick. 2nd most laps. Haas is a serious midfield team.", "testing_grade": "B+" }, { "id": "audi", "name": "Audi", "color": "#BB0000", "chassis": "R26", "engine": "Audi", "lap_times": { "best_lap": "1:33.755", "best_lap_ms": 93755, "best_driver": "Gabriel Bortoleto", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:34.1 (est.)", "second_driver": "Nico Hulkenberg", "gap_to_fastest": 1.763, "compound_on_best": "C3", "fuel_estimate_on_best": "Medium" }, "long_run": { "avg_race_pace_est": "1:39.2", "long_run_consistency": "Medium", "degradation_rating": "Medium", "laps_on_single_stint_avg": 15, "long_run_score": 72, "notes": "ICE reportedly strong (>400kW on dyno). MGU-K energy deployment still being calibrated." }, "top_speed": { "peak_kmh": 320, "rank": 8, "note": "ICE power strong per dyno reports. On-track deployment still maturing." }, "reliability": { "total_laps_both_tests": 710, "mileage_km": 3844, "issues": "No major failures. Reasonable first-year total.", "reliability_score": 80, "dnf_equivalent": 0, "ranking_laps": 7 }, "performance_index": { "race_pace_score": 72, "quali_pace_score": 72, "top_speed_score": 66, "reliability_score": 80, "consistency_score": 72, "weighted_total": 73.0, "rank": 7 }, "driver_feedback": { "bortoleto": "10th fastest way ahead of where we expected as a new team.", "hulkenberg": "We have the platform, now the work begins." }, "testing_verdict": "EXCEEDED NEW-TEAM EXPECTATIONS. 7th overall impressive for Audi Year 1. ICE strong. Aero maturing.", "testing_grade": "B-" }, { "id": "racing_bulls", "name": "Racing Bulls", "color": "#1E3A5F", "chassis": "VCARB 03", "engine": "Red Bull Ford", "lap_times": { "best_lap": "1:34.149", "best_lap_ms": 94149, "best_driver": "Arvid Lindblad", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:34.4 (est.)", "second_driver": "Liam Lawson", "gap_to_fastest": 2.157, "compound_on_best": "C3", "fuel_estimate_on_best": "Medium" }, "long_run": { "avg_race_pace_est": "1:39.6", "long_run_consistency": "Medium-High", "degradation_rating": "Medium", "laps_on_single_stint_avg": 16, "long_run_score": 70, "notes": "Lindblad set highest single-day lap total of any driver (165 laps). Team improved 3+ seconds W1→W2." }, "top_speed": { "peak_kmh": 319, "rank": 9, "note": "Red Bull Ford customer spec." }, "reliability": { "total_laps_both_tests": 733, "mileage_km": 3968, "issues": "Minor. Lindblad 165 laps in single day proves reliability.", "reliability_score": 87, "dnf_equivalent": 0, "ranking_laps": 5 }, "performance_index": { "race_pace_score": 68, "quali_pace_score": 64, "top_speed_score": 62, "reliability_score": 87, "consistency_score": 78, "weighted_total": 69.4, "rank": 8 }, "driver_feedback": { "lindblad": "Excellent rookie debut. 165 laps in one day. Improving at rapid rate.", "lawson": "Car has a lot of potential to develop." }, "testing_verdict": "SOLID MIDFIELD. 8th on pace but 5th on laps. Lindblad is a star in the making.", "testing_grade": "C+" }, { "id": "williams", "name": "Williams", "color": "#005AFF", "chassis": "FW48", "engine": "Mercedes", "lap_times": { "best_lap": "1:34.342", "best_lap_ms": 94342, "best_driver": "Carlos Sainz", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:34.7 (est.)", "second_driver": "Alexander Albon", "gap_to_fastest": 2.350, "compound_on_best": "C3", "fuel_estimate_on_best": "Medium-High" }, "long_run": { "avg_race_pace_est": "1:40.1", "long_run_consistency": "Medium", "degradation_rating": "Medium-High", "laps_on_single_stint_avg": 14, "long_run_score": 60, "notes": "Failed crash tests pre-testing. Missed Barcelona shakedown. 25-30kg overweight reports. No aero upgrade until Race 4-5." }, "top_speed": { "peak_kmh": 321, "rank": 6, "note": "Mercedes PU straight-line speed but weight penalty hurts elsewhere." }, "reliability": { "total_laps_both_tests": 790, "mileage_km": 4275, "issues": "Failed crash tests pre-testing (missed Barcelona). No on-track mechanical issues in Bahrain.", "reliability_score": 83, "dnf_equivalent": 0, "ranking_laps": 3 }, "performance_index": { "race_pace_score": 58, "quali_pace_score": 58, "top_speed_score": 68, "reliability_score": 83, "consistency_score": 66, "weighted_total": 63.85, "rank": 9 }, "driver_feedback": { "sainz": "It is going to be a challenging season. There is a lot of work ahead of us.", "albon": "We know where we need to improve. Not panicking but we know it will be tough early on." }, "testing_verdict": "DISAPPOINTING. Overweight, missed shakedown, 2+ seconds off pace. Aero upgrade not until R4-5.", "testing_grade": "D+" }, { "id": "cadillac", "name": "Cadillac", "color": "#CC0000", "chassis": "CA01", "engine": "Ferrari", "lap_times": { "best_lap": "1:35.290", "best_lap_ms": 95290, "best_driver": "Valtteri Bottas", "best_lap_day": "Day 3 (Test 2)", "second_driver_best": "~1:35.7 (est.)", "second_driver": "Sergio Perez", "gap_to_fastest": 3.298, "compound_on_best": "C3", "fuel_estimate_on_best": "Medium" }, "long_run": { "avg_race_pace_est": "1:41.5", "long_run_consistency": "Medium", "degradation_rating": "High", "laps_on_single_stint_avg": 13, "long_run_score": 50, "notes": "New team first season. Recorded highest peak top speed of any car (343 km/h) — very low downforce run." }, "top_speed": { "peak_kmh": 343, "rank": 1, "note": "FASTEST top speed in testing at 343 km/h! Very low downforce aero — trades cornering for straight-line." }, "reliability": { "total_laps_both_tests": 586, "mileage_km": 3171, "issues": "No critical failures. Lowest count among established-car teams.", "reliability_score": 72, "dnf_equivalent": 0, "ranking_laps": 10 }, "performance_index": { "race_pace_score": 48, "quali_pace_score": 46, "top_speed_score": 90, "reliability_score": 72, "consistency_score": 60, "weighted_total": 55.9, "rank": 10 }, "driver_feedback": { "bottas": "For a brand new team this is well above expectations.", "perez": "Ferrari PU impressive. Great straight-line speed. Aero balance needs work." }, "testing_verdict": "EXPECTED as new team. 3.3s off pace BUT fastest top speed of all 11 cars (343 km/h) is fascinating. Development project.", "testing_grade": "C-" }, { "id": "aston_martin", "name": "Aston Martin", "color": "#006F62", "chassis": "AMR26", "engine": "Honda (HRC)", "lap_times": { "best_lap": "1:35.974", "best_lap_ms": 95974, "best_driver": "Lance Stroll", "best_lap_day": "Test 2 Day 2", "second_driver_best": "~1:36.2 (est.)", "second_driver": "Fernando Alonso", "gap_to_fastest": 3.982, "compound_on_best": "C3", "fuel_estimate_on_best": "Medium-High" }, "long_run": { "avg_race_pace_est": "1:43.0 (ESTIMATE — insufficient data)", "long_run_consistency": "N/A — insufficient laps", "degradation_rating": "Unknown", "laps_on_single_stint_avg": 8, "long_run_score": 25, "notes": "INSUFFICIENT DATA. 334 total laps — fewest of all teams. Lance Stroll only 6 laps on final day. Honda battery failure." }, "top_speed": { "peak_kmh": 317, "rank": 11, "note": "LOWEST top speed in testing. Battery deployment issues limiting PU output." }, "reliability": { "total_laps_both_tests": 334, "mileage_km": 1808, "issues": "CRITICAL: Honda battery failure. Alonso stopped on track. Stroll 6 laps on Day 3. Shortage of PU parts. Honda: dissatisfied.", "reliability_score": 25, "dnf_equivalent": 3, "ranking_laps": 11 }, "performance_index": { "race_pace_score": 30, "quali_pace_score": 28, "top_speed_score": 42, "reliability_score": 25, "consistency_score": 20, "weighted_total": 28.5, "rank": 11 }, "driver_feedback": { "alonso": "We are not where we wanted to be. We have more work to do than others.", "stroll": "Run severely curtailed. 6 laps on Day 3. No meaningful data from final day." }, "testing_verdict": "BIGGEST DISAPPOINTMENT. Honda battery reliability failure is systemic. 334 laps — 59% fewer than McLaren. 4s off pace. Team on back foot.", "testing_grade": "F" }], "analysis": { "final_rankings": [{ "rank": 1, "team": "Ferrari", "score": 91.5, "grade": "A+", "verdict": "Fastest car" }, { "rank": 2, "team": "McLaren", "score": 90.6, "grade": "A", "verdict": "Strongest race package" }, { "rank": 3, "team": "Mercedes", "score": 88.3, "grade": "A-", "verdict": "Strong contender" }, { "rank": 4, "team": "Alpine", "score": 81.7, "grade": "B+", "verdict": "Most improved" }, { "rank": 5, "team": "Haas", "score": 80.8, "grade": "B+", "verdict": "Midfield surprise" }, { "rank": 6, "team": "Red Bull", "score": 78.8, "grade": "B", "verdict": "Behind expectations" }, { "rank": 7, "team": "Audi", "score": 73.0, "grade": "B-", "verdict": "Exceeded new-team bar" }, { "rank": 8, "team": "Racing Bulls", "score": 69.4, "grade": "C+", "verdict": "Solid, limited by PU" }, { "rank": 9, "team": "Williams", "score": 63.85, "grade": "D+", "verdict": "Disappointing" }, { "rank": 10, "team": "Cadillac", "score": 55.9, "grade": "C-", "verdict": "New team, expected" }, { "rank": 11, "team": "Aston Martin", "score": 28.5, "grade": "F", "verdict": "Crisis level" }], "key_conclusions": { "fastest_car": { "team": "Ferrari", "evidence": "1:31.992 — only sub-1:32 lap. 0.811s clear of nearest rival (Mercedes). Strong long-run too.", "caveat": "Testing times don't always translate 1:1 to race pace. McLaren long runs arguably better." }, "strongest_race_team": { "team": "McLaren", "evidence": "Most laps (817 = 4,422 km). Best long-run data. Piastri won the long-run race sim per The Race.", "caveat": "Norris afternoon disrupted by small chassis issue — long-run dataset slightly incomplete." }, "most_improved": { "team": "Alpine", "evidence": "Both drivers improved 3+ seconds W1→W2. P5+P6 on final day. Mercedes PU transformative. 1,000+ laps.", "from_2025": "Alpine finished bottom of WCC in 2025." }, "dark_horse": { "team": "Haas", "evidence": "794 laps (2nd most). P9 Bearman from 11th WCC. Ferrari PU praised. Zero major issues." }, "championship_early_favorite": { "driver": "Charles Leclerc / Lando Norris", "reasoning": "Ferrari fastest. McLaren most race-ready. Hamilton wild card. Championship will be between these teams.", "championship_probability": { "Leclerc": "28%", "Norris": "24%", "Hamilton": "22%", "Piastri": "14%", "Antonelli": "6%", "Russell": "4%", "Verstappen": "2%" } }, "biggest_disappointment": { "team": "Aston Martin", "evidence": "334 laps vs 817 (McLaren). Honda battery failure. 4 seconds off pace. Team 'on the back foot' per Krack." }, "teams_in_trouble": [{ "team": "Aston Martin", "issue": "Honda battery failure, 334 laps, 4s off pace" }, { "team": "Williams", "issue": "Overweight ~25-30kg, failed crash tests, 2.3s off pace" }, { "team": "Red Bull", "issue": "Below expectations, Verstappen unhappy, reliability concerns" }] } } };
  // ─────────────────────────────────────────────────────────

  async function loadTestingData() {
    try {
      const res = await fetch('./data/bahrain_testing_2026.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _td = await res.json();
      console.log('[TestingView] ✅ Loaded from JSON file');
    } catch (e) {
      console.warn('[TestingView] Using inline fallback:', e.message);
      _td = JSON.parse(JSON.stringify(INLINE_TESTING));
    }
    return _td;
  }

  function gradeClass(grade) {
    const map = { 'A+': 'grade-ap', 'A': 'grade-a', 'A-': 'grade-am', 'B+': 'grade-bp', 'B': 'grade-b', 'B-': 'grade-bm', 'C+': 'grade-cp', 'C': 'grade-c', 'C-': 'grade-cm', 'D+': 'grade-dp', 'F': 'grade-f' };
    return map[grade] || 'grade-c';
  }

  function rankClass(r) {
    if (r === 1) return 'r1'; if (r === 2) return 'r2'; if (r === 3) return 'r3';
    if (r >= 9) return 'low'; return '';
  }

  function renderVerdictBanner(td) {
    const c = td.analysis.key_conclusions;
    document.getElementById('tvb-fastest').textContent = `Ferrari SF-26 · Leclerc 1:31.992 · ${c.fastest_car.evidence.substring(0, 60)}...`;
    document.getElementById('tvb-race').textContent = `McLaren MCL40 · ${c.strongest_race_team.evidence.substring(0, 65)}...`;
    document.getElementById('tvb-improved').textContent = `Alpine A526 · ${c.most_improved.evidence.substring(0, 65)}...`;
    document.getElementById('tvb-champ').textContent = `${c.championship_early_favorite.driver} · ${c.championship_early_favorite.reasoning.substring(0, 55)}...`;
    document.getElementById('tvb-disappoint').textContent = `Aston Martin AMR26 · Honda battery failure · Only 334 laps · 4.0s off pace`;
  }

  function renderIndexTable(td) {
    const tbody = document.getElementById('testing-index-body');
    if (!tbody) return;
    // Sort by performance rank from analysis
    const ranked = [...td.teams].sort((a, b) => a.performance_index.rank - b.performance_index.rank);
    tbody.innerHTML = ranked.map(t => {
      const pi = t.performance_index;
      const lt = t.lap_times;
      const rel = t.reliability;
      const rc = rankClass(pi.rank);
      const score = pi.weighted_total.toFixed(1);
      const scoreColor = score >= 85 ? '#00dc50' : score >= 70 ? '#ffd166' : '#ff4444';
      const gapStr = lt.gap_to_fastest === 0 ? '—' : `+${lt.gap_to_fastest.toFixed(3)}s`;
      return `<tr>
        <td><span class="tit-rank ${rc}">${pi.rank === 1 ? '🥇' : pi.rank === 2 ? '🥈' : pi.rank === 3 ? '🥉' : `#${pi.rank}`}</span></td>
        <td><div class="tit-team"><div class="tit-dot" style="background:${t.color}"></div>${t.name}</div></td>
        <td><span class="tit-time">${lt.best_lap}</span></td>
        <td><span class="tit-gap">${gapStr}</span></td>
        <td><span class="tit-laps">${rel.total_laps_both_tests}</span></td>
        <td><div class="tit-score-bar-wrap"><div class="tit-score-bar" style="width:${pi.race_pace_score}%;background:${t.color}aa"></div><span class="tit-score-val">${pi.race_pace_score}</span></div></td>
        <td><div class="tit-score-bar-wrap"><div class="tit-score-bar" style="width:${pi.quali_pace_score}%;background:${t.color}aa"></div><span class="tit-score-val">${pi.quali_pace_score}</span></div></td>
        <td><div class="tit-score-bar-wrap"><div class="tit-score-bar" style="width:${pi.top_speed_score}%;background:${t.color}aa"></div><span class="tit-score-val">${pi.top_speed_score}</span></div></td>
        <td><div class="tit-score-bar-wrap"><div class="tit-score-bar" style="width:${pi.reliability_score}%;background:${t.color}aa"></div><span class="tit-score-val">${pi.reliability_score}</span></div></td>
        <td><div class="tit-score-bar-wrap"><div class="tit-score-bar" style="width:${pi.consistency_score}%;background:${t.color}aa"></div><span class="tit-score-val">${pi.consistency_score}</span></div></td>
        <td><span class="tit-total" style="color:${scoreColor}">${score}</span></td>
        <td><span class="tit-grade ${gradeClass(t.testing_grade)}">${t.testing_grade}</span></td>
      </tr>`;
    }).join('');
  }

  function renderCharts(td) {
    const ranked = [...td.teams].sort((a, b) => a.performance_index.rank - b.performance_index.rank);
    const names = ranked.map(t => t.name);
    const colors = ranked.map(t => t.color);

    // 1. Lap times chart
    ChartModule.horizontalBarChart('chart-test-laptimes',
      names,
      [{ label: 'Best Lap (s)', data: ranked.map(t => (t.lap_times.best_lap_ms / 1000).toFixed(3)), backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 1, borderRadius: 4 }],
      { beginAtZero: false, xAxis: { min: 91, max: 97 } }
    );

    // 2. Total laps chart (reliability)
    const lapsSorted = [...td.teams].sort((a, b) => b.reliability.total_laps_both_tests - a.reliability.total_laps_both_tests);
    ChartModule.horizontalBarChart('chart-test-laps',
      lapsSorted.map(t => t.name),
      [{ label: 'Total Laps', data: lapsSorted.map(t => t.reliability.total_laps_both_tests), backgroundColor: lapsSorted.map(t => t.color + 'bb'), borderColor: lapsSorted.map(t => t.color), borderWidth: 1, borderRadius: 4 }],
      { beginAtZero: true }
    );

    // 3. Top speed
    const speedSorted = [...td.teams].sort((a, b) => b.top_speed.peak_kmh - a.top_speed.peak_kmh);
    ChartModule.horizontalBarChart('chart-test-topspeed',
      speedSorted.map(t => t.name),
      [{ label: 'Peak Top Speed (km/h)', data: speedSorted.map(t => t.top_speed.peak_kmh), backgroundColor: speedSorted.map(t => t.color + 'bb'), borderColor: speedSorted.map(t => t.color), borderWidth: 1, borderRadius: 4 }],
      { beginAtZero: false, xAxis: { min: 310, max: 350 } }
    );

    // 4. Performance index score
    ChartModule.barChart('chart-test-index',
      names,
      [{ label: 'Performance Index', data: ranked.map(t => t.performance_index.weighted_total.toFixed(1)), backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 1, borderRadius: 6 }],
      { beginAtZero: false, yAxis: { min: 0, max: 100 } }
    );

    // 5. Radar — top 5 teams
    const top5 = ranked.slice(0, 5);
    const radarDatasets = top5.map(t => ({
      label: t.name,
      data: [t.performance_index.race_pace_score, t.performance_index.quali_pace_score, t.performance_index.top_speed_score, t.performance_index.reliability_score, t.performance_index.consistency_score],
      backgroundColor: t.color + '22',
      borderColor: t.color,
      borderWidth: 2,
      pointBackgroundColor: t.color,
      pointRadius: 4
    }));
    ChartModule.radarChart('chart-test-radar', ['Race Pace (35%)', 'Quali Pace (25%)', 'Top Speed (15%)', 'Reliability (15%)', 'Consistency (10%)'], radarDatasets);

    // 6. Championship probability
    const champData = td.analysis.key_conclusions.championship_early_favorite.championship_probability;
    const champLabels = Object.keys(champData);
    const champValues = Object.values(champData).map(v => parseFloat(v));
    ChartModule.pieChart('chart-test-champprob',
      champLabels,
      champValues,
      ['#DC0000', '#FF8000', '#DC0000', '#FF8000', '#00D2BE', '#00D2BE', '#3671C6'],
      {}
    );
  }

  function renderTeamCards(td) {
    const container = document.getElementById('testing-team-cards');
    if (!container) return;
    const ranked = [...td.teams].sort((a, b) => a.performance_index.rank - b.performance_index.rank);
    container.innerHTML = ranked.map(t => {
      const lt = t.lap_times; const rel = t.reliability; const ts = t.top_speed; const lr = t.long_run;
      const pi = t.performance_index;
      const relColor = rel.reliability_score >= 90 ? 'green' : rel.reliability_score >= 75 ? 'yellow' : 'red';
      const driverKeys = Object.keys(t.driver_feedback);
      const driverQuotes = driverKeys.map(d => `<div class="test-driver-quote"><span class="test-driver-name">${Utils.capitalize(d)}:</span> "${t.driver_feedback[d]}"</div>`).join('');
      return `<div class="test-team-card" style="border-color:${t.color}22">
        <div class="test-team-card-header">
          <div class="test-team-color-bar" style="background:${t.color}"></div>
          <div>
            <div class="test-team-name">${t.name}</div>
            <div class="test-team-chassis">${t.chassis} · ${t.engine}</div>
          </div>
          <span class="test-grade-badge ${gradeClass(t.testing_grade)}">${t.testing_grade}</span>
        </div>
        <div class="test-team-card-body">
          <div class="test-metric-row">
            <div class="test-metric"><div class="test-metric-label">Best Lap</div><div class="test-metric-value">${lt.best_lap}</div></div>
            <div class="test-metric"><div class="test-metric-label">Gap to P1</div><div class="test-metric-value ${lt.gap_to_fastest === 0 ? 'green' : lt.gap_to_fastest > 3 ? 'red' : 'yellow'}">${lt.gap_to_fastest === 0 ? 'FASTEST' : `+${lt.gap_to_fastest.toFixed(3)}s`}</div></div>
            <div class="test-metric"><div class="test-metric-label">Total Laps</div><div class="test-metric-value ${rel.total_laps_both_tests >= 700 ? 'green' : rel.total_laps_both_tests < 400 ? 'red' : 'yellow'}">${rel.total_laps_both_tests}</div></div>
            <div class="test-metric"><div class="test-metric-label">Peak Speed</div><div class="test-metric-value">${ts.peak_kmh} km/h</div></div>
            <div class="test-metric"><div class="test-metric-label">Long-Run Avg</div><div class="test-metric-value">${lr.avg_race_pace_est}</div></div>
            <div class="test-metric"><div class="test-metric-label">Reliability</div><div class="test-metric-value ${relColor}">${rel.reliability_score}/100</div></div>
            <div class="test-metric"><div class="test-metric-label">Race Pace Score</div><div class="test-metric-value">${pi.race_pace_score}/100</div></div>
            <div class="test-metric"><div class="test-metric-label">Index Score</div><div class="test-metric-value" style="color:${t.color}">${pi.weighted_total.toFixed(1)}</div></div>
          </div>
          <div style="font-size:0.65rem;color:#666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.35rem">Data Notes</div>
          <div style="font-size:0.73rem;color:#999;line-height:1.5;margin-bottom:0.6rem">${rel.issues}</div>
          <div class="test-verdict-box" style="border-left-color:${t.color}">${t.testing_verdict}</div>
          <div style="margin-top:0.75rem;font-size:0.65rem;color:#666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.25rem">Driver Feedback</div>
          ${driverQuotes}
        </div>
      </div>`;
    }).join('');
  }

  function renderPredictions(td) {
    const c = td.analysis.key_conclusions;
    const container = document.getElementById('testing-predictions');
    if (!container) return;
    const predsHtml = [
      { cls: 'winner', icon: '🏆', title: 'Fastest Car in Testing', team: 'Ferrari SF-26', evidence: `<strong>Evidence:</strong> Leclerc set 1:31.992 — the only sub-1:32 lap of both tests. Margin over 2nd place (Mercedes: 1:32.803) is 0.811s — significant in F1 testing. Ferrari PU innovative rotating rear wing concept. Hamilton/Leclerc lineup depth unmatched.`, caveat: `Caveat: Testing ≠ race pace. McLaren long-run may close gap.` },
      { cls: 'race', icon: '🥇', title: 'Most Likely to Win Opening Races', team: 'McLaren MCL40', evidence: `<strong>Evidence:</strong> 817 laps = most mileage on track (4,422 km). Piastri won the race-sim long-run on Day 3. Norris + Piastri = deepest driver pair. Best tire management (Low degradation). Race pace score: <strong>94/100</strong>.`, caveat: `Caveat: Norris PM session chassis issue — full race sim data incomplete.` },
      { cls: 'improved', icon: '📈', title: 'Most Improved Team', team: 'Alpine A526', evidence: `<strong>Evidence:</strong> Finished LAST in WCC 2025. Now P5 on Day 3 (Gasly), P6 on Day 2 (Colapinto). Both drivers improved 3+ seconds from Week 1 to Week 2. Mercedes PU gives real straight-line performance. 1,000+ laps across all 2026 tests.`, caveat: `Caveat: Midfield battle is fierce — Haas also very strong.` },
      { cls: 'dark-horse', icon: '🐎', title: 'Dark Horse Team', team: 'Haas VF-26', evidence: `<strong>Evidence:</strong> 794 laps = 2nd most of all teams. P9 on Day 3 (Bearman) from P11 in WCC. Ferrari PU energy deployment praised by team. Zero major technical failures. Long-run consistency: <strong>Very High</strong>. Ocon + Bearman both delivering above expectation.`, caveat: `Caveat: Ferrari customer PU limits absolute ceiling vs works team.` },
      { cls: 'trouble', icon: '⚠️', title: 'Teams in Serious Trouble', team: 'Aston Martin + Williams', evidence: `<strong>Aston Martin:</strong> Honda battery failure — 334 laps (vs 817 McLaren). 4.0s off pace. Mike Krack: "on the back foot." Honda admitted dissatisfaction. <strong>Williams:</strong> Failed crash tests, missed Barcelona, 2.35s off pace, FW48 estimated 25-30kg overweight. No upgrade until Race 4-5.`, caveat: `Both teams face genuine risk of scoring zero points in early rounds.` },
      { cls: 'champ', icon: '🔮', title: 'Championship Early Prediction', team: 'Leclerc 28% · Norris 24% · Hamilton 22%', evidence: `<strong>Model basis:</strong> Ferrari fastest car (P index 91.5). McLaren best race package (90.6). Mercedes strong (88.3). Hamilton wild card — adapting faster than expected. Antonelli dark horse (2nd fastest driver overall). Verstappen only 2% — RB22 reliability + his frustration = risk.`, caveat: `These are early probabilistic estimates. One race can reshape the entire picture.` }
    ];
    container.innerHTML = predsHtml.map(p => `
      <div class="pred-card ${p.cls}">
        <div class="pred-icon">${p.icon}</div>
        <div class="pred-title">${p.title}</div>
        <div class="pred-team">${p.team}</div>
        <div class="pred-evidence">${p.evidence}</div>
        <div class="pred-caveat">${p.caveat}</div>
      </div>
    `).join('');
  }

  async function init() {
    // Lazy render: data loads when nav tab is first clicked
    const navLink = document.getElementById('nav-testing');
    if (!navLink) return;
    let rendered = false;

    navLink.addEventListener('click', async () => {
      if (rendered) return;
      rendered = true;
      // Show a non-destructive loading overlay inside the view
      const view = document.getElementById('view-testing');
      const loader = document.createElement('div');
      loader.id = 'testing-loader';
      loader.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,16,0.85);z-index:50;border-radius:14px;flex-direction:column;gap:1rem;';
      loader.innerHTML = '<div style="font-size:2.5rem">📡</div><div style="font-family:Rajdhani,sans-serif;color:#888;font-size:1.1rem;letter-spacing:0.08em">Loading Bahrain Testing Intelligence...</div>';
      if (view) { view.style.position = 'relative'; view.appendChild(loader); }

      const td = await loadTestingData();
      if (!td) {
        if (loader) loader.innerHTML = '<div style="color:#f44;font-family:Rajdhani,sans-serif">Failed to load testing data.</div>';
        return;
      }
      // Remove loader and populate all sections in existing DOM
      loader.remove();
      renderVerdictBanner(td);
      renderIndexTable(td);
      renderCharts(td);
      renderTeamCards(td);
      renderPredictions(td);
    });
  }


  // Also expose a direct render method for when view is already loaded
  async function renderAll() {
    const td = await loadTestingData();
    if (!td) return;
    renderVerdictBanner(td);
    renderIndexTable(td);
    renderCharts(td);
    renderTeamCards(td);
    renderPredictions(td);
  }

  return { init, renderAll };
})();
