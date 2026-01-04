import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { startBot, botEvents, getSocket, getBotState } from './lib/baileys.js';
import { handleMessage } from './controllers/botController.js';
import { initConfig } from './lib/config.js';
import indexRoutes from './routes/index.js';
import apiRoutes from './routes/api.js';

// Setup FFMPEG Path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Init Config
initConfig();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('Web Client Connected');
    const state = getBotState();
    
    // Kirim status awal
    socket.emit('status', state);
    
    // Jika ada QR aktif, kirim juga
    if (state.status === 'QR_RECEIVED' && state.qr) {
        socket.emit('qr', state.qr);
    }
});

// Start Bot
startBot(io).then(() => {
    console.log('Bot Initialization Started');
});

// Bind Bot Events to Controller
botEvents.on('message', (data) => {
    handleMessage(data);
});

// Start Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

export { io };
