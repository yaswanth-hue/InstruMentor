import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  db,
  sendMessageRequest,
  acceptMessageRequest,
  rejectMessageRequest,
  markMessagesRead,
  getUserProfile,
} from '../firebase';
import { collection, onSnapshot, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Mail, Send, Check, X, MessageCircle, User, MoreVertical, Search, ArrowLeft, SquarePen } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const MessagesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('accepted'); // accepted | pending
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [threadQuery, setThreadQuery] = useState('');
  const [pendingStartUser, setPendingStartUser] = useState(location.state?.startChatWith || null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newMessageSearch, setNewMessageSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const currentUserId = auth.currentUser?.uid;
  const markedReadIdsRef = useRef(new Set());
  const readReceiptsDisabledRef = useRef(false);

  // Message ids in a conversation that were sent to me and not yet read.
  const getUnreadMessageIds = (convo) =>
    (convo?.messages || [])
      .filter((m) => m.receiverId === currentUserId && m.read !== true)
      .map((m) => m.id);

  // Attempts to mark message ids as read exactly once each per page session,
  // and permanently stops trying for the rest of the session after the
  // first failure (e.g. Firestore rules don't allow the receiver to update
  // a message doc). This is intentionally only ever called from explicit
  // user actions (opening a conversation) — never from a reactive effect
  // tied to the conversations listener — so it can never re-trigger itself
  // in a loop no matter what Firestore reports back.
  const tryMarkRead = (ids) => {
    if (readReceiptsDisabledRef.current) return;
    const fresh = (ids || []).filter((id) => id && !markedReadIdsRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => markedReadIdsRef.current.add(id));
    markMessagesRead(fresh).catch((e) => {
      readReceiptsDisabledRef.current = true;
      // eslint-disable-next-line no-console
      console.error(
        'Failed to mark messages as read — disabling read receipts for this session. ' +
          'Check that your Firestore rules let the receiver update a message\'s "read" field:',
        e
      );
    });
  };

  const openConversation = (convo) => {
    setActiveChat(convo);
    setShowChatOptions(false);
    tryMarkRead(getUnreadMessageIds(convo));
  };

  // Helper to open a chat pane with a given user, reusing an existing
  // conversation if one already exists, or starting a fresh draft otherwise.
  const openChatWithUser = (userId, userInfo) => {
    const existing = conversations.find((c) => c.userId === userId);
    if (existing) {
      openConversation(existing);
      setActiveTab(existing.status === 'accepted' ? 'accepted' : activeTab);
    } else {
      setActiveChat({
        userId,
        userInfo: userInfo || null,
        messages: [],
        lastMessage: null,
        status: 'new',
      });
      setShowChatOptions(false);
    }
  };

  // If we arrived here via a "Message" button (profile/users page), open
  // that conversation once the user's info is available. If the user's
  // conversation list loads afterwards and already has a thread with this
  // person, swap the draft for the real conversation.
  useEffect(() => {
    if (!pendingStartUser?.userId) return;

    let userInfo = pendingStartUser.userInfo || null;

    const start = async () => {
      if (!userInfo) {
        try {
          userInfo = await getUserProfile(pendingStartUser.userId);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to load user profile for new chat', e);
        }
      }
      openChatWithUser(pendingStartUser.userId, userInfo);
    };

    start();

    // Clear the navigation state so refreshing/going back doesn't re-trigger this.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStartUser]);

  // Once conversations load/update, if we have a draft/active chat that now
  // has a real thread (e.g. the first message went through, or a thread
  // already existed), sync the active chat to the live data.
  // Note: this intentionally does NOT call tryMarkRead — marking messages
  // read only ever happens from an explicit user action (opening a thread),
  // never reactively off this listener, so it can't retrigger itself.
  useEffect(() => {
    if (!activeChat?.userId) return;
    const live = conversations.find((c) => c.userId === activeChat.userId);
    if (!live) return;
    const changed =
      live.status !== activeChat.status ||
      live.messages?.length !== activeChat.messages?.length ||
      live.lastMessage?.id !== activeChat.lastMessage?.id;
    if (changed) {
      setActiveChat(live);
    }
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load all users for the "New message" picker.
  useEffect(() => {
    if (!showNewMessageModal || allUsers.length > 0) return;
    let alive = true;
    const load = async () => {
      setAllUsersLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        if (!alive) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.id !== currentUserId);
        setAllUsers(list);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load users', e);
      } finally {
        if (alive) setAllUsersLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [showNewMessageModal, allUsers.length, currentUserId]);

  const filteredNewMessageUsers = useMemo(() => {
    const q = newMessageSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      const name = (u.displayName || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [allUsers, newMessageSearch]);

  // Close options menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptions && !event.target.closest('.options-menu')) {
        setShowChatOptions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showChatOptions]);

  useEffect(() => {
    if (!currentUserId) return;

    // Listen to messages in real-time
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', currentUserId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        setConversationsError('');
        const messageGroups = {};

        // Group messages by conversation
        for (const doc of snapshot.docs) {
          const data = { id: doc.id, ...doc.data() };
          const otherUserId = data.senderId === currentUserId ? data.receiverId : data.senderId;

          if (!messageGroups[otherUserId]) {
            messageGroups[otherUserId] = {
              userId: otherUserId,
              messages: [],
              lastMessage: data,
              status: data.status
            };
          }

          messageGroups[otherUserId].messages.push(data);

          // If this message is more recent, update last message
          if (!messageGroups[otherUserId].lastMessage.timestamp ||
              data.timestamp > messageGroups[otherUserId].lastMessage.timestamp) {
            messageGroups[otherUserId].lastMessage = data;
            messageGroups[otherUserId].status = data.status;
          }
        }

        // Fetch user info for each conversation
        const conversationsWithUserInfo = await Promise.all(
          Object.values(messageGroups).map(async (convo) => {
            const userProfile = await getUserProfile(convo.userId);
            return {
              ...convo,
              userInfo: userProfile
            };
          })
        );

        // Keep the most recently active threads first
        conversationsWithUserInfo.sort((a, b) => {
          const at = a.lastMessage?.timestamp?.toMillis?.() ?? 0;
          const bt = b.lastMessage?.timestamp?.toMillis?.() ?? 0;
          return bt - at;
        });

        setConversations(conversationsWithUserInfo);
      },
      (error) => {
        // Without this, a failing query (missing index, denied permissions)
        // fails completely silently and conversations just never load.
        // eslint-disable-next-line no-console
        console.error('Failed to load conversations:', error);
        setConversationsError(
          error?.code === 'permission-denied'
            ? "Couldn't load messages — permission denied. Check your Firestore security rules for the 'messages' collection."
            : error?.code === 'failed-precondition'
            ? "Couldn't load messages — Firestore needs a composite index for this query. Check the browser console for a link to create it."
            : `Couldn't load messages: ${error?.message || 'unknown error'}`
        );
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat || sending) return;

    if (!currentUserId) {
      setSendError("You're not signed in — please refresh and log in again.");
      return;
    }

    setSending(true);
    setSendError('');
    try {
      await sendMessageRequest({
        senderId: currentUserId,
        receiverId: activeChat.userId,
        content: newMessage,
        participants: [currentUserId, activeChat.userId]
      });
      setNewMessage('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send message:', error);
      setSendError(
        error?.code === 'permission-denied'
          ? "Message blocked by Firestore security rules (permission denied)."
          : `Couldn't send message: ${error?.message || 'unknown error'}`
      );
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRequest = async (messageId) => {
    await acceptMessageRequest(messageId);
  };

  useEffect(() => {
    setSendError('');
  }, [activeChat?.userId]);

  const filteredConversations = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    const byTab = conversations.filter((convo) => {
      const isOutgoingPending = convo.status === 'pending' && convo.lastMessage?.senderId === currentUserId;
      const isIncomingPending = convo.status === 'pending' && convo.lastMessage?.receiverId === currentUserId;
      if (activeTab === 'accepted') return convo.status === 'accepted' || isOutgoingPending;
      return isIncomingPending;
    });
    if (!q) return byTab;
    return byTab.filter((convo) => {
      const name = (convo.userInfo?.displayName || '').toLowerCase();
      const last = (convo.lastMessage?.content || '').toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [activeTab, conversations, currentUserId, threadQuery]);

  const activeMessages = useMemo(() => {
    if (!activeChat?.messages) return [];
    return [...activeChat.messages].sort((a, b) => {
      const at = a.timestamp?.toMillis?.() ?? 0;
      const bt = b.timestamp?.toMillis?.() ?? 0;
      return at - bt;
    });
  }, [activeChat]);

  const isOutgoingPending =
    activeChat?.status === 'pending' && activeChat.lastMessage?.senderId === currentUserId;
  const isIncomingPending =
    activeChat?.status === 'pending' && activeChat.lastMessage?.receiverId === currentUserId;

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeChat?.userId, activeMessages.length]);

  return (
    <>
      <Helmet>
        <title>Messages | InstruMentor - Chat with Musicians</title>
        <meta name="description" content="Connect and chat with musicians on InstruMentor. Send messages, share ideas, and collaborate with fellow artists in your network." />
        <meta property="og:title" content="Messages | InstruMentor - Chat with Musicians" />
        <meta property="og:description" content="Connect and chat with musicians on InstruMentor. Send messages, share ideas, and collaborate with fellow artists." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Messages | InstruMentor - Chat with Musicians" />
        <meta name="twitter:description" content="Connect and chat with musicians on InstruMentor. Send messages, share ideas, and collaborate." />
      </Helmet>
      <div
        className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        {/* Top bar */}
        <header className="shrink-0 border-b border-slate-800 bg-slate-950/70 backdrop-blur-xl">
          <div className="w-full px-4 sm:px-6 py-4" style={{ width: '100%', maxWidth: 'none' }}>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/30 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-all duration-300 hover:border-sky-300/60 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-sky-400/20 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-sky-300" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">Messages</h1>
                  <p className="text-xs text-slate-400 truncate">Chat and handle message requests</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewMessageModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-600/15 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-600/25 transition-colors"
                  aria-label="New message"
                >
                  <SquarePen className="w-4 h-4" />
                  <span className="hidden sm:inline">New Message</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('accepted')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'accepted'
                    ? 'bg-slate-800 text-sky-300'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                Conversations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-slate-800 text-sky-300'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                Requests
              </button>
            </div>
          </div>
        </header>

        {/* Two-pane layout */}
        <main className="flex-1 min-h-0 w-full px-4 sm:px-6 py-5 overflow-hidden" style={{ width: '100%', maxWidth: 'none', minHeight: 0 }}>
          <div className="mx-auto max-w-7xl h-full flex flex-col lg:flex-row gap-4 sm:gap-6" style={{ height: '100%', minHeight: 0 }}>
            {/* Threads */}
            <aside className={`h-full min-h-0 ${activeChat ? 'hidden lg:flex' : 'flex'} lg:flex-none lg:w-[360px] xl:w-[400px] flex-col`}>
              <div className="h-full flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="shrink-0 p-4 border-b border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="search"
                      value={threadQuery}
                      onChange={(e) => setThreadQuery(e.target.value)}
                      placeholder="Search people or messages…"
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/40 px-9 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                {conversationsError && (
                  <div className="shrink-0 mx-4 mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
                    {conversationsError}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto">
                  {filteredConversations.length === 0 ? (
                    <div className="p-10 text-center">
                      <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 font-semibold">
                        {activeTab === 'accepted' ? 'No conversations yet' : 'No requests right now'}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {activeTab === 'accepted'
                          ? 'Start by messaging a musician from their profile.'
                          : 'When someone messages you, requests will appear here.'}
                      </p>
                    </div>
                  ) : (
                    filteredConversations.map((convo) => {
                      const selected = activeChat?.userId === convo.userId;
                      const hasUnread = activeTab === 'accepted' && getUnreadMessageIds(convo).length > 0;
                      return (
                        <button
                          key={convo.userId}
                          type="button"
                          onClick={() => openConversation(convo)}
                          className={`w-full text-left px-4 py-4 border-b border-slate-800 transition-colors ${
                            selected ? 'bg-slate-800/60' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              {convo.userInfo?.profilePic ? (
                                <img
                                  src={convo.userInfo.profilePic}
                                  alt={convo.userInfo.displayName}
                                  className="w-11 h-11 rounded-2xl object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                  <User className="w-5 h-5 text-slate-300" />
                                </div>
                              )}
                              {hasUnread && (
                                <span
                                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sky-400 border-2 border-slate-900"
                                  aria-label="Unread messages"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-slate-100 truncate flex items-center gap-2">
                                  {convo.userInfo?.displayName || 'Unknown user'}
                                  {activeTab === 'accepted' && convo.status === 'pending' && (
                                    <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                      Pending
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 shrink-0">
                                  {convo.lastMessage?.timestamp?.toDate?.()?.toLocaleDateString?.() || ''}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-slate-400 truncate">
                                {convo.lastMessage?.content || ''}
                              </p>
                              {activeTab === 'pending' && (
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptRequest(convo.lastMessage.id);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/15 border border-emerald-400/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/25 transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rejectMessageRequest(convo.lastMessage.id);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-red-600/10 border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-600/20 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                    Decline
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* Chat */}
            <section className={`h-full min-h-0 flex-1 ${activeChat ? 'flex' : 'hidden lg:flex'} flex-col`}>
              <div className="h-full rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col">
                {!activeChat ? (
                  <div className="flex-1 flex items-center justify-center p-10 text-center">
                    <div>
                      <MessageCircle className="w-14 h-14 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-200 font-semibold">Pick a conversation</p>
                      <p className="mt-1 text-sm text-slate-400">Select a thread on the left to start chatting.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setActiveChat(null)}
                          className="lg:hidden shrink-0 p-2 -ml-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
                          aria-label="Back to conversations"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        {activeChat.userInfo?.profilePic ? (
                          <img
                            src={activeChat.userInfo.profilePic}
                            alt={activeChat.userInfo.displayName}
                            className="w-10 h-10 rounded-2xl object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate">
                            {activeChat.userInfo?.displayName || 'Unknown user'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {activeChat.status === 'accepted'
                              ? 'Conversation'
                              : activeChat.status === 'new'
                              ? 'New message'
                              : isOutgoingPending
                              ? 'Request sent · waiting for them to accept'
                              : 'Request'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative options-menu">
                        <button
                          type="button"
                          onClick={() => setShowChatOptions(!showChatOptions)}
                          className="p-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
                          aria-label="Chat options"
                        >
                          <MoreVertical className="w-5 h-5 text-slate-200" />
                        </button>

                        {showChatOptions && (
                          <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden z-10">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChat(null);
                                setShowChatOptions(false);
                              }}
                              className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              Close chat
                            </button>
                          </div>
                        )}
                      </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                      {activeChat.status === 'new' && activeMessages.length === 0 && (
                        <div className="h-full flex items-center justify-center text-center px-6">
                          <div>
                            <MessageCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-200 font-semibold">
                              Say hello to {activeChat.userInfo?.displayName || 'this musician'}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              Your message will be sent as a request until they accept.
                            </p>
                          </div>
                        </div>
                      )}
                      {activeMessages.map((msg) => {
                        const mine = msg.senderId === currentUserId;
                        return (
                          <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 border ${
                                mine
                                  ? 'bg-sky-600/20 border-sky-400/30 text-slate-100'
                                  : 'bg-slate-800/70 border-slate-700 text-slate-100'
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <p className={`mt-1 text-[11px] ${mine ? 'text-sky-200/80' : 'text-slate-400'}`}>
                                {msg.timestamp?.toDate?.()?.toLocaleTimeString?.() || ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Composer */}
                    {activeChat.status === 'accepted' || activeChat.status === 'new' || isOutgoingPending ? (
                      <div className="shrink-0 p-4 border-t border-slate-800">
                        {isOutgoingPending && (
                          <p className="mb-2 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                            This is still a pending request — {activeChat.userInfo?.displayName || 'they'} need to accept before it becomes a conversation.
                          </p>
                        )}
                        {sendError && (
                          <p className="mb-2 text-xs font-medium text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2">
                            {sendError}
                          </p>
                        )}
                        <div className="flex items-end gap-2">
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Write a message…"
                            rows={1}
                            className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Send message"
                          >
                            <Send className="w-4 h-4" />
                            <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-950/30">
                        {isIncomingPending ? (
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-sm text-slate-300 text-center">
                              Accept {activeChat.userInfo?.displayName || 'this'}'s request to start chatting.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => activeChat.lastMessage?.id && handleAcceptRequest(activeChat.lastMessage.id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/15 border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/25 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeChat.lastMessage?.id) rejectMessageRequest(activeChat.lastMessage.id);
                                  setActiveChat(null);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600/10 border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-600/20 transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Decline
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-300 text-center">
                            Accept the request from the left to start chatting.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

          </div>
        </main>

        {/* New message modal */}
        {showNewMessageModal && (
          <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-10"
            onClick={() => setShowNewMessageModal(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <p className="font-semibold text-slate-100">New message</p>
                <button
                  type="button"
                  onClick={() => setShowNewMessageModal(false)}
                  className="p-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-slate-200" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="search"
                    autoFocus
                    value={newMessageSearch}
                    onChange={(e) => setNewMessageSearch(e.target.value)}
                    placeholder="Search musicians…"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/40 px-9 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {allUsersLoading ? (
                  <div className="p-8">
                    <LoadingSpinner fullScreen={false} size="sm" message="Loading…" />
                  </div>
                ) : filteredNewMessageUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No musicians found.</div>
                ) : (
                  filteredNewMessageUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        openChatWithUser(u.id, u);
                        setShowNewMessageModal(false);
                        setNewMessageSearch('');
                      }}
                      className="w-full text-left px-4 py-3 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors flex items-center gap-3"
                    >
                      {u.profilePic ? (
                        <img
                          src={u.profilePic}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate">
                          {u.displayName || 'Unnamed musician'}
                        </p>
                        {u.username && (
                          <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MessagesPage;