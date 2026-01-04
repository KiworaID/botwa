import express from 'express';
import prisma from '../services/db.js';
import { getSocket } from '../lib/baileys.js';

const router = express.Router();

import { updateConfigCache } from '../lib/config.js';

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Fetch Available Models
router.get('/models/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        const config = await prisma.config.findFirst();

        if (provider === 'groq') {
            if (!config?.groq_api_key) return res.json({ error: 'API Key Missing' });
            
            const groq = new Groq({ apiKey: config.groq_api_key });
            const models = await groq.models.list();
            
            // Filter usable text models based on known Groq model families
            const availableModels = models.data
                .filter(m => !m.id.includes('whisper')) // Exclude audio models
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    tools: true // Groq generally supports tool calls on text models
                }))
                .sort((a, b) => b.id.localeCompare(a.id)); // Newest first
                
            return res.json({ models: availableModels });
        } 
        
        if (provider === 'gemini') {
            if (!config?.gemini_api_key) return res.json({ error: 'API Key Missing' });
            
            // Use Google Generative AI SDK to list models
            // Documentation confirms genAI.getGenerativeModel is for instantiation, 
            // but for listing, we might need to use the API directly via fetch if SDK doesn't expose listModels easily in this version.
            // However, let's try to use the correct endpoint manually if SDK falls short, or check SDK docs.
            // Actually, the SDK *does* support getting models in some versions, but standard REST API is safest.
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.gemini_api_key}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) throw new Error(data.error.message);
            
            const availableModels = (data.models || [])
                .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                .map(m => ({
                    id: m.name.replace('models/', ''), // API returns 'models/gemini-pro', we just want 'gemini-pro'
                    name: m.displayName || m.name,
                    description: m.description,
                    tools: true // Most modern Gemini models support tools
                }))
                .sort((a, b) => b.id.localeCompare(a.id)); // Newest first

            return res.json({ models: availableModels });
        }

        res.json({ models: [] });
    } catch (error) {
        console.error('Fetch Models Error:', error);
        res.json({ error: 'Failed to fetch models' });
    }
});

// Update Config
router.post('/config', async (req, res) => {
    try {
        const { 
            bot_name, global_ai_mode, ai_provider, 
            gemini_model, groq_model,
            gemini_api_key, groq_api_key, system_prompt, prefix,
            enable_pm, enable_group, enable_newsletter, enable_games
        } = req.body;
        
        const existing = await prisma.config.findFirst();
        
        const newData = {
            bot_name,
            prefix: prefix || '/',
            global_ai_mode: global_ai_mode === 'on',
            ai_provider,
            gemini_model,
            groq_model,
            gemini_api_key,
            groq_api_key,
            system_prompt,
            enable_pm: enable_pm === 'on',
            enable_group: enable_group === 'on',
            enable_newsletter: enable_newsletter === 'on',
            enable_games: enable_games === 'on'
        };

        if (existing) {
            await prisma.config.update({
                where: { id: existing.id },
                data: newData
            });
        } else {
            await prisma.config.create({
                data: newData
            });
        }
        
        // Update Cache Immediately
        updateConfigCache(newData);

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating config');
    }
});

// Add Owner
router.post('/owner/add', async (req, res) => {
    try {
        const { phone, name } = req.body;
        await prisma.owner.create({ data: { phone, name } });
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error adding owner');
    }
});

// Delete Owner
router.post('/owner/delete', async (req, res) => {
    try {
        const { id } = req.body;
        await prisma.owner.delete({ where: { id: parseInt(id) } });
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error deleting owner');
    }
});

// Logout Bot
router.post('/logout', async (req, res) => {
    const sock = getSocket();
    if (sock) {
        await sock.logout();
    }
    res.redirect('/');
});

export default router;
