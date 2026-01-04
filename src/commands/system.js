import os from 'os';
import osu from 'node-os-utils';

export const handleSystemCommands = async (command, args, msg, sock, from, sender) => {
    if (command === '/status' || command === '/info') {
        try {
            // CPU Usage
            let cpuUsage = 'N/A';
            try {
                // Handle different import structures for node-os-utils
                const cpu = osu.cpu || (osu.default && osu.default.cpu);
                if (cpu) {
                    cpuUsage = await cpu.usage();
                }
            } catch (e) {
                console.error('CPU Info Error:', e);
            }

            // Memory Info using built-in os module (more reliable)
            const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);
            const freeMem = (os.freemem() / (1024 * 1024)).toFixed(0);
            const usedMem = (totalMem - freeMem);

            // Uptime
            const uptime = os.uptime();
            const days = Math.floor(uptime / (24 * 60 * 60));
            const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((uptime % (60 * 60)) / 60);

            const statusText = `
*🔰 SERVER STATUS*

🖥️ *Platform:* ${os.platform()} (${os.arch()})
🧠 *CPU Usage:* ${cpuUsage}%
💾 *RAM:* ${usedMem}MB / ${totalMem}MB
⏱️ *Uptime:* ${days}d ${hours}h ${minutes}m
            `.trim();

            await sock.sendMessage(from, { text: statusText }, { quoted: msg });
        } catch (error) {
            console.error('Status Command Error:', error);
            await sock.sendMessage(from, { text: 'Error fetching server status.' });
        }
    }
};
