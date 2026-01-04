import express from 'express';
import prisma from '../services/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const config = await prisma.config.findFirst();
        const owners = await prisma.owner.findMany();
        const admins = await prisma.admin.findMany();
        
        res.render('index', { 
            config: config || {}, 
            owners, 
            admins 
        });
    } catch (error) {
        console.error(error);
        res.render('index', { config: {}, owners: [], admins: [], error: 'Database Error' });
    }
});

export default router;
