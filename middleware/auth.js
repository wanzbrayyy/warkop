const jwt = require('jsonwebtoken');
const JWT_SECRET = 'rahasia_warkop_arum_123';

module.exports = function(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ error: 'Akses ditolak. Tidak ada token.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (ex) {
        res.status(400).json({ error: 'Token tidak valid.' });
    }
};
