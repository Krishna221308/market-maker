export class OrderBook {
    constructor() {
        this.playerBid = null;    // { price, maxQuantity }
        this.playerAsk = null;    // { price, maxQuantity }
        this.fillLog = [];        // record of all fills
    }

    updatePlayerQuotes(bid, ask) {
        this.playerBid = bid !== null ? { price: bid } : null;
        this.playerAsk = ask !== null ? { price: ask } : null;
    }

    processIncomingOrder(order, tick) {
        if (order.side === 'buy') {
            if (this.playerAsk === null) return null;
            const fillPrice = this.playerAsk.price;
            const fillQty = order.quantity;
            const fill = { side: 'sell', price: fillPrice, quantity: fillQty };
            this.fillLog.push({ tick, side: 'sell', price: fillPrice, quantity: fillQty, traderType: order.traderType });
            return fill;
        } else if (order.side === 'sell') {
            if (this.playerBid === null) return null;
            const fillPrice = this.playerBid.price;
            const fillQty = order.quantity;
            const fill = { side: 'buy', price: fillPrice, quantity: fillQty };
            this.fillLog.push({ tick, side: 'buy', price: fillPrice, quantity: fillQty, traderType: order.traderType });
            return fill;
        }
        return null;
    }
}
