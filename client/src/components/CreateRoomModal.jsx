import React, { useState } from 'react';
import { X, Lock, Users, MessageSquare, Image, Radio, Loader } from 'lucide-react';
import bcrypt from 'bcryptjs';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

const CreateRoomModal = ({ isOpen, onClose, onCreateRoom, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 10,
    allowChat: true,
    allowMedia: false,
    isPrivate: false,
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) { setError('Room title is required'); return; }
    if (formData.isPrivate) {
      if (!formData.password) { setError('Password is required for private rooms'); return; }
      if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    }

    setIsCreating(true);
    try {
      let passwordHash = null;
      if (formData.isPrivate && formData.password) {
        passwordHash = await bcrypt.hash(formData.password, await bcrypt.genSalt(10));
      }

      const response = await fetch(`${SOCKET_URL}/api/audio-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          host_id: user.uid,
          host_name: user.displayName || user.email,
          max_participants: parseInt(formData.maxParticipants),
          allow_chat: formData.allowChat,
          allow_media: formData.allowMedia,
          is_private: formData.isPrivate,
          password_hash: passwordHash
        })
      });

      if (!response.ok) throw new Error('Failed to create room');
      const newRoom = await response.json();
      onCreateRoom(newRoom);
      onClose();
      setFormData({ title: '', description: '', maxParticipants: 10, allowChat: true, allowMedia: false, isPrivate: false, password: '', confirmPassword: '' });
    } catch (err) {
      setError('Error creating room: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const FEATURES = [
    {
      name: 'allowChat',
      icon: <MessageSquare className="w-4 h-4 text-sky-300" />,
      label: 'Enable Chat',
      desc: 'Allow participants to send text messages',
      checked: formData.allowChat,
    },
    {
      name: 'allowMedia',
      icon: <Image className="w-4 h-4 text-cyan-300" />,
      label: 'Enable Media Sharing',
      desc: 'Allow sharing images, audio and files',
      checked: formData.allowMedia,
    },
    {
      name: 'isPrivate',
      icon: <Lock className="w-4 h-4 text-amber-300" />,
      label: 'Private Room',
      desc: 'Require a password to join',
      checked: formData.isPrivate,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-sky-300/20 bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-black/60"
        style={{ animation: 'scaleIn 0.2s ease both' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-900/40 shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Create Audio Room</h2>
              <p className="text-xs text-slate-400">Set up your collaborative space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <span className="text-red-400 text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Room Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Jazz Session, Guitar Practice…"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell others what this room is about…"
              rows="3"
              className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
            />
          </div>

          {/* Max participants */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-300" /> Max Participants
            </label>
            <select
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
            >
              {[5, 10, 20, 50, 100].map(n => (
                <option key={n} value={n}>{n} participants</option>
              ))}
            </select>
          </div>

          {/* Feature toggles */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">Room Features</p>
            <div className="space-y-2">
              {FEATURES.map(({ name, icon, label, desc, checked }) => (
                <label
                  key={name}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all duration-200 ${
                    checked
                      ? 'border-sky-400/30 bg-sky-400/10'
                      : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {/* Custom toggle */}
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-sky-600' : 'bg-slate-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
                  </div>
                  {icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Password fields */}
          {formData.isPrivate && (
            <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4" style={{ animation: 'slideDown 0.2s ease both' }}>
              <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Set Room Password
              </p>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password (min 6 characters)"
                minLength="6"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition"
              />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                minLength="6"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3 text-sm font-semibold text-slate-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:via-blue-500 hover:to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;