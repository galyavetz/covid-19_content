require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const nodemailer = require('nodemailer');

const { EMAIL_USER, EMAIL_PASS, EMAIL_TO, MY_PHONE } = process.env;

if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.error('חסרות הגדרות. צור קובץ .env לפי .env.example');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

async function sendEmail(from, body, timestamp) {
    const date = new Date(timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const shortPreview = body.length > 60 ? body.substring(0, 60) + '...' : body;

    await transporter.sendMail({
        from: `"WhatsApp Bot" <${EMAIL_USER}>`,
        to: EMAIL_TO,
        subject: `📩 וואטסאפ מ-${from}: ${shortPreview}`,
        text: `הודעה חדשה\n\nשולח: ${from}\nזמן: ${date}\n\n${body}`,
        html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #25D366;">📩 הודעת וואטסאפ</h2>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr><td style="padding: 6px; font-weight: bold;">שולח:</td><td style="padding: 6px;">${from}</td></tr>
                    <tr><td style="padding: 6px; font-weight: bold;">זמן:</td><td style="padding: 6px;">${date}</td></tr>
                </table>
                <div style="margin-top: 16px; padding: 12px; background: #f0f0f0; border-radius: 8px; white-space: pre-wrap;">${body}</div>
            </div>
        `
    });
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    console.log('\nסרוק את קוד ה-QR הבא עם אפליקציית וואטסאפ שלך:');
    console.log('וואטסאפ → הגדרות → מכשירים מקושרים → קשר מכשיר\n');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('✅ מחובר לוואטסאפ!');
});

client.on('ready', () => {
    console.log('🤖 הבוט פועל ומחכה להודעות...');
    console.log(`📧 הודעות יועברו אל: ${EMAIL_TO}`);
    if (MY_PHONE) console.log(`📱 מסנן: רק הודעות ממספר ${MY_PHONE}`);
    else console.log('📱 מסנן: כל ההודעות הנכנסות');
});

client.on('message', async (msg) => {
    if (msg.fromMe && !isMessageToMyself(msg)) return;

    const sender = msg.from.replace('@c.us', '').replace('@g.us', '');

    if (MY_PHONE && sender !== MY_PHONE) return;

    if (!msg.body) return;

    try {
        await sendEmail(sender, msg.body, msg.timestamp * 1000);
        console.log(`✉️  מייל נשלח עבור הודעה מ-${sender}`);
    } catch (err) {
        console.error(`❌ שגיאה בשליחת מייל:`, err.message);
    }
});

client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    if (!isMessageToMyself(msg)) return;
    if (!msg.body) return;

    const myNumber = client.info?.wid?.user || 'me';

    try {
        await sendEmail(`אני (${myNumber})`, msg.body, msg.timestamp * 1000);
        console.log(`✉️  מייל נשלח עבור הודעה שהוקלדה לעצמי`);
    } catch (err) {
        console.error(`❌ שגיאה בשליחת מייל:`, err.message);
    }
});

function isMessageToMyself(msg) {
    if (!client.info?.wid) return false;
    return msg.to === client.info.wid._serialized;
}

client.on('disconnected', (reason) => {
    console.log('🔌 הבוט התנתק:', reason);
    process.exit(1);
});

client.initialize();
