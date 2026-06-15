import { CONFIG } from './config.js';

/**
 * Returns a standard normal Z ~ N(0,1) using the Box-Muller transform.
 */
export function gaussianRandom() {
    let u1 = Math.random();
    let u2 = Math.random();
    
    // Ensure u1 is not exactly 0 to avoid ln(0)
    while (u1 === 0) u1 = Math.random();
    
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Geometric Brownian Motion (GBM) step function.
 */
export function gbmStep(currentPrice, mu, sigma, dt) {
    const z = gaussianRandom();
    return currentPrice * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
}

/**
 * PriceEngine tracks the simulated asset's price.
 */
export class PriceEngine {
    constructor() {
        this.price = CONFIG.INITIAL_PRICE;
        this.history = [CONFIG.INITIAL_PRICE];
        this.tick = 0;
        
        // Pre-generate next N ticks of jump events for informed trader lookahead
        this.jumpBuffer = [];
        
        // As per 6.3 preview, pre-generating jumps for the lookahead buffer
        // Note: For a 60s game at 500ms, maxTicks is 120.
        const maxTicks = CONFIG.GAME_DURATION_SEC * (1000 / CONFIG.TICK_INTERVAL_MS);
        this.jumpEvents = [];
        for (let t = 0; t < maxTicks; t++) {
            if (CONFIG.JUMP_INTENSITY > 0 && Math.random() < CONFIG.JUMP_INTENSITY) {
                const size = CONFIG.JUMP_MEAN + CONFIG.JUMP_STD * gaussianRandom();
                this.jumpEvents.push({ tick: t, size });
            }
        }
    }

    step() {
        // dt = 1.0 for per-tick (since sigma is already per-tick)
        this.price = gbmStep(this.price, CONFIG.MU, CONFIG.SIGMA, 1.0);
        
        // Phase 2 placeholder: Add jump-diffusion stub
        // We will pull from pre-generated jump events for the current tick
        const jumpEvent = this.jumpEvents.find(j => j.tick === this.tick);
        if (jumpEvent) {
            this.price *= (1 + jumpEvent.size);
        }

        this.history.push(this.price);
        this.tick++;
        
        return this.price;
    }

    getPrice() {
        return this.price;
    }

    getHistory() {
        return this.history;
    }
    
    getUpcomingJumps(currentTick, lookahead) {
        return this.jumpEvents.filter(j =>
            j.tick > currentTick && j.tick <= currentTick + lookahead
        );
    }
}
