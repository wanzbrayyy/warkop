const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nama: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'karyawan' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('user', userSchema);
