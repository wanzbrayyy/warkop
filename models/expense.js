const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    shiftDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('expense', expenseSchema);
