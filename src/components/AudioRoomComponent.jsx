import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Mic, MicOff, Users, MessageSquare, Settings, Crown,
  Upload, Image as ImageIcon, Send, X, FileText, Volume2,
  AlertCircle, Check, Loader, ChevronDown, ChevronUp, Paperclip,
  Lock, Unlock, LogOut, XCircle, WifiOff, Radio
} from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

// One RTCPeerConnection per remote participant (mesh topology). Each
// connection only ever carries the local mic track out and a single
// remote participant's track in — there is never a connection back to
// ourselves, so we can never hear our own voice played back.
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  error:   'border-red-500/30 bg-red-500/15 text-red-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  info:    'border-sky-500/30 bg-sky-500/15 text-sky-300',
};
const Toast = ({ n }) => {
  if (!n) return null;
  return (
    <div className="fixed top-20 right-4 z-50 pointer-events-none" style={{ animation: 'slideDown 0.2s ease both' }}>
      <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl text-sm font-medium ${TOAST_STYLES[n.type] || TOAST_STYLES.info}`}>
        {n.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
        {n.type !== 'success' && <AlertCircle className="w-4 h-4 shrink-0" />}
        {n.message}
      </div>
    </div>
  );
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const GRADIENTS = [
  'from-sky-500 to-blue-600',
  'from-cyan-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-600',
];
const Avatar = ({ name, size = 'md' }) => {
  const g = GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length];
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${g} flex items-center justify-center shadow-md shrink-0`}>
      <span className="font-bold text-white">{name?.charAt(0)?.toUpperCase() || '?'}</span>
    </div>
  );
};

// ── Remote audio sink ────────────────────────────────────────────────────────
// Renders one hidden <audio> per connected participant. Only ever fed a
// *remote* MediaStream (from pc.ontrack of that participant's connection) —
// the local mic stream is never passed in here, so you never hear yourself.
const RemoteAudio = ({ stream }) => {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
};

// ── Main ──────────────────────────────────────────────────────────────────────
const AudioRoomComponent = ({ roomId, userId, userName, userEmail, isHost }) => {
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [roomSettings, setRoomSettings] = useState({ allow_media: true, allow_chat: true });
  const [mediaFile, setMediaFile] = useState(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [showHostControls, setShowHostControls] = useState(true);
  const [toast, setToast] = useState(null);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [roomEntryDenied, setRoomEntryDenied] = useState(null); // null | 'locked'
  const [activeTab, setActiveTab] = useState('chat');
  const [roomInfo, setRoomInfo] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream (remote only)

  const localStreamRef = useRef();
  const peerConnectionsRef = useRef({}); // userId -> RTCPeerConnection
  const pendingCandidatesRef = useRef({}); // userId -> queued ICE candidates
  const pendingCallsRef = useRef(new Set()); // userIds to call once mic is ready
  const chatEndRef = useRef();
  const socketRef = useRef();
  const toastTimer = useRef();
  const navigate = useNavigate();

  const notify = useCallback((msg, type = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message: msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    fetch(`${SOCKET_URL}/api/audio-rooms/${roomId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoomInfo(d); })
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    // ── WebRTC mesh helpers ──────────────────────────────────────────────────
    // Build (or reuse) the RTCPeerConnection for a given remote participant.
    const getOrCreatePeerConnection = (remoteUserId) => {
      let pc = peerConnectionsRef.current[remoteUserId];
      if (pc) return pc;

      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current[remoteUserId] = pc;

      // Send only our own mic track out on this connection.
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc-ice-candidate', { roomId, targetUserId: remoteUserId, candidate: e.candidate });
        }
      };

      // Only ever stash the *remote* party's incoming track — this is what
      // lets us hear them, and it's the only stream that ever reaches an
      // <audio> element, so we never hear ourselves.
      pc.ontrack = (e) => {
        setRemoteStreams(prev => ({ ...prev, [remoteUserId]: e.streams[0] }));
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          closePeerConnection(remoteUserId);
        }
      };

      return pc;
    };

    const closePeerConnection = (remoteUserId) => {
      const pc = peerConnectionsRef.current[remoteUserId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[remoteUserId];
      }
      delete pendingCandidatesRef.current[remoteUserId];
      setRemoteStreams(prev => {
        if (!(remoteUserId in prev)) return prev;
        const next = { ...prev };
        delete next[remoteUserId];
        return next;
      });
    };

    const callParticipant = async (remoteUserId) => {
      if (!localStreamRef.current) { pendingCallsRef.current.add(remoteUserId); return; }
      try {
        const pc = getOrCreatePeerConnection(remoteUserId);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { roomId, targetUserId: remoteUserId, offer });
      } catch {
        notify('Audio connection issue', 'warning');
      }
    };

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-room', { roomId, userId, userName, userEmail, isHost });
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('room-entry-denied', ({ reason }) => {
      setRoomEntryDenied(reason);
      // Disconnect immediately — user should not be in the room at all
      socket.disconnect();
    });
    socket.on('participants-updated', setParticipants);
    socket.on('participant-joined', (p) => {
      if (p.userId === userId) return;
      notify(`${p.userName} joined`, 'info');
      // We were already in the room, so we initiate the connection to the
      // newcomer. Combined with every other existing participant doing the
      // same, this forms a full mesh without duplicate offers.
      callParticipant(p.userId);
    });
    socket.on('participant-left', ({ userId: lid }) => {
      closePeerConnection(lid);
      setParticipants(prev => {
        const who = prev.find(p => p.userId === lid);
        if (who && who.userId !== userId) notify(`${who.userName} left`, 'info');
        return prev.filter(p => p.userId !== lid);
      });
    });
    socket.on('new-message', (msg) => setChatMessages(prev => [...prev, msg]));
    socket.on('chat-history', setChatMessages);
    socket.on('room-settings-updated', (s) => setRoomSettings(p => ({ ...p, ...s })));
    socket.on('room-media-settings-updated', ({ allow_media }) => setRoomSettings(p => ({ ...p, allow_media })));
    socket.on('room-lock-status', ({ lock }) => {
      setIsRoomLocked(lock);
      notify(lock ? 'Room locked by host' : 'Room unlocked', 'warning');
    });
    socket.on('room-closed', () => {
      notify('Room was closed', 'error');
      setTimeout(() => doLeave(socket), 2000);
    });
    socket.on('action-error', (m) => notify(m, 'error'));
    socket.on('host-action', ({ message: m }) => notify(m, 'warning'));
    socket.on('message-error', (m) => notify(m, 'error'));

    // ── Incoming WebRTC signaling ────────────────────────────────────────────
    socket.on('webrtc-offer', async ({ fromUserId, offer }) => {
      try {
        const pc = getOrCreatePeerConnection(fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const queued = pendingCandidatesRef.current[fromUserId] || [];
        queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
        pendingCandidatesRef.current[fromUserId] = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { roomId, targetUserId: fromUserId, answer });
      } catch {
        notify('Audio connection issue', 'warning');
      }
    });

    socket.on('webrtc-answer', async ({ fromUserId, answer }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch { /* ignore */ }
      }
    });

    socket.on('webrtc-ice-candidate', ({ fromUserId, candidate }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current[fromUserId] = pendingCandidatesRef.current[fromUserId] || [];
        pendingCandidatesRef.current[fromUserId].push(candidate);
      }
    });

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
      .then(s => {
        localStreamRef.current = s;
        // Now that the mic is ready, call anyone we were waiting to connect to.
        const queued = Array.from(pendingCallsRef.current);
        pendingCallsRef.current.clear();
        queued.forEach(callParticipant);
      })
      .catch(() => notify('Microphone unavailable — voice disabled', 'warning'));

    socket.emit('join-room', { roomId, userId, userName, userEmail, isHost });

    return () => {
      clearTimeout(toastTimer.current);
      socket.emit('leave-room', { roomId, userId });
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
      pendingCallsRef.current.clear();
      setRemoteStreams({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  const doLeave = useCallback((sock) => {
    const s = sock || socketRef.current;
    s?.emit('leave-room', { roomId, userId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    setRemoteStreams({});
    navigate('/audio-rooms', { replace: true });
  }, [navigate, roomId, userId]);

  const handleToggleMute = () => {
    if (!localStreamRef.current) { notify('No microphone available', 'error'); return; }
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    const next = !isMuted;
    setIsMuted(next);
    socketRef.current?.emit('toggle-mute', { roomId, userId, isMuted: next });
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    if (!roomSettings.allow_chat) { notify('Chat is disabled', 'warning'); return; }
    socketRef.current?.emit('send-message', { roomId, userId, userName, message: message.trim() });
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleToggleMediaPerms = () => {
    if (!isHost) return;
    const next = !roomSettings.allow_media;
    socketRef.current?.emit('host-set-media-permissions', { roomId, hostId: userId, allow_media: next });
    setRoomSettings(p => ({ ...p, allow_media: next }));
    notify(`Media ${next ? 'enabled' : 'disabled'}`, 'success');
  };

  const handleToggleChat = () => {
    if (!isHost) return;
    const next = !roomSettings.allow_chat;
    setRoomSettings(p => ({ ...p, allow_chat: next }));
    notify(`Chat ${next ? 'enabled' : 'disabled'}`, 'success');
  };

  const handleToggleLock = () => {
    if (!isHost) return;
    const next = !isRoomLocked;
    socketRef.current?.emit('host-lock-room', { roomId, hostId: userId, lock: next });
    setIsRoomLocked(next);
  };

  const handleEndRoom = () => {
    if (!isHost || !confirm('End this room for everyone?')) return;
    socketRef.current?.emit('end-room', { roomId });
    notify('Ending room…', 'info');
    setTimeout(() => doLeave(), 1000);
  };

  const handleMediaFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { notify('File too large (max 5 MB)', 'error'); return; }
    setMediaFile(f);
  };

  const handleSendMedia = async () => {
    if (!mediaFile || !roomSettings.allow_media) return;
    setIsUploadingMedia(true);
    try {
      const base64Data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(mediaFile);
      });
      setUploadProgress(100);
      socketRef.current?.emit('send-message', {
        roomId, userId, userName,
        message: `Shared: ${mediaFile.name}`,
        messageType: 'media', mediaData: base64Data,
        fileName: mediaFile.name, fileSize: mediaFile.size, mimeType: mediaFile.type,
      });
      setMediaFile(null); setShowMediaPanel(false);
      notify('Media shared', 'success');
    } catch (e) { notify(`Failed: ${e.message}`, 'error'); }
    finally { setIsUploadingMedia(false); setTimeout(() => setUploadProgress(0), 800); }
  };

  const fileIcon = (m) => m?.startsWith('image/') ? <ImageIcon className="w-4 h-4" />
    : m?.startsWith('audio/') ? <Volume2 className="w-4 h-4" />
    : <FileText className="w-4 h-4" />;

  const HOST_CONTROLS = [
    { label: 'Media Sharing', icon: <ImageIcon className="w-3.5 h-3.5" />, active: roomSettings.allow_media, onClick: handleToggleMediaPerms },
    { label: 'Chat', icon: <MessageSquare className="w-3.5 h-3.5" />, active: roomSettings.allow_chat, onClick: handleToggleChat },
    { label: isRoomLocked ? 'Locked' : 'Unlocked', icon: isRoomLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />, active: !isRoomLocked, onClick: handleToggleLock, invertColor: true },
  ];

  // ── Room entry denied (e.g. room is locked) ──────────────────────────────────
  if (roomEntryDenied === 'locked') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center p-4" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="w-full max-w-sm rounded-3xl border border-amber-400/20 bg-slate-900/80 backdrop-blur-xl p-8 text-center shadow-2xl shadow-black/50">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-amber-400/20 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Room is Locked</h2>
          <p className="text-slate-400 text-sm mb-6">
            The host has locked this room. You cannot join right now.
          </p>
          <button
            onClick={() => navigate('/audio-rooms')}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all duration-200"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100 flex flex-col" style={{ width: '100%', maxWidth: 'none' }}>
      <Toast n={toast} />

      {/* Ambient */}
      <div className="fixed -top-40 -right-40 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="flex items-center justify-between h-16 gap-3">

            {/* Left */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shrink-0">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate text-sm leading-tight">
                  {roomInfo?.title || 'Audio Room'}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {socketConnected
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400">Live</span></>
                    : <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">Reconnecting</span></>
                  }
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{participants.length} {participants.length === 1 ? 'person' : 'people'}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleToggleMute}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow transition-all duration-200 ${
                  isMuted
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {isHost && (
                <button
                  onClick={handleEndRoom}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-2 text-sm font-semibold transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">End</span>
                </button>
              )}

              <button
                onClick={() => doLeave()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 text-sm font-semibold transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row gap-4 min-h-0 relative z-10">

        {/* Sidebar */}
        <aside className="lg:w-72 xl:w-80 flex flex-col gap-3 shrink-0">

          {/* Mobile tab switcher */}
          <div className="flex lg:hidden rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
            {['chat', 'participants'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-semibold capitalize flex items-center justify-center gap-1.5 transition-colors duration-200 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'chat' ? <MessageSquare className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {tab}
              </button>
            ))}
          </div>

          {/* Participants */}
          <div className={`rounded-3xl border border-slate-700 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden flex flex-col ${activeTab !== 'participants' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-300" /> Participants
              </span>
              <span className="text-xs font-bold text-sky-300 border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 rounded-full">
                {participants.length}
              </span>
            </div>
            <div className="overflow-y-auto max-h-56 lg:max-h-[38vh] p-3 space-y-1.5">
              {participants.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No one here yet
                </div>
              ) : participants.map((p, i) => {
                const isMe = p.userId === userId;
                const showCrown = p.isHost || (isMe && isHost);
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all duration-200 ${isMe ? 'border-sky-400/30 bg-sky-400/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                    style={{ animation: 'scaleIn 0.2s ease both', animationDelay: `${i * 30}ms` }}
                  >
                    <Avatar name={p.userName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
                        {p.userName}
                        {isMe && <span className="text-sky-400">(you)</span>}
                        {showCrown && <Crown className="w-3 h-3 text-amber-400" />}
                      </p>
                      {showCrown && <p className="text-xs text-sky-400">Host</p>}
                    </div>
                    {p.isMuted
                      ? <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      : <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host controls */}
          {isHost && (
            <div className={`rounded-3xl border border-amber-400/20 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/30 overflow-hidden ${activeTab !== 'participants' ? 'hidden lg:block' : 'block'}`}>
              <button
                onClick={() => setShowHostControls(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-800 text-sm font-semibold text-amber-300"
              >
                <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Host Controls</span>
                {showHostControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHostControls && (
                <div className="p-3 space-y-2">
                  {HOST_CONTROLS.map(({ label, icon, active, onClick, invertColor }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border text-xs font-semibold transition-all duration-200 ${
                        active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : invertColor
                            ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">{icon} {label}</span>
                      <span className="opacity-60">{active ? 'On' : 'Off'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Chat */}
        <div
          className={`flex-1 rounded-3xl border border-slate-700 bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden flex flex-col min-h-0 ${activeTab !== 'chat' ? 'hidden lg:flex' : 'flex'}`}
          style={{ height: 'calc(100vh - 5.5rem)' }}
        >
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-300" /> Chat
            </span>
            {!roomSettings.allow_chat && (
              <span className="text-xs border border-slate-700 bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full">disabled by host</span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageSquare className="w-14 h-14 mb-3 opacity-10" />
                <p className="font-medium text-slate-400">No messages yet</p>
                <p className="text-sm mt-1">Say hello!</p>
              </div>
            ) : chatMessages.map((msg, i) => {
              const isMe = msg.userId === userId;
              return (
                <div
                  key={msg.id || i}
                  className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                  style={{ animation: 'slideUp 0.2s ease both' }}
                >
                  {!isMe && <Avatar name={msg.userName} size="sm" />}
                  <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && <p className="text-xs text-sky-400 font-semibold mb-1 px-1">{msg.userName}</p>}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 text-white rounded-br-sm shadow-lg shadow-sky-900/30'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.messageType === 'media' ? (
                        <div>
                          <p className="mb-2">{msg.message}</p>
                          {(msg.mediaData || msg.mediaUrl) && (
                            msg.mimeType?.startsWith('image/') ? (
                              <img
                                src={msg.mediaData || msg.mediaUrl} alt="Shared"
                                className="max-w-xs max-h-48 rounded-xl border border-white/10 cursor-pointer hover:opacity-90 transition"
                                onClick={() => window.open(msg.mediaData || msg.mediaUrl)}
                              />
                            ) : msg.mimeType?.startsWith('audio/') ? (
                              <audio controls className="max-w-xs mt-1 w-full">
                                <source src={msg.mediaData || msg.mediaUrl} type={msg.mimeType} />
                              </audio>
                            ) : (
                              <a href={msg.mediaData || msg.mediaUrl} download={msg.fileName}
                                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                                {fileIcon(msg.mimeType)} {msg.fileName}
                              </a>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-800 p-4 bg-slate-950/50 shrink-0">

            {/* Media panel */}
            {showMediaPanel && (
              <div className="mb-3 p-3 rounded-2xl border border-slate-700 bg-slate-900" style={{ animation: 'slideDown 0.2s ease both' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-sky-400" /> Attach file
                  </span>
                  <button onClick={() => { setShowMediaPanel(false); setMediaFile(null); }}>
                    <X className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                  </button>
                </div>
                <input
                  type="file"
                  onChange={handleMediaFile}
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                />
                {mediaFile && (
                  <div className="mt-2 flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-sky-400">{fileIcon(mediaFile.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{mediaFile.name}</p>
                      <p className="text-xs text-slate-500">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={handleSendMedia} disabled={isUploadingMedia}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {isUploadingMedia
                        ? <><Loader className="w-3 h-3 animate-spin" />{uploadProgress}%</>
                        : <><Send className="w-3 h-3" />Send</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMediaPanel(p => !p)}
                disabled={!roomSettings.allow_media}
                title={roomSettings.allow_media ? 'Attach media' : 'Media disabled'}
                className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
                  roomSettings.allow_media
                    ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-300'
                    : 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={roomSettings.allow_chat ? 'Type a message…' : 'Chat disabled by host'}
                disabled={!roomSettings.allow_chat}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition disabled:opacity-50"
              />

              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || !roomSettings.allow_chat}
                className="p-2.5 rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 text-white shadow-lg shadow-sky-900/30 disabled:shadow-none transition-all duration-200 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {Object.entries(remoteStreams).map(([uid, stream]) => (
        <RemoteAudio key={uid} stream={stream} />
      ))}
    </div>
  );
};

export default AudioRoomComponent;