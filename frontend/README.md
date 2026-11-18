# Agent Pixelate — Frontend Studio (`/frontend`)

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion frontend for **Agent Pixelate**, featuring an **Obsidian Canvas** creative studio interface.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables (Optional)

By default, the client targets the local orchestrator at `http://localhost:8000` and WebSocket stream `ws://localhost:8000/ws/campaign/{campaign_id}`. If unreachable, or when **Mock Mode** is toggled on in the top bar, the UI seamlessly streams realistic simulated multi-agent telemetry and assets.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

## Production Verification

```bash
npm run lint
npm run build
```
