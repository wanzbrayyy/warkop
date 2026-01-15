const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const chalk = require('chalk');
const Transaction = require('../models/transaction');
const path = require('path');
const Jimp = require('jimp');

const r2 = new S3Client({
    region: 'auto',
    endpoint: 'https://ec786e5c4cd0818807637b34da897d76.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: "e7ae1b337e897bac0cf15ab7c02f297e",
        secretAccessKey: "678c88269339ab870b2e74724447a770394228bbf502ab8a7b93481dba286906"
    }
});

// Kamus Koreksi Typo Warkop
const warkopDictionary = {
    'oktwz': 'S.Freeze', // Fix spesifik untuk kasus log mu
    'freez': 'Freeze', 'frez': 'Freeze',
    's.': 'Susu', 'kp': 'Kopi', 'htm': 'Hitam',
    'teh': 'Teh', 'mns': 'Manis', 'mg': 'Mie Goreng',
    'ind': 'Indomie', 'tlr': 'Telur'
};

const normalizeProduct = (text) => {
    let cleanText = text.replace(/[^a-zA-Z0-9\s.]/g, ''); 
    const words = cleanText.toLowerCase().split(/\s+/);
    const normalized = words.map(w => warkopDictionary[w] || w);
    return normalized.join(' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Fungsi Cerdas: Mengubah huruf mirip angka menjadi angka
const fuzzyNumber = (str) => {
    if (!str) return null;
    // Ubah I, l, i, O, o menjadi angka
    const clean = str.replace(/[Ili|]/g, '1').replace(/[Oo]/g, '0').replace(/[S]/g, '5');
    const parsed = parseInt(clean);
    return isNaN(parsed) ? null : parsed;
};

// Fungsi Cerdas: Deteksi Status Lunas (V, W, checklist)
const fuzzyStatus = (str) => {
    if (!str) return false;
    const s = str.toLowerCase();
    return ['v', 'x', 'w', 'ww', 'vv', 'ok', '/', '\'].some(k => s.includes(k));
};

exports.processImage = async (req, res) => {
    let worker;
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada gambar diupload' });

        console.log(chalk.yellow('1. Optimasi Gambar (Binarization Mode)...'));

        // TEKNIK BARU: Thresholding (Ubah jadi Hitam Putih Pekat)
        const image = await Jimp.read(req.file.buffer);
        image
            .resize(1000, Jimp.AUTO) // Resolusi sedikit dinaikkan
            .greyscale()
            .contrast(0.8)           // Kontras tinggi
            .brightness(0.1)
            .posterize(2);           // Paksa jadi 2 warna saja (Hitam & Putih)

        const processedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        console.log(chalk.yellow('2. Memulai OCR Tesseract (Mode Loose)...'));

        worker = await Tesseract.createWorker('eng');
        
        // Setting OCR: PSM 6 (Assume single uniform block of text) bagus untuk tabel
        await worker.setParameters({
            tessedit_char_whitelist: '', // Jangan dibatasi, biar huruf aneh tetap terbaca lalu kita filter manual
            tessedit_pageseg_mode: '6'   
        });

        const ocrPromise = worker.recognize(processedBuffer);
        
        // Upload R2
        const fileName = `scan_${Date.now()}.jpg`;
        const uploadParams = { Bucket: 'wanzofc', Key: fileName, Body: req.file.buffer, ContentType: 'image/jpeg' };
        const uploadPromise = r2.send(new PutObjectCommand(uploadParams));

        const [{ data: { text } }] = await Promise.all([ocrPromise, uploadPromise]);
        
        console.log(chalk.cyan('Raw Text:\n', text));

        const lines = text.split('\n');
        const parsedItems = [];
        let total = 0;

        lines.forEach(line => {
            // Bersihkan sampah visual
            let cleanLine = line.replace(/[—_\[\]\{\}]/g, ' ').trim();
            if (cleanLine.length < 3) return;

            const words = cleanLine.split(/\s+/);
            if (words.length < 2) return;

            // --- LOGIKA PARSING BARU (TOLERANSI TINGGI) ---
            
            // 1. Deteksi QTY (Kata pertama)
            // Cek apakah kata pertama mirip angka (contoh: 'I' atau '1' atau 'l')
            let qty = fuzzyNumber(words[0]);
            
            if (qty !== null) {
                // Jika kata pertama adalah angka, hapus dari array kata
                words.shift(); 
            } else {
                // Jika tidak ada angka, default 1
                qty = 1;
            }

            // 2. Deteksi STATUS (Kata terakhir)
            let status = 'Belum';
            const lastWord = words[words.length - 1];
            
            if (fuzzyStatus(lastWord)) {
                status = 'Lunas';
                words.pop(); // Hapus simbol status
            }

            // 3. Deteksi HARGA (Kata paling belakang sekarang)
            let price = 0;
            const lastWordNow = words[words.length - 1];
            const parsedPrice = fuzzyNumber(lastWordNow);

            if (parsedPrice !== null) {
                let rawPrice = parsedPrice;
                // Logika Warkop: "10" = 10.000, "5" = 5.000
                if (rawPrice < 100) rawPrice *= 1000;
                
                price = rawPrice;
                words.pop(); // Hapus harga dari nama produk
            }

            // 4. Sisa kata adalah NAMA PRODUK
            const productName = normalizeProduct(words.join(' '));

            // Validasi akhir: Harus ada nama produk
            // Dan (ada harga ATAU status lunas ATAU qty > 0)
            if (productName.length > 2) {
                parsedItems.push({
                    qty: qty,
                    product: productName,
                    price: price,
                    status: status
                });
                total += qty * price;
            }
        });

        const newTrans = new Transaction({ items: parsedItems, totalAmount: total, originalImage: fileName });
        await newTrans.save();

        console.log(chalk.blue('✓ Hasil Akhir:', JSON.stringify(parsedItems)));

        res.json({ success: true, data: parsedItems, total: total, raw_text: text });

    } catch (error) {
        console.error(chalk.red('Error:', error));
        res.status(500).json({ error: 'Gagal: ' + error.message });
    } finally {
        if (worker) await worker.terminate();
    }
};
