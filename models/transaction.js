const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    shift: { type: String, default: 'Tidak Diketahui' },
    notaNo: { type: String, default: 'Tidak Diketahui' },
    items: [{
        qty: Number,
        product: String,
        price: Number,
        paymentMethod: { 
            type: String, 
            enum: ['Cash', 'QRIS', 'Belum Bayar'],
            default: 'Belum Bayar'
        }
    }],
    totalAmount: Number,
    totalQty: Number,
    originalImage: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.transaction || mongoose.model('transaction', transactionSchema);
