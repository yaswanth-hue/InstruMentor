import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import io from 'socket.io-client';
import bcrypt from 'bcryptjs';
import { Lock, Users, MessageSquare, Image, RefreshCw, Plus, Home, Clock, AlertCircle } from 'lucide-react';
import CreateRoomModal from '../components/CreateRoomModal';
import PasswordModal from '../components/PasswordModal';

const AudioRoomsListPage = () => {
  const [audioRooms, setAudioRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user] = useAuthState(auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle browser back button navigation
    const handlePopState = (event) => {
      if (location.pathname === '/audio-rooms') {
        navigate('/home', { replace: true });
      }
    };

    window.history.replaceState({ audioRoomsList: true }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    fetchAudioRooms();

    // Connect to socket for real-time updates
    const socket = io.connect('http://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log('AudioRoomsListPage connected to socket:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.warn('Socket connection error:', error.message);
    });

    socket.on('room-closed', ({ roomId }) => {
      console.log(`Room ${roomId} was closed`);
      setAudioRooms(prev => prev.filter(room => room.id !== roomId));
    });

    socket.on('disconnect', () => {
      console.log('AudioRoomsListPage disconnected from socket');
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      socket.disconnect();
    };
  }, [location.pathname, navigate]);

  const fetchAudioRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/audio-rooms');
      if (!response.ok) {
        throw new Error('Failed to fetch audio rooms');
      }
      const data = await response.json();
      setAudioRooms(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching audio rooms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAudioRooms();
  };

  const handleJoinRoom = async (room) => {
    // If room is private, show password modal
    if (room.is_private && room.password_hash) {
      setSelectedRoom(room);
      setShowPasswordModal(true);
    } else {
      navigate(`/audio-room/${room.id}`, { replace: true });
    }
  };

  const handlePasswordSubmit = async (password) => {
    if (!selectedRoom) return;

    try {
      const isValid = await bcrypt.compare(password, selectedRoom.password_hash);

      if (!isValid) {
        throw new Error('Incorrect password');
      }

      setShowPasswordModal(false);
      navigate(`/audio-room/${selectedRoom.id}`, { replace: true });
    } catch (error) {
      throw error; // Let the modal handle the error display
    }
  };

  const handleCreateRoom = (newRoom) => {
    setAudioRooms(prev => [newRoom, ...prev]);
    navigate(`/audio-room/${newRoom.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="w-8 h-8 text-purple-600 animate-pulse" />
            </div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading audio rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Audio Rooms | InstruMentor - Voice Chat & Collaborate</title>
        <meta name="description" content="Join audio rooms on InstruMentor to connect and collaborate with musicians in real-time. Create or join voice chat rooms to jam, discuss, and learn together." />
        <meta property="og:title" content="Audio Rooms | InstruMentor - Voice Chat & Collaborate" />
        <meta property="og:description" content="Join audio rooms on InstruMentor to connect and collaborate with musicians in real-time. Voice chat, jam sessions, and more!" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Audio Rooms | InstruMentor - Voice Chat & Collaborate" />
        <meta name="twitter:description" content="Join audio rooms to connect and collaborate with musicians in real-time." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100" style={{width: '100%', maxWidth: 'none'}}>
      {/* Header */}
      <div className="bg-white bg-opacity-80 backdrop-blur-lg border-b border-purple-100 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6" style={{width: '100%', maxWidth: 'none'}}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Audio Rooms
                </h1>
                <p className="text-gray-600 text-sm mt-1">Connect and collaborate with musicians</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/home')}
                className="px-4 py-2 bg-white border-2 border-gray-300 hover:border-purple-400 text-gray-700 font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-white border-2 border-blue-400 hover:border-blue-600 text-blue-700 font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  setShowCreateModal(true);
                }}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Room</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-md animate-slideDown">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-800 font-semibold">Error loading rooms</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
                <button
                  onClick={fetchAudioRooms}
                  className="mt-3 text-red-600 hover:text-red-800 font-medium text-sm underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rooms Grid */}
        {audioRooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full mx-auto flex items-center justify-center mb-4">
                <Users className="w-12 h-12 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No Active Rooms</h3>
              <p className="text-gray-600 mb-8 w-full">
                Be the first to create an audio room and start your musical journey!
              </p>
              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Room</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Room Count */}
            <div className="mb-6">
              <p className="text-gray-600 font-medium">
                {audioRooms.length} {audioRooms.length === 1 ? 'room' : 'rooms'} available
              </p>
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {audioRooms.map((room, index) => (
                <div
                  key={room.id}
                  className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-purple-300 animate-scaleIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Room Header */}
                  <div className={`p-5 ${room.is_private ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {room.is_private && <Lock className="w-5 h-5 text-white" />}
                          <h3 className="text-white font-bold text-lg line-clamp-1">{room.title}</h3>
                        </div>
                        <p className="text-white text-opacity-90 text-sm flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {room.host_name}
                        </p>
                      </div>
                      {room.is_private && (
                        <div className="bg-white bg-opacity-20 px-2 py-1 rounded-full">
                          <span className="text-white text-xs font-semibold">Private</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Room Body */}
                  <div className="p-5">
                    {room.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    {/* Room Features */}
                    <div className="flex items-center space-x-3 mb-4">
                      {room.allow_chat && (
                        <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs font-medium">Chat</span>
                        </div>
                      )}
                      {room.allow_media && (
                        <div className="flex items-center space-x-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          <Image className="w-4 h-4" />
                          <span className="text-xs font-medium">Media</span>
                        </div>
                      )}
                    </div>

                    {/* Room Info */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pb-4 border-b">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>Max {room.max_participants}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(room.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Join Button */}
                    <button
                      onClick={() => handleJoinRoom(room)}
                      className={`w-full py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                        room.is_private
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                          : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                      }`}
                    >
                      {room.is_private && <Lock className="w-4 h-4" />}
                      <span>Join Room</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={handleCreateRoom}
        user={user}
      />

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedRoom(null);
        }}
        onSubmit={handlePasswordSubmit}
        roomTitle={selectedRoom?.title || ''}
      />
    </div>
    </>
  );
};

export default AudioRoomsListPage;
