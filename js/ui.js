import { CONFIG } from './config.js';
import { GameEngine } from './engine.js';

let priceChart = null;
let engine = null;
let previousPrice = CONFIG.INITIAL_PRICE;
let previousPnl = 0;

function formatMoney(num) {
    return '$' + num.toFixed(2);
}

function formatTime(seconds) {
    return Math.max(0, Math.ceil(seconds)) + 's';
}

function initChart() {
    const ctx = document.getElementById('price-chart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Mid Price',
                    data: [],
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                },
                {
                    label: 'Your Bid',
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                },
                {
                    label: 'Your Ask',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                },
                {
                    label: 'A-S Optimal Bid',
                    data: [],
                    borderColor: 'rgba(16,185,129,0.3)',
                    borderWidth: 1,
                    borderDash: [2, 4],
                    pointRadius: 0,
                    hidden: true
                },
                {
                    label: 'A-S Optimal Ask',
                    data: [],
                    borderColor: 'rgba(239,68,68,0.3)',
                    borderWidth: 1,
                    borderDash: [2, 4],
                    pointRadius: 0,
                    hidden: true
                }
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { display: false },
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
            },
            plugins: {
                legend: {
                    labels: { color: '#e2e8f0' }
                }
            }
        },
    });
}

function updateChart(snapshot) {
    if (!priceChart) return;

    const data = priceChart.data;
    data.labels.push(snapshot.tick);
    data.datasets[0].data.push(snapshot.price);
    data.datasets[1].data.push(snapshot.quotes.bid);
    data.datasets[2].data.push(snapshot.quotes.ask);
    data.datasets[3].data.push(snapshot.optimalQuotes ? snapshot.optimalQuotes.bid : null);
    data.datasets[4].data.push(snapshot.optimalQuotes ? snapshot.optimalQuotes.ask : null);

    if (data.labels.length > CONFIG.CHART_MAX_POINTS) {
        data.labels.shift();
        data.datasets.forEach(ds => ds.data.shift());
    }

    priceChart.update('none');
}

function updateStats(snapshot) {
    // === PnL with flash effect ===
    const pnlEl = document.getElementById('pnl-value');
    const newPnl = snapshot.pnl.total;
    pnlEl.textContent = formatMoney(newPnl);
    pnlEl.className = newPnl >= 0 ? 'positive' : 'negative';

    if (Math.abs(newPnl - previousPnl) > 0.5) {
        pnlEl.classList.add(newPnl > previousPnl ? 'pnl-flash-positive' : 'pnl-flash-negative');
        setTimeout(() => {
            pnlEl.classList.remove('pnl-flash-positive', 'pnl-flash-negative');
        }, 500);
    }
    previousPnl = newPnl;

    // === Inventory ===
    document.getElementById('inventory-value').textContent = snapshot.inventory;
    document.getElementById('spread-value').textContent = snapshot.spread.toFixed(2);
    document.getElementById('skew-value').textContent = snapshot.skew.toFixed(2);

    // === Price display with flash ===
    const priceEl = document.getElementById('current-price');
    const priceDisplay = document.getElementById('price-display');
    if (priceEl) {
        priceEl.textContent = snapshot.price.toFixed(2);
        priceDisplay.classList.remove('price-up', 'price-down');
        if (snapshot.price > previousPrice) {
            priceDisplay.classList.add('price-up');
        } else if (snapshot.price < previousPrice) {
            priceDisplay.classList.add('price-down');
        }
        setTimeout(() => {
            priceDisplay.classList.remove('price-up', 'price-down');
        }, 400);
    }
    previousPrice = snapshot.price;

    // === Timer with urgency pulse ===
    const timerEl = document.getElementById('timer-value');
    timerEl.textContent = formatTime(snapshot.timeLeft);
    if (snapshot.timeLeft <= 10) {
        timerEl.className = 'timer-urgent';
    } else {
        timerEl.className = '';
    }

    // === Inventory gauge ===
    const gaugeFill = document.getElementById('gauge-fill');
    const gaugeContainer = document.querySelector('.gauge-container');
    if (gaugeFill) {
        const pct = Math.min(100, Math.abs(snapshot.inventory) / CONFIG.MAX_INVENTORY * 50);
        if (snapshot.inventory > 0) {
            gaugeFill.style.left = '50%';
            gaugeFill.style.width = `${pct}%`;
        } else {
            gaugeFill.style.left = `${50 - pct}%`;
            gaugeFill.style.width = `${pct}%`;
        }

        // Color based on inventory level + warning glow
        if (pct > 40) {
            gaugeFill.style.background = 'var(--accent-red)';
            if (gaugeContainer) gaugeContainer.classList.add('inventory-warning');
        } else if (pct > 25) {
            gaugeFill.style.background = 'var(--accent-yellow)';
            if (gaugeContainer) gaugeContainer.classList.remove('inventory-warning');
        } else {
            gaugeFill.style.background = 'var(--accent-green)';
            if (gaugeContainer) gaugeContainer.classList.remove('inventory-warning');
        }
    }

    // === Spread warning shake ===
    if (snapshot.spread < 0.15) {
        const spreadEl = document.getElementById('spread-value');
        spreadEl.classList.add('spread-warning');
        setTimeout(() => spreadEl.classList.remove('spread-warning'), 300);
    }

    // === Toggle quotes button state ===
    const toggleBtn = document.getElementById('toggle-quotes');
    if (snapshot.isQuoting) {
        toggleBtn.textContent = 'PULL QUOTES (Space)';
        toggleBtn.className = 'active';
    } else {
        toggleBtn.textContent = 'GO LIVE (Space)';
        toggleBtn.className = 'inactive';
    }
}

function updateOrderFlow(snapshot) {
    const feed = document.getElementById('orderflow-feed');

    let html = '';

    if (snapshot.fill) {
        html += `<div class="fill-flash" style="color: var(--accent-green); margin-bottom: 4px;">✅ FILLED: You ${snapshot.fill.side === 'sell' ? 'sold' : 'bought'} ${snapshot.fill.quantity} @ $${snapshot.fill.price.toFixed(2)}</div>`;
    }

    if (snapshot.trader) {
        const isBuy = snapshot.trader.side === 'buy';
        const isInformed = snapshot.trader.traderType === 'informed';
        const color = isInformed ? 'var(--accent-red)' : (isBuy ? 'var(--accent-green)' : 'var(--accent-blue)');
        const label = isInformed ? `(${snapshot.trader.traderType}!)` : `(${snapshot.trader.traderType})`;
        html += `<div style="color: ${color}; margin-bottom: 4px;">` +
            `${isBuy ? '🟢 BUY' : '🔴 SELL'} ${snapshot.trader.quantity} @ market ${label}` +
            `</div>`;
    }

    if (html) {
        const el = document.createElement('div');
        el.innerHTML = html;
        feed.insertBefore(el, feed.firstChild);

        while (feed.children.length > CONFIG.ORDERFLOW_MAX_LINES) {
            feed.removeChild(feed.lastChild);
        }
    }
}

function renderUI(snapshot) {
    if (snapshot.gameOver) {
        showGameOver(snapshot);
        return;
    }
    updateChart(snapshot);
    updateStats(snapshot);
    updateOrderFlow(snapshot);
}

function setupControls() {
    // Button controls — all guarded by game state
    document.getElementById('btn-tighten').addEventListener('click', () => {
        if (engine.state !== 'running') return;
        engine.tightenSpread();
        updateControlsDisplay();
    });
    document.getElementById('btn-widen').addEventListener('click', () => {
        if (engine.state !== 'running') return;
        engine.widenSpread();
        updateControlsDisplay();
    });
    document.getElementById('btn-skew-down').addEventListener('click', () => {
        if (engine.state !== 'running') return;
        engine.skewDown();
        updateControlsDisplay();
    });
    document.getElementById('btn-skew-up').addEventListener('click', () => {
        if (engine.state !== 'running') return;
        engine.skewUp();
        updateControlsDisplay();
    });
    document.getElementById('toggle-quotes').addEventListener('click', () => {
        if (engine.state !== 'running') return;
        engine.toggleQuotes();
        updateControlsDisplay();
    });

    // Keyboard shortcuts — guarded by game state
    window.addEventListener('keydown', (e) => {
        if (engine.state !== 'running') return;

        if (e.code === 'KeyW') { engine.widenSpread(); updateControlsDisplay(); }
        if (e.code === 'KeyT') { engine.tightenSpread(); updateControlsDisplay(); }
        if (e.code === 'KeyQ') { engine.skewDown(); updateControlsDisplay(); }
        if (e.code === 'KeyE') { engine.skewUp(); updateControlsDisplay(); }
        if (e.code === 'Space') {
            e.preventDefault();
            engine.toggleQuotes();
            updateControlsDisplay();
        }
    });

    // A-S model overlay toggle
    document.getElementById('toggle-as-model').addEventListener('change', (e) => {
        const show = e.target.checked;
        priceChart.data.datasets[3].hidden = !show;
        priceChart.data.datasets[4].hidden = !show;
        priceChart.update('none');
    });

    // Start game
    document.getElementById('btn-start').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        engine.start();
    });

    // Restart game
    document.getElementById('btn-restart').addEventListener('click', () => {
        document.getElementById('game-over-overlay').style.display = 'none';

        // Clear UI state
        priceChart.data.labels = [];
        priceChart.data.datasets.forEach(d => d.data = []);
        priceChart.update();
        document.getElementById('orderflow-feed').innerHTML = '';

        // Reset tracking
        previousPrice = CONFIG.INITIAL_PRICE;
        previousPnl = 0;
        document.getElementById('current-price').textContent = CONFIG.INITIAL_PRICE.toFixed(2);

        engine.reset();
        engine.start();
    });
}

function updateControlsDisplay() {
    document.getElementById('spread-value').textContent = (engine.player.halfSpread * 2).toFixed(2);
    document.getElementById('skew-value').textContent = engine.player.skew.toFixed(2);
    const toggleBtn = document.getElementById('toggle-quotes');
    if (engine.player.isQuoting) {
        toggleBtn.textContent = 'PULL QUOTES (Space)';
        toggleBtn.className = 'active';
    } else {
        toggleBtn.textContent = 'GO LIVE (Space)';
        toggleBtn.className = 'inactive';
    }
}

function saveAndGetScores(snapshot) {
    const scores = JSON.parse(localStorage.getItem('mm-scores') || '[]');
    const newEntry = {
        score: snapshot.finalScore.finalScore,
        date: new Date().toISOString(),
        trades: snapshot.finalScore.totalTrades,
        id: Date.now()
    };
    scores.push(newEntry);
    scores.sort((a, b) => b.score - a.score);
    scores.splice(10); // keep top 10
    localStorage.setItem('mm-scores', JSON.stringify(scores));
    return { scores, isNewBest: scores.length > 0 && scores[0].id === newEntry.id, currentId: newEntry.id };
}

function showGameOver(snapshot) {
    document.getElementById('game-over-overlay').style.display = 'flex';

    // Score breakdown
    const rawPnlEl = document.getElementById('go-raw-pnl');
    rawPnlEl.textContent = formatMoney(snapshot.finalScore.rawPnL);
    rawPnlEl.className = snapshot.finalScore.rawPnL >= 0 ? 'positive' : 'negative';

    document.getElementById('go-penalty').textContent = '-' + formatMoney(snapshot.finalScore.inventoryPenalty);

    const scoreEl = document.getElementById('go-score');
    scoreEl.textContent = formatMoney(snapshot.finalScore.finalScore);
    scoreEl.className = snapshot.finalScore.finalScore >= 0 ? 'positive' : 'negative';

    document.getElementById('go-trades').textContent = snapshot.finalScore.totalTrades;
    document.getElementById('go-inventory').textContent = snapshot.finalScore.finalInventory;

    // Display achievements
    const achievementsContainer = document.getElementById('achievements-container');
    if (achievementsContainer) {
        if (snapshot.finalScore.achievements && snapshot.finalScore.achievements.length > 0) {
            achievementsContainer.innerHTML =
                '<h3 style="margin: 10px 0 6px;">🏅 Achievements</h3>' +
                snapshot.finalScore.achievements.map(a => `<span class="achievement-badge">🏆 ${a}</span>`).join('');
        } else {
            achievementsContainer.innerHTML = '';
        }
    }

    // Leaderboard
    const { scores, isNewBest, currentId } = saveAndGetScores(snapshot);
    const leaderboardHtml = `
        <h3 style="margin-top: 20px; text-align: center;">Your Top Scores</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; margin-bottom: 20px;">
            <thead>
                <tr style="border-bottom: 1px solid var(--bg-secondary);">
                    <th style="padding-bottom: 4px;">Rank</th>
                    <th style="padding-bottom: 4px;">Score</th>
                    <th style="padding-bottom: 4px;">Trades</th>
                    <th style="padding-bottom: 4px;">Date</th>
                </tr>
            </thead>
            <tbody>
                ${scores.map((s, i) => `
                    <tr style="${s.id === currentId ? 'background: rgba(59, 130, 246, 0.2); font-weight: bold;' : ''}">
                        <td style="padding: 4px 0;">#${i + 1}</td>
                        <td style="padding: 4px 0; color: ${s.score >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${formatMoney(s.score)}</td>
                        <td style="padding: 4px 0;">${s.trades}</td>
                        <td style="padding: 4px 0;">${new Date(s.date).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${isNewBest ? '<div style="color: var(--accent-green); font-weight: bold; margin-bottom: 10px; text-align: center;">🏆 New Personal Best!</div>' : ''}
    `;

    let lbContainer = document.getElementById('leaderboard-container');
    if (!lbContainer) {
        lbContainer = document.createElement('div');
        lbContainer.id = 'leaderboard-container';
        const btn = document.getElementById('btn-restart');
        btn.parentNode.insertBefore(lbContainer, btn);
    }
    lbContainer.innerHTML = leaderboardHtml;
}

// === Initial Setup ===
export function init() {
    engine = new GameEngine(renderUI);
    initChart();
    setupControls();

    // Render initial stats WITHOUT advancing the game state
    const initialSnap = engine.getInitialSnapshot();
    updateStats(initialSnap);
}

// Ensure DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    populateDOM();
    init();
});

function populateDOM() {
    // === Start Screen ===
    document.getElementById('start-screen').innerHTML = `
        <div class="overlay">
            <div class="overlay-content">
                <h1>Market Maker Madness</h1>
                <p>Provide liquidity, manage inventory, and avoid informed traders!</p>
                <div style="margin: 16px 0; padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: left; font-size: 0.9em; line-height: 1.6;">
                    <div><strong>Controls:</strong></div>
                    <div>W / T — Widen / Tighten spread</div>
                    <div>Q / E — Skew quotes down / up</div>
                    <div>Space — Pull / Post quotes</div>
                </div>
                <div style="margin-bottom: 12px; font-size: 0.9em; color: var(--text-secondary);">Difficulty: Normal</div>
                <button id="btn-start" class="primary-btn">START GAME</button>
            </div>
        </div>
    `;

    // === Game Header ===
    document.getElementById('game-header').innerHTML = `
        <h2>Market Maker Madness</h2>
        <div id="price-display">Price: $<span id="current-price">${CONFIG.INITIAL_PRICE.toFixed(2)}</span></div>
        <div style="font-size: 1.5em; font-weight: bold; font-family: 'JetBrains Mono', monospace;">Time: <span id="timer-value">${CONFIG.GAME_DURATION_SEC}s</span></div>
    `;

    // === Controls Panel ===
    document.getElementById('controls-panel').innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 8px;">Controls</h3>
        <div class="button-row">
            <button id="btn-tighten">Tighten ◄ (T)</button>
            <div style="font-family: 'JetBrains Mono', monospace;">Spread: $<span id="spread-value">${(CONFIG.DEFAULT_SPREAD * 2).toFixed(2)}</span></div>
            <button id="btn-widen">► Widen (W)</button>
        </div>
        <div class="button-row">
            <button id="btn-skew-down">Skew ↓ (Q)</button>
            <div style="font-family: 'JetBrains Mono', monospace;">Skew: $<span id="skew-value">0.00</span></div>
            <button id="btn-skew-up">↑ Skew (E)</button>
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.9em; margin-top: 8px;">
            <input type="checkbox" id="toggle-as-model"> Show A-S Optimal Quotes
        </label>
        <button id="toggle-quotes" class="active">PULL QUOTES (Space)</button>
    `;

    // === Stats Panel ===
    document.getElementById('stats-panel').innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 8px;">Portfolio</h3>
        <div>PnL: <span id="pnl-value" class="positive">$0.00</span></div>
        <div>Inventory: <span id="inventory-value">0</span> / ${CONFIG.MAX_INVENTORY}</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: var(--text-secondary); margin-top: 12px;">
            <span>SHORT</span>
            <span>LONG</span>
        </div>
        <div class="gauge-container">
            <div id="gauge-fill" class="gauge-fill" style="width: 0%; left: 50%;"></div>
            <div class="gauge-center"></div>
        </div>
    `;

    // === Game Over Overlay ===
    document.getElementById('game-over-overlay').innerHTML = `
        <div class="overlay">
            <div class="overlay-content">
                <h1>Game Over</h1>
                <div style="text-align: left; font-size: 1.2em; line-height: 1.6; margin-bottom: 20px;">
                    <div>Raw PnL: <span id="go-raw-pnl"></span></div>
                    <div>Inventory Penalty: <span id="go-penalty" class="negative"></span></div>
                    <hr>
                    <div style="font-weight: bold; font-size: 1.4em;">Final Score: <span id="go-score"></span></div>
                    <div style="margin-top: 10px;">Total Trades: <span id="go-trades"></span></div>
                    <div>Final Inventory: <span id="go-inventory"></span></div>
                </div>
                <div id="achievements-container" style="text-align: center; margin-bottom: 10px;"></div>
                <button id="btn-restart" class="primary-btn">PLAY AGAIN</button>
            </div>
        </div>
    `;
}
