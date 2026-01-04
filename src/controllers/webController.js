import prisma from '../services/db.js';
import { getSocket } from '../lib/baileys.js';

export const getDashboard = async (req, res) => {
    try {
        const config = await prisma.config.findFirst();
        const owners = await prisma.owner.findMany();
        const admins = await prisma.admin.findMany();
        
        // Fetch Chats from DB (History/Active)
        const chats = await prisma.chat.findMany({
            orderBy: { id: 'desc' },
            take: 50 // Limit to recent 50
        });

        // Fetch Groups from Baileys Socket
        let groups = [];
        const sock = getSocket();
        if (sock) {
            try {
                const groupData = await sock.groupFetchAllParticipating();
                groups = Object.values(groupData).map(g => ({
                    id: g.id,
                    subject: g.subject,
                    size: g.participants.length,
                    creation: g.creation
                }));
            } catch (e) {
                console.error('Error fetching groups:', e);
            }
        }

        res.render('index', { 
            config: config || {}, 
            owners, 
            admins,
            groups,
            chats,
            error: null 
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.render('index', { 
            config: {}, 
            owners: [], 
            admins: [], 
            groups: [], 
            chats: [], 
            error: 'Database Error: ' + error.message 
        });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const { jid } = req.body;
        const sock = getSocket();
        
        if (!sock) {
            return res.status(500).json({ error: 'Bot not connected' });
        }

        await sock.groupLeave(jid);
        
        // Optionally delete from local DB if exists
        await prisma.group.deleteMany({ where: { jid } });

        res.redirect('/?tab=groups');
    } catch (error) {
        console.error('Leave Group Error:', error);
        res.status(500).send('Failed to leave group');
    }
};
