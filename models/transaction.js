const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    items: [{
        qty: Number,
        product: String,
        price: Number,
        status: { type: String, enum: ['Lunas', 'Belum'] }
    }],
    totalAmount: Number,
    originalImage: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('transaction', transactionSchema);
