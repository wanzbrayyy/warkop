const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'rahasia_warkop_arum_123'; 

exports.register = async (req, res) => {
    try {
        const { nama, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ nama, email, password: hashedPassword });
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Password salah' });

        const token = jwt.sign({ id: user._id }, JWT_SECRET);
        res.json({ success: true, token, user: { nama: user.nama, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
