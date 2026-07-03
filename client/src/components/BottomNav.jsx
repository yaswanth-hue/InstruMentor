import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, BookOpen, Mic, User } from 'lucide-react';

// Icon-only, in this exact order. Order matters — it's what the sliding
// indicator below walks across.
const NAV_ITEMS = [
  { path: '/users', icon: Users, label: 'Discover musicians' },
  { path: '/courses', icon: BookOpen, label: 'Browse courses' },
  { path: '/audio-rooms', icon: Mic, label: 'Join audio rooms' },
  { path: '/profile', icon: User, label: 'Profile' },
];

// This floating nav must never appear inside a live audio room or a live
// meeting room — those screens need the full viewport and already have
// their own controls docked at the bottom.
const HIDDEN_ROUTE_PATTERNS = [
  /^\/audio-room\//,
  /^\/meeting\//,
  /^\/login/,
  /^\/signup/,
  /^\/$/,
];

// Keep these in sync with the button sizing classes below (w-12 = 48px,
// gap-2 = 8px) — the sliding indicator's offset is computed from them.
const ITEM_SIZE = 48;
const ITEM_GAP = 8;
const STEP = ITEM_SIZE + ITEM_GAP;

const BottomNav = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;
  if (HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(location.pathname))) return null;

  const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.path));

  return (
    <nav
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40"
      aria-label="Primary"
    >
      <div className="relative flex items-center gap-2 p-2 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/40">
        {/* Sliding active indicator */}
        {activeIndex !== -1 && (
          <div
            className="absolute top-2 left-2 w-12 h-12 rounded-full bg-white shadow-lg shadow-black/30 transition-transform duration-300 ease-out pointer-events-none"
            style={{ transform: `translateX(${activeIndex * STEP}px)` }}
          />
        )}

        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === activeIndex;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300"
            >
              <Icon
                className={`w-5 h-5 transition-colors duration-300 ${
                  isActive ? 'text-slate-900' : 'text-white/70 hover:text-white'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;