const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chalk = require('chalk');
const apiRoutes = require('./routes/api');
const app = express();

// Konfigurasi CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// URI Mongo
const MONGO_URI = "mongodb+srv://maverickuniverse405:1m8MIgmKfK2QwBNe@cluster0.il8d4jx.mongodb.net/warkop?appName=Cluster0&retryWrites=true&w=majority";

// Fungsi Koneksi Database
const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            console.log(chalk.green('✓ Menggunakan koneksi database yang sudah ada.'));
            return;
        }

        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            family: 4 // WAJIB: Memaksa IPv4
        });

        console.log(chalk.green.bold('✓ Database MongoDB Terhubung (IPv4 Mode)'));
    } catch (err) {
        console.error(chalk.red.bold('X Gagal Konek Database:'), err.message);
    }
};

connectDB();

app.use(async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        await connectDB();
    }
    next();
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => res.send('Warkop Backend is Running...'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(chalk.blue.bold(`✓ Server berjalan di port ${PORT}`));
});

module.exports = app;
