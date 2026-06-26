import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorBoundary from "./components/ErrorBoundary";
import { HelmetProvider } from 'react-helmet-async';

// Critical pages - loaded immediately (above the fold)
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUp from "./pages/SignUp";
import SocialHomePage from "./pages/SocialHomePage";

// Lazy-loaded pages - loaded on demand
const HomePage = lazy(() => import("./pages/HomePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const AddResource = lazy(() => import("./pages/AddResource"));
const ManageResources = lazy(() => import("./pages/ManageResources"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const InstrumentPage = lazy(() => import("./pages/InstrumentPage"));
const ResourceListPage = lazy(() => import("./pages/ResourceListPage"));
const AudioRoomsListPage = lazy(() => import("./pages/AudioRoomsListPage"));
const AudioRoomPage = lazy(() => import("./pages/AudioRoomPage"));
const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"));
const MeetingPage = lazy(() => import("./pages/MeetingPage"));
const FirebaseTestPage = lazy(() => import("./pages/FirebaseTestPage"));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <LoadingSpinner message="Authenticating..." />;
  }

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
            {/* Root route */}
            <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/home" />} />

            {/* Public routes */}
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/home" />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/home" />} />

            {/* Protected routes */}
            <Route path="/home" element={user ? <SocialHomePage /> : <Navigate to="/login" />} />
            <Route path="/original-home" element={user ? <HomePage /> : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <UserProfilePage /> : <Navigate to="/login" />} />
            <Route path="/profile-settings" element={user ? <ProfileSettingsPage /> : <Navigate to="/login" />} />
            <Route path="/user-profile/:userId" element={user ? <UserProfilePage /> : <Navigate to="/login" />} />
            <Route path="/add-resource" element={user ? <AddResource /> : <Navigate to="/login" />} />
            <Route path="/manage-resources" element={user ? <ManageResources /> : <Navigate to="/login" />} />
            <Route path="/instrument/:instrument" element={user ? <InstrumentPage /> : <Navigate to="/login" />} />
            <Route path="/instrument/:instrument/:level" element={user ? <ResourceListPage /> : <Navigate to="/login" />} />

            {/* Audio Rooms Routes */}
            <Route path="/audio-rooms" element={<AudioRoomsListPage />} />
            <Route path="/audio-room/:roomId" element={user ? <AudioRoomPage /> : <Navigate to="/login" />} />

            {/* Social Network Routes */}
            <Route path="/users" element={user ? <UsersPage /> : <Navigate to="/login" />} />
            <Route path="/messages" element={user ? <MessagesPage /> : <Navigate to="/login" />} />
            <Route path="/post/:postId" element={user ? <PostDetailPage /> : <Navigate to="/login" />} />

            {/* Course Routes */}
            <Route path="/courses" element={user ? <CoursesPage /> : <Navigate to="/login" />} />
            <Route path="/course/:courseId" element={user ? <CourseDetailPage /> : <Navigate to="/login" />} />
            <Route path="/course/:courseId/manage" element={user ? <CoursePage /> : <Navigate to="/login" />} />
            <Route path="/meeting/:meetingId" element={user ? <MeetingPage /> : <Navigate to="/login" />} />
            <Route path="/test-firebase" element={user ? <FirebaseTestPage /> : <Navigate to="/login" />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
