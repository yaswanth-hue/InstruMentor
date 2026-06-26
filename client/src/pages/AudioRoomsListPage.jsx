import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { io } from 'socket.io-client';
import bcrypt from 'bcryptjs';
import {
  Lock, Users, MessageSquare, Image, Plus, Home, Clock,
  AlertCircle, Wifi, WifiOff, Radio, Mic
} from 'lucide-react';
import CreateRoomModal from '../components/CreateRoomModal';
import PasswordModal from '../components/PasswordModal';
import LoadingSpinner from '../components/LoadingSpinner';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

const AudioRoomsListPage = () => {
  const [audioRooms, setAudioRooms] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user] = useAuthState(auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const fetchAudioRooms = useCallback(async () => {
    try {
      const response = await fetch(`${SOCKET_URL}/api/audio-rooms`);
      if (!response.ok) throw new Error('Failed to fetch audio rooms');
      const data = await response.json();
      setAudioRooms(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudioRooms();

    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('room-created', (room) => {
      setAudioRooms(prev => prev.find(r => r.id === room.id) ? prev : [room, ...prev]);
    });

    socket.on('room-deleted', ({ roomId }) => {
      setAudioRooms(prev => prev.filter(r => r.id !== roomId));
    });

    socket.on('room-closed', ({ roomId }) => {
      if (roomId) setAudioRooms(prev => prev.filter(r => r.id !== roomId));
    });

    socket.on('room-participant-count', ({ roomId, count }) => {
      setParticipantCounts(prev => ({ ...prev, [roomId]: count }));
    });

    return () => socket.disconnect();
  }, [fetchAudioRooms]);

  const handleJoinRoom = async (room) => {
    if (room.is_private && room.password_hash) {
      setSelectedRoom(room);
      setShowPasswordModal(true);
    } else {
      navigate(`/audio-room/${room.id}`);
    }
  };

  const handlePasswordSubmit = async (password) => {
    if (!selectedRoom) return;
    const isValid = await bcrypt.compare(password, selectedRoom.password_hash);
    if (!isValid) throw new Error('Incorrect password');
    setShowPasswordModal(false);
    navigate(`/audio-room/${selectedRoom.id}`);
  };

  const handleCreateRoom = (newRoom) => {
    navigate(`/audio-room/${newRoom.id}`, { state: { isHost: true } });
  };

  if (loading) {
    return <LoadingSpinner message="Loading rooms…" />;
  }

  return (
    <>
      <Helmet>
        <title>Audio Rooms · InstruMentor</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100" style={{ width: '100%', maxWidth: 'none' }}>

        {/* Ambient glow */}
        <div className="fixed -top-40 -right-40 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="fixed -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4" style={{ width: '100%', maxWidth: 'none' }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-900/40 shrink-0">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">Audio Rooms</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    {socketConnected
                      ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-emerald-400 font-medium">Live</span></>
                      : <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-xs text-red-400">Reconnecting</span></>
                    }
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400">{audioRooms.length} {audioRooms.length === 1 ? 'room' : 'rooms'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/home')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </button>
                <button
                  onClick={() => { if (!user) { navigate('/login'); return; } setShowCreateModal(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:via-blue-500 hover:to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 animate-slideDown">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">Couldn't load rooms</p>
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
                <button onClick={fetchAudioRooms} className="mt-2 text-xs text-red-300 underline hover:text-red-200">Retry</button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {audioRooms.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-sky-300/20 bg-slate-900/80 backdrop-blur-xl p-12 text-center shadow-2xl shadow-black/40 mt-8">
              <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-sky-400/20 flex items-center justify-center mb-5 shadow-lg shadow-black/40">
                <Radio className="w-10 h-10 text-sky-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">No Active Rooms</h3>
              <p className="text-slate-400 mb-8 max-w-sm">Be the first to start a session and invite others to join.</p>
              <button
                onClick={() => { if (!user) { navigate('/login'); return; } setShowCreateModal(true); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Create Your First Room
              </button>
            </div>
          )}

          {/* Grid */}
          {audioRooms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {audioRooms.map((room, idx) => {
                const liveCount = participantCounts[room.id] ?? 0;
                return (
                  <div
                    key={room.id}
                    className="group bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-sky-300/20 hover:border-cyan-300/40 shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/50 transition-all duration-500 overflow-hidden hover:-translate-y-1"
                    style={{ animation: 'scaleIn 0.25s ease both', animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Top accent bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="p-5">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {room.is_private && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            <h3 className="font-semibold text-slate-100 truncate">{room.title}</h3>
                          </div>
                          <p className="text-xs text-slate-400 truncate">by {room.host_name}</p>
                        </div>
                        {liveCount > 0 && (
                          <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs text-emerald-300 font-semibold">{liveCount}</span>
                          </div>
                        )}
                      </div>

                      {room.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">{room.description}</p>
                      )}

                      {/* Pills */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {room.allow_chat && (
                          <span className="flex items-center gap-1 text-xs font-medium text-sky-300 border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 rounded-full">
                            <MessageSquare className="w-3 h-3" /> Chat
                          </span>
                        )}
                        {room.allow_media && (
                          <span className="flex items-center gap-1 text-xs font-medium text-cyan-300 border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 rounded-full">
                            <Image className="w-3 h-3" /> Media
                          </span>
                        )}
                        {room.is_private && (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-300 border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-4 pb-4 border-b border-slate-800">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> Max {room.max_participants}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(room.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleJoinRoom(room)}
                        className="w-full rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:via-blue-500 hover:to-cyan-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]"
                      >
                        {room.is_private && <Lock className="w-3.5 h-3.5" />}
                        Join Room
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={handleCreateRoom}
        user={user}
      />
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setSelectedRoom(null); }}
        onSubmit={handlePasswordSubmit}
        roomTitle={selectedRoom?.title || ''}
      />
    </>
  );
};

export default AudioRoomsListPage;