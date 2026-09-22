import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  MoreVertical,
  UserX,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Camera,
  Send,
  Paperclip,
  X,
  Hand,
  Smile,
  ThumbsUp,
  Heart,
  Laugh,
  ChevronUp
} from 'lucide-react';
import { auth, getMeetingById, getCourseById, startMeeting, endMeeting } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { getSocketServerUrl } from '../config/socketConfig';

// IMPORTANT: this must come from VITE_SOCKET_SERVER_URL (falling back to
// localhost only for same-machine dev), NOT a hardcoded 'localhost:3001'.
// A hardcoded localhost URL works when you and the other party are both on
// the same machine, but breaks completely for anyone joining from another
// device (e.g. a phone on the same WiFi) — "localhost" on their device
// points back to their own device, not this dev server, so their socket
// never connects and they silently never appear as a participant to anyone.
const socket = io.connect(getSocketServerUrl(), {
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 5000
});

socket.on('connect_error', (error) => {
  console.warn('Socket connection error (backend server not running):', error.message);
});

const VideoMeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // Meeting & User State
  const [meeting, setMeeting] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);

  // Pre-join gate. Media/socket join no longer fires the instant the
  // page loads — the host must explicitly click "Start Meeting" (or a
  // student must click "Join") first. This is what keeps scheduled
  // meetings from silently starting (and finishing) on their own.
  const [hasJoined, setHasJoined] = useState(false);
  const [starting, setStarting] = useState(false);

  // Participants
  const [participants, setParticipants] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Whichever remote participant currently has isScreenSharing set. Kept as
  // a single derived value (not separate state) so every place that needs
  // "is someone else presenting right now" — the layout switch and the
  // srcObject re-attach effect above — reads the same answer instead of
  // each computing it slightly differently and drifting out of sync.
  const remoteSharerActive = useMemo(
    () => participants.some(p => p.userId !== auth.currentUser?.uid && p.isScreenSharing),
    [participants]
  );

  // Media State
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  // UI State
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('everyone'); // 'everyone' or userId
  const [chatLocked, setChatLocked] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState({}); // userId -> { type, timestamp }
  const [raisedHands, setRaisedHands] = useState([]); // array of userIds with raised hands
  const [participantSearch, setParticipantSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  // Tracks whether the viewport is at/below Tailwind's `sm` breakpoint
  // (640px), so the grid's JS-computed column count (inline styles can't
  // use sm:/md: classes) matches the same breakpoint the rest of the UI
  // already uses.
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [availableDevices, setAvailableDevices] = useState({ audio: [], video: [] });
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [permissionsSettings, setPermissionsSettings] = useState({
    allowReactions: true,
    allowUnmute: true,
    allowVideo: true
  });
  const [mirrorVideo, setMirrorVideo] = useState(true);

  // Peer Connections
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});

  // Refs
  const localVideoRef = useRef(null);
  // Separate ref for the local screen-share preview. Previously there was
  // no dedicated element for this — the code only called replaceTrack() on
  // the outgoing peer-connection senders, so remote viewers eventually got
  // the screen track, but the sharer's own tile kept showing
  // localVideoRef's srcObject (the camera stream), which never changed.
  // That's the "stuck" preview: you were simply never looking at your own
  // share, only at whatever the camera was last showing.
  const localScreenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const chatEndRef = useRef(null);

  // ICE servers and RTC configuration for high-quality audio
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    sdpSemantics: 'unified-plan'
  };

  // Bumps the Opus audio bitrate in an SDP offer/answer. The previous
  // version did `sdp.replace('useinbandfec=1', 'useinbandfec=1; maxaverage...')`,
  // which produces an `a=fmtp` line with `; ` (semicolon + space) between
  // parameters. Real fmtp parameter lists use a bare `;` with no space
  // (e.g. `minptime=10;useinbandfec=1;stereo=1`) — the space is enough to
  // make several browsers' SDP parsers reject the whole description when
  // it's handed to setLocalDescription/setRemoteDescription. Because that
  // call was wrapped in try/catch with only a console.error, the failure
  // was silent: the offer/answer was never actually applied or sent, so
  // no media connection ever formed even though signaling looked fine.
  // This version only touches a line it can find and edits it with the
  // correct separator; if the line isn't present, it leaves the SDP
  // untouched instead of guessing.
  const boostOpusAudio = (sdp) => {
    try {
      return sdp.replace(
        /(a=fmtp:\d+ .*useinbandfec=1)([^\r\n]*)/,
        (match, base, rest) => {
          const extra = 'maxaveragebitrate=128000;stereo=1;maxplaybackrate=48000';
          // Avoid double-appending if this SDP already carries the params
          // (e.g. a re-offer built from a previous description).
          if (rest.includes('maxaveragebitrate')) return match;
          return `${base};${extra}${rest}`;
        }
      );
    } catch (err) {
      console.error('Error adjusting SDP, using original offer/answer:', err);
      return sdp;
    }
  };

  // Load meeting data
  useEffect(() => {
    const loadMeetingData = async () => {
      try {
        setLoading(true);
        const meetingData = await getMeetingById(meetingId);

        if (!meetingData) {
          setError('Meeting not found');
          return;
        }

        setMeeting(meetingData);

        const courseData = await getCourseById(meetingData.courseId);
        if (!courseData) {
          setError('Course not found');
          return;
        }

        setCourse(courseData);

        const userId = auth.currentUser?.uid;
        const userEmail = auth.currentUser?.email;

        // Check if user is host
        const isUserHost = meetingData.hostId === userId;
        setIsHost(isUserHost);

        // Check if user can access meeting
        const isEnrolled = courseData.enrolledUsers?.includes(userId);
        const isCreator = courseData.creatorId === userId;

        if (!isEnrolled && !isCreator) {
          setError('You must be enrolled in this course to join this meeting');
          return;
        }

        setLoading(false);

      } catch (err) {
        console.error('Error loading meeting:', err);
        setError('Failed to load meeting data');
        setLoading(false);
      }
    };

    loadMeetingData();
  }, [meetingId]);

  // Socket connection status (separate effect, always active)
  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    // Check initial connection state
    if (socket.connected) {
      setSocketConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  // While waiting on the pre-join screen (not yet joined, meeting not
  // active/ended), poll every 10s so the "Join Meeting" button appears
  // automatically once the host starts — no manual refresh needed.
  useEffect(() => {
    if (hasJoined || !meeting || meeting.isActive || meeting.endedAt) return;
    const id = setInterval(async () => {
      try {
        const fresh = await getMeetingById(meetingId);
        if (fresh) setMeeting(fresh);
      } catch (e) {
        console.error('Error polling meeting status:', e);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [hasJoined, meeting, meetingId]);

  // Initialize media and socket connection
  useEffect(() => {
    if (!meeting || loading || error || !hasJoined) return;

    const userId = auth.currentUser?.uid;
    const userName = auth.currentUser?.displayName || auth.currentUser?.email;
    const userEmail = auth.currentUser?.email;


    // Get initial media stream with high-quality audio
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      },
      video: false
    })
      .then(stream => {
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Mute audio by default
        stream.getAudioTracks().forEach(track => track.enabled = false);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join room via socket
        socket.emit('join-room', {
          roomId: meetingId,
          userId,
          userName,
          userEmail,
          isHost
        });

        // Listen for duplicate session errors
        socket.on('duplicate-session', ({ message }) => {
          setError(message);
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
          }
        });

        // The server can also silently refuse a join (e.g. "already in a
        // meeting session from another device") by emitting 'action-error'.
        // Previously nothing listened for this, so the room UI stayed open
        // showing 0 participants forever with no explanation. Surface it.
        socket.on('action-error', (message) => {
          console.error('Room join rejected by server:', message);
          setError(typeof message === 'string' ? message : 'Unable to join the meeting.');
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
          }
        });

      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
        setError('Unable to access camera/microphone. Please check permissions.');
      });

    // Socket event listeners
    socket.on('participants-updated', (participantsList) => {
      setParticipants(participantsList);
    });

    socket.on('participant-joined', async (participant) => {

      // Create peer connection for new participant
      if (participant.userId !== userId) {
        await createPeerConnection(participant.userId);
      }
    });

    socket.on('participant-left', ({ userId: leftUserId }) => {

      // Close peer connection
      if (peerConnectionsRef.current[leftUserId]) {
        peerConnectionsRef.current[leftUserId].close();
        delete peerConnectionsRef.current[leftUserId];
      }

      // Remove remote stream
      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[leftUserId];
        return updated;
      });
    });

    socket.on('webrtc-offer', async ({ fromUserId, offer }) => {
      await handleOffer(fromUserId, offer);
    });

    socket.on('webrtc-answer', async ({ fromUserId, answer }) => {
      await handleAnswer(fromUserId, answer);
    });

    socket.on('webrtc-ice-candidate', async ({ fromUserId, candidate }) => {
      await handleIceCandidate(fromUserId, candidate);
    });

    socket.on('new-message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('chat-history', (messages) => {
      setChatMessages(messages);
    });

    socket.on('participant-muted', ({ userId: mutedUserId, isMuted }) => {
      setParticipants(prev =>
        prev.map(p => p.userId === mutedUserId ? { ...p, isMuted } : p)
      );
    });

    socket.on('participant-video-toggled', ({ userId: toggledUserId, hasVideo }) => {
      setParticipants(prev =>
        prev.map(p => p.userId === toggledUserId ? { ...p, hasVideo } : p)
      );
    });

    socket.on('participant-screen-share', ({ userId: sharingUserId, isSharing }) => {
      setParticipants(prev =>
        prev.map(p => p.userId === sharingUserId ? { ...p, isScreenSharing: isSharing } : p)
      );
    });

    // Server-side rejection when someone else started sharing a moment
    // earlier (see the share-screen handler's single-presenter check).
    // getDisplayMedia() has already succeeded locally by the time this can
    // arrive, so roll that back cleanly instead of leaving a capture
    // running that nobody else will ever see.
    socket.on('screen-share-denied', ({ activeSharerName }) => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      if (localScreenVideoRef.current) {
        localScreenVideoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
      alert(`${activeSharerName || 'Someone else'} is already sharing their screen.`);
    });

    socket.on('host-action', ({ action, message }) => {
      alert(message);
      if (action === 'muted') {
        handleToggleMute(true);
      }
    });

    socket.on('kicked-from-room', ({ message }) => {
      alert(message);
      handleLeave();
    });

    socket.on('room-closed', () => {
      // Only show alert and leave for non-hosts (host already left via handleEndMeeting)
      if (!isHost) {
        alert('The meeting has been ended by the host');
        handleLeave();
      }
    });

    socket.on('chat-locked', ({ locked }) => {
      setChatLocked(locked);
      if (locked) {
        alert('Chat has been locked by the host. Only everyone messages are allowed.');
      } else {
        alert('Chat has been unlocked by the host.');
      }
    });

    socket.on('reaction-sent', ({ userId, reaction }) => {
      setReactions(prev => ({ ...prev, [userId]: { type: reaction, timestamp: Date.now() } }));
      setTimeout(() => {
        setReactions(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }, 3000);
    });

    socket.on('hand-raised', ({ userId, raised }) => {

      // Only update if raised is explicitly true or false, ignore undefined
      if (raised === true || raised === false) {
        setRaisedHands(prev => {
          if (raised) {
            const newState = prev.includes(userId) ? prev : [...prev, userId];
            return newState;
          } else {
            const newState = prev.filter(id => id !== userId);
            return newState;
          }
        });
      }
    });

    socket.on('permissions-updated', (settings) => {
      setPermissionsSettings(settings);
    });

    // Cleanup
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }

      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());

      socket.emit('leave-room', { roomId: meetingId, userId });
      socket.off('participants-updated');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('new-message');
      socket.off('chat-history');
      socket.off('duplicate-session');
      socket.off('action-error');
      socket.off('participant-screen-share');
      socket.off('screen-share-denied');
    };
  }, [meeting, loading, error, isHost, meetingId, hasJoined]);

  // Keep isMobileViewport in sync with actual window width, so the video
  // grid's column count updates on rotation/resize instead of only ever
  // reflecting the width at first render.
  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Re-attach the local camera/screen previews whenever the layout swaps
  // between the normal grid and the screen-share "main stage" view. Both
  // layouts render their own <video> with ref={localVideoRef} (grid tile
  // vs. filmstrip thumbnail), so switching between them unmounts one
  // <video> element and mounts a new one — srcObject is a plain DOM
  // property, not React state, so the new element starts out with no
  // stream at all until something reassigns it. That's why the local
  // camera preview would go blank after stopping a share (remote peers
  // were unaffected because their view of you goes over the peer
  // connection, not through this element) — nothing was reattaching your
  // camera stream to the freshly-mounted video element.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (isScreenSharing && localScreenVideoRef.current && screenStreamRef.current) {
      localScreenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing, remoteSharerActive]);

  // Get available devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices({ audio: audioDevices, video: videoDevices });
        if (audioDevices.length > 0) setSelectedAudioDevice(audioDevices[0].deviceId);
        if (videoDevices.length > 0) setSelectedVideoDevice(videoDevices[0].deviceId);
      } catch (err) {
        console.error('Error getting devices:', err);
      }
    };
    getDevices();
  }, []);

  // WebRTC Functions
  const createPeerConnection = async (targetUserId) => {
    try {
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionsRef.current[targetUserId] = pc;
      // The very first offer/answer exchange is done manually below, so the
      // negotiationneeded event that fires from the initial addTrack calls
      // should be ignored — otherwise we'd race a duplicate offer against
      // the manual one. Once that initial exchange completes, this flag
      // flips and later track changes (e.g. turning the camera on after
      // joining with it off) correctly trigger a fresh offer.
      let isInitialNegotiation = true;

      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            roomId: meetingId,
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [targetUserId]: event.streams[0]
        }));
      };

      // Surface connection failures instead of leaving media silently
      // stuck — previously there was no visibility into whether a peer
      // connection actually completed, so a dead connection looked
      // identical (in the UI) to one still negotiating.
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${targetUserId}:`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          // A single ICE restart attempt often recovers a connection that
          // failed due to a transient network blip.
          pc.restartIce?.();
        }
      };

      // Renegotiate whenever tracks change after the initial connection is
      // up — e.g. someone turns their camera on after joining with it off.
      // Without this, addTrack() only adds the track locally; the remote
      // side never learns about it and its ontrack never fires.
      pc.onnegotiationneeded = async () => {
        if (isInitialNegotiation) return;
        try {
          const newOffer = await pc.createOffer();
          await pc.setLocalDescription(newOffer);
          socket.emit('webrtc-offer', {
            roomId: meetingId,
            targetUserId,
            offer: pc.localDescription
          });
        } catch (err) {
          console.error('Error renegotiating connection:', err);
        }
      };

      // Create and send offer with audio codec preferences
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      // Modify SDP to prefer Opus codec with higher bitrate
      const modifiedOffer = {
        ...offer,
        sdp: boostOpusAudio(offer.sdp)
      };

      await pc.setLocalDescription(modifiedOffer);

      socket.emit('webrtc-offer', {
        roomId: meetingId,
        targetUserId,
        offer: modifiedOffer
      });

      isInitialNegotiation = false;

      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
    }
  };

  const handleOffer = async (fromUserId, offer) => {
    try {
      let pc = peerConnectionsRef.current[fromUserId];
      let isNewConnection = false;

      if (!pc) {
        isNewConnection = true;
        pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[fromUserId] = pc;

        // Add local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
          });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc-ice-candidate', {
              roomId: meetingId,
              targetUserId: fromUserId,
              candidate: event.candidate
            });
          }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
          setRemoteStreams(prev => ({
            ...prev,
            [fromUserId]: event.streams[0]
          }));
        };

        // Same reasoning as createPeerConnection above: make failures
        // visible instead of a permanently silent, stuck connection.
        pc.oniceconnectionstatechange = () => {
          console.log(`ICE connection state with ${fromUserId}:`, pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed') {
            pc.restartIce?.();
          }
        };

        // Same reasoning as createPeerConnection: ignore the
        // negotiationneeded event fired by the initial addTrack calls
        // (the offer/answer we're already handling below covers that),
        // but renegotiate for any tracks added after this point.
        let isInitialNegotiation = true;
        pc.onnegotiationneeded = async () => {
          if (isInitialNegotiation) return;
          try {
            const newOffer = await pc.createOffer();
            await pc.setLocalDescription(newOffer);
            socket.emit('webrtc-offer', {
              roomId: meetingId,
              targetUserId: fromUserId,
              offer: pc.localDescription
            });
          } catch (err) {
            console.error('Error renegotiating connection:', err);
          }
        };
        pc._markInitialNegotiationDone = () => { isInitialNegotiation = false; };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();

      // Modify SDP for higher audio quality
      const modifiedAnswer = {
        ...answer,
        sdp: boostOpusAudio(answer.sdp)
      };

      await pc.setLocalDescription(modifiedAnswer);

      socket.emit('webrtc-answer', {
        roomId: meetingId,
        targetUserId: fromUserId,
        answer: modifiedAnswer
      });

      if (isNewConnection) pc._markInitialNegotiationDone();

    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromUserId, answer) => {
    try {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(pc);
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (fromUserId, candidate) => {
    try {
      const pc = peerConnectionsRef.current[fromUserId];
      if (!pc) return;

      // ICE candidates from the other side can arrive (and often do,
      // over a fast local network) before setRemoteDescription() has
      // finished running here — addIceCandidate() throws in that state.
      // The old code let that throw straight into the catch below and
      // silently dropped the candidate, which could leave a connection
      // without enough candidates to ever complete, even though the
      // offer/answer exchange itself succeeded. Queue anything that
      // arrives too early and flush it once the remote description is set.
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        if (!pc._pendingCandidates) pc._pendingCandidates = [];
        pc._pendingCandidates.push(candidate);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  };

  // Applies any ICE candidates that arrived before the remote description
  // was set (see handleIceCandidate above). Call this right after every
  // successful setRemoteDescription().
  const flushPendingCandidates = async (pc) => {
    if (!pc._pendingCandidates || pc._pendingCandidates.length === 0) return;
    const queued = pc._pendingCandidates;
    pc._pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error applying queued ICE candidate:', err);
      }
    }
  };

  // Media Controls
  const handleToggleMute = (forceMute = null) => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMutedState = forceMute !== null ? forceMute : !isMuted;
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);

        if (socket.connected) {
          socket.emit('toggle-mute', {
            roomId: meetingId,
            userId: auth.currentUser?.uid,
            isMuted: newMutedState
          });
        } else {
          console.error('Socket not connected, cannot emit toggle-mute');
        }
      } else {
        console.error('No audio track available');
      }
    } else {
      console.error('No local stream available');
    }
  };

  const handleToggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];

      if (!videoTrack && isVideoOff) {
        // No video track exists, request camera permission
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];

          // Add video track to local stream
          localStreamRef.current.addTrack(newVideoTrack);

          // Update video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Add video track to all peer connections
          Object.values(peerConnectionsRef.current).forEach(pc => {
            pc.addTrack(newVideoTrack, localStreamRef.current);
          });

          setIsVideoOff(false);

          socket.emit('toggle-video', {
            roomId: meetingId,
            userId: auth.currentUser?.uid,
            hasVideo: true
          });
        } catch (err) {
          console.error('Error accessing camera:', err);
          alert('Unable to access camera. Please check permissions.');
        }
      } else if (videoTrack) {
        // Video track exists, just toggle it
        const newVideoState = !isVideoOff;
        videoTrack.enabled = !newVideoState;
        setIsVideoOff(newVideoState);

        socket.emit('toggle-video', {
          roomId: meetingId,
          userId: auth.currentUser?.uid,
          hasVideo: !newVideoState
        });
      }
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      if (localScreenVideoRef.current) {
        localScreenVideoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);

      // Restore the camera video track (if any) on every connection that
      // was showing the screen share, so peers see the camera again
      // instead of a frozen last frame or a blank sender.
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video' || s._isScreenShareSender);
        if (sender) {
          sender.replaceTrack(camTrack);
          sender._isScreenShareSender = false;
        }
      });

      socket.emit('share-screen', {
        roomId: meetingId,
        userId: auth.currentUser?.uid,
        isSharing: false
      });
    } else {
      // Only one presenter at a time, mirroring how Zoom/Meet work. Check
      // client-side first so we don't even prompt the OS screen-picker
      // when someone else is already presenting; the server enforces the
      // same rule (see share-screen handler) to cover the race where two
      // people click share within moments of each other.
      const activeSharer = participants.find(p => p.userId !== auth.currentUser?.uid && p.isScreenSharing);
      if (activeSharer) {
        alert(`${activeSharer.userName} is already sharing their screen. Only one person can share at a time.`);
        return;
      }

      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        // Play the live screen stream in its own preview element instead
        // of leaving the local tile stuck on the camera feed.
        if (localScreenVideoRef.current) {
          localScreenVideoRef.current.srcObject = stream;
        }

        const screenTrack = stream.getVideoTracks()[0];

        // If someone joined with their camera off, no video sender ever
        // existed on these connections (getSenders().find(...video) was
        // silently returning undefined, so replaceTrack() was never even
        // called and peers got nothing). Add the screen track as a new
        // sender in that case instead of dropping the share.
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
            sender._isScreenShareSender = true;
          } else {
            const newSender = pc.addTrack(screenTrack, stream);
            newSender._isScreenShareSender = true;
          }
        });

        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          handleScreenShare();
        };

        socket.emit('share-screen', {
          roomId: meetingId,
          userId: auth.currentUser?.uid,
          isSharing: true
        });
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  // Chat Functions
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (chatLocked && !isHost && selectedRecipient !== 'everyone') {
      alert('Chat is locked. You can only send messages to everyone.');
      return;
    }

    if (messageInput.trim()) {
      const messageData = {
        roomId: meetingId,
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName || auth.currentUser?.email,
        message: messageInput,
        messageType: selectedRecipient === 'everyone' ? 'public' : 'private',
        recipientId: selectedRecipient === 'everyone' ? null : selectedRecipient
      };

      if (socket.connected) {
        socket.emit('send-message', messageData);
        setMessageInput('');
      } else {
        console.error('Socket not connected, cannot send message');
        alert('Not connected to server. Please refresh and try again.');
      }
    }
  };

  const handleToggleChatLock = () => {
    if (!isHost) return;
    const newLockState = !chatLocked;
    socket.emit('toggle-chat-lock', {
      roomId: meetingId,
      locked: newLockState
    });
    setChatLocked(newLockState);
  };

  // Host Controls
  const handleMuteParticipant = (targetUserId, currentMuteState) => {
    if (!isHost) return;

    socket.emit('host-mute-participant', {
      roomId: meetingId,
      targetUserId,
      isMuted: !currentMuteState,
      hostId: auth.currentUser?.uid
    });
  };

  const handleKickParticipant = (targetUserId) => {
    if (!isHost) return;

    if (window.confirm('Are you sure you want to remove this participant?')) {
      socket.emit('host-kick-participant', {
        roomId: meetingId,
        targetUserId,
        hostId: auth.currentUser?.uid
      });
    }
  };

  const handleEndMeeting = async () => {
    if (!isHost) return;

    if (window.confirm('Are you sure you want to end this meeting for everyone?')) {
      try {
        // Clean up local streams
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Notify server to end meeting
        socket.emit('end-room', { roomId: meetingId });

        // Mark the meeting as ended in Firestore so it correctly shows
        // "Ended" (not "Completed" from the clock, not still "Live")
        // back on the course page.
        try { await endMeeting(meetingId); } catch (e) { console.error('endMeeting:', e); }

        // Navigate to course detail with replace to prevent back navigation to meeting
        navigate(`/course/${meeting?.courseId}`, { replace: true });
      } catch (err) {
        console.error('Error ending meeting:', err);
        alert('Failed to end meeting');
      }
    }
  };

  // Host clicks "Start Meeting" on the pre-join screen. Marks the
  // meeting active in Firestore first (so status is correct even if
  // the host's connection drops before they finish joining), then
  // opens the gate that lets the media/socket effect run.
  const handleStartMeeting = async () => {
    setStarting(true);
    try {
      await startMeeting(meetingId);
      setMeeting(m => m ? { ...m, isActive: true, endedAt: null } : m);
    } catch (err) {
      console.error('Error starting meeting:', err);
      // Don't block the host from entering just because the status
      // write failed — they can still run the call, it just won't be
      // reflected as "Live" elsewhere until it succeeds on retry.
    } finally {
      setStarting(false);
      setHasJoined(true);
    }
  };

  // Student/participant clicks "Join Meeting" once it's live.
  const handleJoinMeeting = () => {
    setHasJoined(true);
  };

  const handleLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    socket.emit('leave-room', {
      roomId: meetingId,
      userId: auth.currentUser?.uid
    });

    // Navigate to course detail with replace to prevent back to meeting
    navigate(`/course/${meeting?.courseId}`, { replace: true });
  };

  // Reactions & Hand Raise
  const handleSendReaction = (reactionType) => {
    if (!permissionsSettings.allowReactions && !isHost) {
      alert('Reactions are disabled by the host');
      return;
    }
    socket.emit('send-reaction', {
      roomId: meetingId,
      userId: auth.currentUser?.uid,
      reaction: reactionType
    });
    setShowReactions(false);
  };

  const handleRaiseHand = () => {
    const userId = auth.currentUser?.uid;
    const isRaised = raisedHands.includes(userId);
    const newState = !isRaised;


    // Update local state immediately for instant feedback
    setRaisedHands(prev => {
      if (newState) {
        return prev.includes(userId) ? prev : [...prev, userId];
      } else {
        return prev.filter(id => id !== userId);
      }
    });


    // Emit to server
    socket.emit('raise-hand', {
      roomId: meetingId,
      userId: userId,
      raised: newState
    });

  };

  // Device Selection
  const handleChangeAudioDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      newAudioTrack.enabled = !isMuted;

      // Replace audio track in all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      // Stop old audio track
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.stop());
        localStreamRef.current.removeTrack(localStreamRef.current.getAudioTracks()[0]);
        localStreamRef.current.addTrack(newAudioTrack);
      }

      setSelectedAudioDevice(deviceId);
    } catch (err) {
      console.error('Error changing audio device:', err);
      alert('Failed to change audio device');
    }
  };

  const handleChangeVideoDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoOff;

      // Replace video track in all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      // Stop old video track
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        localStreamRef.current.addTrack(newVideoTrack);
      }

      setSelectedVideoDevice(deviceId);
    } catch (err) {
      console.error('Error changing video device:', err);
      alert('Failed to change video device');
    }
  };

  // Block User
  const handleBlockUser = (userId) => {
    if (blockedUsers.includes(userId)) {
      setBlockedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setBlockedUsers(prev => [...prev, userId]);
    }
  };

  // Permissions (Host Only)
  const handleUpdatePermissions = (newSettings) => {
    if (!isHost) return;
    setPermissionsSettings(newSettings);
    socket.emit('update-permissions', {
      roomId: meetingId,
      settings: newSettings
    });
  };

  // Render Functions
  if (loading) {
    return <LoadingSpinner message="Loading meeting…" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="bg-white rounded-lg p-8 w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Cannot Join Meeting</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  // Pre-join screen — shown until the host explicitly starts the
  // meeting (or a participant explicitly joins one that's already
  // live). This is what stops a future-scheduled meeting from
  // silently "starting" the moment someone opens the link, and stops
  // it from being marked finished just because its scheduled time
  // has passed — only an explicit Start/End action changes that now.
  if (!hasJoined) {
    const scheduled = meeting?.scheduledTime?.toDate
      ? meeting.scheduledTime.toDate()
      : new Date(meeting?.scheduledTime);
    const now             = new Date();
    const isFutureMeeting = !isNaN(scheduled) && scheduled > now && !meeting?.isActive;
    const isEnded         = !!meeting?.endedAt;
    // Meeting is 'missed' if: not active, not ended, scheduled time has passed by >10 min
    const minutesPast     = !meeting?.isActive && !isEnded && !isNaN(scheduled) && scheduled < now
      ? (now - scheduled) / 60_000
      : 0;
    const isMissed = minutesPast > 10;

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
            <Video className="w-7 h-7 text-purple-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{meeting?.title || 'Meeting'}</h2>
          {!isNaN(scheduled) && (
            <p className="text-sm text-gray-400 mb-5">
              Scheduled for {scheduled.toLocaleString([], {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}

          {isEnded ? (
            <>
              <p className="text-gray-300 mb-6">This meeting has already ended.</p>
              <button
                onClick={() => navigate(`/course/${meeting?.courseId}`)}
                className="w-full px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 font-semibold transition-colors"
              >
                Back to Course
              </button>
            </>
          ) : meeting?.isActive ? (
            <>
              {isHost ? (
                <>
                  <p className="text-gray-300 mb-6">Your meeting is live. Rejoin it below.</p>
                  <button
                    onClick={handleJoinMeeting}
                    className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors"
                  >
                    Rejoin Meeting
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-300 mb-6">The host has started this meeting. You can join now.</p>
                  <button
                    onClick={handleJoinMeeting}
                    className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold transition-colors"
                  >
                    Join Meeting
                  </button>
                </>
              )}
            </>
          ) : isHost ? (
            <>
              {isMissed ? (
                <>
                  <p className="text-red-400 mb-2 font-semibold">This meeting wasn't started in time.</p>
                  <p className="text-gray-400 text-sm mb-6">
                    Meetings can only be started within 10 minutes of their scheduled time.
                    Please schedule a new meeting.
                  </p>
                  <button
                    onClick={() => navigate(`/course/${meeting?.courseId}`)}
                    className="w-full px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 font-semibold transition-colors"
                  >
                    Back to Course
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-300 mb-6">
                    {isFutureMeeting
                      ? "This meeting is scheduled for later, but you can start it early whenever you're ready."
                      : "You're hosting this meeting. Start it whenever you're ready."}
                  </p>
                  <button
                    onClick={handleStartMeeting}
                    disabled={starting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors"
                  >
                    {starting ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Starting…
                      </>
                    ) : (
                      'Start Meeting'
                    )}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-300 mb-6">
                {isFutureMeeting
                  ? "The host hasn't started this meeting yet. You'll be able to join as soon as they do."
                  : "Waiting for the host to start this meeting…"}
              </p>
              <button
                onClick={async () => {
                  try {
                    const fresh = await getMeetingById(meetingId);
                    if (fresh) setMeeting(fresh);
                  } catch (e) { console.error('Error checking meeting status:', e); }
                }}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
              >
                Check Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 flex flex-col overflow-hidden" style={{width: '100%', maxWidth: 'none', height: '100svh'}}>
      {/* Header */}
      <div className="bg-gray-800 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-white min-w-0">
            <h1 className="text-sm sm:text-lg font-semibold truncate">{meeting?.title}</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">{course?.title}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} title={socketConnected ? 'Connected' : 'Disconnected'}></div>
            {isHost && (
              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-600 text-white text-xs sm:text-sm rounded-full whitespace-nowrap">
                Host
              </span>
            )}
            <span className="hidden sm:inline text-gray-400 text-sm whitespace-nowrap">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
            <span className="sm:hidden text-gray-400 text-xs whitespace-nowrap">
              {participants.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {/* Video Grid */}
        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0 min-w-0">
          {(() => {
            const nonBlockedParticipants = participants.filter(p =>
              p.userId !== auth.currentUser?.uid && !blockedUsers.includes(p.userId)
            );

            // Real meeting apps (Zoom, Meet) give whoever is presenting a
            // large dedicated stage instead of one equal-sized grid tile —
            // that's what was meant by the share getting "stuck" inside a
            // small window. Detect the current presenter (only one at a
            // time is meaningful here, same as this app's one-video-track
            // design) and switch layouts when someone is sharing.
            const remoteSharer = nonBlockedParticipants.find(p => p.isScreenSharing);
            const localIsSharing = isScreenSharing;
            const someoneIsSharing = localIsSharing || !!remoteSharer;

            if (someoneIsSharing) {
              const filmstripParticipants = remoteSharer
                ? nonBlockedParticipants.filter(p => p.userId !== remoteSharer.userId)
                : nonBlockedParticipants;

              return (
                <div className="w-full h-full flex flex-col lg:flex-row gap-2 sm:gap-3 p-2 sm:p-3 min-h-0">
                  {/* Main Stage */}
                  <div className="flex-1 min-h-0 min-w-0 relative">
                    {localIsSharing ? (
                      <div className="relative w-full h-full rounded-none sm:rounded-xl overflow-hidden bg-black flex items-center justify-center border border-gray-700">
                        <video
                          ref={localScreenVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/50 px-3 py-1 rounded text-white text-sm">
                          Your screen
                        </div>
                        <div className="absolute bottom-2 right-2 bg-green-600 px-2 py-1 rounded text-white text-xs">
                          Sharing Screen
                        </div>
                      </div>
                    ) : (
                      <RemoteVideo
                        participant={remoteSharer}
                        stream={remoteStreams[remoteSharer.userId]}
                        isHost={isHost}
                        onMute={() => handleMuteParticipant(remoteSharer.userId, remoteSharer.isMuted)}
                        onKick={() => handleKickParticipant(remoteSharer.userId)}
                        onBlock={() => handleBlockUser(remoteSharer.userId)}
                        reaction={reactions[remoteSharer.userId]}
                        handRaised={raisedHands.includes(remoteSharer.userId)}
                        isMainStage
                      />
                    )}
                  </div>

                  {/* Filmstrip — everyone's camera, including your own,
                      stays visible but small while the stage is active. */}
                  <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden flex-shrink-0 lg:w-40 xl:w-48 max-h-28 lg:max-h-none lg:h-full">
                    <div className="w-24 sm:w-28 lg:w-full aspect-video flex-shrink-0">
                      <div className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 group">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
                          style={{ display: isVideoOff ? 'none' : 'block' }}
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {auth.currentUser?.displayName?.[0] || auth.currentUser?.email?.[0] || 'Y'}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 bg-black/50 px-1.5 py-0.5 rounded text-white text-[10px] sm:text-xs">
                          You {isMuted && <MicOff className="inline w-3 h-3 ml-0.5" />}
                        </div>
                        {raisedHands.includes(auth.currentUser?.uid) && (
                          <div className="absolute top-1 left-1 bg-yellow-500 px-1 py-0.5 rounded text-white">
                            <Hand className="w-3 h-3" />
                          </div>
                        )}
                        {reactions[auth.currentUser?.uid] && (
                          <div className="absolute top-1 right-1 text-lg sm:text-xl animate-bounce">
                            {reactions[auth.currentUser?.uid].type}
                          </div>
                        )}
                      </div>
                    </div>

                    {filmstripParticipants.map(participant => (
                      <div key={participant.userId} className="w-24 sm:w-28 lg:w-full aspect-video flex-shrink-0">
                        <RemoteVideo
                          participant={participant}
                          stream={remoteStreams[participant.userId]}
                          isHost={isHost}
                          onMute={() => handleMuteParticipant(participant.userId, participant.isMuted)}
                          onKick={() => handleKickParticipant(participant.userId)}
                          onBlock={() => handleBlockUser(participant.userId)}
                          reaction={reactions[participant.userId]}
                          handRaised={raisedHands.includes(participant.userId)}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            const participantsPerPage = 9;
            const totalPages = Math.ceil((nonBlockedParticipants.length + 1) / participantsPerPage);
            const startIdx = currentPage * participantsPerPage;
            const currentParticipants = nonBlockedParticipants.slice(startIdx, startIdx + participantsPerPage - 1);
            const showLocal = currentPage === 0;

            // Calculate total visible participants
            const totalVisible = (showLocal ? 1 : 0) + currentParticipants.length;

            // Determine grid layout based on number of participants. The
            // grid must always fit inside the available space with no
            // scrolling, so rows are sized as an even 1fr split of
            // whatever height is actually available (repeat(rows, 1fr))
            // rather than a fixed pixel or minmax() floor — a floor can
            // add up to more than the container's real height once there
            // are enough rows, which is exactly what was forcing a
            // scrollbar before. Each tile's own aspect-ratio box (set in
            // the tile markup below) shrinks to fit its cell instead of
            // being cropped or distorted.
            let columns;
            if (totalVisible === 1) {
              columns = 1;
            } else if (totalVisible === 2) {
              columns = isMobileViewport ? 1 : 2;
            } else if (totalVisible <= 4) {
              columns = 2;
            } else if (totalVisible <= 6) {
              columns = isMobileViewport ? 2 : 3;
            } else {
              columns = isMobileViewport ? 2 : 3;
            }
            const rows = Math.max(1, Math.ceil(totalVisible / columns));
            const gridClass = 'grid gap-2 sm:gap-4 w-full h-full p-2 sm:p-4';
            const gridStyle = {
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
            };

            return (
              <>
                <div className={gridClass} style={gridStyle}>
                  {/* Local Video - only on first page */}
                  {showLocal && (
                    <div className="w-full h-full min-h-0 min-w-0 flex items-center justify-center p-1 sm:p-2">
                      <div style={{ aspectRatio: '1/1', width: 'auto', height: '100%', maxWidth: '100%' }} className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 group">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
                          style={{ display: isVideoOff ? 'none' : 'block' }}
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                              {auth.currentUser?.displayName?.[0] || auth.currentUser?.email?.[0] || 'Y'}
                            </div>
                          </div>
                        )}
                        {/* Mirror Toggle Icon */}
                        <button
                          onClick={() => setMirrorVideo(!mirrorVideo)}
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 p-2 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                          title={mirrorVideo ? 'Disable mirror' : 'Enable mirror'}
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 bg-black/50 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded text-white text-xs sm:text-sm">
                        You {isMuted && <MicOff className="inline w-3 h-3 sm:w-4 sm:h-4 ml-1" />}
                      </div>
                      {raisedHands.includes(auth.currentUser?.uid) && (
                        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-yellow-500 p-1 sm:px-2 sm:py-1 rounded text-white">
                          <Hand className="w-3 h-3 sm:w-4 sm:h-4" />
                        </div>
                      )}
                      {reactions[auth.currentUser?.uid] && (
                        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 text-xl sm:text-4xl animate-bounce">
                          {reactions[auth.currentUser?.uid].type}
                        </div>
                      )}
                      </div>
                    </div>
                  )}

                  {/* Remote Videos */}
                  {currentParticipants.map(participant => (
                    <RemoteVideo
                      key={participant.userId}
                      participant={participant}
                      stream={remoteStreams[participant.userId]}
                      isHost={isHost}
                      onMute={() => handleMuteParticipant(participant.userId, participant.isMuted)}
                      onKick={() => handleKickParticipant(participant.userId)}
                      onBlock={() => handleBlockUser(participant.userId)}
                      reaction={reactions[participant.userId]}
                      handRaised={raisedHands.includes(participant.userId)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-white">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Sidebar - Chat/Participants */}
        {(showChat || showParticipants) && (
          <div className="fixed sm:static inset-0 sm:inset-auto z-30 sm:z-auto w-full sm:w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden min-h-0">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => { setShowChat(true); setShowParticipants(false); }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  showChat ? 'text-white border-b-2 border-purple-500' : 'text-gray-400'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => { setShowParticipants(true); setShowChat(false); }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  showParticipants ? 'text-white border-b-2 border-purple-500' : 'text-gray-400'
                }`}
              >
                Participants ({participants.length})
              </button>
            </div>

            {/* Chat Panel */}
            {showChat && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Header with Controls */}
                <div className="p-3 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">Messages</span>
                    {isHost && (
                      <button
                        onClick={handleToggleChatLock}
                        className={`px-2 py-1 rounded text-xs ${
                          chatLocked ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                        } text-white`}
                        title={chatLocked ? 'Unlock chat' : 'Lock chat'}
                      >
                        {chatLocked ? <Lock className="w-3 h-3 inline" /> : <Unlock className="w-3 h-3 inline" />}
                        {chatLocked ? ' Locked' : ' Unlocked'}
                      </button>
                    )}
                  </div>

                  {/* Recipient Selector */}
                  {(!chatLocked || isHost) && (
                    <select
                      value={selectedRecipient}
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                      className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="everyone">Everyone</option>
                      {participants
                        .filter(p => p.userId !== auth.currentUser?.uid)
                        .map(p => (
                          <option key={p.userId} value={p.userId}>
                            Private: {p.userName}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(() => {
                    const myId = auth.currentUser?.uid;
                    // Each recipient gets its own thread instead of one
                    // shared feed with a "(Private)" tag mixed in: picking
                    // "Everyone" shows the public thread, picking a
                    // participant shows only the 1:1 conversation with
                    // them. The messages themselves were already scoped to
                    // this user server-side (see chat-history above); this
                    // just splits them into separate windows instead of
                    // one interleaved list.
                    const threadMessages = chatMessages.filter(msg => {
                      if (selectedRecipient === 'everyone') {
                        return msg.messageType === 'public';
                      }
                      return msg.messageType === 'private' && (
                        (msg.userId === myId && msg.recipientId === selectedRecipient) ||
                        (msg.userId === selectedRecipient && msg.recipientId === myId)
                      );
                    });
                    const recipientName = selectedRecipient === 'everyone'
                      ? null
                      : participants.find(p => p.userId === selectedRecipient)?.userName || 'participant';

                    return (
                      <>
                        {recipientName && (
                          <div className="text-xs text-yellow-400 text-center pb-1 border-b border-gray-700/50">
                            Private conversation with {recipientName}
                          </div>
                        )}
                        {threadMessages.length === 0 && (
                          <div className="text-gray-400 text-sm text-center mt-4">
                            {recipientName
                              ? `No messages with ${recipientName} yet. Say hi!`
                              : 'No messages yet. Start the conversation!'}
                          </div>
                        )}
                        {threadMessages.map((msg, idx) => (
                          <div key={msg.id ?? idx} className={`text-sm ${msg.messageType === 'private' ? 'bg-gray-700/50 p-2 rounded' : ''}`}>
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-purple-400">{msg.userName}</div>
                            </div>
                            <div className="text-gray-300">{msg.message}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={selectedRecipient === 'everyone' ? 'Message everyone...' : `Private message to ${participants.find(p => p.userId === selectedRecipient)?.userName || 'participant'}...`}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Participants Panel */}
            {showParticipants && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Participant Search */}
                <div className="p-3 border-b border-gray-700">
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Search participants..."
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                  {participants
                    .filter(p => p.userName?.toLowerCase().includes(participantSearch.toLowerCase()))
                    .map(participant => (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {participant.userName?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium flex items-center gap-2">
                            {participant.userName}
                            {participant.isHost && (
                              <span className="text-xs text-purple-400">(Host)</span>
                            )}
                            {participant.userId === auth.currentUser?.uid && (
                              <span className="text-xs text-gray-400">(You)</span>
                            )}
                            {raisedHands.includes(participant.userId) && (
                              <Hand className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {participant.isMuted && <MicOff className="w-3 h-3" />}
                            {!participant.hasVideo && <VideoOff className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                      {participant.userId !== auth.currentUser?.uid && (
                        <div className="relative flex items-center gap-1">
                          <button
                            onClick={() => setSelectedRecipient(participant.userId)}
                            className="p-1 hover:bg-gray-600 rounded"
                            title="Send private message"
                          >
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                          </button>
                          {isHost && (
                            <>
                              <button
                                onClick={() => handleMuteParticipant(participant.userId, participant.isMuted)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title={participant.isMuted ? 'Unmute' : 'Mute'}
                              >
                                {participant.isMuted ? (
                                  <VolumeX className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <Volume2 className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => handleKickParticipant(participant.userId)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Remove participant"
                              >
                                <UserX className="w-4 h-4 text-red-400" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleBlockUser(participant.userId)}
                            className="p-1 hover:bg-gray-600 rounded"
                            title={blockedUsers.includes(participant.userId) ? 'Unblock' : 'Block'}
                          >
                            <X className={`w-4 h-4 ${blockedUsers.includes(participant.userId) ? 'text-red-400' : 'text-gray-400'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 px-2 sm:px-6 py-3 sm:py-4 border-t border-gray-700 relative flex-shrink-0">
        {/* Reactions Panel */}
        {showReactions && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-700 rounded-lg p-3 flex gap-2 shadow-lg z-20">
            <button onClick={() => handleSendReaction('👍')} className="text-3xl hover:scale-110 transition-transform">👍</button>
            <button onClick={() => handleSendReaction('❤️')} className="text-3xl hover:scale-110 transition-transform">❤️</button>
            <button onClick={() => handleSendReaction('😂')} className="text-3xl hover:scale-110 transition-transform">😂</button>
            <button onClick={() => handleSendReaction('😮')} className="text-3xl hover:scale-110 transition-transform">😮</button>
            <button onClick={() => handleSendReaction('👏')} className="text-3xl hover:scale-110 transition-transform">👏</button>
          </div>
        )}

        {/* Settings Panel - Host Permissions Only */}

        <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 w-full min-w-max sm:min-w-0 px-1 overflow-x-auto">
          {/* Microphone with Device Menu */}
          <div className="relative group">
            <button
              onClick={() => handleToggleMute()}
              disabled={!permissionsSettings.allowUnmute && !isHost && isMuted}
              className={`p-3 sm:p-4 rounded-full ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors disabled:opacity-50`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-500 rounded-full p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="Select microphone"
            >
              <ChevronUp className="w-3 h-3 text-white" />
            </button>
            {showAudioMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-700 rounded-lg p-2 w-56 sm:w-64 max-w-[80vw] shadow-lg z-10">
                <h4 className="text-white text-sm font-medium mb-2 px-2">Select Microphone</h4>
                <div className="max-h-48 overflow-y-auto">
                  {availableDevices.audio.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleChangeAudioDevice(device.deviceId);
                        setShowAudioMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-600 ${
                        selectedAudioDevice === device.deviceId ? 'bg-gray-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Video with Device Menu */}
          <div className="relative group">
            <button
              onClick={handleToggleVideo}
              disabled={!permissionsSettings.allowVideo && !isHost && isVideoOff}
              className={`p-3 sm:p-4 rounded-full ${
                isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors disabled:opacity-50`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowVideoMenu(!showVideoMenu)}
              className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-500 rounded-full p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="Select camera"
            >
              <ChevronUp className="w-3 h-3 text-white" />
            </button>
            {showVideoMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-700 rounded-lg p-2 w-56 sm:w-64 max-w-[80vw] shadow-lg z-10">
                <h4 className="text-white text-sm font-medium mb-2 px-2">Select Camera</h4>
                <div className="max-h-48 overflow-y-auto">
                  {availableDevices.video.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleChangeVideoDevice(device.deviceId);
                        setShowVideoMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-600 ${
                        selectedVideoDevice === device.deviceId ? 'bg-gray-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleScreenShare}
            className={`p-3 sm:p-4 rounded-full ${
              isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Raise Hand */}
          <button
            onClick={handleRaiseHand}
            className={`p-3 sm:p-4 rounded-full ${
              raisedHands.includes(auth.currentUser?.uid) ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={raisedHands.includes(auth.currentUser?.uid) ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Reactions */}
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="p-3 sm:p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Reactions"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
            className="p-3 sm:p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
            className="p-3 sm:p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="px-3 sm:px-6 py-3 rounded-full bg-red-700 whitespace-nowrap hover:bg-red-800 text-white font-medium transition-colors flex items-center gap-2"
              title="End Meeting"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">End Meeting</span>
            </button>
          )}

          <button
            onClick={handleLeave}
            className="px-3 sm:px-6 py-3 rounded-full bg-red-600 whitespace-nowrap hover:bg-red-700 text-white font-medium transition-colors flex items-center gap-2"
            title="Leave"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Remote Video Component
const RemoteVideo = ({ participant, stream, isHost, onMute, onKick, onBlock, reaction, handRaised, isMainStage = false, compact = false }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  // Three layout modes:
  // - grid (default): a free-floating square tile, sized by content — used
  //   in the normal equal-grid view.
  // - isMainStage: fills its parent completely (the large presenter view).
  // - compact: also fills its parent completely, but keeps the small
  //   rounded-corner filmstrip look. Previously the filmstrip tiles reused
  //   the default "grid" mode, which force-applies aspectRatio: 1/1 via
  //   inline style — that fought with the aspect-video wrapper the
  //   filmstrip already puts each tile in, so a tile ended up constrained
  //   to two different, conflicting shapes at once and rendered squashed
  //   or cropped depending on the browser.
  const fillsParent = isMainStage || compact;

  return (
    <div className={fillsParent ? "w-full h-full min-h-0 min-w-0 flex items-center justify-center" : "w-full h-full min-h-0 min-w-0 flex items-center justify-center p-1 sm:p-2"}>
      <div
        style={fillsParent ? undefined : { aspectRatio: '1/1', width: 'auto', height: '100%', maxWidth: '100%' }}
        className={`relative bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden shadow-2xl border border-gray-700 group w-full h-full ${isMainStage ? 'rounded-none sm:rounded-xl' : 'rounded-xl'}`}
      >
        {/* Audio element (always present for audio playback) */}
        <audio ref={audioRef} autoPlay playsInline />

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${isMainStage && participant.isScreenSharing ? 'object-contain' : 'object-cover'}`}
          style={{ display: (stream && (participant.hasVideo || participant.isScreenSharing)) ? 'block' : 'none' }}
        />
        {(!stream || (!participant.hasVideo && !participant.isScreenSharing)) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`${isMainStage ? 'w-24 h-24 text-3xl' : compact ? 'w-8 h-8 sm:w-10 sm:h-10 text-sm' : 'w-20 h-20 text-2xl'} bg-purple-600 rounded-full flex items-center justify-center text-white font-bold`}>
              {participant.userName?.[0] || 'U'}
            </div>
          </div>
        )}

      <div className={`absolute bottom-1 left-1 sm:bottom-2 sm:left-2 bg-black/50 rounded text-white flex items-center gap-1 sm:gap-2 ${compact ? 'px-1.5 py-0.5 text-[10px] max-w-[85%] truncate' : 'px-1.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm max-w-[85%] truncate'}`}>
        {participant.userName}
        {participant.isMuted && <MicOff className={compact ? 'w-3 h-3 flex-shrink-0' : 'w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0'} />}
      </div>

      {/* Raised Hand */}
      {handRaised && (
        <div className={`absolute top-1 left-1 sm:top-2 sm:left-2 bg-yellow-500 rounded text-white ${compact ? 'p-1' : 'p-1 sm:px-2 sm:py-1'}`}>
          <Hand className={compact ? 'w-3 h-3' : 'w-3 h-3 sm:w-4 sm:h-4'} />
        </div>
      )}

      {/* Reaction */}
      {reaction && (
        <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 animate-bounce ${compact ? 'text-lg' : 'text-xl sm:text-4xl'}`}>
          {reaction.type}
        </div>
      )}

      {participant.isScreenSharing && !isMainStage && (
        <div className={`absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-green-600 rounded text-white ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-xs'}`}>
          {compact ? 'Sharing' : 'Sharing Screen'}
        </div>
      )}

      {isHost && (
        <div className="absolute top-2 left-2 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute top-10 left-0 bg-gray-900 rounded-lg shadow-lg py-1 w-40 z-10">
                <button
                  onClick={() => { onMute(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 flex items-center gap-2"
                >
                  {participant.isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {participant.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => { onKick(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default VideoMeetingRoom;