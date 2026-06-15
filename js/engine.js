import { CONFIG } from './config.js';
import { PriceEngine } from './price.js';
import { Player } from './player.js';
import { OrderBook } from './orderbook.js';
import { generateTrader } from './traders.js';
import { calculateScore } from './scoring.js';

function avellanedaStoikov(midPrice, inventory, timeLeft, sigma) {
    const gamma = CONFIG.AS_GAMMA;
    const kappa = CONFIG.AS_KAPPA;

    // Reservation price (inventory-adjusted mid)
    const reservationPrice = midPrice - inventory * gamma * sigma * sigma * timeLeft;

    // Optimal spread
    const optimalSpread = (2 / gamma) * Math.log(1 + gamma / kappa)
                        + gamma * sigma * sigma * timeLeft;

    // Optimal quotes
    const optimalBid = reservationPrice - optimalSpread / 2;
    const optimalAsk = reservationPrice + optimalSpread / 2;

    return { reservationPrice, optimalSpread, optimalBid, optimalAsk };
}

export class GameEngine {
    constructor(onTickCallback) {
        this.priceEngine = new PriceEngine();
        this.player = new Player();
        this.orderBook = new OrderBook();
        this.tick = 0;
        this.maxTicks = CONFIG.GAME_DURATION_SEC * (1000 / CONFIG.TICK_INTERVAL_MS);
        this.state = 'waiting';  // 'waiting' | 'running' | 'finished'
        this.intervalId = null;
        this.eventLog = [];       // all events for UI to consume
        this.onTickCallback = onTickCallback; // callback to render UI
    }

    update() {
        // 1. Advance price
        const newPrice = this.priceEngine.step();

        // 2. Update player quotes on the book
        const quotes = this.player.getQuotes(newPrice);
        this.orderBook.updatePlayerQuotes(quotes.bid, quotes.ask);

        // 3. Generate trader (may be null)
        const trader = generateTrader(this.priceEngine, this.tick);

        // 4. If trader arrived, try to match
        let fill = null;
        if (trader) {
            fill = this.orderBook.processIncomingOrder(trader, this.tick);
            if (fill) {
                this.player.onFill(this.tick, fill.side, fill.price, fill.quantity);
                fill.traderType = trader.traderType;
            }
        }

        // 5. Check inventory limits
        this.player.checkInventoryLimit();

        // Record spread for achievement tracking
        this.player.recordSpread(this.player.halfSpread);

        // Avellaneda-Stoikov model quotes
        const timeLeftTicks = this.maxTicks - this.tick;
        const asModel = avellanedaStoikov(newPrice, this.player.inventory, timeLeftTicks, CONFIG.SIGMA);

        // 6. Compute current state snapshot for UI
        const snapshot = {
            tick: this.tick,
            price: newPrice,
            quotes: quotes,
            optimalQuotes: {
                bid: asModel.optimalBid,
                ask: asModel.optimalAsk
            },
            pnl: this.player.getPnL(newPrice),
            inventory: this.player.inventory,
            spread: this.player.halfSpread * 2,
            skew: this.player.skew,
            isQuoting: this.player.isQuoting,
            trader: trader,
            fill: fill,
            timeLeft: (this.maxTicks - this.tick) * CONFIG.TICK_INTERVAL_MS / 1000,
        };

        // 7. Advance tick
        this.tick++;

        // 8. Check game over
        if (this.tick >= this.maxTicks) {
            this.stop();
            snapshot.gameOver = true;
            snapshot.finalScore = calculateScore(this.player, newPrice);
        }

        return snapshot;
    }

    getInitialSnapshot() {
        const currentPrice = this.priceEngine.getPrice();
        const quotes = this.player.getQuotes(currentPrice);
        const timeLeftTicks = this.maxTicks - this.tick;
        const asModel = avellanedaStoikov(currentPrice, this.player.inventory, timeLeftTicks, CONFIG.SIGMA);

        return {
            tick: this.tick,
            price: currentPrice,
            quotes: quotes,
            optimalQuotes: {
                bid: asModel.optimalBid,
                ask: asModel.optimalAsk
            },
            pnl: this.player.getPnL(currentPrice),
            inventory: this.player.inventory,
            spread: this.player.halfSpread * 2,
            skew: this.player.skew,
            isQuoting: this.player.isQuoting,
            trader: null,
            fill: null,
            timeLeft: (this.maxTicks - this.tick) * CONFIG.TICK_INTERVAL_MS / 1000,
        };
    }

    start() {
        this.state = 'running';
        this.intervalId = setInterval(() => {
            const snapshot = this.update();
            if (this.onTickCallback) {
                this.onTickCallback(snapshot);
            }
        }, CONFIG.TICK_INTERVAL_MS);
    }

    stop() {
        this.state = 'finished';
        clearInterval(this.intervalId);
    }

    reset() {
        this.stop();
        this.priceEngine = new PriceEngine();
        this.player = new Player();
        this.orderBook = new OrderBook();
        this.tick = 0;
        this.state = 'waiting';
    }

    // Controls
    widenSpread() { this.player.widenSpread(); }
    tightenSpread() { this.player.tightenSpread(); }
    skewUp() { this.player.skewUp(); }
    skewDown() { this.player.skewDown(); }
    toggleQuotes() { this.player.toggleQuotes(); }
}
