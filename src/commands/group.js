import prisma from '../services/db.js';
import { getGroupAdmins } from '../lib/utils.js';

export const handleGroupCommands = async (command, args, msg, sock, from, sender, isGroup) => {
    if (!isGroup) return; // Group only commands

    // Helper: Check Admin
    const groupMetadata = await sock.groupMetadata(from);
    const admins = getGroupAdmins(groupMetadata.participants);
    const isAdmin = admins.includes(sender);
    const isBotAdmin = admins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net');

    switch (command) {
        case '/hidetag':
            if (!isAdmin) return await sock.sendMessage(from, { text: 'Admin only!' });
            const text = args.join(' ') || 'Hidetag active';
            const participants = groupMetadata.participants.map(p => p.id);
            
            await sock.sendMessage(from, { 
                text: text, 
                mentions: participants 
            });
            break;

        case '/antilink':
            if (!isAdmin) return await sock.sendMessage(from, { text: 'Admin only!' });
            const mode = args[0];
            if (mode === 'on') {
                await prisma.group.update({ where: { jid: from }, data: { antilink: true } });
                await sock.sendMessage(from, { text: 'Antilink enabled!' });
            } else if (mode === 'off') {
                await prisma.group.update({ where: { jid: from }, data: { antilink: false } });
                await sock.sendMessage(from, { text: 'Antilink disabled!' });
            } else {
                await sock.sendMessage(from, { text: 'Usage: /antilink on/off' });
            }
            break;
    }
};

export const checkAntilink = async (msg, sock, from, sender, body) => {
    // Basic regex for WhatsApp Links
    const linkRegex = /chat\.whatsapp\.com\/[a-zA-Z0-9]{20,}/;
    if (!linkRegex.test(body)) return;

    const group = await prisma.group.findUnique({ where: { jid: from } });
    if (!group || !group.antilink) return;

    // Check if sender is admin
    const groupMetadata = await sock.groupMetadata(from);
    const admins = getGroupAdmins(groupMetadata.participants);
    if (admins.includes(sender)) return; // Allow admins

    // Delete and Kick
    await sock.sendMessage(from, { delete: msg.key });
    await sock.groupParticipantsUpdate(from, [sender], 'remove');
    await sock.sendMessage(from, { text: 'Antilink detected. Message deleted and user removed.' });
};
