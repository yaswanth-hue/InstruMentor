import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, db, getUserProfile, followUser, unfollowUser } from '../firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { Users, Search, UserPlus, UserMinus, Sparkles, Heart, MessageCircle, ArrowLeft } from 'lucide-react';

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

  const filteredUsers = useMemo(() => users.filter(user => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = user.displayName?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.username?.toLowerCase().includes(q);

    if (filterTab === 'following') {
      return matchesSearch && isFollowing(user.id);
    }
    return matchesSearch && !isFollowing(user.id);
  }), [users, searchTerm, filterTab, currentUserProfile]);

  const discoverCount = useMemo(
    () => users.filter((u) => !isFollowing(u.id)).length,
    [users, currentUserProfile]
  );

  const followingCount = useMemo(
    () => users.filter((u) => isFollowing(u.id)).length,
    [users, currentUserProfile]
  );

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
        <header className="sticky top-0 z-50 bg-zinc-950/85 backdrop-blur-2xl border-b border-white/5">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="h-16 sm:h-20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/home')}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline text-sm font-semibold">Back to feed</span>
                </button>
                <div className="h-10 w-10" />
              </div>

              <div className="pb-5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Discover musicians</h1>
                <p className="mt-1 text-sm text-zinc-400">Find people, follow profiles, and start conversations.</p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, username, or email"
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-900 border border-sky-300/20 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition-colors ${
                        filterTab === 'all'
                          ? 'bg-sky-500/20 text-sky-200 border-sky-300/40'
                          : 'bg-zinc-900 text-zinc-200 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      {discoverCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('following')}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition-colors ${
                        filterTab === 'following'
                          ? 'bg-sky-500/20 text-sky-200 border-sky-300/40'
                          : 'bg-zinc-900 text-zinc-200 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      {followingCount}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="mx-auto max-w-7xl">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-sky-300/20 bg-zinc-900/70 backdrop-blur-2xl overflow-hidden"
                  >
                    <div className="h-24 bg-gradient-to-br from-sky-500/20 via-blue-500/15 to-cyan-500/15" />
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
              <div className="text-center py-16 rounded-3xl border border-sky-300/20 bg-zinc-900/70">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-sky-500/10 border border-sky-300/20 flex items-center justify-center">
                  <Users className="w-8 h-8 text-sky-200" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-zinc-100">No musicians found</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm ? 'Try a different name, username, or email.' : 'Try searching, or check back later.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredUsers.map((user) => {
                  const userIsFollowing = isFollowing(user.id);
                  const userIsRequested = isRequested(user.id);

                  return (
                    <div
                      key={user.id}
                      onClick={() => navigate(`/user-profile/${user.id}`)}
                      className="group relative rounded-3xl border border-sky-300/20 bg-zinc-900/70 backdrop-blur-2xl overflow-hidden cursor-pointer hover:border-sky-300/40 transition-colors"
                    >
                      <div className="h-24 bg-gradient-to-br from-sky-400/70 via-blue-500/70 to-cyan-500/70" />

                      <div className="px-5 pb-5 pt-5">
                        <div className="-mt-12 mb-4 flex items-center justify-between gap-3">
                          <div className="h-20 w-20 rounded-full p-[2px] bg-gradient-to-br from-sky-300 via-blue-400 to-cyan-400">
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
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                                Following
                              </span>
                            )}
                            {userIsRequested && !userIsFollowing && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                                Requested
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-center min-h-[56px]">
                          <h3 className="text-base font-semibold text-zinc-50 line-clamp-1">
                            {user.displayName || 'Music Lover'}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-400 line-clamp-1">
                            {user.username ? `@${user.username}` : user.email}
                          </p>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 px-3 py-3">
                            <p className="text-sm font-semibold text-zinc-100">{user.followers?.length || 0}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Followers</p>
                          </div>
                          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 px-3 py-3">
                            <p className="text-sm font-semibold text-zinc-100">{user.following?.length || 0}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Following</p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {userIsFollowing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUnfollow(user.id)}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors"
                              >
                                <UserMinus className="w-4 h-4" />
                                Unfollow
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate('/messages')}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 text-white px-4 py-2.5 text-xs font-semibold hover:bg-sky-400 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                                Message
                              </button>
                            </>
                          ) : userIsRequested ? (
                            <button
                              type="button"
                              onClick={() => handleUnfollow(user.id)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors"
                            >
                              <UserPlus className="w-4 h-4 text-sky-200" />
                              Requested
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleFollow(user.id, user.isPrivate)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 text-white px-4 py-2.5 text-xs font-semibold hover:bg-sky-400 transition-colors"
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
        </main>
      </div>
    </>
  );
};

export default UsersPage;
