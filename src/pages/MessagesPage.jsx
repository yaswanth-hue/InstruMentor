import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  db,
  sendMessageRequest,
  acceptMessageRequest,
  rejectMessageRequest,
  getUserProfile,
  getPosts,
} from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { Mail, Send, Check, X, MessageCircle, User, MoreVertical, Search, ArrowLeft, PlaySquare, PanelRightOpen, PanelRightClose } from 'lucide-react';

const MessagesPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('accepted'); // accepted | pending
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [threadQuery, setThreadQuery] = useState('');
  const [showSocialPanel, setShowSocialPanel] = useState(false);
  const [socialTab, setSocialTab] = useState('posts'); // posts | reels
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialItems, setSocialItems] = useState([]);
  const currentUserId = auth.currentUser?.uid;

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

    const unsubscribe = onSnapshot(q, async (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    await sendMessageRequest({
      senderId: currentUserId,
      receiverId: activeChat.userId,
      content: newMessage,
      participants: [currentUserId, activeChat.userId]
    });

    setNewMessage('');
  };

  const handleAcceptRequest = async (messageId) => {
    await acceptMessageRequest(messageId);
  };

  const filteredConversations = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    const byTab = conversations.filter((convo) => {
      if (activeTab === 'accepted') return convo.status === 'accepted';
      return convo.status === 'pending' && convo.lastMessage?.receiverId === currentUserId;
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

  const visibleSocialItems = useMemo(() => {
    if (socialTab === 'posts') {
      return (socialItems || []).filter((p) => !p.mediaType || p.mediaType === 'post');
    }
    // reels / vibes: align with profile logic
    return (socialItems || []).filter(
      (p) =>
        p.mediaType === 'reel' ||
        (p.mediaType === 'video' && p.videoDuration && Number(p.videoDuration) <= 120)
    );
  }, [socialItems, socialTab]);

  useEffect(() => {
    if (!showSocialPanel) return;
    let alive = true;

    const load = async () => {
      setSocialLoading(true);
      try {
        const posts = await getPosts();
        if (!alive) return;
        const withUser = await Promise.all(
          (posts || []).slice(0, 30).map(async (p) => {
            const userInfo = await getUserProfile(p.userId);
            return { ...p, userInfo };
          })
        );
        if (!alive) return;
        setSocialItems(withUser);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load social items', e);
      } finally {
        if (alive) setSocialLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [showSocialPanel]);

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
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/70 backdrop-blur-xl">
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
                  onClick={() => setShowSocialPanel((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    showSocialPanel
                      ? 'border-sky-400/40 bg-sky-600/15 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                  aria-label={showSocialPanel ? 'Hide social panel' : 'Show social panel'}
                >
                  {showSocialPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  <span className="hidden sm:inline">{showSocialPanel ? 'Hide Social' : 'Show Social'}</span>
                  <span className="sm:hidden">Social</span>
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
        <main className="w-full px-4 sm:px-6 py-5" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-[calc(100vh-180px)]">
            {/* Threads */}
            <aside className="lg:col-span-4 xl:col-span-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="p-4 border-b border-slate-800">
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

                <div className="max-h-[calc(100vh-310px)] lg:max-h-[calc(100vh-250px)] overflow-y-auto">
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
                      return (
                        <button
                          key={convo.userId}
                          type="button"
                          onClick={() => {
                            setActiveChat(convo);
                            setShowChatOptions(false);
                          }}
                          className={`w-full text-left px-4 py-4 border-b border-slate-800 transition-colors ${
                            selected ? 'bg-slate-800/60' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start gap-3">
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-slate-100 truncate">
                                  {convo.userInfo?.displayName || 'Unknown user'}
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
            <section className={showSocialPanel ? 'lg:col-span-5 xl:col-span-5' : 'lg:col-span-8 xl:col-span-8'}>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col min-h-[520px]">
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
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
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
                            {activeChat.status === 'accepted' ? 'Conversation' : 'Request'}
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
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
                    </div>

                    {/* Composer */}
                    {activeChat.status === 'accepted' ? (
                      <div className="p-4 border-t border-slate-800">
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
                            disabled={!newMessage.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Send message"
                          >
                            <Send className="w-4 h-4" />
                            <span className="hidden sm:inline">Send</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                        <p className="text-sm text-slate-300 text-center">
                          Accept the request from the left to start chatting.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Social panel (desktop) */}
            <aside className={`hidden lg:block lg:col-span-3 xl:col-span-3 ${showSocialPanel ? '' : 'pointer-events-none'}`}>
              <div
                className={`rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden min-h-[520px] flex flex-col transition-all duration-300 ${
                  showSocialPanel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                }`}
              >
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">Social</p>
                    <p className="text-xs text-slate-400">Browse posts & reels</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSocialPanel(false)}
                    className="p-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
                    aria-label="Close social panel"
                  >
                    <X className="w-5 h-5 text-slate-200" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSocialTab('posts')}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      socialTab === 'posts' ? 'bg-slate-800 text-sky-300' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    Posts
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocialTab('reels')}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      socialTab === 'reels' ? 'bg-slate-800 text-sky-300' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    Reels
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {socialLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="mx-auto h-10 w-10 rounded-full border-b-2 border-sky-500 animate-spin" />
                      <p className="mt-3 text-sm">Loading…</p>
                    </div>
                  ) : visibleSocialItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <PlaySquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm">Nothing here yet.</p>
                    </div>
                  ) : socialTab === 'reels' ? (
                    <div className="grid grid-cols-2 gap-3">
                      {visibleSocialItems.slice(0, 16).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate('/home')}
                          className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/30 hover:bg-slate-800/40 transition-colors"
                          title="Open in feed"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="Reel" className="h-28 w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="h-28 w-full flex items-center justify-center text-slate-500">
                              <PlaySquare className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleSocialItems.slice(0, 12).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate(`/post/${p.id}`)}
                          className="w-full text-left rounded-2xl border border-slate-700 bg-slate-950/30 hover:bg-slate-800/40 transition-colors p-3"
                        >
                          <div className="flex items-start gap-3">
                            {p.userInfo?.profilePic ? (
                              <img src={p.userInfo.profilePic} alt={p.userInfo.displayName} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-100 truncate">
                                  {p.userInfo?.displayName || 'User'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {p.timestamp?.toDate?.()?.toLocaleDateString?.() || ''}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-slate-300 line-clamp-2">{p.content || ''}</p>
                              {p.imageUrl && (
                                <div className="mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
                                  <img
                                    src={p.imageUrl}
                                    alt="Post preview"
                                    className="h-24 w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => navigate('/home')}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-sky-300 hover:bg-slate-800 transition-colors"
                      >
                        Open full feed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
};

export default MessagesPage;
