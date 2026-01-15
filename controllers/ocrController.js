
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Tesseract = require('tesseract.js');
const chalk = require('chalk');
const Transaction = require('../models/transaction');
const DailyReport = require('../models/dailyReport');
const path = require('path');
const Jimp = require('jimp');
const axios = require('axios');
const { getShiftDate } = require('../utils/shiftHelper');

const r2 = new S3Client({ region: 'auto', endpoint: 'https://ec786e5c4cd0818807637b34da897d76.r2.cloudflarestorage.com', credentials: { accessKeyId: "e7ae1b337e897bac0cf15ab7c02f297e", secretAccessKey: "678c88269339ab870b2e74724447a770394228bbf502ab8a7b93481dba286906" }});
const OPENROUTER_API_KEY = "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";

async function analyzeTextWithAI(rawText) {
    const prompt = `
        You are a highly precise data extraction AI. Analyze the messy text from a receipt and convert it into a clean JSON object.

        The final JSON object MUST have this structure:
        {"shift": "string", "notaNo": "string", "items": [{"qty": number, "product": "string", "price": number, "paymentMethod": "string ('Cash'/'QRIS'/'Belum Bayar')"}]}
        
        **CRITICAL RULES:**
        1. **FIND THE TABLE:** First, identify the item table by looking for headers like 'Banyaknya', 'Nama Barang', 'Harga', 'Jumlah'.
        2. **EXTRACT FROM COLUMNS:** For each row under these headers, extract data strictly from its corresponding column.
        3. **NO HALLUCINATION:** Do NOT invent items. If a line is garbled or clearly not an item (e.g., 'vevveesearaessessszsazzares'), IGNORE IT. If you see 4 items written, the JSON array must have exactly 4 items.
        4. **QUANTITY (Banyaknya):** Extract from the first column. If it's a letter like 'I' or 'l', it is 1. If missing, assume 1.
        5. **PRODUCT (Nama Barang):** Extract from the second column. Correct obvious spelling errors.
        6. **PRICE (Harga):** Extract from the third column. '10' means 10000. Any number under 100 is multiplied by 1000.
        7. **PAYMENT (Jumlah):** Extract from the fourth column. A checkmark (✓, v, vv, ww, x) implies "Cash". If you see "QR" or "QRIS", it's "QRIS". If this column is empty, it's "Belum Bayar".
        8. **HEADER EXTRACTION:** Extract header info like 'shift' and 'nota no'.
        9. **CLEAN OUTPUT:** Your final output MUST BE ONLY the JSON object. No extra text.

        MESSY TEXT TO ANALYZE:
        "${rawText}"

        JSON OUTPUT:
    `;

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "xiaomi/mimo-v2-flash:free",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://warkop.app', 'X-Title': 'Warkop Kasir AI' }
        });
        
        let content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) return JSON.parse(jsonMatch[0]);
        throw new Error("AI did not return a valid JSON object.");
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        throw new Error(`AI analysis failed: ${errorMessage}`);
    }
}

exports.processImage = async (req, res) => {
    let worker;
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada gambar diupload' });
        
        const image = await Jimp.read(req.file.buffer);
        image.resize(1000, Jimp.AUTO).greyscale().contrast(0.5).posterize(2);
        const processedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
        
        worker = await Tesseract.createWorker('eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        
        const aiResult = await analyzeTextWithAI(text);
        
        const totalAmount = aiResult.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const totalQty = aiResult.items.reduce((sum, item) => sum + item.qty, 0);
        const shiftDate = getShiftDate();
        const userId = req.userId;
        
        const fileName = `scan_${Date.now()}.jpg`;
        await r2.send(new PutObjectCommand({ Bucket: 'wanzofc', Key: fileName, Body: req.file.buffer, ContentType: 'image/jpeg' }));

        const newTrans = new Transaction({
            userId, shift: aiResult.shift, notaNo: aiResult.notaNo,
            items: aiResult.items, totalAmount, totalQty,
            originalImage: fileName, createdAt: new Date()
        });
        await newTrans.save();

        await DailyReport.findOneAndUpdate(
            { shiftDate, userId },
            { $inc: { totalRevenue: totalAmount, netIncome: totalAmount, transactionCount: 1 }, $set: { lastUpdatedAt: new Date() } },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: aiResult.items, total: totalAmount, raw_text: text });
    } catch (error) {
        console.error(chalk.red('System Error:', error));
        res.status(500).json({ error: error.message });
    } finally {
        if (worker) await worker.terminate();
    }
};