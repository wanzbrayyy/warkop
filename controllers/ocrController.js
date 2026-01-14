const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const chalk = require('chalk');
const Transaction = require('../models/transaction');
const path = require('path');

const r2 = new S3Client({
    region: 'auto',
    endpoint: 'https://ec786e5c4cd0818807637b34da897d76.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: "e7ae1b337e897bac0cf15ab7c02f297e",
        secretAccessKey: "678c88269339ab870b2e74724447a770394228bbf502ab8a7b93481dba286906"
    }
});

const warkopDictionary = {
    'kp': 'Kopi Hitam', 'kpi': 'Kopi Hitam', 'kopi': 'Kopi Hitam',
    'susu': 'Susu Putih', 'su': 'Susu Putih',
    'js': 'Jos Susu', 'jos': 'Jos Susu', 'joss': 'Jos Susu',
    'kb': 'Kuku Bima', 'kuku': 'Kuku Bima',
    'ind': 'Indomie', 'mie': 'Indomie',
    'grg': 'Goreng', 'rb': 'Rebus',
    'rt': 'Roti Bakar', 'roti': 'Roti Bakar',
    'th': 'Teh Manis', 'teh': 'Teh Manis',
    'es': 'Es Batu'
};

const normalizeProduct = (text) => {
    const words = text.toLowerCase().split(' ');
    const normalized = words.map(w => warkopDictionary[w] || w);
    return normalized.join(' ').replace(/\b\w/g, l => l.toUpperCase());
};

exports.processImage = async (req, res) => {
    let worker;
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada gambar diupload' });

        console.log(chalk.yellow('1. Memulai Proses OCR & Upload (Tesseract v5)...'));

        worker = await Tesseract.createWorker('eng');
        
        const ocrPromise = worker.recognize(req.file.buffer);

        const fileName = `scan_${Date.now()}_${path.extname(req.file.originalname)}`;
        const uploadParams = { Bucket: 'wanzofc', Key: fileName, Body: req.file.buffer, ContentType: req.file.mimetype };
        const uploadPromise = r2.send(new PutObjectCommand(uploadParams));

        const [{ data: { text } }, uploadResult] = await Promise.all([ocrPromise, uploadPromise]);
        
        console.log(chalk.green('✓ OCR & Upload Selesai:', fileName));

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const parsedItems = [];
        let total = 0;

        lines.forEach(line => {
            const match = line.match(/^(\d+)?\s*([a-zA-Z\s]+?)\s*(\d{3,})?\s*([vVxX✓]|$)/);
            
            if (match) {
                const qty = match[1] ? parseInt(match[1]) : 1;
                let rawProduct = match[2].trim();
                const price = match[3] ? parseInt(match[3]) : 0;
                const statusSymbol = match[4] ? match[4].toLowerCase() : '';
                const isPaid = ['v', 'x', '✓', 'ok'].includes(statusSymbol);
                const product = normalizeProduct(rawProduct);

                if (product.length > 2) { 
                    parsedItems.push({ qty, product, price, status: isPaid ? 'Lunas' : 'Belum' });
                    total += price;
                }
            }
        });

        const newTrans = new Transaction({ items: parsedItems, totalAmount: total, originalImage: fileName });
        await newTrans.save();

        res.json({ success: true, data: parsedItems, total: total, imageId: fileName, raw_text: text });

    } catch (error) {
        console.error(chalk.red('System Error:', error));
        res.status(500).json({ error: 'Gagal memproses transaksi' });
    } finally {
        if (worker) {
            await worker.terminate();
            console.log(chalk.magenta('Worker Terminated.'));
        }
    }
};
