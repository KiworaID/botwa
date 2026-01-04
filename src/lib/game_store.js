// In-memory store for active game sessions
// Key: chat JID
// Value: { type: 'tebakkata' | 'tebakgambar', answer: string, original: object, startTime: number }

export const gameSessions = new Map();
