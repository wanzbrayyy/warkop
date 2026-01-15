const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
    shiftDate: { type: Date, unique: true, required: true },
    totalRevenue: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netIncome: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('dailyReport', dailyReportSchema);
