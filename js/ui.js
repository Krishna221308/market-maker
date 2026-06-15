import { CONFIG } from './config.js';
import { GameEngine } from './engine.js';

let priceChart = null;
let engine = null;

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

    if (data.labels.length > CONFIG.CHART_MAX_POINTS) {
        data.labels.shift();
        data.datasets[0].data.shift();
        data.datasets[1].data.shift();
        data.datasets[2].data.shift();
    }

    priceChart.update('none');
}

function updateStats(snapshot) {
    const pnlEl = document.getElementById('pnl-value');
    pnlEl.textContent = formatMoney(snapshot.pnl.total);
    pnlEl.className = snapshot.pnl.total >= 0 ? 'positive' : 'negative';

    document.getElementById('inventory-value').textContent = snapshot.inventory;
    document.getElementById('spread-value').textContent = snapshot.spread.toFixed(2);
    document.getElementById('skew-value').textContent = snapshot.skew.toFixed(2);
    
    const timerEl = document.getElementById('timer-value');
    timerEl.textContent = formatTime(snapshot.timeLeft);
    if (snapshot.timeLeft <= 10) {
        timerEl.className = 'negative';
    } else {
        timerEl.className = '';
    }

    // Update gauge
    const gaugeFill = document.getElementById('gauge-fill');
    if (gaugeFill) {
        const pct = Math.min(100, Math.abs(snapshot.inventory) / CONFIG.MAX_INVENTORY * 50);
        if (snapshot.inventory > 0) {
            gaugeFill.style.left = '50%';
            gaugeFill.style.width = `${pct}%`;
            gaugeFill.style.background = pct > 40 ? 'var(--accent-red)' : 'var(--accent-green)';
        } else {
            gaugeFill.style.left = `${50 - pct}%`;
            gaugeFill.style.width = `${pct}%`;
            gaugeFill.style.background = pct > 40 ? 'var(--accent-red)' : 'var(--accent-green)';
        }
    }

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
        html += `<div style="color: var(--accent-green); margin-bottom: 4px;">✅ FILLED: You ${snapshot.fill.side === 'sell' ? 'sold' : 'bought'} ${snapshot.fill.quantity} @ $${snapshot.fill.price.toFixed(2)}</div>`;
    }
    
    if (snapshot.trader) {
        const isBuy = snapshot.trader.side === 'buy';
        const color = snapshot.trader.traderType === 'informed' ? 'var(--accent-red)' : (isBuy ? 'var(--accent-green)' : 'var(--accent-blue)');
        html += `<div style="color: ${color}; margin-bottom: 4px;">` +
            `${isBuy ? '🟢 BUY' : '🔴 SELL'} ${snapshot.trader.quantity} @ market (${snapshot.trader.traderType})` +
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
    document.getElementById('btn-tighten').addEventListener('click', () => { engine.tightenSpread(); updateControlsDisplay(); });
    document.getElementById('btn-widen').addEventListener('click', () => { engine.widenSpread(); updateControlsDisplay(); });
    document.getElementById('btn-skew-down').addEventListener('click', () => { engine.skewDown(); updateControlsDisplay(); });
    document.getElementById('btn-skew-up').addEventListener('click', () => { engine.skewUp(); updateControlsDisplay(); });
    document.getElementById('toggle-quotes').addEventListener('click', () => { engine.toggleQuotes(); updateControlsDisplay(); });

    window.addEventListener('keydown', (e) => {
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

    document.getElementById('btn-start').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        engine.start();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        document.getElementById('game-over-overlay').style.display = 'none';
        
        // Clear UI state
        priceChart.data.labels = [];
        priceChart.data.datasets.forEach(d => d.data = []);
        priceChart.update();
        document.getElementById('orderflow-feed').innerHTML = '';
        
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

function showGameOver(snapshot) {
    document.getElementById('game-over-overlay').style.display = 'flex';
    document.getElementById('go-raw-pnl').textContent = formatMoney(snapshot.finalScore.rawPnL);
    document.getElementById('go-penalty').textContent = formatMoney(snapshot.finalScore.inventoryPenalty);
    document.getElementById('go-score').textContent = formatMoney(snapshot.finalScore.finalScore);
    document.getElementById('go-trades').textContent = snapshot.finalScore.totalTrades;
}

// Initial Setup
export function init() {
    engine = new GameEngine(renderUI);
    initChart();
    setupControls();
    
    // Initial render
    const initialSnap = engine.update();
    updateStats(initialSnap);
}

// Ensure DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    populateDOM();
    init();
});

function populateDOM() {
    document.getElementById('start-screen').innerHTML = `
        <div class="overlay">
            <div class="overlay-content">
                <h1>Market Maker Madness</h1>
                <p>Provide liquidity, manage inventory, and avoid informed traders!</p>
                <button id="btn-start" class="primary-btn">START GAME</button>
            </div>
        </div>
    `;

    document.getElementById('game-header').innerHTML = `
        <h2>Market Maker Madness</h2>
        <div style="font-size: 1.5em; font-weight: bold; font-family: 'JetBrains Mono', monospace;">Time: <span id="timer-value">60s</span></div>
    `;

    document.getElementById('controls-panel').innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 8px;">Controls</h3>
        <div class="button-row">
            <button id="btn-tighten">Tighten ◄ (T)</button>
            <div style="font-family: 'JetBrains Mono', monospace;">Spread: $<span id="spread-value">1.00</span></div>
            <button id="btn-widen">► Widen (W)</button>
        </div>
        <div class="button-row">
            <button id="btn-skew-down">Skew ↓ (Q)</button>
            <div style="font-family: 'JetBrains Mono', monospace;">Skew: $<span id="skew-value">0.00</span></div>
            <button id="btn-skew-up">↑ Skew (E)</button>
        </div>
        <button id="toggle-quotes" class="active">PULL QUOTES (Space)</button>
    `;

    document.getElementById('stats-panel').innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 8px;">Portfolio</h3>
        <div>PnL: <span id="pnl-value" class="positive">$0.00</span></div>
        <div>Inventory: <span id="inventory-value">0</span> / ${CONFIG.MAX_INVENTORY}</div>
        <div class="gauge-container">
            <div id="gauge-fill" class="gauge-fill" style="width: 0%; left: 50%;"></div>
            <div class="gauge-center"></div>
        </div>
    `;

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
                </div>
                <button id="btn-restart" class="primary-btn">PLAY AGAIN</button>
            </div>
        </div>
    `;
}
