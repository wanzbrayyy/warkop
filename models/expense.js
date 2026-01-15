const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    shiftDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.expense || mongoose.model('expense', expenseSchema);
