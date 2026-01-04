import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Global event emitter for bot events
export const botEvents = new EventEmitter();

let sock = null;
let isConnecting = false;
let lastQR = null;
let currentStatus = 'Disconnected';
const processedMessages = new Set();
const MAX_CACHE_SIZE = 1000;

export const getSocket = () => sock;
export const getBotState = () => ({ status: currentStatus, qr: lastQR, user: sock?.user });

export const startBot = async (io) => {
    if (isConnecting) return;
    isConnecting = true;

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: true,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            lastQR = qr;
            currentStatus = 'QR_RECEIVED';
            io.emit('qr', qr);
        }

        if (connection === 'close') {
            lastQR = null;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            currentStatus = 'Disconnected';
            io.emit('status', { status: 'Disconnected', reason: lastDisconnect?.error?.message });
            
            botEvents.removeAllListeners(); 
            
            if (shouldReconnect) {
                isConnecting = false;
                startBot(io);
            } else {
                isConnecting = false;
            }
        } else if (connection === 'open') {
            lastQR = null;
            currentStatus = 'Connected';
            io.emit('status', { status: 'Connected', user: sock.user });
            isConnecting = false;
        } else if (connection === 'connecting') {
            currentStatus = 'Connecting';
            io.emit('status', { status: 'Connecting' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
            if (!msg.message) continue;
            const remoteJid = msg.key?.remoteJid;
            const id = msg.key?.id;
            if (remoteJid && id) {
                const dedupeKey = `${remoteJid}:${id}`;
                if (processedMessages.has(dedupeKey)) continue;
                processedMessages.add(dedupeKey);
                if (processedMessages.size > MAX_CACHE_SIZE) processedMessages.clear();
            }
            botEvents.emit('message', { sock, msg });
        }
    });

    return sock;
};
