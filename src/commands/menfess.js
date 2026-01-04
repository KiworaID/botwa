import prisma from '../services/db.js';

export const handleMenfess = async (sock, msg, args, sender, isGroup) => {
    const from = msg.key.remoteJid;

    if (isGroup) {
        return await sock.sendMessage(from, { text: 'Fitur Menfess hanya bisa digunakan di Private Chat!' }, { quoted: msg });
    }

    if (args.length < 2) {
        return await sock.sendMessage(from, { text: 'Format salah! Gunakan: /menfess [nomor] [pesan]\nContoh: /menfess 08123456789 Halo kak!' }, { quoted: msg });
    }

    let targetNumber = args[0].replace(/[^0-9]/g, '');
    const message = args.slice(1).join(' ');

    if (targetNumber.startsWith('08')) {
        targetNumber = '628' + targetNumber.slice(2);
    }

    if (!targetNumber.endsWith('@s.whatsapp.net')) {
        targetNumber += '@s.whatsapp.net';
    }

    if (targetNumber === sender) {
        return await sock.sendMessage(from, { text: 'Kamu tidak bisa mengirim menfess ke diri sendiri!' }, { quoted: msg });
    }

    try {
        // Create session
        await prisma.menfessSession.create({
            data: {
                senderId: sender.replace('@s.whatsapp.net', ''),
                targetId: targetNumber.replace('@s.whatsapp.net', ''),
                status: 'active'
            }
        });

        // Send to target
        await sock.sendMessage(targetNumber, {
            text: `📩 *Pesan Menfess Masuk!*\n\n"${message}"\n\n_Seseorang mengirim pesan ini secara rahasia. Balas pesan ini untuk mengirim balasan ke pengirim (identitasmu tetap aman)._`
        });

        // Confirm to sender
        await sock.sendMessage(from, { text: '✅ Pesan Menfess berhasil dikirim!' }, { quoted: msg });

    } catch (error) {
        console.error('Menfess Error:', error);
        await sock.sendMessage(from, { text: 'Gagal mengirim menfess. Pastikan nomor tujuan valid.' }, { quoted: msg });
    }
};
