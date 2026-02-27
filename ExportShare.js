'use strict';
/* ═══════════════════════════════════════════════════════════════
   EXPORT & SHARE PREDICTIONS — ExportShare.js
   Generates shareable prediction cards as PNG images using
   Canvas API. Also supports copying to clipboard and data export.
   ═══════════════════════════════════════════════════════════════ */

window.ExportShare = (() => {

    function generatePredictionCard(race, predictions, options = {}) {
        const canvas = document.createElement('canvas');
        const w = options.width || 600;
        const h = options.height || 400;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Background gradient
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#0a0e14');
        bg.addColorStop(0.5, '#0d1117');
        bg.addColorStop(1, '#161b22');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Border glow
        ctx.strokeStyle = '#58a6ff33';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);

        // Top accent line
        const accent = ctx.createLinearGradient(0, 0, w, 0);
        accent.addColorStop(0, '#DC0000');
        accent.addColorStop(0.25, '#FF8000');
        accent.addColorStop(0.5, '#00D2BE');
        accent.addColorStop(0.75, '#3671C6');
        accent.addColorStop(1, '#FF69B4');
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, w, 3);

        // Title
        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🔮 F1 2026 AI PREDICTION', 24, 36);

        // Race info
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = '#58a6ff';
        ctx.fillText(`${race.flag || ''} R${race.round} — ${race.name}`, 24, 60);

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText(`${race.date} · ${race.circuit || ''}`, 24, 78);

        // Divider
        ctx.strokeStyle = '#ffffff12';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, 90);
        ctx.lineTo(w - 24, 90);
        ctx.stroke();

        // Column headers
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('POS', 30, 110);
        ctx.fillText('DRIVER', 70, 110);
        ctx.fillText('WIN %', 320, 110);
        ctx.fillText('PODIUM %', 400, 110);
        ctx.fillText('AVG', 510, 110);

        // Top 10 predictions
        const top10 = (predictions || []).slice(0, 10);
        top10.forEach((p, i) => {
            const y = 130 + i * 24;
            const isTop3 = i < 3;

            // Row background for top 3
            if (isTop3) {
                ctx.fillStyle = '#ffffff06';
                ctx.fillRect(24, y - 12, w - 48, 22);
            }

            // Position
            ctx.font = `bold 12px Orbitron, monospace`;
            ctx.fillStyle = isTop3 ? '#ffd166' : '#888';
            ctx.fillText(`P${i + 1}`, 30, y + 4);

            // Driver name with team color
            ctx.font = `${isTop3 ? 'bold ' : ''}12px Inter, sans-serif`;
            ctx.fillStyle = p.driver?.color || '#ccc';
            ctx.fillText(p.driver?.full || p.driver?.name || '?', 70, y + 4);

            // Win probability
            ctx.font = '11px monospace';
            ctx.fillStyle = p.winProb > 20 ? '#00dc50' : p.winProb > 10 ? '#ffd166' : '#888';
            ctx.fillText(`${(p.winProb || 0).toFixed(1)}%`, 320, y + 4);

            // Podium probability
            ctx.fillStyle = '#aaa';
            ctx.fillText(`${(p.podiumProb || 0).toFixed(0)}%`, 410, y + 4);

            // Average finish
            ctx.fillStyle = '#888';
            ctx.fillText(`${(p.avgFinish || 0).toFixed(1)}`, 510, y + 4);
        });

        // Footer
        const footerY = h - 30;
        ctx.strokeStyle = '#ffffff08';
        ctx.beginPath();
        ctx.moveTo(24, footerY - 8);
        ctx.lineTo(w - 24, footerY - 8);
        ctx.stroke();

        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#48484a';
        ctx.fillText('F1 Stats AI · Elo-rated · 1000 Monte Carlo simulations', 24, footerY + 4);
        ctx.fillText(new Date().toLocaleDateString(), w - 100, footerY + 4);

        return canvas;
    }

    async function downloadCard(race, predictions) {
        const canvas = generatePredictionCard(race, predictions);
        const link = document.createElement('a');
        link.download = `F1_Prediction_R${race.round}_${race.short}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async function copyToClipboard(race, predictions) {
        try {
            const canvas = generatePredictionCard(race, predictions);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            return true;
        } catch (e) {
            console.warn('[ExportShare] Clipboard copy failed:', e);
            return false;
        }
    }

    function exportJSON(dataModel) {
        const data = {
            exportDate: new Date().toISOString(),
            engine: 'F1 Stats AI v14.0',
            results: dataModel.results,
            accuracy: dataModel.accuracy,
            eloRatings: window.EloRatingSystem?.save(),
            trackHistory: window.TrackPerformanceHistory?.save(),
            accuracyHistory: window.AccuracyTracker?.save()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `F1_Stats_Export_${new Date().toISOString().split('T')[0]}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    function importJSON(file, onComplete) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                onComplete(data);
            } catch (err) { console.error('[ExportShare] Import parse error:', err); }
        };
        reader.readAsText(file);
    }

    function renderExportPanel(race, predictions) {
        return `
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
        <button onclick="PredictionsCenter.exportCard()" style="padding:0.35rem 0.8rem;background:#a78bfa18;border:1px solid #a78bfa33;color:#a78bfa;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">📸 Download Card</button>
        <button onclick="PredictionsCenter.copyCard()" style="padding:0.35rem 0.8rem;background:#58a6ff18;border:1px solid #58a6ff33;color:#58a6ff;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">📋 Copy to Clipboard</button>
        <button onclick="PredictionsCenter.exportData()" style="padding:0.35rem 0.8rem;background:#00dc5018;border:1px solid #00dc5033;color:#00dc50;border-radius:6px;cursor:pointer;font-size:0.6rem;font-family:'Orbitron',monospace">💾 Export JSON</button>
      </div>`;
    }

    return { generatePredictionCard, downloadCard, copyToClipboard, exportJSON, importJSON, renderExportPanel };
})();

console.log('%c[ExportShare] Ready — PNG cards & data export', 'color:#a78bfa;font-weight:bold');
