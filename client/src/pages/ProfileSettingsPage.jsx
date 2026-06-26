import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  User,
  Mail,
  Save,
  Settings,
  Shield,
  Bell,
  Eye,
  EyeOff,
  Copy,
  Link as LinkIcon
} from 'lucide-react';

const defaultForm = {
  displayName: '',
  username: '',
  bio: '',
  isPrivate: false,
  allowTags: true,
  showActivityStatus: true,
  messagePermission: 'everyone'
};

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadProfileData = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        navigate('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!alive) return;

        if (userDoc.exists()) {
          const data = userDoc.data();
          const normalized = {
            displayName: data.displayName || '',
            username: data.username || '',
            bio: data.bio || '',
            isPrivate: data.isPrivate || false,
            allowTags: data.allowTags ?? true,
            showActivityStatus: data.showActivityStatus ?? true,
            messagePermission: data.messagePermission || 'everyone'
          };
          setForm(normalized);
          setInitialForm(normalized);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load profile data');
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadProfileData();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  const profileUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (!auth.currentUser?.uid) return '';
    return `${window.location.origin}/user-profile/${auth.currentUser.uid}`;
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Failed to copy profile link');
    }
  };

  const handleDiscard = () => {
    setForm(initialForm);
  };

  const handleSaveProfile = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (!form.displayName.trim()) {
      alert('Display name cannot be empty');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        username: form.username.trim(),
        isPrivate: form.isPrivate,
        allowTags: form.allowTags,
        showActivityStatus: form.showActivityStatus,
        messagePermission: form.messagePermission
      };

      await setDoc(doc(db, 'users', userId), payload, { merge: true });
      setInitialForm(payload);
      setForm(payload);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-16 rounded-2xl border border-slate-800 bg-slate-900/60 animate-pulse" />
            <div className="h-56 rounded-3xl border border-slate-800 bg-slate-900/60 animate-pulse" />
            <div className="h-56 rounded-3xl border border-slate-800 bg-slate-900/60 animate-pulse" />
            <div className="h-44 rounded-3xl border border-slate-800 bg-slate-900/60 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Profile Settings | InstruMentor</title>
        <meta name="description" content="Manage your InstruMentor profile settings, privacy, and visibility preferences." />
        <meta property="og:title" content="Profile Settings | InstruMentor" />
        <meta property="og:description" content="Manage your InstruMentor profile settings and privacy." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Profile Settings | InstruMentor" />
        <meta name="twitter:description" content="Manage your InstruMentor profile settings and privacy." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white" style={{ width: '100%', maxWidth: 'none' }}>
        <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-2xl">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex h-16 sm:h-20 max-w-4xl items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/profile')}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-200 transition-colors hover:bg-white/10"
                  aria-label="Back to profile"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-300/30 bg-slate-900">
                    <Settings className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <h1 className="text-base font-semibold text-zinc-100 sm:text-lg">Profile Settings</h1>
                    <p className="text-xs text-zinc-500">Inspired by modern social apps</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mx-auto max-w-4xl space-y-5">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                <User className="h-4 w-4 text-sky-300" />
                Account
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Display Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => updateField('displayName', e.target.value.slice(0, 30))}
                    placeholder="Your display name"
                    maxLength={30}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">{form.displayName.length}/30</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                    placeholder="username"
                    maxLength={20}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">Lowercase letters, numbers, underscore ({form.username.length}/20)</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => updateField('bio', e.target.value.slice(0, 150))}
                    placeholder="Tell people what you play, teach, or learn..."
                    rows={4}
                    maxLength={150}
                    className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">{form.bio.length}/150</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span>{auth.currentUser?.email}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                <Shield className="h-4 w-4 text-sky-300" />
                Privacy & Interactions
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Private account</p>
                    <p className="text-xs text-slate-400">Only approved followers can view your media.</p>
                  </div>
                  <button
                    onClick={() => updateField('isPrivate', !form.isPrivate)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.isPrivate ? 'bg-sky-600' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Allow tags</p>
                    <p className="text-xs text-slate-400">People can tag you in posts and reels.</p>
                  </div>
                  <button
                    onClick={() => updateField('allowTags', !form.allowTags)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.allowTags ? 'bg-sky-600' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.allowTags ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Show activity status</p>
                    <p className="text-xs text-slate-400">Others can see when you are active.</p>
                  </div>
                  <button
                    onClick={() => updateField('showActivityStatus', !form.showActivityStatus)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.showActivityStatus ? 'bg-sky-600' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.showActivityStatus ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-100">Who can message you</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateField('messagePermission', 'everyone')}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${form.messagePermission === 'everyone' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      Everyone
                    </button>
                    <button
                      onClick={() => updateField('messagePermission', 'followers')}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${form.messagePermission === 'followers' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      Followers only
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                <Bell className="h-4 w-4 text-sky-300" />
                Visibility & Sharing
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    {form.isPrivate ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                    <span className="text-sm">{form.isPrivate ? 'Your profile is private' : 'Your profile is public'}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                  <p className="mb-2 text-sm font-semibold text-slate-100">Profile link</p>
                  <div className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                      <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{profileUrl || 'Not available'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyProfileLink}
                      disabled={!profileUrl}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  {hasChanges ? 'You have unsaved changes.' : 'All changes are saved.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={!hasChanges || saving}
                    className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={!hasChanges || saving}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default ProfileSettingsPage;
