const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } 
});

// Auth Routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// OCR Route
router.post('/scan', upload.single('image'), ocrController.processImage);

// Dashboard & Expense Routes
router.get('/dashboard', dashboardController.getDashboardData);
router.post('/expense', dashboardController.addExpense);

module.exports = router;
