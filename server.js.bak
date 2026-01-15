const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chalk = require('chalk');
const apiRoutes = require('./routes/api');
const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGO_URI = "mongodb+srv://maverickuniverse405:1m8MIgmKfK2QwBNe@cluster0.il8d4jx.mongodb.net/warkop?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log(chalk.green.bold('✓ MongoDB Connected')))
    .catch(err => console.log(chalk.red.bold('X MongoDB Error:'), err));

app.use('/api', apiRoutes);

app.get('/', (req, res) => res.send('Warkop Backend (R2 Storage) is Running...'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(chalk.blue.bold(`✓ Server listening on port ${PORT}`));
});

module.exports = app;
