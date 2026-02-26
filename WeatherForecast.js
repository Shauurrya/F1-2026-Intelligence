'use strict';
/* ═══════════════════════════════════════════════════════════════
   LIVE WEATHER FORECAST — WeatherForecast.js
   Fetches real weather forecasts for upcoming race weekends
   using Open-Meteo API (free, no API key required).
   Integrates into pace calculations for wet/dry predictions.
   ═══════════════════════════════════════════════════════════════ */

window.WeatherForecast = (() => {

    const API_BASE = 'https://api.open-meteo.com/v1/forecast';
    const CACHE_KEY = 'f1_weather_cache_v1';
    const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

    // Circuit coordinates (lat, lon)
    const CIRCUIT_COORDS = {
        'AUS': { lat: -37.8497, lon: 144.9680, tz: 'Australia/Melbourne' },
        'CHN': { lat: 31.3389, lon: 121.2197, tz: 'Asia/Shanghai' },
        'JPN': { lat: 34.8431, lon: 136.5406, tz: 'Asia/Tokyo' },
        'BAH': { lat: 26.0325, lon: 50.5106, tz: 'Asia/Bahrain' },
        'KSA': { lat: 21.6319, lon: 39.1044, tz: 'Asia/Riyadh' },
        'MIA': { lat: 25.9581, lon: -80.2389, tz: 'America/New_York' },
        'EMI': { lat: 44.3439, lon: 11.7167, tz: 'Europe/Rome' },
        'MON': { lat: 43.7347, lon: 7.4206, tz: 'Europe/Monaco' },
        'ESP': { lat: 41.5700, lon: 2.2611, tz: 'Europe/Madrid' },
        'CAN': { lat: 45.5017, lon: -73.5228, tz: 'America/Montreal' },
        'AUT': { lat: 47.2197, lon: 14.7647, tz: 'Europe/Vienna' },
        'GBR': { lat: 52.0786, lon: -1.0169, tz: 'Europe/London' },
        'BEL': { lat: 50.4372, lon: 5.9714, tz: 'Europe/Brussels' },
        'HUN': { lat: 47.5789, lon: 19.2486, tz: 'Europe/Budapest' },
        'NED': { lat: 52.3888, lon: 4.5409, tz: 'Europe/Amsterdam' },
        'ITA': { lat: 45.6156, lon: 9.2811, tz: 'Europe/Rome' },
        'AZE': { lat: 40.3725, lon: 49.8533, tz: 'Asia/Baku' },
        'SGP': { lat: 1.2914, lon: 103.8636, tz: 'Asia/Singapore' },
        'USA': { lat: 30.1328, lon: -97.6411, tz: 'America/Chicago' },
        'MEX': { lat: 19.4042, lon: -99.0907, tz: 'America/Mexico_City' },
        'BRA': { lat: -23.7014, lon: -46.6969, tz: 'America/Sao_Paulo' },
        'LAS': { lat: 36.1147, lon: -115.1728, tz: 'America/Los_Angeles' },
        'QAT': { lat: 25.4900, lon: 51.4542, tz: 'Asia/Qatar' },
        'ABU': { lat: 24.4672, lon: 54.6031, tz: 'Asia/Dubai' },
        'RSA': { lat: -33.6881, lon: 18.9842, tz: 'Africa/Johannesburg' }
    };

    let _cache = {};
    let _forecasts = {};

    function loadCache() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) _cache = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    }

    function saveCache() {
        try { (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify(_cache)); } catch (e) { /* ignore */ }
    }

    async function fetchForecast(trackShort, raceDate) {
        const coords = CIRCUIT_COORDS[trackShort];
        if (!coords) return null;

        const cacheKey = `${trackShort}_${raceDate}`;
        const cached = _cache[cacheKey];
        if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
            _forecasts[trackShort] = cached.data;
            return cached.data;
        }

        try {
            const url = `${API_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&start_date=${raceDate}&end_date=${raceDate}&timezone=auto`;

            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();

            const daily = data.daily;
            if (!daily || !daily.time || !daily.time.length) return null;

            const forecast = {
                date: daily.time[0],
                tempMax: daily.temperature_2m_max?.[0],
                tempMin: daily.temperature_2m_min?.[0],
                precipMm: daily.precipitation_sum?.[0] || 0,
                rainProb: (daily.precipitation_probability_max?.[0] || 0) / 100,
                windMax: daily.wind_speed_10m_max?.[0] || 0,
                weatherCode: daily.weather_code?.[0] || 0,
                trackTemp: (daily.temperature_2m_max?.[0] || 25) + 12 // Approximate track temp
            };

            // Derive weather classification
            forecast.classification = classifyWeather(forecast);

            _cache[cacheKey] = { data: forecast, fetchedAt: Date.now() };
            _forecasts[trackShort] = forecast;
            saveCache();

            return forecast;
        } catch (e) {
            console.warn('[Weather] Fetch failed for', trackShort, e.message);
            return null;
        }
    }

    function classifyWeather(f) {
        // WMO Weather codes: 0-3 clear, 45-48 fog, 51-67 drizzle/rain, 71-77 snow, 80-82 showers, 95-99 thunderstorm
        const code = f.weatherCode;
        if (code >= 95) return 'heavy_rain';
        if (code >= 80 || (code >= 61 && code <= 67)) return 'wet';
        if (code >= 51 && code <= 57) return 'damp';
        if (f.rainProb > 0.7 && f.precipMm > 5) return 'wet';
        if (f.rainProb > 0.5 && f.precipMm > 2) return 'damp';
        return 'dry';
    }

    function getWeatherEmoji(classification) {
        const emojis = { dry: '☀️', damp: '🌦️', wet: '🌧️', heavy_rain: '⛈️' };
        return emojis[classification] || '☀️';
    }

    function getPaceModifier(forecast) {
        if (!forecast) return { modifier: 0, scBoost: 0, tireDegMult: 1.0, description: 'No forecast' };
        const c = forecast.classification;
        if (c === 'heavy_rain') return { modifier: -0.03, scBoost: 0.35, tireDegMult: 0.6, description: 'Heavy rain expected — high SC risk, low tire deg' };
        if (c === 'wet') return { modifier: -0.015, scBoost: 0.2, tireDegMult: 0.7, description: 'Rain likely — moderate SC risk' };
        if (c === 'damp') return { modifier: -0.005, scBoost: 0.1, tireDegMult: 0.85, description: 'Chance of showers — strategy variable' };
        // Hot conditions affect tire deg
        if (forecast.trackTemp > 50) return { modifier: 0, scBoost: 0, tireDegMult: 1.15, description: 'Extreme heat — high tire degradation' };
        if (forecast.trackTemp > 42) return { modifier: 0, scBoost: 0, tireDegMult: 1.08, description: 'Hot conditions — elevated tire wear' };
        return { modifier: 0, scBoost: 0, tireDegMult: 1.0, description: 'Clear and dry' };
    }

    async function fetchAllUpcoming(calendar) {
        const now = new Date();
        const upcoming = calendar.filter(r => new Date(r.date) > now).slice(0, 3);
        const results = [];
        for (const race of upcoming) {
            const forecast = await fetchForecast(race.short, race.date);
            if (forecast) results.push({ race, forecast });
        }
        return results;
    }

    function getForecast(trackShort) { return _forecasts[trackShort] || null; }

    function renderWidget(calendar) {
        const now = new Date();
        const upcoming = calendar.filter(r => new Date(r.date) > now).slice(0, 3);
        if (!upcoming.length) return '<div style="color:#666;padding:0.5rem;font-size:0.6rem">No upcoming races</div>';

        let html = '<div class="f1-weather-grid" style="display:grid;gap:0.5rem">';
        upcoming.forEach(race => {
            const f = _forecasts[race.short];
            const daysUntil = Math.ceil((new Date(race.date) - now) / (1000 * 60 * 60 * 24));
            const canFetch = daysUntil <= 16; // Open-Meteo supports 16-day forecasts

            if (f) {
                const emoji = getWeatherEmoji(f.classification);
                const mod = getPaceModifier(f);
                html += `<div style="display:flex;align-items:center;gap:0.6rem;background:#ffffff04;border-radius:8px;padding:0.5rem 0.7rem;border-left:3px solid ${f.classification === 'dry' ? '#00dc50' : f.classification === 'damp' ? '#ffd166' : '#58a6ff'}">
          <span style="font-size:1.3rem">${emoji}</span>
          <div style="flex:1">
            <div style="font-size:0.65rem;color:#ddd">${race.flag} R${race.round} ${race.short} <span style="color:#666">· ${race.date}</span></div>
            <div style="font-size:0.55rem;color:#888;margin-top:0.15rem">${mod.description}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.7rem;color:#ffd166;font-weight:bold">${Math.round(f.tempMax)}°C</div>
            <div style="font-size:0.5rem;color:#58a6ff">${Math.round(f.rainProb * 100)}% rain</div>
            <div style="font-size:0.5rem;color:#888">${f.windMax.toFixed(0)} km/h</div>
          </div>
        </div>`;
            } else if (canFetch) {
                html += `<div style="display:flex;align-items:center;gap:0.6rem;background:#ffffff04;border-radius:8px;padding:0.5rem 0.7rem">
          <span style="font-size:1rem">⏳</span>
          <div style="flex:1">
            <div style="font-size:0.65rem;color:#ddd">${race.flag} R${race.round} ${race.short}</div>
            <div style="font-size:0.55rem;color:#666">Fetching forecast...</div>
          </div>
        </div>`;
            } else {
                html += `<div style="display:flex;align-items:center;gap:0.6rem;background:#ffffff04;border-radius:8px;padding:0.5rem 0.7rem;opacity:0.5">
          <span style="font-size:1rem">📅</span>
          <div>
            <div style="font-size:0.65rem;color:#ddd">${race.flag} R${race.round} ${race.short} <span style="color:#666">· in ${daysUntil} days</span></div>
            <div style="font-size:0.55rem;color:#666">Forecast available within 16 days</div>
          </div>
        </div>`;
            }
        });
        html += '</div>';
        return html;
    }

    loadCache();

    return {
        fetchForecast, fetchAllUpcoming, getForecast, getPaceModifier,
        classifyWeather, getWeatherEmoji, renderWidget, CIRCUIT_COORDS
    };
})();

console.log('%c[WeatherForecast] Ready — Open-Meteo live forecasts', 'color:#58a6ff;font-weight:bold');
