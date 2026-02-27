'use strict';
/* ═══════════════════════════════════════════════════════════════
   API HEALTH DASHBOARD — ApiHealthDashboard.js
   Monitors connectivity, latency, error rates, and staleness for
   all external data sources. Renders a floating status widget.
   ═══════════════════════════════════════════════════════════════ */

window.ApiHealthDashboard = (() => {

    const sources = {
        openf1: {
            name: 'OpenF1',
            url: 'https://api.openf1.org/v1',
            icon: '🏎️',
            status: 'unknown',    // 'online' | 'degraded' | 'offline' | 'unknown'
            lastSuccess: null,
            lastError: null,
            latencyMs: null,
            errorCount: 0,
            successCount: 0,
            cacheHits: 0,
        },
        jolpica: {
            name: 'Jolpica/Ergast',
            url: 'https://api.jolpi.ca/ergast/f1',
            icon: '📊',
            status: 'unknown',
            lastSuccess: null,
            lastError: null,
            latencyMs: null,
            errorCount: 0,
            successCount: 0,
            cacheHits: 0,
        },
        openmeteo: {
            name: 'Open-Meteo',
            url: 'https://api.open-meteo.com/v1/forecast',
            icon: '🌤️',
            status: 'unknown',
            lastSuccess: null,
            lastError: null,
            latencyMs: null,
            errorCount: 0,
            successCount: 0,
            cacheHits: 0,
        },
    };

    let _widgetElement = null;
    let _expanded = false;
    let _updateTimer = null;

    // ─────────────────────────────────────────────────────────────
    // HEALTH CHECK: Ping each API endpoint
    // ─────────────────────────────────────────────────────────────
    async function checkHealth(sourceId) {
        const src = sources[sourceId];
        if (!src) return;

        const testUrls = {
            openf1: 'https://api.openf1.org/v1/sessions?year=2026&limit=1',
            jolpica: 'https://api.jolpi.ca/ergast/f1/current.json',
            openmeteo: 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&daily=temperature_2m_max&forecast_days=1',
        };

        const url = testUrls[sourceId];
        if (!url) return;

        const start = performance.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            const latency = Math.round(performance.now() - start);
            src.latencyMs = latency;
            src.successCount++;

            if (resp.ok) {
                src.status = latency > 3000 ? 'degraded' : 'online';
                src.lastSuccess = new Date();
            } else {
                src.status = 'degraded';
                src.lastError = new Date();
                src.errorCount++;
            }
        } catch (e) {
            src.latencyMs = null;
            src.status = 'offline';
            src.lastError = new Date();
            src.errorCount++;
        }
    }

    async function checkAllHealth() {
        await Promise.allSettled([
            checkHealth('openf1'),
            checkHealth('jolpica'),
            checkHealth('openmeteo'),
        ]);
        renderWidget();
    }

    // ─────────────────────────────────────────────────────────────
    // RECORD EVENTS (called externally by other engines)
    // ─────────────────────────────────────────────────────────────
    function recordSuccess(sourceId, latencyMs) {
        const src = sources[sourceId];
        if (!src) return;
        src.successCount++;
        src.lastSuccess = new Date();
        src.latencyMs = latencyMs || src.latencyMs;
        src.status = (latencyMs && latencyMs > 3000) ? 'degraded' : 'online';
    }

    function recordError(sourceId) {
        const src = sources[sourceId];
        if (!src) return;
        src.errorCount++;
        src.lastError = new Date();
        if (src.errorCount > 3 && (!src.lastSuccess || Date.now() - src.lastSuccess > 60000)) {
            src.status = 'offline';
        } else {
            src.status = 'degraded';
        }
    }

    function recordCacheHit(sourceId) {
        const src = sources[sourceId];
        if (src) src.cacheHits++;
    }

    // ─────────────────────────────────────────────────────────────
    // TIME AGO HELPER
    // ─────────────────────────────────────────────────────────────
    function timeAgo(date) {
        if (!date) return 'never';
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER WIDGET
    // ─────────────────────────────────────────────────────────────
    function getStatusColor(status) {
        return { online: '#3fb950', degraded: '#f0883e', offline: '#f44336', unknown: '#666' }[status] || '#666';
    }

    function getStatusDot(status) {
        const color = getStatusColor(status);
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}55;margin-right:4px"></span>`;
    }

    function renderWidget() {
        if (!_widgetElement) return;

        const allOnline = Object.values(sources).every(s => s.status === 'online');
        const anyOffline = Object.values(sources).some(s => s.status === 'offline');
        const overallColor = anyOffline ? '#f44336' : allOnline ? '#3fb950' : '#f0883e';
        const overallLabel = anyOffline ? 'DEGRADED' : allOnline ? 'ALL SYSTEMS GO' : 'PARTIAL';

        let html = `<div id="api-health-header" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 10px;background:${overallColor}10;border:1px solid ${overallColor}33;border-radius:8px;user-select:none">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${overallColor};box-shadow:0 0 8px ${overallColor}55;animation:pulse 2s infinite"></span>
            <span style="font-size:0.55rem;font-family:'Orbitron',monospace;color:${overallColor};font-weight:700;letter-spacing:0.5px">API: ${overallLabel}</span>
            <span style="font-size:0.5rem;color:#666;margin-left:auto">${_expanded ? '▲' : '▼'}</span>
        </div>`;

        if (_expanded) {
            html += '<div style="margin-top:6px;display:grid;gap:4px">';
            Object.values(sources).forEach(src => {
                const color = getStatusColor(src.status);
                const errorRate = src.successCount + src.errorCount > 0
                    ? Math.round(src.errorCount / (src.successCount + src.errorCount) * 100)
                    : 0;

                html += `<div style="display:flex;align-items:center;gap:8px;background:#ffffff04;border-radius:6px;padding:5px 8px;border-left:2px solid ${color}">
                    <span style="font-size:0.85rem">${src.icon}</span>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:4px">
                            ${getStatusDot(src.status)}
                            <span style="font-size:0.55rem;color:#ddd;font-weight:600">${src.name}</span>
                            <span style="font-size:0.45rem;color:${color};margin-left:auto;text-transform:uppercase;font-weight:700">${src.status}</span>
                        </div>
                        <div style="display:flex;gap:8px;margin-top:2px">
                            <span style="font-size:0.45rem;color:#888">⏱ ${src.latencyMs ? src.latencyMs + 'ms' : '—'}</span>
                            <span style="font-size:0.45rem;color:#888">✓ ${src.successCount}</span>
                            <span style="font-size:0.45rem;color:${src.errorCount > 0 ? '#f44' : '#888'}">✗ ${src.errorCount}${errorRate > 0 ? ' (' + errorRate + '%)' : ''}</span>
                            <span style="font-size:0.45rem;color:#888">📦 ${src.cacheHits} cached</span>
                        </div>
                        <div style="font-size:0.42rem;color:#555;margin-top:1px">
                            Last OK: ${timeAgo(src.lastSuccess)} ${src.lastError ? '| Last err: ' + timeAgo(src.lastError) : ''}
                        </div>
                    </div>
                </div>`;
            });
            html += `<button onclick="window.ApiHealthDashboard.checkAll()" style="padding:3px 8px;background:#58a6ff15;color:#58a6ff;border:1px solid #58a6ff33;border-radius:4px;cursor:pointer;font-size:0.5rem;font-family:'Orbitron',monospace;margin-top:2px">↻ Re-check All</button>`;
            html += '</div>';
        }

        _widgetElement.innerHTML = html;

        // Bind toggle
        const header = _widgetElement.querySelector('#api-health-header');
        if (header) {
            header.onclick = () => {
                _expanded = !_expanded;
                renderWidget();
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────
    function init() {
        // Create floating widget
        _widgetElement = document.createElement('div');
        _widgetElement.id = 'api-health-widget';
        _widgetElement.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;min-width:180px;max-width:320px;background:#0d1117ee;backdrop-filter:blur(12px);border:1px solid #ffffff12;border-radius:12px;padding:8px;box-shadow:0 8px 32px #00000055;font-family:Inter,sans-serif;transition:all 0.3s ease';
        document.body.appendChild(_widgetElement);

        // Initial health check
        checkAllHealth();

        // Re-check every 2 minutes
        _updateTimer = setInterval(checkAllHealth, 120000);

        console.log('%c[ApiHealthDashboard] Initialized — monitoring 3 API sources', 'color:#58a6ff;font-weight:bold');
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to let other scripts load first
        setTimeout(init, 1500);
    }

    return {
        checkAll: checkAllHealth,
        recordSuccess,
        recordError,
        recordCacheHit,
        getSources: () => sources,
    };
})();
