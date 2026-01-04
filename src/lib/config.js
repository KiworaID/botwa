import prisma from '../services/db.js';

// In-memory cache
const globalConfig = {
    prefix: '/',
    botName: 'MyBot',
    geminiModel: 'gemini-1.5-flash',
    groqModel: 'llama-3.3-70b-versatile',
    enablePm: true,
    enableGroup: true,
    enableNewsletter: false
};

// Initialize Cache on Startup
export const initConfig = async () => {
    try {
        const config = await prisma.config.findFirst();
        if (config) {
            globalConfig.prefix = config.prefix || '/';
            globalConfig.botName = config.bot_name || 'MyBot';
            globalConfig.geminiModel = config.gemini_model || 'gemini-1.5-flash';
            globalConfig.groqModel = config.groq_model || 'llama-3.3-70b-versatile';
            globalConfig.enablePm = config.enable_pm ?? true;
            globalConfig.enableGroup = config.enable_group ?? true;
            globalConfig.enableNewsletter = config.enable_newsletter ?? false;
        } else {
            // Create default if not exists
            const def = {
                prefix: '/',
                bot_name: 'MyBot',
                gemini_model: 'gemini-1.5-flash',
                groq_model: 'llama-3.3-70b-versatile',
                enable_pm: true,
                enable_group: true,
                enable_newsletter: false
            };
            await prisma.config.create({ data: def });
        }
        console.log(`Config Loaded: Prefix [${globalConfig.prefix}], PM [${globalConfig.enablePm}], Group [${globalConfig.enableGroup}]`);
    } catch (error) {
        console.error('Failed to load config:', error);
    }
};

// Update Cache (Called from Dashboard)
export const updateConfigCache = (newConfig) => {
    if (newConfig.prefix) globalConfig.prefix = newConfig.prefix;
    if (newConfig.bot_name) globalConfig.botName = newConfig.bot_name;
    if (newConfig.gemini_model) globalConfig.geminiModel = newConfig.gemini_model;
    if (newConfig.groq_model) globalConfig.groqModel = newConfig.groq_model;
    if (newConfig.enable_pm !== undefined) globalConfig.enablePm = newConfig.enable_pm;
    if (newConfig.enable_group !== undefined) globalConfig.enableGroup = newConfig.enable_group;
    if (newConfig.enable_newsletter !== undefined) globalConfig.enableNewsletter = newConfig.enable_newsletter;
};

// Getter
export const getConfig = () => globalConfig;
