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
                           │ • RTCPeerConnection              │
                           │ • simple-peer                    │
                           │ • Audio + Video streams          │
                           │ • Browser-to-browser media       │
                           └──────────────────────────────────┘
```

**Why split it this way?** Firebase's client SDKs are already great at realtime listeners for *data* (posts, comments, profile updates). What they don't give you is low-latency signaling for WebRTC or transient room state that shouldn't be written to a database at all (who's currently muted, who raised a hand). The Socket.IO server exists specifically to fill that gap — it's deliberately small and stateless across restarts.

## Tech Stack

**Frontend**
- React 19 + React Router 7 (lazy-loaded routes, `Suspense` boundaries, error boundaries)
- Vite 6 with a hand-tuned `manualChunks` build (React, Firebase, and media libraries split into dedicated bundles to minimize HTTP requests on slow connections)
- Tailwind CSS 4 (Vite plugin, no PostCSS config needed)
- GSAP for animation, Lottie for vector animations, `react-easy-crop` for avatar/image cropping

**Real-time backend** (`server/`)
- Express 5 + Socket.IO 4, organized into `routes/` (REST), `sockets/` (event handlers), `controllers/`, and `services/` (state)
- In-memory `stateService` (plain `Map`s) for rooms, participants, chat history, sessions, and meeting progress
- WebRTC signaling via Socket.IO events; actual audio/video flows peer-to-peer using native `RTCPeerConnection` (video meetings) and `simple-peer` / PeerJS (audio rooms)
- `mediasoup` is included as a dependency for a possible future SFU-based upgrade, but the current implementation is mesh P2P, not SFU-routed

**Persistence & content**
- Firebase Auth (users), Firestore (posts, comments, courses, resources), Realtime Database, and Storage (media uploads)

**Security**
- Helmet (CSP, HSTS, frame/sniff protections), `express-rate-limit` (general/strict/API tiers), `hpp`, a custom request sanitizer, `express-validator`, and `bcryptjs`-based hashing utilities for data that isn't covered by Firebase Auth (e.g. room passcodes)

## Project Structure

```
Retro/
├── server/                    # Real-time + REST backend (Express + Socket.IO)
│   ├── app.js                  # Express app, security middleware pipeline
│   ├── index.js                # HTTP server bootstrap + Socket.IO init
│   ├── routes/api.js           # REST endpoints (rooms, course meetings, progress)
│   ├── controllers/            # Room & meeting request handlers
│   ├── services/stateService.js  # In-memory state store
│   └── sockets/                 # join/leave, chat, host controls, signaling
├── middleware/security.js      # Helmet, rate limiters, CORS, sanitization
├── utils/passwordSecurity.js   # bcrypt/crypto helpers for non-Firebase secrets
├── src/
│   ├── pages/                   # Route-level views (lazy-loaded except auth/landing)
│   ├── components/               # Shared UI (rooms, video, cards, social widgets)
│   ├── components/social/        # Feed-specific widgets (stories, trending, quick access)
│   ├── hooks/                    # e.g. useOptimizedQuery (caching query hook)
│   ├── lib/                      # Firestore helper functions (comments, interactions)
│   ├── utils/                    # Client-side cache/pagination/perf helpers
│   ├── config/socketConfig.js    # Socket.IO client connection config
│   ├── firebase.js               # Firebase SDK init (Auth, Firestore, RTDB, Storage)
│   ├── App.jsx                   # Router + auth-gated routes
│   └── main.jsx                  # Entry point
├── public/                     # Static assets
├── vite.config.js
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Firebase project with Auth, Firestore, Realtime Database, and Storage enabled

### Installation

```bash
git clone <your-repo-url>
cd Retro
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Fill in your Firebase project credentials and server settings (see [Environment Variables](#environment-variables)).

### Run it

This is two processes, run in two terminals:

```bash
# Terminal 1 — Vite dev server (the React app)
npm run dev          # http://localhost:5173

# Terminal 2 — Real-time/API server
npm run server       # http://localhost:3001
# or, with auto-restart on change:
npm run server:dev   # requires nodemon installed (it isn't a listed dependency — add it or install globally)
```

Audio rooms, video meetings, and chat all depend on the server in Terminal 2 being up. Everything else (auth, feed, courses, resources) talks to Firebase directly and will work even without it.

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_MEASUREMENT_ID` | Client | Standard Firebase SDK config |
| `VITE_SOCKET_SERVER_URL` | Client | Where the React app connects for Socket.IO |
| `PORT` | Server | Port for the Express/Socket.IO server (default `3001`) |
| `CORS_ORIGIN` | Server | Comma-separated allowlist of origins permitted by CORS/Socket.IO |
| `NODE_ENV` | Server | `development` \| `production` |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Server | Tunables for the general rate limiter |
| `SESSION_SECRET`, `JWT_SECRET` | Server | Reserved for session/token signing if you extend auth beyond Firebase |

See `.env.example` for the full annotated list, including SSL/proxy settings that only matter if you put the server behind a load balancer yourself.

## Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` (manual chunking for React/Firebase/media) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint over the project |
| `npm run server` | Start the Socket.IO/Express server |
| `npm run server:dev` | Same, with nodemon (install it first) |
| `npm run health` | curl the `/health` endpoint |
| `npm run security:audit` / `:fix` | `npm audit` wrappers |
| `npm run docker:*`, `npm run scale:*` | Placeholders for a future Docker Compose + Nginx + Redis horizontal-scaling setup — there's no `docker-compose.yml` or `Dockerfile` in this repo yet, so these aren't runnable out of the box (see [Known Limitations](#known-limitations--roadmap)) |

## Real-Time Layer in Detail

The Socket.IO server (`server/sockets/`) is the backbone for both audio rooms and video meetings:

- **Presence & state**: `join-room` / `leave-room` register a participant in the in-memory `stateService`, broadcast `participants-updated`, and emit chat history for the session.
- **Controls**: `toggle-mute`, `raise-hand`, and host-only events (`host-mute-participant`, `host-set-media-permissions`, `host-lock-room`, `end-room`) are validated against the room's `host_id` before being applied.
- **Cleanup**: rooms left empty are scheduled for deletion after a 30-second grace period, so a brief disconnect/reconnect doesn't tear down the room.
- **Signaling**: WebRTC offer/answer/ICE candidates are relayed through Socket.IO; the actual media never touches the server — it's a direct peer-to-peer mesh between participants' browsers.
- **Room creation/listing** is a small REST API (`server/routes/api.js`) backed by the same in-memory store, with results broadcast over Socket.IO (`room-created`, `room-deleted`) so list pages stay live without polling.

## Security

The Express app runs every request through a fixed middleware pipeline (`server/app.js` → `middleware/security.js`):

`Helmet (CSP/HSTS/frameguard) → CORS allowlist → body size limits → HPP protection → custom input sanitizer → request logging → rate limiting`

A few specifics worth knowing:
- Three rate-limit tiers exist (`generalLimiter`, `strictLimiter` for sensitive actions, `apiLimiter` for API routes) — wire `strictLimiter` into any auth-adjacent endpoints you add.
- The sanitizer strips `<script>`/`<iframe>` tags and inline event handlers from request bodies/query/params, while explicitly skipping fields like `password_hash` and `token` so hashes aren't mangled.
- `utils/passwordSecurity.js` provides bcrypt-based hashing for things Firebase Auth doesn't cover (e.g. a private room's passcode) — Firebase still owns actual user password hashing.
- CORS origins and rate-limit thresholds are environment-driven, not hardcoded.

## Build & Deployment

The frontend and real-time server are deployed as two separate things:

- **Frontend** (`npm run build` → `dist/`): any static host works well — Vercel, Netlify, Cloudflare Pages, or Firebase Hosting.
- **Server** (`server/`): needs a host that supports long-lived WebSocket connections (Render, Railway, Fly.io, or a plain VM/container). As shipped, it runs as a single process with in-memory state — see [Known Limitations](#known-limitations--roadmap) before you scale it horizontally.

## Known Limitations & Roadmap

Being upfront about the current state so it's easy to plan around:

- **Single-instance, in-memory state.** Rooms, participants, and session chat history live in a JS `Map` inside one Node process. Restarting the server clears all active rooms; running multiple instances behind a load balancer will *not* share state out of the box.
- **No horizontal scaling implemented yet.** The `docker:*`/`scale:*` npm scripts anticipate a future Docker Compose + Nginx + Redis setup, but that infrastructure isn't in this repo. The natural next step would be a `socket.io-redis` adapter plus moving `stateService` onto Redis.
- **Mesh WebRTC doesn't scale past a handful of participants per room** by nature (each browser opens a connection to every other browser). `mediasoup` is already a dependency if you want to move to an SFU model for larger rooms.
- **No automated test suite** is currently included.

## License

No license file is currently included in this repository — add one (MIT is a common default for a project like this) before sharing it publicly or accepting outside contributions.