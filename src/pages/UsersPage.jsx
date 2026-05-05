import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, db, getUserProfile, followUser, unfollowUser } from '../firebase';
import { collection, getDocs, query, limit, where } from 'firebase/firestore';
import { Users, Search, UserPlus, UserMinus, Music, Sparkles, Star, Heart, MessageCircle, ArrowLeft } from 'lucide-react';

const UsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // all, following
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const abortController = new AbortController();

    loadUsers(abortController.signal);
    loadCurrentUserProfile(abortController.signal);

    // Cleanup function - abort requests when component unmounts
    return () => {
      abortController.abort();
    };
  }, []);

  const loadCurrentUserProfile = async (signal) => {
    if (currentUserId) {
      try {
        const profile = await getUserProfile(currentUserId);
        // Only update state if not aborted
        if (!signal?.aborted) {
          setCurrentUserProfile(profile);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error loading current user profile:', error);
        }
      }
    }
  };

  const loadUsers = async (signal) => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(usersQuery);

      // Check if aborted before processing
      if (signal?.aborted) {
        return;
      }

      const usersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => {
          // Filter out current user by checking both id and uid
          return user.id !== currentUserId && user.uid !== currentUserId;
        });

      // Only update state if not aborted
      if (!signal?.aborted) {
        setUsers(usersList);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading users:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const isFollowing = (userId) => {
    return currentUserProfile?.following?.includes(userId) || false;
  };

  const isRequested = (userId) => {
    return currentUserProfile?.followRequests?.includes(userId) || false;
  };

  const handleFollow = async (targetUserId, isPrivate) => {
    try {
      await followUser(currentUserId, targetUserId);

      // Update local state immediately without refresh
      setCurrentUserProfile(prev => {
        const newFollowing = [...(prev?.following || [])];
        const newRequests = [...(prev?.followRequests || [])];

        if (isPrivate) {
          // For private accounts, add to follow requests
          if (!newRequests.includes(targetUserId)) {
            newRequests.push(targetUserId);
          }
        } else {
          // For public accounts, add to following
          if (!newFollowing.includes(targetUserId)) {
            newFollowing.push(targetUserId);
          }
        }

        return {
          ...prev,
          following: newFollowing,
          followRequests: newRequests
        };
      });

      // Update the user's follower count in the users list
      setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === targetUserId && !isPrivate) {
          return {
            ...user,
            followers: [...(user.followers || []), currentUserId]
          };
        }
        return user;
      }));
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async (targetUserId) => {
    try {
      await unfollowUser(currentUserId, targetUserId);

      // Update local state immediately without refresh
      setCurrentUserProfile(prev => {
        const newFollowing = (prev?.following || []).filter(id => id !== targetUserId);
        const newRequests = (prev?.followRequests || []).filter(id => id !== targetUserId);

        return {
          ...prev,
          following: newFollowing,
          followRequests: newRequests
        };
      });

      // Update the user's follower count in the users list
      setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === targetUserId) {
          return {
            ...user,
            followers: (user.followers || []).filter(id => id !== currentUserId)
          };
        }
        return user;
      }));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterTab === 'following') {
      // Show only users you were following when the page loaded
      // This ensures users stay in Discover tab until page refresh
      return matchesSearch && user.followers?.includes(currentUserId);
    } else {
      // 'all' tab (Discover) - show everyone except those you were following on page load
      return matchesSearch && !user.followers?.includes(currentUserId);
    }
  });

  // Generate random gradient for each user card
  const getGradient = (index) => {
    const gradients = [
      'from-purple-400 via-pink-500 to-red-500',
      'from-blue-400 via-indigo-500 to-purple-600',
      'from-green-400 via-teal-500 to-blue-500',
      'from-yellow-400 via-orange-500 to-red-500',
      'from-pink-400 via-purple-500 to-indigo-600',
      'from-cyan-400 via-blue-500 to-indigo-600',
      'from-rose-400 via-fuchsia-500 to-purple-600',
      'from-amber-400 via-orange-500 to-pink-500',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <>
      <Helmet>
        <title>Discover Musicians | InstruMentor - Find & Connect</title>
        <meta name="description" content="Discover talented musicians on InstruMentor. Connect with artists, follow their journey, and collaborate with musicians from around the world." />
        <meta property="og:title" content="Discover Musicians | InstruMentor - Find & Connect" />
        <meta property="og:description" content="Discover talented musicians on InstruMentor. Connect with artists, follow their journey, and collaborate with musicians from around the world." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Discover Musicians | InstruMentor - Find & Connect" />
        <meta name="twitter:description" content="Discover talented musicians on InstruMentor. Connect with artists, follow their journey, and collaborate." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white" style={{ width: '100%', maxWidth: 'none' }}>
        {/* Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="cursor-pointer inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-semibold">Back to feed</span>
              </button>

              <div aria-hidden="true" />

              <div className="w-24 sm:w-28" aria-hidden="true" />
            </div>

            {/* Page controls */}
            <div className="pb-4 sm:pb-5">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    Discover musicians
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Search, follow, and build your circle.
                  </p>
                </div>

                <div className="w-full lg:max-w-xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-900/70 border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      style={{ cursor: 'pointer' }}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold border transition-colors ${
                        filterTab === 'all'
                          ? 'bg-white text-zinc-950 border-white'
                          : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      Discover
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('following')}
                      style={{ cursor: 'pointer' }}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold border transition-colors ${
                        filterTab === 'following'
                          ? 'bg-white text-zinc-950 border-white'
                          : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      Following
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading bar (page-level) */}
              {loading && (
                <div className="mt-4 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </header>

      {/* Users Grid */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden"
                  >
                    <div className="h-24 bg-gradient-to-br from-amber-400/20 via-pink-500/15 to-indigo-500/15" />
                    <div className="px-5 pb-5 pt-5">
                      <div className="-mt-12 mb-4 flex justify-center">
                        <div className="h-20 w-20 rounded-full border-4 border-zinc-950 bg-white/10 animate-pulse" />
                      </div>
                      <div className="h-4 w-2/3 mx-auto rounded bg-white/10 animate-pulse" />
                      <div className="mt-2 h-3 w-1/2 mx-auto rounded bg-white/10 animate-pulse" />
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="h-10 rounded-2xl bg-white/10 animate-pulse" />
                        <div className="h-10 rounded-2xl bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-amber-200" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-zinc-100">No musicians found</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm ? 'Try a different name or email.' : 'Try searching, or check back later.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredUsers.map((user, index) => {
                  const userIsFollowing = isFollowing(user.id);
                  const userIsRequested = isRequested(user.id);

                  return (
                    <div
                      key={user.id}
                      onClick={() => navigate(`/user-profile/${user.id}`)}
                      className="group relative rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden cursor-pointer hover:border-amber-300/30 transition-colors"
                    >
                      <div className={`h-24 bg-gradient-to-br ${getGradient(index)} opacity-80`} />

                      <div className="px-5 pb-5 pt-5">
                        <div className="-mt-12 mb-4 flex items-center justify-between gap-3">
                          <div className="h-20 w-20 rounded-full p-[2px] bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-500">
                            <div className="h-full w-full rounded-full overflow-hidden bg-zinc-900 border border-white/10">
                              {user.profilePic ? (
                                <img src={user.profilePic} alt={user.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-zinc-800 text-zinc-200 font-bold text-2xl">
                                  {user.displayName?.charAt(0)?.toUpperCase() || 'M'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {userIsFollowing && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-100">
                                <Heart className="w-3.5 h-3.5 text-pink-300 fill-pink-300" />
                                Following
                              </span>
                            )}
                            {userIsRequested && !userIsFollowing && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-100">
                                <UserPlus className="w-3.5 h-3.5 text-amber-200" />
                                Requested
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-center">
                          <h3 className="text-base font-semibold text-zinc-50 line-clamp-1">
                            {user.displayName || 'Music Lover'}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-400 line-clamp-1">{user.email}</p>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                            <p className="text-sm font-semibold text-zinc-100">{user.followers?.length || 0}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Followers</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                            <p className="text-sm font-semibold text-zinc-100">{user.following?.length || 0}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Following</p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {userIsFollowing ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnfollow(user.id);
                                }}
                                className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/12 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors"
                              >
                                <UserMinus className="w-4 h-4" />
                                Unfollow
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/messages`);
                                }}
                                className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400 text-zinc-950 px-4 py-2.5 text-xs font-semibold hover:brightness-125 hover:shadow-lg hover:shadow-amber-400/20 transition-all active:scale-[0.98]"
                              >
                                <MessageCircle className="w-4 h-4" />
                                Message
                              </button>
                            </>
                          ) : userIsRequested ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnfollow(user.id);
                              }}
                              className="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/12 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors"
                            >
                              <UserPlus className="w-4 h-4 text-amber-200" />
                              Requested
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollow(user.id, user.isPrivate);
                              }}
                              className="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400 text-zinc-950 px-4 py-2.5 text-xs font-semibold hover:brightness-125 hover:shadow-lg hover:shadow-amber-400/25 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                            >
                              <UserPlus className="w-4 h-4" />
                              {user.isPrivate ? 'Request' : 'Follow'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UsersPage;
