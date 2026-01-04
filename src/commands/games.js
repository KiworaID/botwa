import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gameSessions } from '../lib/game_store.js';
import prisma from '../services/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadData = (filename) => {
    try {
        const dataPath = path.join(__dirname, '../data', filename);
        const raw = fs.readFileSync(dataPath, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Failed to load ${filename}:`, e);
        return [];
    }
};

export const handleGame = async (sock, msg, args, command, sender, isGroup, groupSettings, config) => {
    const from = msg.key.remoteJid;

    if (!isGroup) {
        return await sock.sendMessage(from, { text: 'Game hanya bisa dimainkan di dalam grup!' }, { quoted: msg });
    }

    if (config && !config.enable_games) {
         return await sock.sendMessage(from, { text: '❌ Fitur game sedang dinonaktifkan oleh Owner.' }, { quoted: msg });
    }

    if (groupSettings && !groupSettings.games_active) {
        return await sock.sendMessage(from, { text: '❌ Fitur game dinonaktifkan di grup ini oleh admin.' }, { quoted: msg });
    }

    if (gameSessions.has(from)) {
        return await sock.sendMessage(from, { text: 'Masih ada sesi game yang aktif! Selesaikan dulu.' }, { quoted: msg });
    }

    let gameData;
    let type;
    let prompt;
    let mediaUrl;

    if (command === '/tebakkata') {
        const data = loadData('tebakkata.json');
        if (!data.length) return await sock.sendMessage(from, { text: 'Database soal kosong.' });
        const item = data[Math.floor(Math.random() * data.length)];
        
        gameData = item;
        type = 'tebakkata';
        prompt = `🎮 *TEBAK KATA*\n\nPetunjuk: ${item.soal}\n\nJawab dengan membalas pesan ini! Waktu 60 detik.`;
    } else if (command === '/tebakgambar') {
        const data = loadData('tebakgambar.json');
        if (!data.length) return await sock.sendMessage(from, { text: 'Database soal kosong.' });
        const item = data[Math.floor(Math.random() * data.length)];
        
        gameData = item;
        type = 'tebakgambar';
        prompt = `🎮 *TEBAK GAMBAR*\n\nPetunjuk: ${item.clue || 'Apa ini?'}\n\nJawab dengan membalas pesan ini! Waktu 60 detik.`;
        mediaUrl = item.img;
    }

    // Start Session
    gameSessions.set(from, {
        type,
        answer: gameData.jawaban.toLowerCase(),
        original: gameData,
        startTime: Date.now()
    });

    // Send Question
    let sentMsg;
    if (mediaUrl) {
        sentMsg = await sock.sendMessage(from, { image: { url: mediaUrl }, caption: prompt }, { quoted: msg });
    } else {
        sentMsg = await sock.sendMessage(from, { text: prompt }, { quoted: msg });
    }

    // Set Timeout
    setTimeout(async () => {
        if (gameSessions.has(from)) {
            const currentSession = gameSessions.get(from);
            // Check if it's the same session (timestamp check optional but good)
            if (currentSession.startTime === gameSessions.get(from).startTime) {
                gameSessions.delete(from);
                await sock.sendMessage(from, { text: `⏳ Waktu habis! Jawabannya adalah: *${gameData.jawaban}*` });
            }
        }
    }, 60000);
};

export const handleGameAnswer = async (sock, msg, body, sender) => {
    const from = msg.key.remoteJid;
    if (!gameSessions.has(from)) return false;

    const session = gameSessions.get(from);
    const userAnswer = body.toLowerCase().trim();

    if (userAnswer === session.answer) {
        gameSessions.delete(from);
        
        // Add coins/xp
        const senderNum = sender.replace('@s.whatsapp.net', '');
        
        // Upsert user to ensure they exist
        // Note: Prisma upsert is best here
        try {
            const user = await prisma.user.upsert({
                where: { phone: senderNum },
                update: {
                    coins: { increment: 100 },
                    xp: { increment: 50 }
                },
                create: {
                    phone: senderNum,
                    coins: 100,
                    xp: 50,
                    name: msg.pushName || 'User'
                }
            });

            await sock.sendMessage(from, { 
                text: `🎉 *BENAR!* @${senderNum} berhasil menjawab!\nJawaban: ${session.original.jawaban}\n\n🎁 Hadiah: +100 Coins, +50 XP\n💰 Total Coins: ${user.coins}`,
                mentions: [sender]
            }, { quoted: msg });
        } catch (e) {
            console.error('DB Update Error:', e);
            await sock.sendMessage(from, { text: `🎉 *BENAR!* Jawabannya: ${session.original.jawaban}` }, { quoted: msg });
        }

        return true; // Handled
    }
    return false; // Not the answer
};
