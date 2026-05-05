import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Peer from 'peerjs';
import io from 'socket.io-client';
import {
  Mic, MicOff, Phone, Users, MessageSquare, Settings, Crown,
  Upload, Image as ImageIcon, Send, X, FileText, Volume2,
  AlertCircle, Check, Loader, ChevronDown, ChevronUp, Paperclip,
  Lock, Unlock, LogOut, XCircle
} from 'lucide-react';

const socket = io.connect('http://localhost:3001', {
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 5000
});

socket.on('connect_error', (error) => {
  console.warn('Socket connection error:', error.message);
});

const AudioRoomComponent = ({ roomId, userId, userName, userEmail, isHost }) => {
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomSettings, setRoomSettings] = useState({ allow_media: true, allow_chat: true });
  const [mediaFile, setMediaFile] = useState(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [showHostControls, setShowHostControls] = useState(true);
  const [showNotification, setShowNotification] = useState(null);
  const [isRoomLocked, setIsRoomLocked] = useState(false);

  const audioRef = useRef();
  const localStreamRef = useRef();
  const peerRef = useRef();
  const chatEndRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Show notification helper
  const notify = (message, type = 'info') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 3000);
  };

  useEffect(() => {
    const handlePopState = (event) => {
      if (location.pathname.includes('/audio-room/')) {
        event.preventDefault();
        handleLeaveRoom();
      }
    };

    window.history.replaceState({ audioRoom: true }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    const cleanup = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    // Initialize peer
    peerRef.current = new Peer(userId);

    peerRef.current.on('open', (id) => {
      console.log('Peer connection open:', id);
      setIsConnected(true);
      notify('Connected to room', 'success');
    });

    // Get local media stream
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
        notify('Microphone access denied', 'error');
      });

    // Handle incoming call
    peerRef.current.on('call', (call) => {
      call.answer(localStreamRef.current);
      call.on('stream', (remoteStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
      });
    });

    // Socket events
    socket.on('participants-updated', (participantsList) => {
      setParticipants(participantsList);
    });

    socket.on('participant-joined', (participant) => {
      notify(`${participant.userName} joined`, 'info');
    });

    socket.on('participant-left', ({ userId: leftUserId }) => {
      const leftParticipant = participants.find(p => p.userId === leftUserId);
      if (leftParticipant) {
        notify(`${leftParticipant.userName} left`, 'info');
      }
    });

    socket.on('new-message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('chat-history', (messages) => {
      setChatMessages(messages);
    });

    socket.on('room-settings-updated', (settings) => {
      setRoomSettings(settings);
    });

    socket.on('room-media-settings-updated', ({ allow_media }) => {
      setRoomSettings(prev => ({ ...prev, allow_media }));
    });

    socket.on('room-lock-status', ({ lock }) => {
      setIsRoomLocked(lock);
      notify(lock ? 'Room locked by host' : 'Room unlocked by host', 'info');
    });

    socket.on('room-closed', () => {
      notify('Room has been closed by host', 'error');
      setTimeout(() => handleLeaveRoom(), 2000);
    });

    socket.on('kicked-from-room', () => {
      notify('You have been removed from the room', 'error');
      setTimeout(() => handleLeaveRoom(), 2000);
    });

    socket.on('message-error', (error) => {
      notify(error, 'error');
    });

    console.log('Joining room:', { roomId, userId, userName, userEmail, isHost });
    socket.emit('join-room', { roomId, userId, userName, userEmail, isHost });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      socket.emit('leave-room', { roomId, userId });
      socket.off('participants-updated');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('new-message');
      socket.off('chat-history');
      socket.off('room-settings-updated');
      socket.off('room-media-settings-updated');
      socket.off('room-lock-status');
      socket.off('room-closed');
      socket.off('kicked-from-room');
      socket.off('message-error');
      cleanup();
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [roomId, userId, userName, userEmail, isHost, location.pathname]);

  const handleLeaveRoom = () => {
    socket.emit('leave-room', { roomId, userId });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setParticipants([]);
    setChatMessages([]);
    setIsConnected(false);
    setIsMuted(false);

    navigate('/audio-rooms', { replace: true });
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      socket.emit('toggle-mute', { roomId, userId, isMuted: newMuted });
      notify(newMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      socket.emit('send-message', { roomId, userId, userName, message: message.trim() });
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleMediaPermissions = () => {
    if (isHost) {
      const newValue = !roomSettings.allow_media;
      socket.emit('host-set-media-permissions', {
        roomId,
        hostId: userId,
        allow_media: newValue
      });
      notify(`Media sharing ${newValue ? 'enabled' : 'disabled'}`, 'success');
    }
  };

  const handleToggleChatPermissions = () => {
    if (isHost) {
      const newValue = !roomSettings.allow_chat;
      setRoomSettings(prev => ({ ...prev, allow_chat: newValue }));
      notify(`Chat ${newValue ? 'enabled' : 'disabled'}`, 'success');
    }
  };

  const handleToggleRoomLock = () => {
    if (isHost) {
      const newLock = !isRoomLocked;
      socket.emit('host-lock-room', {
        roomId,
        hostId: userId,
        lock: newLock
      });
      setIsRoomLocked(newLock);
      notify(newLock ? 'Room locked' : 'Room unlocked', 'success');
    }
  };

  const handleEndRoom = () => {
    if (isHost) {
      if (confirm('Are you sure you want to end this room for everyone?')) {
        socket.emit('end-room', { roomId });
        notify('Ending room for all participants...', 'info');
        setTimeout(() => handleLeaveRoom(), 1000);
      }
    }
  };

  const handleMediaFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        notify('File too large. Maximum size is 5MB', 'error');
        return;
      }
      setMediaFile(file);
    }
  };

  const handleSendMedia = async () => {
    if (!mediaFile || !roomSettings.allow_media) return;

    setIsUploadingMedia(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();

      const fileDataPromise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
      });

      reader.readAsDataURL(mediaFile);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const base64Data = await fileDataPromise;
      clearInterval(progressInterval);
      setUploadProgress(100);

      const messageData = {
        roomId,
        userId,
        userName,
        message: `Shared: ${mediaFile.name}`,
        messageType: 'media',
        mediaData: base64Data,
        fileName: mediaFile.name,
        fileSize: mediaFile.size,
        mimeType: mediaFile.type
      };

      socket.emit('send-message', messageData);

      setMediaFile(null);
      setShowMediaPanel(false);
      notify('Media shared successfully', 'success');

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (error) {
      console.error('Media sharing error:', error);
      notify(`Failed to share media: ${error.message}`, 'error');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-gradient-to-br from-purple-500 to-pink-500',
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-green-500 to-emerald-500',
      'bg-gradient-to-br from-orange-500 to-red-500',
      'bg-gradient-to-br from-indigo-500 to-purple-500',
      'bg-gradient-to-br from-pink-500 to-rose-500'
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const formatFileSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2);
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (mimeType?.startsWith('audio/')) return <Volume2 className="w-5 h-5" />;
    if (mimeType?.startsWith('video/')) return <FileText className="w-5 h-5" />;
    return <Paperclip className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-100" style={{width: '100%', maxWidth: 'none'}}>
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8" style={{width: '100%', maxWidth: 'none'}}>
          <div className="flex items-center justify-between h-16">
            {/* Left: Room Info */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Audio Room</h1>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-600">
                    {isConnected ? 'Connected' : 'Connecting...'}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-600">{participants.length} {participants.length === 1 ? 'participant' : 'participants'}</span>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleToggleMute}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold shadow-md transition-all duration-200 ${
                  isMuted
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {isHost ? (
                <>
                  <button
                    onClick={handleLeaveRoom}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Leave</span>
                  </button>
                  <button
                    onClick={handleEndRoom}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">End Room</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
                >
                  <Phone className="w-4 h-4 transform rotate-135" />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-20 right-4 z-50 animate-slideDown">
          <div className={`px-4 py-3 rounded-lg shadow-xl flex items-center space-x-3 ${
            showNotification.type === 'success' ? 'bg-green-500' :
            showNotification.type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
          } text-white`}>
            {showNotification.type === 'success' && <Check className="w-5 h-5" />}
            {showNotification.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {showNotification.type === 'info' && <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{showNotification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar: Participants */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-bold flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Participants
                  </h2>
                  <span className="bg-white bg-opacity-30 px-3 py-1 rounded-full text-white text-sm font-bold shadow-md">
                    {participants.length}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {participants.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No participants yet</p>
                  </div>
                ) : (
                  participants.map((participant, index) => {
                    const isCurrentUser = participant.userId === userId;
                    const showAsHost = participant.isHost || (isCurrentUser && isHost);

                    return (
                      <div
                        key={participant.userId}
                        className={`bg-gradient-to-r from-gray-50 to-white p-3 rounded-xl border transition-all duration-200 animate-scaleIn ${
                          isCurrentUser ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100 hover:border-purple-300'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 ${getAvatarColor(participant.userName)} rounded-full flex items-center justify-center shadow-md`}>
                              <span className="text-white font-bold text-sm">
                                {participant.userName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm flex items-center">
                                {participant.userName}
                                {isCurrentUser && <span className="ml-1 text-purple-600">(You)</span>}
                                {showAsHost && (
                                  <Crown className="w-3 h-3 text-yellow-500 ml-1" />
                                )}
                              </p>
                              {showAsHost && (
                                <p className="text-xs text-purple-600 font-medium">Host</p>
                              )}
                            </div>
                          </div>
                          <div>
                            {participant.isMuted ? (
                              <MicOff className="w-4 h-4 text-red-500" />
                            ) : (
                              <Mic className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden mt-6">
                <button
                  onClick={() => setShowHostControls(!showHostControls)}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 flex items-center justify-between text-white font-bold"
                >
                  <div className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Host Controls
                  </div>
                  {showHostControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showHostControls && (
                  <div className="p-4 space-y-3">
                    <button
                      onClick={handleToggleMediaPermissions}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-semibold shadow-md transition-all duration-200 ${
                        roomSettings.allow_media
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Media Sharing
                      </div>
                      <span className="text-xs">
                        {roomSettings.allow_media ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>

                    <button
                      onClick={handleToggleChatPermissions}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-semibold shadow-md transition-all duration-200 ${
                        roomSettings.allow_chat
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Chat
                      </div>
                      <span className="text-xs">
                        {roomSettings.allow_chat ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>

                    <button
                      onClick={handleToggleRoomLock}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-semibold shadow-md transition-all duration-200 ${
                        isRoomLocked
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        {isRoomLocked ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                        Room Lock
                      </div>
                      <span className="text-xs">
                        {isRoomLocked ? 'Locked' : 'Unlocked'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Chat */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden h-[calc(100vh-200px)] flex flex-col">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <h2 className="text-white font-bold flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Chat
                </h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No messages yet</p>
                    <p className="text-gray-400 text-sm">Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className="flex items-start space-x-3 animate-slideUp">
                      <div className={`w-10 h-10 ${getAvatarColor(msg.userName)} rounded-full flex items-center justify-center shadow-md flex-shrink-0`}>
                        <span className="text-white font-bold text-sm">
                          {msg.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 bg-white rounded-2xl px-4 py-3 shadow-sm">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-800 text-sm">{msg.userName}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {msg.messageType === 'media' ? (
                          <div>
                            <p className="text-gray-700 text-sm mb-2">{msg.message}</p>
                            {(msg.mediaData || msg.mediaUrl) && (
                              <div className="mt-2">
                                {msg.mimeType?.startsWith('image/') ? (
                                  <img
                                    src={msg.mediaData || msg.mediaUrl}
                                    alt="Shared"
                                    className="max-w-sm max-h-64 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-purple-400 transition-all duration-200"
                                    onClick={() => window.open(msg.mediaData || msg.mediaUrl)}
                                  />
                                ) : msg.mimeType?.startsWith('audio/') ? (
                                  <audio controls className="w-full max-w-sm">
                                    <source src={msg.mediaData || msg.mediaUrl} type={msg.mimeType} />
                                  </audio>
                                ) : msg.mimeType?.startsWith('video/') ? (
                                  <video controls className="max-w-sm rounded-lg">
                                    <source src={msg.mediaData || msg.mediaUrl} type={msg.mimeType} />
                                  </video>
                                ) : (
                                  <a
                                    href={msg.mediaData || msg.mediaUrl}
                                    download={msg.fileName}
                                    className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200"
                                  >
                                    {getFileIcon(msg.mimeType)}
                                    <span>Download {msg.fileName}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">{msg.message}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 p-4 bg-white">
                {showMediaPanel && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800 flex items-center">
                        <Upload className="w-4 h-4 mr-2" />
                        Attach Media
                      </h4>
                      <button
                        onClick={() => {
                          setShowMediaPanel(false);
                          setMediaFile(null);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <input
                      type="file"
                      onChange={handleMediaFileChange}
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                      disabled={!roomSettings.allow_media}
                      className="w-full text-sm"
                    />

                    {mediaFile && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="text-purple-600">
                            {getFileIcon(mediaFile.type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">{mediaFile.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(mediaFile.size)} MB</p>
                          </div>
                          <button
                            onClick={handleSendMedia}
                            disabled={isUploadingMedia}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-all duration-200"
                          >
                            {isUploadingMedia ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin" />
                                <span>{uploadProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Send</span>
                              </>
                            )}
                          </button>
                        </div>

                        {isUploadingMedia && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowMediaPanel(!showMediaPanel)}
                    disabled={!roomSettings.allow_media}
                    className={`p-3 rounded-lg transition-all duration-200 ${
                      roomSettings.allow_media
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={roomSettings.allow_media ? 'Attach media' : 'Media disabled by host'}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200"
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white p-3 rounded-lg shadow-md transition-all duration-200"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay className="hidden" />
    </div>
  );
};

export default AudioRoomComponent;
