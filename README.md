# WhatsApp Bot Management Dashboard

A complete, production-ready WhatsApp Bot with a Web Dashboard, built with Node.js, Express, Baileys, and MySQL (Prisma).

## Features

- **Web Dashboard**: Manage config, owners, and monitor connection status.
- **QR Code Scanning**: Scan QR directly from the browser.
- **AI Integration**: Support for Google Gemini and Groq (Configurable).
- **Sticker Maker**: Convert images/videos to stickers with `/sticker`.
- **Anti-Link**: Auto-delete and kick for group links (Configurable).
- **Persistent Session**: Auto-reconnects using local file storage.

## Prerequisites

- Node.js (v18+)
- MySQL Database
- ffmpeg (for sticker creation)

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment**
    - Copy `.env` file (created automatically) and update `DATABASE_URL`.
    ```env
    DATABASE_URL="mysql://user:password@localhost:3306/database_name"
    ```

3.  **Database Migration**
    - Push the schema to your MySQL database:
    ```bash
    npx prisma db push
    ```

4.  **Start the Server**
    ```bash
    npm start
    ```

5.  **Access Dashboard**
    - Open `http://localhost:3000` in your browser.
    - Scan the QR code to connect.

## Project Structure

- `src/app.js`: Main entry point (Express + Socket.io).
- `src/lib/baileys.js`: WhatsApp connection logic.
- `src/controllers/botController.js`: Message handling logic.
- `src/services/`: AI, Database, and Sticker services.
- `src/views/`: EJS templates for the dashboard.
- `prisma/`: Database schema.

## AI Configuration

1.  Go to the Dashboard (`http://localhost:3000`).
2.  Enable "Global AI Mode" or configure per chat (database only for now).
3.  Select Provider (Gemini or Groq).
4.  Enter API Key.

## Commands

- `/menu`: Show available commands.
- `/sticker`: Reply to an image/video to create a sticker.
- `/ai [query]`: Ask the AI explicitly.
