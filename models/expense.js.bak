const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    shiftDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('expense', expenseSchema);
EOF```

### 4. Update Model `dailyReport.js`
Menambahkan `userId`. Sekarang setiap user akan punya laporan hariannya sendiri.

```bash
cat > models/dailyReport.js <<'EOF'
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

module.exports = mongoose.model('dailyReport', dailyReportSchema);
