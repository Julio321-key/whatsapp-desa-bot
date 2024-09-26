const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

let usersState = {};
let desaImage;

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "client-one",
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions'],
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR code terdeteksi, silakan scan.');
});

client.on('authenticated', () => {
    logger.info('Autentikasi berhasil');
});

client.on('auth_failure', (message) => {
    logger.error('Autentikasi gagal:', message);
    const sessionPath = path.join(__dirname, '.wwebjs_auth', 'client-one');
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info('Sesi lokal dihapus karena autentikasi gagal.');
    }
    logger.info('Inisialisasi ulang untuk mendapatkan QR code baru.');
    client.initialize();
});

client.on('disconnected', (reason) => {
    logger.warn('Client terputus:', reason);
    setTimeout(() => {
        logger.info('Mencoba menghubungkan kembali...');
        client.initialize();
    }, 5000); // Tunggu 5 detik sebelum mencoba menghubungkan kembali
});

client.on('ready', () => {
    logger.info('Bot siap untuk digunakan.');
    const imagePath = path.join(__dirname, 'images', 'desa.jpg');
    if (fs.existsSync(imagePath)) {
        desaImage = MessageMedia.fromFilePath(imagePath);
    } else {
        logger.error('File gambar desa tidak ditemukan:', imagePath);
    }
});

const sendMessage = async (message, text) => {
    try {
        await message.reply(text);
    } catch (error) {
        console.error('Error saat mengirim pesan:', error);
    }
};

client.on('message', async message => {
    try {
        const userId = message.from;
        const userMessage = message.body.trim().toLowerCase();

        if (!usersState[userId]) {
            usersState[userId] = { step: 0 };
        }

        const userState = usersState[userId];

        switch (userState.step) {
            case 0:
                if (userMessage === 'rabu') {
                    await client.sendMessage(message.from, desaImage, { caption: getWelcomeMessage() });
                    userState.step = 1;
                } else {
                    await message.reply('Mohon ketik "rabu" untuk memulai');
                }
                break;
            case 1:
                await handleMainMenu(message, userMessage, userState);
                break;
            case 2:
                await handleContinueOrExit(message, userMessage, userState);
                break;
            case 3:
                await handleServiceMenu(message, userMessage, userState);
                break;
            default:
                console.error('Langkah tidak valid:', userState.step);
                userState.step = 0;
                await message.reply('Terjadi kesalahan. Silakan mulai ulang dengan mengetik "rabu".');
        }
    } catch (error) {
        console.error('Error dalam penanganan pesan:', error);
        await message.reply('Maaf, terjadi kesalahan. Silakan coba lagi nanti.');
    }
});

function getWelcomeMessage() {
    return `*Selamat datang di Layanan Desa Muara Tinobu!*

Kami disini untuk membantu Anda dalam memberikan informasi.
*Jam Kerja Pukul 08.00 WITA-15.00 WITA.*

Pilih salah satu opsi berikut untuk mendapatkan informasi lebih lanjut:
1. Profil Desa
2. Struktur Organisasi Desa
3. Peta Desa
4. Layanan Desa
5. Kontak Kami
6. Verifikasi Berita Hoax`;
}

async function handleMainMenu(message, userMessage, userState) {
    const menuOptions = {
        '1': {
            response: 'Muara Tinobu adalah sebuah desa yang terletak di Kecamatan Lasolo, Kabupaten Konawe Utara, Sulawesi Tenggara. Luas desa ini adalah 52 hektare dan terbagi menjadi beberapa bagian yaitu:\nTanah perkebunan, Tanah pertanian, Pekarangan, Pemukiman, Perikanan, dan lahan pengembangan.\n\nUntuk informasi lebih lanjut silahkan akses link berikut:\nhttps://muaratinobudesa.wordpress.com/tentang/',
            nextStep: 2
        },
        '2': {
            response: 'Silahkan akses link berikut untuk melihat tampilan struktur organisasi:\nhttps://muaratinobudesa.wordpress.com/pemerintah-desa/',
            nextStep: 2
        },
        '3': {
            response: 'Silahkan akses link berikut untuk melihat peta lokasi desa:\nhttps://muaratinobudesa.wordpress.com/peta-desa/',
            nextStep: 2
        },
        '4': {
            response: 'Kami menyediakan layanan pembuatan. Pembuatan apa yang ingin Anda ketahui:\n1. Kartu Tanda Penduduk (KTP)\n2. Surat Keterangan Domisili\n0. Kembali',
            nextStep: 3
        },
        '5': {
            response: 'Silahkan akses link berikut untuk menghubungin kami:\nhttps://muaratinobudesa.wordpress.com/kontak/',
            nextStep: 2
        },
        '6': {
            response: 'Silahkan akses link berikut untuk cek kebenaran dari sebuah berita:\nhttps://cekfakta.tempo.co/',
            nextStep: 2
        }
    };

    if (menuOptions[userMessage]) {
        await message.reply(menuOptions[userMessage].response);
        if (menuOptions[userMessage].nextStep === 2) {
            await sendMessage(message, 'Apakah Anda ingin melanjutkan?\n\nKetik *"YA"* untuk melihat menu.\nKetik *"TIDAK"* untuk selesai.');
        }
        userState.step = menuOptions[userMessage].nextStep;
    } else {
        await message.reply('*Pilih dengan ketik angka yang tersedia!*');
    }
}

async function handleContinueOrExit(message, userMessage, userState) {
    if (userMessage === 'ya') {
        await client.sendMessage(message.from, desaImage, { caption: getWelcomeMessage() });
        userState.step = 1;
    } else if (userMessage === 'tidak') {
        await message.reply('Terima kasih telah menggunakan layanan kami. Untuk memulai kembali ketik "rabu"');
        userState.step = 0;
    } else {
        await message.reply('*Pilihan Salah* ⚠️\n\nKetik "YA" untuk melanjutkan\nKetik "TIDAK" untuk mengakhiri');
    }
}

async function handleServiceMenu(message, userMessage, userState) {
    const serviceOptions = {
        '1': 'Silahkan akses link berikut untuk pembuatan KTP:\nhttps://muaratinobudesa.wordpress.com/ktp/\n\nKami akan melayani pembuatan KTP secepatnya.',
        '2': 'Silahkan akses link berikut untuk pembuatan surat Domisili:\nhttps://muaratinobudesa.wordpress.com/suket-domisili/\n\nKami akan melayani pembuatan surat tersebut secepatnya.',
        '0': getWelcomeMessage()
    };

    if (serviceOptions[userMessage]) {
        await message.reply(serviceOptions[userMessage]);
        if (userMessage === '0') {
            userState.step = 1;
        } else {
            await sendMessage(message, 'Apakah Anda ingin melanjutkan?\n\nKetik *"YA"* untuk melihat menu.\nKetik *"TIDAK"* untuk selesai.');
            userState.step = 2;
        }
    } else {
        await message.reply('*Pilih dengan ketik angka yang tersedia!*');
    }
}

client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Mematikan bot...');
    await client.destroy();
    process.exit(0);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Kirim notifikasi ke admin jika diperlukan
    // sendAdminNotification('Terjadi kesalahan tidak tertangani: ' + error.message);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Kirim notifikasi ke admin jika diperlukan
    // sendAdminNotification('Terjadi penolakan tidak tertangani: ' + reason);
});

// Fungsi untuk mengirim notifikasi ke admin (opsional)
async function sendAdminNotification(message) {
    const adminNumber = process.env.ADMIN_NUMBER;
    if (adminNumber) {
        try {
            await client.sendMessage(adminNumber, message);
        } catch (error) {
            logger.error('Gagal mengirim notifikasi ke admin:', error);
        }
    }
}

// Fungsi untuk membersihkan usersState secara berkala
setInterval(() => {
    const now = Date.now();
    Object.keys(usersState).forEach(userId => {
        if (now - usersState[userId].lastActivity > 24 * 60 * 60 * 1000) { // 24 jam
            delete usersState[userId];
        }
    });
}, 60 * 60 * 1000); // Jalankan setiap jam