const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    shiftDate: { type: Date, required: true },
    totalRevenue: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netIncome: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now }
});

dailyReportSchema.index({ shiftDate: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.dailyReport || mongoose.model('dailyReport', dailyReportSchema);
