<div align="center">

# 🎼 InstruMentor

**A real-time music-learning platform that blends structured courses, a social feed, and live audio/video collaboration into one app.**

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)](https://socket.io)
[![Firebase](https://img.shields.io/badge/Firebase-11-ffca28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

</div>

---

## Overview

InstruMentor is a React single-page app for learning musical instruments together. It pairs a **Firebase-backed content & social layer** (courses, learning resources, profiles, posts, comments, messaging) with a **custom Node/Socket.IO real-time layer** that powers live audio practice rooms and video course meetings over peer-to-peer WebRTC.

It's built as two cooperating halves rather than one monolith:

- **Firebase is the system of record.** Auth, user/post/comment data (Firestore), presence-style data (Realtime Database), and uploaded media (Storage) all live there. Most pages talk to Firebase directly from the client.
- **A lightweight Node server handles only ephemeral, real-time concerns** — who's in a room right now, chat history for the current session, mute/host state, and WebRTC signaling. This state is intentionally *not* persisted to a database; it lives in memory for the lifetime of the process.

That split keeps the durable social/learning data simple and consistent while letting the live-collaboration features stay fast and stateless-by-design.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Real-Time Layer in Detail](#real-time-layer-in-detail)
- [Security](#security)
- [Build & Deployment](#build--deployment)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [License](#license)

## Features

| Pillar | What it does |
|---|---|
| 🎸 **Learning Library** | Browse instruments and skill levels, view/add learning resources, rate and comment on them |
| 👥 **Social Feed** | Profiles, follow/unfollow, image posts, comments, trending & "stories" panels, direct messaging |
| 🎙️ **Live Audio Rooms** | Voice-only practice rooms with mute, hand-raise, host controls, optional password lock, and session recording |
| 📹 **Video Course Meetings** | Scheduled course meetings with HD video, screen share, chat, and recording playback |
| 📈 **Course Management** | Create/enroll in courses, schedule meetings, track per-user progress through a creator dashboard |
| 🔐 **Hardened API surface** | Helmet CSP, tiered rate limiting, HPP protection, input sanitization, and a CORS allowlist in front of every request |

## Architecture

```
┌──────────────────────────────────────────────┐
│                 React 19 SPA                 │
│        Vite 6 · Tailwind 4 · Router          │
│        Route-level Code Splitting            │
└───────────────────┬──────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼

┌──────────────────────┐   ┌──────────────────────────────────┐
│       Firebase       │   │    Node + Express + Socket.IO    │
│                      │   │    "real-time" server (server/)  │
│ • Authentication     │   │                                  │
│ • Firestore          │   │ • Room & participant state       │
│ • Realtime Database  │   │ • Chat history (in-memory)       │
│ • Storage            │   │ • WebRTC signaling               │
│                      │   │                                  │
│ System of record for │   └───────────────┬──────────────────┘
│ users, posts,        │                   │
│ courses, resources   │                   │ Signaling
└──────────────────────┘                   │ (Offer/Answer/ICE)
                                           ▼

                           ┌──────────────────────────────────┐
                           │      Mesh WebRTC Peer Links      │
                           │                                  │
                           │ • Native RTCPeerConnection       │
                           │ • Audio + Video streams          │
                           │ • Browser-to-browser media       │
                           └──────────────────────────────────┘
```

**Why split it this way?** Firebase's client SDKs are already great at realtime listeners for *data* (posts, comments, profile updates). What they don't give you is low-latency signaling for WebRTC or transient room state that shouldn't be written to a database at all (who's currently muted, who raised a hand). The Socket.IO server exists specifically to fill that gap — it's deliberately small and stateless across restarts.

## Tech Stack

**Frontend** (`client/`)
- React 19 + React Router 7 (lazy-loaded routes, `Suspense` boundaries, error boundaries)
- Vite 6 with a hand-tuned `manualChunks` build (React, Firebase, and Socket.IO split into dedicated bundles to minimize HTTP requests on slow connections)
- Tailwind CSS 4 (Vite plugin, no PostCSS config needed)
- GSAP for animation, `react-easy-crop` for avatar/image cropping

**Real-time backend** (`server/`)
- Express 5 + Socket.IO 4, organized into `routes/` (REST), `sockets/` (event handlers), `controllers/`, `services/` (state), and `utils/` (shared helpers)
- In-memory `stateService` (plain `Map`s) for rooms, participants, chat history, sessions, and meeting progress
- WebRTC signaling via Socket.IO events; actual audio/video flows peer-to-peer using native `RTCPeerConnection` — both video meetings and audio rooms are mesh P2P, no SFU/media-server dependency

**Persistence & content**
- Firebase Auth (users), Firestore (posts, comments, courses, resources), Realtime Database, and Storage (media uploads), via `firebase` (client SDK) and `firebase-admin` (server SDK)

**Security**
- Helmet (CSP, HSTS, frame/sniff protections), `express-rate-limit` (general/strict/API tiers), `hpp`, a custom request sanitizer, `express-validator`, and `bcryptjs`-based hashing for data that isn't covered by Firebase Auth (e.g. room passcodes) — hashing and verification both happen server-side; the client only ever sends/receives plaintext over TLS, never a hash

## Project Structure

```
InstruMentor/
├── package.json                # Orchestrator — runs client + server together
├── client/
│   ├── package.json              # Frontend dependencies only
│   ├── vite.config.js
│   ├── index.html
│   ├── public/                   # Static assets
│   └── src/
│       ├── pages/                  # Route-level views (lazy-loaded except auth/landing)
│       ├── components/             # Shared UI (rooms, video, cards, social widgets)
│       ├── components/social/      # Feed-specific widgets (stories, trending, quick access)
│       ├── hooks/                  # e.g. useOptimizedQuery (caching query hook)
│       ├── lib/                    # Firestore helper functions (comments, interactions)
│       ├── utils/                  # Client-side cache/pagination/perf helpers
│       ├── config/socketConfig.js  # Socket.IO client connection config
│       ├── firebase.js             # Firebase SDK init (Auth, Firestore, RTDB, Storage)
│       ├── App.jsx                 # Router + auth-gated routes
│       └── main.jsx                # Entry point
└── server/
    ├── package.json              # Backend dependencies only
    ├── app.js                     # Express app, security middleware pipeline
    ├── index.js                   # HTTP server bootstrap + Socket.IO init
    ├── routes/api.js              # REST endpoints (rooms, course meetings, progress)
    ├── controllers/               # Room & meeting request handlers
    ├── services/stateService.js   # In-memory state store
    ├── sockets/                    # join/leave, chat, host controls, signaling
    ├── middleware/security.js     # Helmet, rate limiters, CORS, sanitization
    └── utils/passwordSecurity.js  # bcryptjs helpers for non-Firebase secrets (room passwords)
```

`client/` and `server/` are independent npm workspaces — each has its own `package.json`, `node_modules`, and `.env`. There are no cross-imports between them; the only connection is HTTP/WebSocket calls over `VITE_SOCKET_SERVER_URL` / `CORS_ORIGIN`.

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Firebase project with Auth, Firestore, Realtime Database, and Storage enabled

### Installation

```bash
git clone <your-repo-url>
cd InstruMentor
npm run install-all   # installs root, client/, and server/ dependencies
```

### Configure environment

Each workspace has its own env file:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Fill in your Firebase project credentials in `client/.env` and your server settings in `server/.env` (see [Environment Variables](#environment-variables)).

### Run it

```bash
npm run dev   # starts both client (5173) and server (3001) together via concurrently
```

Or run them separately in two terminals if you want isolated logs:

```bash
npm run client   # Vite dev server — http://localhost:5173
npm run server   # Express + Socket.IO server — http://localhost:3001
```

Audio rooms, video meetings, and chat all depend on the server in Terminal 2 being up. Everything else (auth, feed, courses, resources) talks to Firebase directly and will work even without it.

## Environment Variables

| Variable | File | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_MEASUREMENT_ID` | `client/.env` | Standard Firebase SDK config |
| `VITE_SOCKET_SERVER_URL` | `client/.env` | Where the React app connects for Socket.IO |
| `PORT` | `server/.env` | Port for the Express/Socket.IO server (default `3001`) |
| `CORS_ORIGIN` | `server/.env` | Comma-separated allowlist of origins permitted by CORS/Socket.IO |
| `NODE_ENV` | `server/.env` | `development` \| `production` |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | `server/.env` | Tunables for the general rate limiter |
| `SESSION_SECRET`, `JWT_SECRET` | `server/.env` | Reserved for session/token signing if you extend auth beyond Firebase |

See `client/.env.example` and `server/.env.example` for the full annotated lists, including SSL/proxy settings that only matter if you put the server behind a load balancer yourself.

## Available Scripts

**Root** (`InstruMentor/package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Runs `server` and `client` together via `concurrently` |
| `npm run client` | Starts the Vite dev server (delegates to `client/`) |
| `npm run server` | Starts the Express/Socket.IO server with nodemon (delegates to `server/`) |
| `npm run install-all` | Installs root, `client/`, and `server/` dependencies in one command |
| `npm run health` | curl the `/health` endpoint |

**Client** (`client/package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `client/dist/` (manual chunking for React/Firebase/Socket.IO) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint over the client source |

**Server** (`server/package.json`)

| Script | What it does |
|---|---|
| `npm start` | Start the server with plain `node` (production) |
| `npm run dev` | Start the server with `nodemon` (auto-restart on change) |
| `npm run security:audit` / `:fix` | `npm audit` wrappers |

## Real-Time Layer in Detail

The Socket.IO server (`server/sockets/`) is the backbone for both audio rooms and video meetings:

- **Presence & state**: `join-room` / `leave-room` register a participant in the in-memory `stateService`, broadcast `participants-updated`, and emit chat history for the session.
- **Controls**: `toggle-mute`, `raise-hand`, and host-only events (`host-mute-participant`, `host-set-media-permissions`, `host-lock-room`, `end-room`) are validated against the room's `host_id` before being applied.
- **Cleanup**: rooms left empty are scheduled for deletion after a 30-second grace period, so a brief disconnect/reconnect doesn't tear down the room.
- **Signaling**: WebRTC offer/answer/ICE candidates are relayed through Socket.IO; the actual media never touches the server — it's a direct peer-to-peer mesh between participants' browsers.
- **Room creation/listing** is a small REST API (`server/routes/api.js`) backed by the same in-memory store, with results broadcast over Socket.IO (`room-created`, `room-deleted`) so list pages stay live without polling.

## Security

The Express app runs every request through a fixed middleware pipeline (`server/app.js` → `server/middleware/security.js`):

`Helmet (CSP/HSTS/frameguard) → CORS allowlist → body size limits → HPP protection → custom input sanitizer → request logging → rate limiting`

A few specifics worth knowing:
- Three rate-limit tiers exist (`generalLimiter`, `strictLimiter` for sensitive actions, `apiLimiter` for API routes) — wire `strictLimiter` into any auth-adjacent endpoints you add.
- The sanitizer strips `<script>`/`<iframe>` tags and inline event handlers from request bodies/query/params, while explicitly skipping fields like `password_hash` and `token` so hashes aren't mangled.
- `server/utils/passwordSecurity.js` provides `bcryptjs`-based hashing for things Firebase Auth doesn't cover (private room passcodes) — Firebase still owns actual user password hashing. Hashing and verification happen entirely server-side: `POST /api/audio-rooms` accepts a plaintext password and hashes it before storing; `GET /api/audio-rooms*` never returns `password_hash` to the client; a dedicated `POST /api/audio-rooms/:id/verify-password` checks a submitted plaintext password against the stored hash and returns only `{ valid: boolean }`. The client never sees or computes a hash.
- CORS origins and rate-limit thresholds are environment-driven, not hardcoded.

## Build & Deployment

The frontend and real-time server are deployed as two separate Render services, sharing one repo via Root Directory:

- **Frontend** — Static Site, Root Directory `client`, Build Command `npm install && npm run build`, Publish Directory `dist`.
- **Server** — Web Service, Root Directory `server`, Build Command `npm install`, Start Command `npm start`. Needs a host that supports long-lived WebSocket connections (Render, Railway, Fly.io, or a plain VM/container also work). As shipped, it runs as a single process with in-memory state — see [Known Limitations](#known-limitations--roadmap) before you scale it horizontally.

Set each service's environment variables in its own Render dashboard (not from a committed `.env` — those are gitignored). The backend's `CORS_ORIGIN` needs to include the deployed frontend URL, and the frontend's `VITE_SOCKET_SERVER_URL` needs to point at the deployed backend URL — not `localhost`.

## Known Limitations & Roadmap

Being upfront about the current state so it's easy to plan around:

- **Single-instance, in-memory state.** Rooms, participants, and session chat history live in a JS `Map` inside one Node process. Restarting the server clears all active rooms; running multiple instances behind a load balancer will *not* share state out of the box.
- **No horizontal scaling implemented yet.** The natural next step would be a `socket.io-redis` adapter plus moving `stateService` onto Redis. No Docker/Nginx config exists in this repo yet — that's a deliberate future addition, not a stripped-down placeholder.
- **Mesh WebRTC doesn't scale past a handful of participants per room** by nature (each browser opens a connection to every other browser). Moving to an SFU model (e.g. `mediasoup`) would be the path to larger rooms, but that's not implemented currently.
- **No automated test suite** is currently included.

## License

No license file is currently included in this repository — add one (MIT is a common default for a project like this) before sharing it publicly or accepting outside contributions.