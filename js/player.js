import { CONFIG } from './config.js';

function round2(x) {
    return Math.round(x * 100) / 100;
}

export class Player {
    constructor() {
        this.cash = CONFIG.INITIAL_CASH;        // realized cash from trades
        this.inventory = CONFIG.INITIAL_INVENTORY;  // shares held (+ = long, - = short)
        this.halfSpread = CONFIG.DEFAULT_SPREAD;    // distance from mid to bid/ask
        this.skew = 0.0;                            // asymmetric shift (+ = bid closer to mid)
        this.isQuoting = true;                      // whether quotes are live
        this.trades = [];                           // log of all fills
    }

    getQuotes(midPrice) {
        if (!this.isQuoting) return { bid: null, ask: null };
        const bid = midPrice - this.halfSpread + this.skew;
        const ask = midPrice + this.halfSpread + this.skew;
        return { bid: round2(bid), ask: round2(ask) };
    }

    onFill(tick, side, price, quantity) {
        if (side === 'buy') {
            this.cash -= price * quantity;
            this.inventory += quantity;
        } else if (side === 'sell') {
            this.cash += price * quantity;
            this.inventory -= quantity;
        }
        
        this.trades.push({
            tick,
            side,
            price,
            quantity,
            inventoryAfter: this.inventory
        });
    }

    getPnL(currentMidPrice) {
        const markToMarket = this.inventory * currentMidPrice;
        const totalPnL = this.cash + markToMarket;
        return {
            realized: this.cash,
            unrealized: markToMarket,
            total: totalPnL
        };
    }

    widenSpread() {
        this.halfSpread += CONFIG.SPREAD_STEP;
    }

    tightenSpread() {
        this.halfSpread = Math.max(0.01, this.halfSpread - CONFIG.SPREAD_STEP);
    }

    skewUp() {
        this.skew += CONFIG.SKEW_STEP;
    }

    skewDown() {
        this.skew -= CONFIG.SKEW_STEP;
    }

    toggleQuotes() {
        this.isQuoting = !this.isQuoting;
    }

    checkInventoryLimit() {
        if (Math.abs(this.inventory) >= CONFIG.MAX_INVENTORY) {
            this.isQuoting = false;
        }
    }
}
