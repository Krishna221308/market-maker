import { CONFIG } from './config.js';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shouldTraderArrive() {
    return Math.random() < CONFIG.ARRIVAL_RATE;
}

export function generateNoiseTrader() {
    const side = Math.random() < 0.5 ? 'buy' : 'sell';
    const quantity = randomInt(CONFIG.ORDER_SIZE_MIN, CONFIG.ORDER_SIZE_MAX);
    return { side, quantity, type: 'market', traderType: 'noise' };
}

export function generateInformedTrader(priceEngine, currentTick) {
    const upcomingJumps = priceEngine.getUpcomingJumps(
        currentTick,
        CONFIG.INFORMED_LOOKAHEAD_TICKS
    );

    const biggestJump = upcomingJumps.reduce((max, j) =>
        Math.abs(j.size) > Math.abs(max.size) ? j : max,
        { size: 0 }
    );

    if (Math.abs(biggestJump.size) < CONFIG.INFORMED_THRESHOLD) {
        return generateNoiseTrader();
    }

    if (Math.random() > CONFIG.INFORMED_AGGRESSION) {
        return null;
    }

    const side = biggestJump.size > 0 ? 'buy' : 'sell';
    const quantity = randomInt(
        CONFIG.ORDER_SIZE_MAX * 0.5,
        CONFIG.ORDER_SIZE_MAX
    );

    return {
        side,
        quantity,
        type: 'market',
        traderType: 'informed'
    };
}

export function generateTrader(priceEngine, tick) {
    if (!shouldTraderArrive()) return null;

    if (CONFIG.INFORMED_RATIO > 0 && Math.random() < CONFIG.INFORMED_RATIO) {
        return generateInformedTrader(priceEngine, tick);
    }

    return generateNoiseTrader();
}
