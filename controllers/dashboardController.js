const Expense = require('../models/expense');
const DailyReport = require('../models/dailyReport');
const { getShiftDate } = require('../utils/shiftHelper');

exports.addExpense = async (req, res) => {
    try {
        const { description, amount } = req.body;
        if (!description || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Deskripsi dan jumlah harus valid.' });
        }

        const shiftDate = getShiftDate();

        const expense = new Expense({ description, amount, shiftDate });
        await expense.save();

        const report = await DailyReport.findOneAndUpdate(
            { shiftDate },
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
        
        const report = await DailyReport.findOne({ shiftDate });

        if (!report) {
            return res.json({
                shiftDate,
                totalRevenue: 0,
                totalExpenses: 0,
                netIncome: 0,
                transactionCount: 0,
            });
        }
        
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
