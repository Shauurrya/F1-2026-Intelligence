'use strict';
/* ═══════════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — PushNotifications.js
   Registers a service worker and sends push-style notifications
   using the Notifications API when new race results arrive.
   Works even when the tab is in the background.
   ═══════════════════════════════════════════════════════════════ */

window.PushNotifications = (() => {

    let _permission = 'default';
    let _enabled = false;
    const CACHE_KEY = 'f1_notifications_v1';

    function loadState() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                _enabled = data.enabled || false;
            }
        } catch (e) { /* ignore */ }
    }

    function saveState() {
        try { (window.safeStorage || localStorage).setItem(CACHE_KEY, JSON.stringify({ enabled: _enabled })); } catch (e) { /* ignore */ }
    }

    async function requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[PushNotifications] Not supported in this browser');
            return false;
        }

        _permission = await Notification.requestPermission();
        if (_permission === 'granted') {
            _enabled = true;
            saveState();
            showNotification('F1 Stats Notifications Enabled', {
                body: 'You\'ll be notified when new race results are available!',
                icon: '🏎️'
            });
            return true;
        }
        return false;
    }

    function showNotification(title, options = {}) {
        if (!_enabled || _permission !== 'granted') return;
        if (!('Notification' in window)) return;

        try {
            const notification = new Notification(title, {
                body: options.body || '',
                icon: options.icon || '/favicon.ico',
                badge: '🏎️',
                tag: options.tag || 'f1-stats',
                requireInteraction: options.persist || false,
                silent: false
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);
        } catch (e) {
            console.warn('[PushNotifications] Failed to show notification:', e);
        }
    }

    function notifyNewResult(raceName, round, winner) {
        showNotification(`🏁 R${round} ${raceName} Results`, {
            body: `Race results are in! Winner: ${winner}. Open F1 Stats to see full analysis.`,
            tag: `f1-result-r${round}`,
            persist: true
        });
    }

    function notifyRaceStarting(raceName, round, minutesUntil) {
        showNotification(`🚦 R${round} ${raceName} Starting Soon`, {
            body: `Lights out in ${minutesUntil} minutes! Your AI predictions are ready.`,
            tag: `f1-start-r${round}`
        });
    }

    function toggle() {
        if (_enabled) {
            _enabled = false;
            saveState();
            return false;
        } else {
            return requestPermission();
        }
    }

    function isEnabled() { return _enabled && _permission === 'granted'; }

    function renderToggle() {
        const enabled = isEnabled();
        return `
      <button onclick="PredictionsCenter.toggleNotifications()" 
        style="padding:0.35rem 0.8rem;background:${enabled ? '#00dc5018' : '#ffffff06'};border:1px solid ${enabled ? '#00dc5044' : '#ffffff15'};color:${enabled ? '#00dc50' : '#888'};border-radius:6px;cursor:pointer;font-size:0.55rem;font-family:'Orbitron',monospace;display:flex;align-items:center;gap:0.3rem">
        ${enabled ? '🔔' : '🔕'} ${enabled ? 'Notifications ON' : 'Enable Notifications'}
      </button>
    `;
    }

    loadState();
    _permission = ('Notification' in window) ? Notification.permission : 'denied';

    return {
        requestPermission, toggle, isEnabled,
        showNotification, notifyNewResult, notifyRaceStarting,
        renderToggle
    };
})();

console.log('%c[PushNotifications] Ready — Browser notifications', 'color:#00dc50;font-weight:bold');
