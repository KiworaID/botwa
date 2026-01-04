import prisma from '../services/db.js';

export const isOwner = async (phone) => {
    const owner = await prisma.owner.findUnique({
        where: { phone }
    });
    return !!owner;
};

export const isAdmin = async (phone) => {
    const admin = await prisma.admin.findUnique({
        where: { phone }
    });
    return !!admin;
};

export const getGroupAdmins = (participants) => {
    return participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').map((p) => p.id);
};

export const runtime = (seconds) => {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? "d " : "d ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? "h " : "h ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? "m " : "m ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? "s" : "s") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
};

export const formatDate = (date) => {
    const d = new Date(date);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
};

export const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('id-ID', { hour12: false }).replace(/\./g, ':') + ' WIB';
};

export const serializeMessage = (m, sock) => {
    // Simple serializer helper
    // In a real production app, you might want a more robust one
    // For now, we return the raw message with some convenience properties
    return m;
};
