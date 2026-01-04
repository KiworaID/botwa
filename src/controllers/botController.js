import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import prisma from '../services/db.js';
import aiService from '../services/ai.js';
import { createStickerFromMedia } from '../services/sticker.js';
import { isOwner, getGroupAdmins, runtime, formatDate, formatTime } from '../lib/utils.js';
import { getConfig } from '../lib/config.js';
import os from 'os';

// Import Command Handlers
import { handleMediaCommands } from '../commands/media.js';
import { handleImagine } from '../commands/imagine.js';
import { handleAICommands } from '../commands/ai.js';
import { handleGroupCommands, checkAntilink } from '../commands/group.js';
import { handleSystemCommands } from '../commands/system.js';
import { handleMenfess } from '../commands/menfess.js';
import { handleGame, handleGameAnswer } from '../commands/games.js';
import { handleGempa, handleSholat } from '../commands/info.js';

// Global Start Time
const botStartTime = Date.now();

export const handleMessage = async ({ sock, msg }) => {
    try {
        if (!msg.message) return;

        // Basic Info
        const key = msg.key;
        const from = key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? key.participant : from;
        const pushName = msg.pushName || 'User';
        const isBot = key.fromMe;
        const isNewsletter = from.endsWith('@newsletter');
        
        // Filter berdasarkan scope (PM/Group/Channel)
        const { enablePm, enableGroup, enableNewsletter, prefix } = getConfig();
        
        if (isNewsletter && !enableNewsletter) return;
        if (isGroup && !enableGroup) return;
        if (!isGroup && !isNewsletter && !enablePm) return;

        // Determinasikan isi pesan
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                    (type == 'imageMessage') ? msg.message.imageMessage.caption :
                    (type == 'videoMessage') ? msg.message.videoMessage.caption :
                    (type == 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                    (type == 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage.selectedButtonId :
                    (type == 'listResponseMessage') ? msg.message.listResponseMessage.singleSelectReply.selectedRowId :
                    (type == 'templateButtonReplyMessage') ? msg.message.templateButtonReplyMessage.selectedId : '';

        if (!body) return;
        
        console.log(`[MSG] ${pushName} (${sender}): ${body}`);

        if (isBot) return; // Abaikan pesan dari bot sendiri (kecuali mau buat fitur self-bot)

        // 0. Game Answer Listener (Priority)
        if (isGroup) {
            const isAnswer = await handleGameAnswer(sock, msg, body, sender);
            if (isAnswer) return; // Stop processing if it was a game answer
        }

        // Fetch Global Config
        const config = await prisma.config.findFirst();

        // Database checks (Optimized)
        let groupSettings = null;
        let chatSettings = null;

        if (isGroup) {
            groupSettings = await prisma.group.findUnique({ where: { jid: from } });
            if (!groupSettings) {
                groupSettings = await prisma.group.create({ data: { jid: from } });
            }
        } else {
            chatSettings = await prisma.chat.findUnique({ where: { jid: from } });
            if (!chatSettings) {
                chatSettings = await prisma.chat.create({ data: { jid: from } });
            }
        }

        // 0.5 Menfess Reply Listener
        if (!isGroup) {
            // Check if replying to a Menfess message
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            // We check if the quoted text contains "Pesan Menfess Masuk" OR if there is an active session
            // For better UX, we just check active session for the user as target
            const activeSession = await prisma.menfessSession.findFirst({
                where: { targetId: sender.replace('@s.whatsapp.net', ''), status: 'active' },
                orderBy: { createdAt: 'desc' }
            });

            if (activeSession && quotedMsg) {
                 const senderJid = activeSession.senderId + '@s.whatsapp.net';
                 await sock.sendMessage(senderJid, { 
                     text: `📩 *Balasan Menfess:*\n\n"${body}"\n\n_Dari target (Balas pesan ini untuk membalas balik)._` 
                 });
                 // We could also auto-create a reverse session or just keep the existing one. 
                 // The prompt implies a conversation. 
                 // Let's ensure the sender can also reply back to this forwarding message.
                 // Ideally, we swap sender/target in a new session or maintain a single bidirectional link.
                 // For simplicity, let's keep the session active.
                 
                 await sock.sendMessage(from, { text: '✅ Balasan terkirim!' }, { quoted: msg });
                 return; 
            }
            
            // Check if sender is replying to a forwarded reply (to complete the loop)
            const activeSenderSession = await prisma.menfessSession.findFirst({
                where: { senderId: sender.replace('@s.whatsapp.net', ''), status: 'active' },
                orderBy: { createdAt: 'desc' }
            });
             
            if (activeSenderSession && quotedMsg && quotedMsg.conversation?.includes('Balasan Menfess')) {
                 const targetJid = activeSenderSession.targetId + '@s.whatsapp.net';
                 await sock.sendMessage(targetJid, { 
                     text: `📩 *Pesan Menfess Masuk!*\n\n"${body}"\n\n_Balasan dari pengirim._` 
                 });
                 await sock.sendMessage(from, { text: '✅ Balasan terkirim!' }, { quoted: msg });
                 return;
            }
        }

        // 1. Antilink Check (Priority)
        if (isGroup) {
            await checkAntilink(msg, sock, from, sender, body);
        }

        // 2. Command Handler
        if (body.startsWith(prefix)) {
            const command = body.split(' ')[0].toLowerCase();
            const args = body.split(' ').slice(1);
            
            // Standardize command for internal handlers (always use / internally)
            const cmdName = '/' + command.slice(prefix.length);

            await handleImagine(cmdName, sock, msg, args, from, sender);
            await handleMediaCommands(cmdName, args, msg, sock, from, sender);
            await handleAICommands(cmdName, args, msg, sock, from, sender);
            await handleGroupCommands(cmdName, args, msg, sock, from, sender, isGroup);
            await handleSystemCommands(cmdName, args, msg, sock, from, sender);
            
            // Legacy/Simple Commands inside Controller
            switch (cmdName) {
                case '/menfess':
                    await handleMenfess(sock, msg, args, sender, isGroup);
                    break;
                case '/tebakkata':
                case '/tebakgambar':
                    await handleGame(sock, msg, args, cmdName, sender, isGroup, groupSettings, config);
                    break;
                case '/gempa':
                    await handleGempa(sock, msg);
                    break;
                case '/sholat':
                    await handleSholat(sock, msg, args);
                    break;
                case '/menu':
                case '/help':
                    const botUptime = runtime((Date.now() - botStartTime) / 1000);
                    const vpsUptime = runtime(os.uptime());
                    const dateNow = formatDate(new Date());
                    const timeNow = formatTime(new Date());
                    const aiModel = config?.ai_provider === 'gemini' ? config?.gemini_model : config?.groq_model;

                    const menuText = `
╭───「 ${config?.bot_name?.toUpperCase() || 'BOT'} 」
│ Afternoon, ${pushName}
│
│ ⌚ Bot: ${botUptime}
│ 💻 VPS: ${vpsUptime}
│ 📅 ${dateNow}
│ 🕒 ${timeNow}
│ 🤖 Model: ${config?.ai_provider}/${aiModel}
│ 🧠 Provider: ${config?.ai_provider}
╰───────────────────

╭───「 COMMUNITY & GAMES 」
│ • ${prefix}menfess [number] [msg]
│ • ${prefix}tebakkata
│ • ${prefix}tebakgambar
│ • ${prefix}gempa
│ • ${prefix}sholat [kota]
╰───────────────────

╭───「 MEDIA COMMANDS 」
│ • ${prefix}sticker (or ${prefix}s)
│ • ${prefix}imagine [prompt]
│ • ${prefix}say [text]
│ • ${prefix}analyze [image]
│ • ${prefix}txt [audio]
╰───────────────────

╭───「 GROUP & SYSTEM 」
│ • ${prefix}hidetag
│ • ${prefix}antilink
│ • ${prefix}status
│ • ${prefix}ai [query]
╰───────────────────

_Prefix: ${prefix}_
`.trim();

                    await sock.sendMessage(from, { 
                        text: menuText,
                        contextInfo: {
                            externalAdReply: {
                                title: `${config?.bot_name || 'MyBot'} Menu`,
                                body: 'Multi-Provider AI Assistant',
                                thumbnailUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', // Fallback icon
                                sourceUrl: 'https://chat.whatsapp.com/invite/your-link', // Optional link
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted: msg });
                    break;
                
                case '/ai':
                    const query = args.join(' ');
                    if (!query) return await sock.sendMessage(from, { text: `Please provide a question after ${prefix}ai` });
                    const reply = await aiService.getResponse(query, sender, pushName);
                    await sock.sendMessage(from, { text: reply });
                    break;
            }
            return;
        }

        // 3. AI Auto-Reply & Image Analysis (Context Aware)
        const isAiActive = config?.global_ai_mode || (isGroup && groupSettings?.ai_active) || (!isGroup && chatSettings?.ai_active);
        
        if (isAiActive && !isBot) {
            if (type === 'imageMessage') {
                // Auto analysis if AI is on and image has caption
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                const reply = await aiService.getResponse(body, sender, pushName, { buffer, mimetype: 'image/jpeg' });
                if (reply) await sock.sendMessage(from, { text: reply }, { quoted: msg });
            } else if (!isGroup) {
                // Auto reply for private messages
                const reply = await aiService.getResponse(body, sender, pushName);
                if (reply) await sock.sendMessage(from, { text: reply });
            }
        }
        
    } catch (error) {
        console.error('Message Handler Error:', error);
    }
};
