# Once Upon You

Interactive React + Node app for creating personalized coloring books from uploaded photos.

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express + OpenAI Images API

## Prerequisites
- Node.js 20+
- npm
- OpenAI API key

## Setup
1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

3. Create backend env file:
```bash
cp server/.env.example server/.env
```

4. Set your key in `server/.env`:
```env
OPENAI_API_KEY=your_real_key_here
PORT=5001
CLEANUP_SESSION_AFTER_ORDER=true
```

## Run Locally
1. Start backend:
```bash
cd server
node server.js
```

2. In a second terminal, start frontend:
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`

## GitHub Safety
Sensitive and generated files are ignored by `.gitignore`, including:
- `.env`
- `server/.env`
- `server/generated-orders/`
- `server/orders/`
- `node_modules/`
- `dist/`

Do not commit real API keys. Use `server/.env.example` for shared configuration templates.
