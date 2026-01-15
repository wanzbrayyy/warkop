const Expense = require('../models/expense');
const DailyReport = require('../models/dailyReport');
const { getShiftDate } = require('../utils/shiftHelper');

exports.addExpense = async (req, res) => {
    try {
        const { description, amount } = req.body;
        const shiftDate = getShiftDate();
        const userId = req.userId;

        const expense = new Expense({ description, amount, shiftDate, userId });
        await expense.save();

        const report = await DailyReport.findOneAndUpdate(
            { shiftDate, userId },
            { 
                $inc: { totalExpenses: amount, netIncome: -amount },
                $set: { lastUpdatedAt: new Date() }
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, message: 'Pengeluaran dicatat', report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDashboardData = async (req, res) => {
    try {
        const shiftDate = getShiftDate();
        const userId = req.userId;
        
        const report = await DailyReport.findOne({ shiftDate, userId });

        if (!report) {
            return res.json({
                shiftDate, userId, totalRevenue: 0, totalExpenses: 0,
                netIncome: 0, transactionCount: 0
            });
        }
        
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
