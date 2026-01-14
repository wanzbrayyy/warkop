const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');
const authController = require('../controllers/authController');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } 
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/scan', upload.single('image'), ocrController.processImage);

router.get('/ping', (req, res) => res.json({ message: 'Warkop R2 Backend Online' }));

module.exports = router;
