import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { createStickerFromMedia } from '../services/sticker.js';
import * as googleTTS from 'google-tts-api';
import axios from 'axios';
import fs from 'fs';

export const handleMediaCommands = async (command, args, msg, sock, from, sender) => {
    switch (command.toLowerCase()) {
        case '/sticker':
        case '/stiker':
        case '/s':
            const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isQuotedVideo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
            const isImage = msg.message?.imageMessage;
            const isVideo = msg.message?.videoMessage;

            if (isImage || isVideo || isQuotedImage || isQuotedVideo) {
                try {
                    let media;
                    if (isQuotedImage || isQuotedVideo) {
                        const quoted = msg.message.extendedTextMessage.contextInfo;
                        const rawMsg = isQuotedImage ? { message: { imageMessage: quoted.quotedMessage.imageMessage } } : { message: { videoMessage: quoted.quotedMessage.videoMessage } };
                        media = await downloadMediaMessage(rawMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    } else {
                        media = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    }

                    const stickerBuffer = await createStickerFromMedia(media, 'MyBot', 'Sticker');
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(from, { text: 'Failed to create sticker.' });
                }
            } else {
                await sock.sendMessage(from, { text: 'Please send an image/video with the /sticker caption or reply to one.' });
            }
            break;

        case '/say':
        case '/tts':
            if (args.length === 0) return await sock.sendMessage(from, { text: 'Example: /say Hello how are you' });
            const text = args.join(' ');
            try {
                const url = googleTTS.getAudioUrl(text, {
                    lang: 'id',
                    slow: false,
                    host: 'https://translate.google.com',
                });
                await sock.sendMessage(from, { 
                    audio: { url: url }, 
                    mimetype: 'audio/mp4',
                    ptt: true // Send as Voice Note
                }, { quoted: msg });
            } catch (e) {
                console.error(e);
                await sock.sendMessage(from, { text: 'Failed to generate TTS audio.' });
            }
            break;
    }
};
