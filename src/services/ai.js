import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import prisma from './db.js';

class AIService {
    constructor() {
        this.geminiClient = null;
        this.groqClient = null;
    }

    async getConfig() {
        const config = await prisma.config.findFirst();
        if (!config) {
            // Create default config if not exists
            return await prisma.config.create({
                data: {
                    bot_name: 'MyBot',
                    global_ai_mode: false,
                    ai_provider: 'gemini'
                }
            });
        }
        return config;
    }

    async getResponse(prompt, userId, userName, mediaData = null, options = {}) {
        try {
            const config = await this.getConfig();
            
            // If it's a command (like !ai), we ignore the global_ai_mode toggle
            // But if it's an auto-reply, we respect it.
            // For simplicity, we assume this is called when AI should respond.

            const systemPrompt = options.systemPrompt || config.system_prompt || `You are ${config.bot_name}, a helpful WhatsApp assistant. Answer concisely.`;

            if (config.ai_provider === 'gemini') {
                if (!config.gemini_api_key) return 'Error: Gemini API Key not configured.';
                const genAI = new GoogleGenerativeAI(config.gemini_api_key);
                const modelName = config.gemini_model || 'gemini-1.5-flash';
                const model = genAI.getGenerativeModel({ model: modelName });

                let parts = [];
                if (mediaData) {
                    // Vision request
                    parts.push({
                        inlineData: {
                            data: mediaData.buffer.toString('base64'),
                            mimeType: mediaData.mimetype || 'image/jpeg'
                        }
                    });
                }
                parts.push(prompt);

                const result = await model.generateContent(parts);
                const response = await result.response;
                return response.text();
            } 
            
            if (config.ai_provider === 'groq') {
                if (!config.groq_api_key) return 'Error: Groq API Key not configured.';
                const groq = new Groq({ apiKey: config.groq_api_key });
                const modelName = config.groq_model || 'llama-3.2-11b-vision-preview'; // Default to a vision model if available

                const messages = [
                    { role: 'system', content: systemPrompt }
                ];

                if (mediaData) {
                    // Groq Vision (Llama 3.2 Vision)
                    messages.push({
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mediaData.mimetype || 'image/jpeg'};base64,${mediaData.buffer.toString('base64')}`
                                }
                            }
                        ]
                    });
                } else {
                    messages.push({ role: 'user', content: prompt });
                }

                const completion = await groq.chat.completions.create({
                    messages: messages,
                    model: modelName,
                });
                return completion.choices[0]?.message?.content || '';
            }

            return 'Error: Invalid AI Provider configured.';
        } catch (error) {
            console.error('AI Service Error:', error);
            return 'Sorry, I encountered an error processing your request.';
        }
    }
}

export default new AIService();
