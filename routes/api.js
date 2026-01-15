const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const ocrController = require('../controllers/ocrController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/scan', auth, upload.single('image'), ocrController.processImage);
router.get('/dashboard', auth, dashboardController.getDashboardData);
router.post('/expense', auth, dashboardController.addExpense);

module.exports = router;
