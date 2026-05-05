import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  User,
  Mail,
  Clock,
  Edit2,
  Save,
  X,
  Settings
} from 'lucide-react';

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Edit states
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Screen time tracking
  const [screenTime, setScreenTime] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  });
  const [sessionStart, setSessionStart] = useState(Date.now());

  useEffect(() => {
    loadProfileData();

    // Track session time
    const sessionStartTime = Date.now();
    setSessionStart(sessionStartTime);

    // Update screen time every minute
    const interval = setInterval(() => {
      updateScreenTime();
    }, 60000); // Update every minute

    // Save screen time when component unmounts
    return () => {
      clearInterval(interval);
      saveScreenTime();
    };
  }, []);

  const loadProfileData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      navigate('/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile(data);
        setDisplayName(data.displayName || '');
        setBio(data.bio || '');
        setUsername(data.username || '');
        setIsPrivate(data.isPrivate || false);

        // Load screen time data
        if (data.screenTime) {
          setScreenTime(data.screenTime);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const updateScreenTime = () => {
    const currentTime = Date.now();
    const sessionDuration = Math.floor((currentTime - sessionStart) / 60000); // in minutes

    setScreenTime(prev => ({
      today: prev.today + sessionDuration,
      thisWeek: prev.thisWeek + sessionDuration,
      thisMonth: prev.thisMonth + sessionDuration
    }));

    setSessionStart(currentTime);
  };

  const saveScreenTime = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      updateScreenTime();
      await setDoc(doc(db, 'users', userId), {
        screenTime: screenTime,
        lastActive: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving screen time:', error);
    }
  };

  const handleSaveProfile = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (!displayName.trim()) {
      alert('Display name cannot be empty');
      return;
    }

    try {
      setSaving(true);

      await setDoc(doc(db, 'users', userId), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        username: username.trim(),
        isPrivate: isPrivate
      }, { merge: true });

      setUserProfile(prev => ({
        ...prev,
        displayName: displayName.trim(),
        bio: bio.trim(),
        username: username.trim(),
        isPrivate: isPrivate
      }));

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
          <p className="text-indigo-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Profile Settings | InstruMentor - Manage Your Account</title>
        <meta name="description" content="Manage your InstruMentor profile settings. Update your bio, profile picture, privacy settings, and customize your musical profile." />
        <meta property="og:title" content="Profile Settings | InstruMentor" />
        <meta property="og:description" content="Manage your InstruMentor profile settings and customize your musical profile." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Profile Settings | InstruMentor" />
        <meta name="twitter:description" content="Manage your InstruMentor profile settings." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" style={{width: '100%', maxWidth: 'none'}}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-2xl border-b border-indigo-100 shadow-lg shadow-indigo-100/50">
        <div className="w-full px-4 sm:px-6 lg:px-8" style={{width: '100%', maxWidth: 'none'}}>
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="p-2 hover:bg-indigo-50 rounded-2xl transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-indigo-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Profile Settings
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Profile Information Section */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <User className="w-6 h-6 text-indigo-600" />
              Profile Information
            </h2>

            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                  placeholder="Your display name"
                  maxLength={30}
                  className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-400 transition-all text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{displayName.length}/30 characters</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                  placeholder="username"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-400 transition-all text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only. {username.length}/20 characters</p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 150))}
                  placeholder="Tell others about yourself..."
                  maxLength={150}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-400 transition-all resize-none text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{bio.length}/150 characters</p>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">{auth.currentUser?.email}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Private Account Toggle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account Privacy
                </label>
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Private Account</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {isPrivate
                          ? 'Only approved followers can see your posts'
                          : 'Anyone can see your posts'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        isPrivate ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          isPrivate ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  When your account is private, only people you approve can see your photos and videos
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Screen Time Section */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-600" />
              Screen Time
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Today */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                <div className="text-sm font-semibold text-indigo-600 mb-2">Today</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {formatTime(screenTime.today)}
                </div>
              </div>

              {/* This Week */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                <div className="text-sm font-semibold text-purple-600 mb-2">This Week</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {formatTime(screenTime.thisWeek)}
                </div>
              </div>

              {/* This Month */}
              <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-6 border border-pink-100">
                <div className="text-sm font-semibold text-pink-600 mb-2">This Month</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">
                  {formatTime(screenTime.thisMonth)}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-sm text-indigo-700">
                <strong>Note:</strong> Screen time is tracked while you're actively using InstruMentor. Data resets daily, weekly, and monthly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProfileSettingsPage;
