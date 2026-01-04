import aiService from '../services/ai.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Note: Ensure API Keys are in .env
// We need to initialize clients here or reuse from services/ai.js but specific for vision/audio
// For simplicity, we'll instantiate here using env vars directly for the specialized calls

export const handleAICommands = async (command, args, msg, sock, from, sender) => {
    switch (command) {
        case '/analyze':
        case '/vision':
            // Check for image
            const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isImage = msg.message?.imageMessage;
            
            if (!isImage && !isQuotedImage) {
                return await sock.sendMessage(from, { text: 'Reply to an image with /analyze [question]' });
            }

            const query = args.join(' ') || 'Describe this image';
            
            try {
                // Download Image
                let buffer;
                let mimetype = 'image/jpeg';

                if (isQuotedImage) {
                    const quoted = msg.message.extendedTextMessage.contextInfo;
                    const rawMsg = { message: { imageMessage: quoted.quotedMessage.imageMessage } };
                    buffer = await downloadMediaMessage(rawMsg, 'buffer', {}, { logger: console });
                } else {
                    buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
                }

                // Use the unified AI service for vision
                const reply = await aiService.getResponse(query, sender, 'User', { buffer, mimetype });
                await sock.sendMessage(from, { text: reply }, { quoted: msg });

            } catch (e) {
                console.error('Vision Error:', e);
                await sock.sendMessage(from, { text: 'Failed to analyze image. Ensure API Key and Model are configured.' });
            }
            break;

        case '/txt':
        case '/transcribe':
            // Check for audio/voice note
            const isQuotedAudio = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
            
            if (!isQuotedAudio) {
                return await sock.sendMessage(from, { text: 'Reply to a voice note with /txt' });
            }

            try {
                const quoted = msg.message.extendedTextMessage.contextInfo;
                const rawMsg = { message: { audioMessage: quoted.quotedMessage.audioMessage } };
                const media = await downloadMediaMessage(rawMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });

                // Save temp file for Groq
                const tempFile = path.join(process.cwd(), `temp_${Date.now()}.mp3`);
                fs.writeFileSync(tempFile, media);

                // Groq Whisper
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                
                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: "whisper-large-v3",
                    response_format: "text"
                });

                await sock.sendMessage(from, { text: `📝 Transcription:\n\n${transcription}` }, { quoted: msg });
                
                // Cleanup
                fs.unlinkSync(tempFile);

            } catch (e) {
                console.error('Transcript Error:', e);
                await sock.sendMessage(from, { text: 'Failed to transcribe audio. Ensure Groq API Key is configured.' });
            }
            break;
    }
};
