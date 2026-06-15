import { CONFIG } from './config.js';

function round2(x) {
    return Math.round(x * 100) / 100;
}

function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
    if (arr.length <= 1) return 0;
    const m = mean(arr);
    return arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
}

export function calculateScore(player, finalPrice) {
    const pnl = player.getPnL(finalPrice);
    
    // Raw PnL
    const rawPnL = pnl.total;

    // Inventory penalty: punish holding risk at end of game
    // This incentivizes the player to flatten their position before time runs out
    const inventoryPenalty = CONFIG.INVENTORY_PENALTY_LAMBDA
        * Math.abs(player.inventory)
        * finalPrice
        / 100;  // scale factor

    // Final score
    const finalScore = rawPnL - inventoryPenalty;

    // Track inventory at each tick
    const inventoryTimeSeries = player.trades.map(t => t.inventoryAfter);
    const avgInventory = mean(inventoryTimeSeries);
    const inventoryVariance = variance(inventoryTimeSeries);

    // Sharpe-like: excess return per unit of risk taken
    const riskAdjustedScore = rawPnL / Math.sqrt(inventoryVariance + 1);

    // Achievements
    const achievements = [];
    if (player.inventory === 0) achievements.push("Flat Finish");
    if (!player.everPulledQuotes) achievements.push("Iron Hands");
    if (player.trades.length >= 50) achievements.push("Scalper");
    if (player.spreadSnapshots.length > 0) {
        const avgSpread = mean(player.spreadSnapshots);
        if (avgSpread < 0.30) achievements.push("Tight Ship");
    }

    return {
        rawPnL: round2(rawPnL),
        inventoryPenalty: round2(inventoryPenalty),
        finalInventory: player.inventory,
        totalTrades: player.trades.length,
        finalScore: round2(finalScore),
        riskAdjustedScore: round2(riskAdjustedScore),
        achievements
    };
}
