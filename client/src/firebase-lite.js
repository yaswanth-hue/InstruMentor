/**
 * Firebase Lite - Minimal Firebase initialization for fast initial load
 * Full Firebase SDK loaded lazily when needed
 */

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize minimal Firebase - just app and auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Lazy load full Firebase when needed
let fullFirebaseLoaded = false;
let fullFirebasePromise = null;

export const loadFullFirebase = () => {
  if (fullFirebaseLoaded) {
    return Promise.resolve();
  }

  if (fullFirebasePromise) {
    return fullFirebasePromise;
  }

  fullFirebasePromise = import('./firebase').then(() => {
    fullFirebaseLoaded = true;
    return true;
  });

  return fullFirebasePromise;
};

export { auth, onAuthStateChanged };
