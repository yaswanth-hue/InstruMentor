import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import AudioRoomComponent from '../components/AudioRoomComponent';
import { LogIn, Radio } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const AudioRoomPage = () => {
  const { roomId } = useParams();
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();
  const isHost = location.state?.isHost === true;

  if (loading) {
    return <LoadingSpinner message="Authenticating…" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center p-4" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="w-full max-w-sm rounded-3xl border border-sky-300/20 bg-slate-900/80 backdrop-blur-xl p-8 text-center shadow-2xl shadow-black/50">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-red-400/20 flex items-center justify-center mx-auto mb-5">
            <LogIn className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Sign in required</h2>
          <p className="text-slate-400 text-sm mb-6">Please log in to join this audio room.</p>
          <button
            onClick={() => navigate('/login', { state: { from: `/audio-room/${roomId}` } })}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200 flex items-center justify-center gap-2 mb-3"
          >
            <LogIn className="w-4 h-4" /> Log In
          </button>
          <button
            onClick={() => navigate('/audio-rooms')}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3 text-sm font-semibold text-slate-300 transition-colors"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <AudioRoomComponent
      roomId={roomId}
      userId={user.uid}
      userName={user.displayName || user.email.split('@')[0]}
      userEmail={user.email}
      isHost={isHost}
    />
  );
};

export default AudioRoomPage;