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

// Kamus singkatan Warkop (tambahkan sesuai kebutuhan)
const warkopDictionary = {
    's.': 'Susu', 's': 'Susu', 'freez': 'Freeze', 'frez': 'Freeze',
    'kp': 'Kopi', 'htm': 'Hitam', 'itm': 'Hitam',
    'teh': 'Teh', 'mns': 'Manis', 't': 'Teh',
    'gr': 'Goreng', 'grg': 'Goreng',
    'ind': 'Indomie', 'mg': 'Mie Goreng',
    'rb': 'Rebus', 'tlr': 'Telur'
};

const normalizeProduct = (text) => {
    // Hapus karakter aneh dari nama produk
    const cleanText = text.replace(/[^a-zA-Z0-9\s.]/g, ''); 
    const words = cleanText.toLowerCase().split(/\s+/);
    
    const normalized = words.map(w => warkopDictionary[w] || w);
    return normalized.join(' ').replace(/\b\w/g, l => l.toUpperCase());
};

exports.processImage = async (req, res) => {
    let worker;
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada gambar diupload' });

        console.log(chalk.yellow('1. Mengoptimalkan Gambar (Jimp)...'));

        // PRE-PROCESSING: Resize & Contrast (Kunci Kecepatan & Akurasi)
        const image = await Jimp.read(req.file.buffer);
        image
            .resize(800, Jimp.AUTO) // Perkecil gambar (Speed Booster)
            .greyscale()            // Hapus warna (biar fokus ke teks)
            .contrast(0.5)          // Perjelas tulisan hitam
            .normalize();           // Ratakan pencahayaan

        const processedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        console.log(chalk.yellow('2. Memulai OCR Tesseract...'));

        worker = await Tesseract.createWorker('eng');
        
        // Whitelist: Hanya izinkan angka, huruf, dan simbol dasar untuk mengurangi sampah
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/- VvXx',
        });

        const ocrPromise = worker.recognize(processedBuffer);

        // Upload gambar asli ke R2 (Background process)
        const fileName = `scan_${Date.now()}.jpg`;
        const uploadParams = { Bucket: 'wanzofc', Key: fileName, Body: req.file.buffer, ContentType: 'image/jpeg' };
        const uploadPromise = r2.send(new PutObjectCommand(uploadParams));

        const [{ data: { text } }] = await Promise.all([ocrPromise, uploadPromise]);
        
        console.log(chalk.cyan('Raw Text Bersih:\n', text));

        // FILTERING & PARSING
        const lines = text.split('\n');
        const parsedItems = [];
        let total = 0;

        // Kata kunci sampah yang harus diabaikan (Header Tabel)
        const ignoreWords = ['banyaknya', 'nama', 'barang', 'harga', 'jumlah', 'nota', 'tuan', 'toko', 'shift'];

        lines.forEach(line => {
            // 1. Bersihkan garis tabel (| _ —) menjadi spasi
            let cleanLine = line.replace(/[|_\—\[\]\{\}]/g, ' ').trim();
            
            // 2. Skip jika baris terlalu pendek atau berisi header
            if (cleanLine.length < 5) return;
            if (ignoreWords.some(w => cleanLine.toLowerCase().includes(w))) return;

            // 3. Pecah menjadi kata
            const words = cleanLine.split(/\s+/);

            // Logika Deteksi:
            // Biasanya format: [QTY] [NAMA PRODUK...] [HARGA] [STATUS]
            
            let qty = 1;
            let price = 0;
            let status = 'Belum';
            
            // Cek Qty (Angka di awal)
            if (!isNaN(parseFloat(words[0]))) {
                qty = parseInt(words[0]);
                words.shift(); // Hapus angka qty dari array
            }

            // Cek Status (Simbol di akhir: V, /, X)
            const lastWord = words[words.length - 1];
            if (['v', 'x', '/', 'ok'].includes(lastWord.toLowerCase())) {
                status = 'Lunas';
                words.pop();
            }

            // Cek Harga (Angka di akhir setelah status dibuang)
            const possiblePrice = words[words.length - 1];
            // Deteksi harga 10 artinya 10.000, 5 artinya 5.000
            if (!isNaN(parseFloat(possiblePrice))) {
                let rawPrice = parseFloat(possiblePrice);
                // Logika Warkop: Jika angka < 100, pasti ribuan (cth: 10 = 10.000)
                if (rawPrice < 100) rawPrice *= 1000; 
                
                price = rawPrice;
                words.pop();
            }

            // Sisanya adalah Nama Produk
            const productName = words.join(' ');

            // Simpan hanya jika ada nama produk dan (ada harga ATAU status lunas)
            if (productName.length > 2 && (price > 0 || status === 'Lunas')) {
                parsedItems.push({
                    qty: qty,
                    product: normalizeProduct(productName),
                    price: price,
                    status: status
                });
                total += qty * price;
            }
        });

        const newTrans = new Transaction({ items: parsedItems, totalAmount: total, originalImage: fileName });
        await newTrans.save();

        console.log(chalk.blue('✓ Hasil:', JSON.stringify(parsedItems)));

        res.json({ success: true, data: parsedItems, total: total, raw_text: text });

    } catch (error) {
        console.error(chalk.red('Error:', error));
        res.status(500).json({ error: 'Gagal proses: ' + error.message });
    } finally {
        if (worker) await worker.terminate();
    }
};
