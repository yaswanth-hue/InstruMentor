# InstruMentor - Music Learning Platform

A comprehensive music education platform with social features, real-time audio rooms, video meetings, and course management.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📚 Documentation

All comprehensive guides are in the **[docs/](docs/)** folder:

### 🎯 Quick Links
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - Developer cheat sheet
- **[Optimization Guide](docs/OPTIMIZATION_GUIDE.md)** - Complete performance guide
- **[3G Optimization](docs/3G_OPTIMIZATION_GUIDE.md)** - Mobile network optimization
- **[Security Guide](docs/SECURITY.md)** - Security best practices

### 📖 Full Documentation Index
See **[docs/README.md](docs/README.md)** for complete documentation index

---

## ✨ Features

### 🎵 Learning Platform
- Multi-instrument support (Guitar, Piano, Drums, etc.)
- Skill level progression (Beginner → Advanced)
- Resource library with ratings and comments
- User-generated content

### 👥 Social Features
- User profiles and following system
- Social feed with posts and images
- Direct messaging
- User discovery

### 🎙️ Real-time Audio Rooms
- Voice-only rooms for practice
- Screen sharing
- Recording functionality
- Host controls

### 📹 Video Meetings
- HD video conferencing
- Screen sharing
- Chat and reactions
- Recording and playback

### 📚 Course Management
- Create and enroll in courses
- Scheduled meetings
- Progress tracking
- Creator dashboard

---

## 🎯 Performance

### Optimizations Implemented
- ✅ **React Suspense** - Lazy loading for all routes
- ✅ **Code splitting** - 19 page chunks + 4 vendor chunks
- ✅ **Smart caching** - 5-minute TTL on queries
- ✅ **Error boundaries** - Graceful error handling
- ✅ **Loading states** - Consistent UI across app
- ✅ **3G optimization** - 35% fewer HTTP requests

### Performance Metrics
- **Initial load**: 8-10s on 3G (was 60s)
- **Bundle size**: ~400KB initial (was 2.5MB)
- **HTTP requests**: 18-20 (was 29)
- **Code coverage**: 19 lazy-loaded routes

See **[docs/OPTIMIZATION_SUMMARY.md](docs/OPTIMIZATION_SUMMARY.md)** for details.

---

## 🔒 Security

- Password hashing with bcrypt
- JWT authentication
- Rate limiting
- Input validation
- XSS protection
- Helmet security headers

See **[docs/SECURITY.md](docs/SECURITY.md)** for details.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **React Router 7** - Routing with lazy loading
- **Tailwind CSS 4** - Styling with JIT compiler
- **Vite 6** - Build tool with optimized chunking
- **Lucide React** - Icon library

### Backend & Real-time
- **Firebase** - Authentication, Firestore, Realtime Database
- **Socket.IO** - Real-time communication
- **WebRTC** - Peer-to-peer audio/video
- **Simple-peer** - WebRTC wrapper
- **PeerJS** - P2P connections

### Media Processing
- **MediaSoup** - Media server
- **RecordRTC** - Recording functionality
- **GSAP** - Animations

---

## 📁 Project Structure

```
Retro/
├── src/
│   ├── components/       # Reusable components
│   ├── pages/           # Page components (lazy-loaded)
│   ├── context/         # React context providers
│   ├── hooks/           # Custom hooks
│   ├── utils/           # Utilities (cache, pagination, performance)
│   ├── lib/             # Firebase helpers
│   ├── config/          # Configuration files
│   ├── assets/          # Images, audio files
│   ├── firebase.js      # Firebase initialization
│   ├── App.jsx          # Main app with routing
│   └── main.jsx         # Entry point
├── docs/                # All documentation
├── dist/                # Production build
├── public/              # Static assets
└── server.js            # Socket.IO server
```

---

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## 🚢 Deployment

### Recommended Platforms
- **Vercel** - Best for React apps, automatic optimization
- **Netlify** - Easy deployment with CI/CD
- **Cloudflare Pages** - Global CDN, fast worldwide
- **Firebase Hosting** - Integrated with Firebase backend

### Deploy Commands
```bash
# Build for production
npm run build

# Deploy to Vercel
npx vercel

# Deploy to Netlify
npx netlify deploy --prod
```

---

## 📊 Performance Testing

See **[docs/TEST_RESULTS.md](docs/TEST_RESULTS.md)** for complete testing guide.

---

## 📝 Scripts

```bash
npm run dev          # Start development server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run server       # Start Socket.IO server (port 3001)
npm run server:dev   # Start server with nodemon
```

---

## 🐛 Troubleshooting

See **[docs/3G_OPTIMIZATION_GUIDE.md](docs/3G_OPTIMIZATION_GUIDE.md)** for performance troubleshooting.

---

## 📞 Support

- **Documentation**: See [docs/README.md](docs/README.md)
- **Performance**: See [docs/OPTIMIZATION_GUIDE.md](docs/OPTIMIZATION_GUIDE.md)
- **Security**: See [docs/SECURITY.md](docs/SECURITY.md)
- **3G Issues**: See [docs/3G_OPTIMIZATION_GUIDE.md](docs/3G_OPTIMIZATION_GUIDE.md)

---

*Last updated: January 2025*
*Status: Production-ready with optimizations ✅*
