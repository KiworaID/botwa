import axios from 'axios';

export const handleGempa = async (sock, msg) => {
    const from = msg.key.remoteJid;
    try {
        const response = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
        const gempa = response.data.Infogempa.gempa;

        const text = `🌋 *INFO GEMPA TERKINI*\n\n` +
                     `📅 Tanggal: ${gempa.Tanggal}\n` +
                     `🕒 Jam: ${gempa.Jam}\n` +
                     `📉 Magnitudo: ${gempa.Magnitude}\n` +
                     `🌊 Kedalaman: ${gempa.Kedalaman}\n` +
                     `📍 Lokasi: ${gempa.Lintang}, ${gempa.Bujur}\n` +
                     `🏙️ Wilayah: ${gempa.Wilayah}\n` +
                     `⚠️ Potensi: ${gempa.Potensi}`;

        const imageUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;

        await sock.sendMessage(from, { image: { url: imageUrl }, caption: text }, { quoted: msg });

    } catch (error) {
        console.error('Gempa API Error:', error);
        await sock.sendMessage(from, { text: '⚠️ Gagal mengambil data gempa dari BMKG.' }, { quoted: msg });
    }
};

export const handleSholat = async (sock, msg, args) => {
    const from = msg.key.remoteJid;
    if (args.length < 1) {
        return await sock.sendMessage(from, { text: 'Gunakan format: /sholat [nama_kota]\nContoh: /sholat Jakarta' }, { quoted: msg });
    }

    const cityQuery = args.join(' ');

    try {
        // 1. Search City ID
        const searchRes = await axios.get(`https://api.myquran.com/v2/sholat/kota/cari/${cityQuery}`);
        if (!searchRes.data.status || searchRes.data.data.length === 0) {
            return await sock.sendMessage(from, { text: `Kota "${cityQuery}" tidak ditemukan.` }, { quoted: msg });
        }

        const cityId = searchRes.data.data[0].id;
        const cityName = searchRes.data.data[0].lokasi;

        // 2. Get Schedule
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        const scheduleRes = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/${year}/${month}/${day}`);
        const jadwal = scheduleRes.data.data.jadwal;

        const text = `🕌 *JADWAL SHOLAT*\n📍 ${cityName}\n📅 ${jadwal.tanggal}\n\n` +
                     `Subuh: ${jadwal.subuh}\n` +
                     `Dzuhur: ${jadwal.dzuhur}\n` +
                     `Ashar: ${jadwal.ashar}\n` +
                     `Maghrib: ${jadwal.maghrib}\n` +
                     `Isya: ${jadwal.isya}`;

        await sock.sendMessage(from, { text: text }, { quoted: msg });

    } catch (error) {
        console.error('Sholat API Error:', error);
        await sock.sendMessage(from, { text: '⚠️ Gagal mengambil data jadwal sholat.' }, { quoted: msg });
    }
};
