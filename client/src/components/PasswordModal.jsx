import React, { useState } from 'react';
import { X, Lock, AlertCircle, Loader } from 'lucide-react';

const PasswordModal = ({ isOpen, onClose, onSubmit, roomTitle }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Please enter a password'); return; }
    setIsVerifying(true);
    setError('');
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || 'Incorrect password');
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setIsVerifying(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl border border-sky-300/20 bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-black/60"
        style={{ animation: 'scaleIn 0.2s ease both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-slate-800 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Private Room</h2>
              <p className="text-xs text-slate-400">Password required to join</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isVerifying}
            className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-100">"{roomTitle}"</span> is a private room. Enter the password to join.
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-300 font-medium">{error}</span>
            </div>
          )}

          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter room password"
              autoFocus
              disabled={isVerifying}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isVerifying}
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3 text-sm font-semibold text-slate-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="flex-1 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying
                ? <><Loader className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><Lock className="w-4 h-4" /> Join Room</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;