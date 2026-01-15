const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const chalk = require('chalk');
const Transaction = require('../models/transaction');
const path = require('path');
const Jimp = require('jimp');
const axios = require('axios');

const r2 = new S3Client({
    region: 'auto',
    endpoint: 'https://ec786e5c4cd0818807637b34da897d76.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: "e7ae1b337e897bac0cf15ab7c02f297e",
        secretAccessKey: "678c88269339ab870b2e74724447a770394228bbf502ab8a7b93481dba286906"
    }
});

const OPENROUTER_API_KEY = "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";

async function analyzeTextWithAI(rawText) {
    const prompt = `
        You are an expert data entry assistant for a coffee shop.
        Analyze the following messy text from a handwritten receipt and convert it into a clean JSON array of objects.
        Each object must have these keys: "qty", "product", "price", "status".

        RULES:
        1. Perbaiki kesalahan ketik dan singkatan. 'kp htm' adalah 'Kopi Hitam', 's frez' atau 'oktwz' adalah 'Susu Freeze, pokonya lihat saja dibagian nama produk atau nama barang, wajib terbaca dengan jelas dan ditulis yang sesuai'.
        2. Jika kuantitas berupa huruf seperti 'I' atau 'l', maka nilainya adalah 1. Jika tidak ada, anggap saja nilainya 1.
        3. LOGIKA HARGA: Angka seperti '1' 1000, '2" 2000 "3" 3000, "4" 4000 dan seterusnya j'10' di kolom harga berarti '10000'. Kalikan harga apa pun yang kurang dari 100 dengan 1000. jika 100 =100.000 tinggal atur dari 1 sampai seterusnya paham?
        4. LOGIKA STATUS: Tanda centang (✓), garis miring (/), atau 'x' berarti statusnya adalah 'Lunas'. Jika tidak, 'Belum, jika belum diisi atau kolom harga nya kosong belum di centang = belum lunas, dan jika bukan centang tapi ada bacaan QR, QRIS, RIS DAN SETERUSNYA BERARTI ITU MENGGUNAKAN METODE PEMBAYARAN QRIS, JIKA CENTANG ITU UANG CASH'
        5. tuliskan juga header  dan shift shift dll relevan seperti 'NOTA', 'NAMA BARANG', atau simbol yang campur aduk.
        6. Output akhir Anda hanya boleh berupa array JSON itu sendiri, tanpa teks tambahan atau markdown apa pun.

        MESSY TEXT:
        "${rawText}"

        JSON OUTPUT:
    `;

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "xiaomi/mimo-v2-flash:free",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://warkop.app',
                'X-Title': 'Warkop Kasir AI'
            }
        });
        
        let content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/(\[[\s\S]*\])/);

        if (jsonMatch && jsonMatch[0]) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("AI did not return a valid JSON array.");
        
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(chalk.red('OpenRouter AI Error:', errorMessage));
        throw new Error("Failed to analyze text with AI.");
    }
}


exports.processImage = async (req, res) => {
    let worker;
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada gambar diupload' });

        console.log(chalk.yellow('1. Optimasi Gambar...'));
        const image = await Jimp.read(req.file.buffer);
        image.resize(1000, Jimp.AUTO).greyscale().contrast(0.5).posterize(2);
        const processedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
        
        console.log(chalk.yellow('2. Ekstraksi Teks (Tesseract)...'));
        worker = await Tesseract.createWorker('eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();

        console.log(chalk.cyan('Raw Text:\n', text));
        console.log(chalk.yellow('3. Menganalisa dengan AI...'));

        const parsedItems = await analyzeTextWithAI(text);
        
        const total = parsedItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
        
        const fileName = `scan_${Date.now()}.jpg`;
        const uploadParams = { Bucket: 'wanzofc', Key: fileName, Body: req.file.buffer, ContentType: 'image/jpeg' };
        await r2.send(new PutObjectCommand(uploadParams));

        const newTrans = new Transaction({ items: parsedItems, totalAmount: total, originalImage: fileName });
        await newTrans.save();

        console.log(chalk.blue('✓ Hasil dari AI:', JSON.stringify(parsedItems)));

        res.json({ success: true, data: parsedItems, total: total, imageId: fileName, raw_text: text });

    } catch (error) {
        console.error(chalk.red('System Error:', error));
        res.status(500).json({ error: error.message });
    }
};
