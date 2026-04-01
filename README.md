# Strangr 🔌

> Real-time anonymous 1-on-1 chat. No accounts. No logs. Just strangers.

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start in development mode (auto-reload)
npm run dev

# 3. Or start in production mode
npm start
```

Open → http://localhost:3000

---

## Project Structure

```
strangr/
├── server.js          ← Express + Socket.IO backend
├── package.json
├── vercel.json        ← Vercel deployment config
├── .gitignore
└── public/
    ├── index.html     ← App shell
    ├── style.css      ← All styles
    └── script.js      ← Socket.IO client logic
```

---

## How It Works

1. User opens the site → socket connects → added to `waitingQueue`
2. As soon as 2 users are waiting → `createRoom()` is called
3. Both users join the same Socket.IO room and can exchange messages
4. **Skip** → user leaves current room, partner is re-queued, user is re-queued
5. **Disconnect** → partner is automatically re-queued
6. All state lives in memory — no database needed

---

## API

| Endpoint | Description |
|----------|-------------|
| `GET /`  | Serves the chat UI |
| `GET /stats` | Returns `{ online, waiting, activeRooms }` as JSON |

### Socket Events

| Event (client → server) | Description |
|--------------------------|-------------|
| `message` (text)         | Send a chat message |
| `skip`                   | Leave current room, re-queue |

| Event (server → client) | Description |
|--------------------------|-------------|
| `waiting`                | Added to queue, waiting for match |
| `matched` `{ roomId }`   | Room created, chat can begin |
| `message` (text)         | Incoming message from partner |
| `partnerLeft`            | Partner disconnected or skipped |

---

## Deployment

### ⚠️ Vercel Limitation

Vercel runs Node.js as **serverless functions** — each request spins up and tears down instantly. **WebSockets require a persistent process**, so Socket.IO's WebSocket transport won't work reliably on Vercel's free tier.

The `vercel.json` included will work for HTTP long-polling (Socket.IO will fall back automatically), but it's not ideal.

### ✅ Recommended: Deploy on Render (Free, WebSocket-native)

**Render.com** keeps your process running 24/7 and supports WebSockets natively.

```bash
# 1. Push code to a GitHub repo
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/strangr.git
git push -u origin main

# 2. Go to https://render.com → New → Web Service
# 3. Connect your GitHub repo
# 4. Settings:
#    - Build Command: npm install
#    - Start Command: npm start
#    - Environment: Node
#    - Plan: Free
# 5. Click "Deploy" → done!
```

Render gives you a URL like `https://strangr.onrender.com`.

### Alternative: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Alternative: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

fly launch
fly deploy
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |

---

## 🚀 Suggested Improvements (Production Roadmap)

### v2 — Quality of Life
- **Typing indicator** — `typing` / `stopTyping` socket events
- **Message timestamps** — add `Date.now()` to each message object
- **Reconnect grace period** — hold room open for 10s on disconnect

### v3 — Matching
- **Interest tags** — user picks 1–3 topics; match only shares-interest pairs
- **Language detection** — auto-match by browser locale

### v4 — Moderation
- **Client-side profanity filter** before emitting
- **Report button** — emit a `report` event, log to a moderation queue
- **Rate limiting** — max N messages per 10s per socket (already easy to add in `server.js`)

### v5 — Scale
- **Redis adapter** for Socket.IO — allows multiple Node processes
  ```bash
  npm install @socket.io/redis-adapter redis
  ```
- **Sticky sessions** on load balancer (or use Redis pub/sub)
- **Prometheus metrics** endpoint for monitoring room churn, queue depth

---

## License

MIT
