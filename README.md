# Citadelscreen

The software that citadel provides.

> Your digital command center. Build your web. Control your day.

A personal AI command center, productivity dashboard, and browser home screen — one screen for everything you run.

## Requirements

- **Node.js ≥ 18.17** (Next.js 14 requirement). The current machine has Node 12 — install [Node 20 LTS](https://nodejs.org/) (or use `nvm-windows`) before running.

## Run

```bash
npm install
npm run serve
```

Open <http://127.0.0.1:3000>.

`npm run serve` builds the app once, then runs the optimized server. Use this
for everyday use: pages are compiled before you click them. After a successful
build, `npm start` launches the same build without rebuilding. Run `npm run serve`
again after changing source files. Stop the running server before rebuilding.

For code editing with hot reload, use `npm run dev -- --hostname 127.0.0.1`.
Development mode compiles routes on demand and can pause on the first visit.
Production output lives in `.next-production`; development output uses `.next`.

## What's in the box

- **Node Mode** — the main visual identity. An interactive React Flow graph centered on the Citadel core, with draggable app/automation/AI/reminder nodes, animated edges between related tools, and hover/click states. Layout persists to localStorage.
- **Dashboard Mode** — toggled via the "Unnode" button in the top bar. A traditional dashboard with daily brief, recent Gmail, upcoming calendar, reminders, n8n automations, AI tools, and app shortcuts. Smooth Framer Motion transitions between modes.
- **Side panel** — click any node to open a sleek right-side panel. Custom views for Gmail, Calendar, n8n, Reminders, AI assistants, the Citadel core, and a generic app fallback.
- **8 pages** — Home, Network (graph editor), Apps, Automations, Inbox, Calendar, Reminders, Settings.
- **Settings = control panel** — feature toggles for each surface (inbox/calendar/reminders/automations/aiTools/drive/tasks/network), theme accent, graph behavior (grid, edges, minimap), default view mode, and reset controls.
- **n8n webhooks** — stubbed for now. Triggering a workflow shows a toast and increments the run counter. Each automation has a webhook URL field for when you wire it up live.

## Stack

- Next.js 14 (app router) · React 18 · TypeScript
- Tailwind CSS · Framer Motion · React Flow · Lucide React
- Zustand (with `persist` middleware) for state + localStorage

## Sample data

All Gmail / Calendar / Apps / Reminders / Automations data is fake and lives under `src/lib/data/`. State for reminders, automations, node positions, and preferences persists in `localStorage` under `citadel-store`. Clear it from **Settings → Reset → Clear all local state**.

## Notes

- Webhooks are stubbed. To wire to a real n8n endpoint, replace the `triggerAutomation` body in `src/lib/store.ts` with a `fetch(webhookUrl, { method: "POST" })` call.
- Real OAuth (Gmail / Calendar / Drive) is intentionally not wired. The data shape in `src/lib/types.ts` is real-API-shaped so swapping fake data for a backend later is mostly a one-file change per surface.
