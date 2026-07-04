import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Users, BookOpen, Home, Mic, User, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../firebase';

// Icon-only, in this exact order — Home sits in the middle and is the
// default/landing tab. Order matters, it's what the sliding indicator
// below walks across.
const NAV_ITEMS = [
  { path: '/users', icon: Users, label: 'Discover musicians' },
  { path: '/courses', icon: BookOpen, label: 'Browse courses' },
  { path: '/home', icon: Home, label: 'Home', isDefault: true },
  { path: '/audio-rooms', icon: Mic, label: 'Join audio rooms' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const DEFAULT_INDEX = NAV_ITEMS.findIndex((item) => item.isDefault);

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
  const [profilePic, setProfilePic] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfilePic(null);
      return;
    }
    // Live-subscribe so the avatar updates the moment the user changes
    // their profile picture, without needing a page reload.
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfilePic(snap.exists() ? snap.data()?.profilePic || null : null);
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) return null;
  if (HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(location.pathname))) return null;

  const matchedIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.path));
  const activeIndex = matchedIndex !== -1 ? matchedIndex : DEFAULT_INDEX;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="relative">
        {/* Nav pill — stays mounted so the same transition plays both ways:
            popping up to reveal itself, popping back down to hide. */}
        <nav
          aria-label="Primary"
          aria-hidden={collapsed}
          className={`flex items-center gap-2 p-2 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/40 origin-bottom transition-all duration-300 ease-out ${
            collapsed
              ? 'opacity-0 translate-y-4 scale-95 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100'
          }`}
        >
          {/* Sliding active indicator */}
          <div
            className="absolute top-2 left-2 w-12 h-12 rounded-full bg-white shadow-lg shadow-black/30 transition-transform duration-300 ease-out pointer-events-none"
            style={{ transform: `translateX(${activeIndex * STEP}px)` }}
          />

          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === activeIndex;
            const isProfile = item.path === '/profile';

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
                {isProfile && profilePic ? (
                  <span
                    className={`block w-7 h-7 rounded-full overflow-hidden ring-2 transition-all duration-300 ${
                      isActive ? 'ring-slate-900/70' : 'ring-white/40'
                    }`}
                  >
                    <img
                      src={profilePic}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </span>
                ) : (
                  <Icon
                    className={`w-5 h-5 transition-colors duration-300 ${
                      isActive ? 'text-slate-900' : 'text-white/70 hover:text-white'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse / expand handle — physically overlaps the pill's
            bottom edge so it reads as part of the nav bar, not a separate
            floating control. It stays put while the pill pops up/down
            behind it. */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Show navigation' : 'Hide navigation'}
          aria-expanded={!collapsed}
          className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-2xl border border-white/20 shadow-lg shadow-black/40 text-white/70 hover:text-white transition-colors duration-300"
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default BottomNav;