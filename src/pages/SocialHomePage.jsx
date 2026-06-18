import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  getUserProfile,
  getFeedPosts,
  getPosts,
  createPost,
  createUserProfile,
  createStory,
  getStoriesGroupedByUser,
  markStoryAsViewed,
  likePost,
  unlikePost,
  addComment,
  resolveTaggedUsersByMentions
} from '../firebase';
import {
  Mail,
  PlusCircle,
  Home,
  BookOpen,
  User,
  Users,
  Sparkles,
  Music,
  Camera,
  ChevronRight,
  ChevronLeft,
  Heart,
  MessageCircle,
  Share2,
  Image,
  Mic,
  Send,
  X
} from 'lucide-react';
import StoriesBar from '../components/social/StoriesBar';
import QuickAccessPanel from '../components/social/QuickAccessPanel';
import TrendingPanel from '../components/social/TrendingPanel';

// Import instrument images and logo
import logoImg from "../assets/logo.png";
import drumsImg from "../assets/photos/drums.png";
import fluteImg from "../assets/photos/flute.png";
import guitarImg from "../assets/photos/guitar.png";
import tablaImg from "../assets/photos/tabla.png";
import harmoniumImg from "../assets/photos/harmonium.png";
import saxophoneImg from "../assets/photos/saxophone.png";
import keyboardImg from "../assets/photos/keyboard.png";
import violinImg from "../assets/photos/violin.png";

const SocialHomePage = () => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [uploadingPost, setUploadingPost] = useState(false);
  const [activeTab, setActiveTab] = useState('following');
  const [stories, setStories] = useState({});
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyImages, setStoryImages] = useState([]);
  const [storyText, setStoryText] = useState('');
  const [uploadingStory, setUploadingStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryUser, setCurrentStoryUser] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [likedPosts, setLikedPosts] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentCommentPost, setCurrentCommentPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedPostModal, setSelectedPostModal] = useState(null);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [postMediaType, setPostMediaType] = useState('post'); // post, reel, video
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState([]);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);

  useEffect(() => {
    const abortController = new AbortController();

    loadData(abortController.signal);

    // Cleanup function - abort requests when activeTab changes or component unmounts
    return () => {
      abortController.abort();
    };
  }, [activeTab]);

  // Reload profile when component mounts or when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      // Reload user profile when tab gains focus
      if (auth.currentUser?.uid) {
        console.log("SocialHomePage: Reloading profile on focus");
        getUserProfile(auth.currentUser.uid).then(profile => {
          if (profile) {
            console.log("SocialHomePage: Profile loaded from DB:", profile.profilePic);
            console.log("SocialHomePage: Auth photoURL:", auth.currentUser.photoURL);
            setUserProfile(profile);
          }
        });
      }
    };

    // Add focus listener
    window.addEventListener('focus', handleFocus);

    // Initial load
    handleFocus();

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadData = async (signal) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      // Get or create user profile
      let profile = await getUserProfile(userId);

      // Check if aborted
      if (signal?.aborted) return;

      if (!profile) {
        // Get existing profile pic from Firestore if it exists, otherwise null
        await createUserProfile(userId, {
          displayName: auth.currentUser.displayName || auth.currentUser.email,
          profilePic: null, // Don't use Firebase Auth photoURL
          email: auth.currentUser.email
        });

        // Check if aborted
        if (signal?.aborted) return;

        profile = await getUserProfile(userId);
      }

      // Check if aborted
      if (signal?.aborted) return;

      setUserProfile(profile);

      // Load stories
      const storiesData = await getStoriesGroupedByUser();

      // Check if aborted
      if (signal?.aborted) return;

      setStories(storiesData);

      // Load feed based on active tab
      let posts = [];
      if (activeTab === 'following') {
        if (profile?.following?.length > 0) {
          posts = await getFeedPosts(profile.following);
        } else {
          posts = [];
        }
      } else if (activeTab === 'explore') {
        posts = await getPosts(); // Always show all posts
      }

      // Check if aborted
      if (signal?.aborted) return;

      setFeed(posts);

      // Track liked posts for current user
      const currentUserId = auth.currentUser?.uid;
      const liked = {};
      posts.forEach(post => {
        if (post.likes && post.likes.includes(currentUserId)) {
          liked[post.id] = true;
        }
      });
      setLikedPosts(liked);

      // Calculate trending hashtags
      const hashtags = {};
      posts.forEach(post => {
        const matches = post.content?.match(/#[\w]+/g);
        if (matches) {
          matches.forEach(tag => {
            hashtags[tag] = (hashtags[tag] || 0) + 1;
          });
        }
      });

      const trending = Object.entries(hashtags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag, count }));

      // Check if aborted before final state update
      if (signal?.aborted) return;

      setTrendingHashtags(trending);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading data:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };



  const openStoryViewer = (userId, startIndex = 0) => {
    setCurrentStoryUser(userId);
    setCurrentStoryIndex(startIndex);
    setShowStoryViewer(true);
  };

  const closeStoryViewer = () => {
    setShowStoryViewer(false);
    setCurrentStoryUser(null);
    setCurrentStoryIndex(0);
  };

  const handleCreatePost = async () => {
    if (!postImage) {
      alert('Please add media to your post');
      return;
    }

    const isVideo = postImage.type.startsWith('video/');
    const isImage = postImage.type.startsWith('image/');

    if (isImage && (postMediaType === 'reel' || postMediaType === 'video')) {
      alert('Images cannot be uploaded as Vibes or Streams. Please select "Post" type.');
      return;
    }

    if (isVideo && postMediaType === 'post') {
      alert('Videos cannot be uploaded as regular Posts. Please select "Vibe" or "Stream" type.');
      return;
    }

    if (postMediaType === 'reel' && videoDuration > 120) {
      alert('Vibes (Reels) must be 2 minutes or less. Please select "Streams" for longer videos.');
      return;
    }

    try {
      setUploadingPost(true);
      const taggedUsers = await resolveTaggedUsersByMentions(postContent, auth.currentUser.uid);
      await createPost({
        content: postContent,
        userId: auth.currentUser.uid,
        userName: userProfile.displayName,
        userProfilePic: userProfile.profilePic,
        mediaType: postMediaType,
        videoDuration: videoDuration || 0,
        taggedUsers
      }, postImage);

      setPostContent('');
      setPostImage(null);
      setPostMediaType('post');
      setVideoDuration(0);
      setShowCreatePost(false);
      await loadData();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setUploadingPost(false);
    }
  };

  const handleCreateStory = async () => {
    if (storyImages.length === 0 && !storyText.trim()) {
      alert('Please add at least one image or text to your update');
      return;
    }

    try {
      setUploadingStory(true);
      await createStory({
        userId: auth.currentUser.uid,
        userName: userProfile.displayName,
        userProfilePic: userProfile.profilePic,
        text: storyText
      }, storyImages);

      setStoryText('');
      setStoryImages([]);
      setShowCreateStory(false);
      await loadData();
    } catch (error) {
      console.error('Error creating update:', error);
      alert('Failed to create update. Please try again.');
    } finally {
      setUploadingStory(false);
    }
  };

  const handleLikePost = async (postId) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      if (likedPosts[postId]) {
        await unlikePost(postId, userId);
        setLikedPosts(prev => ({ ...prev, [postId]: false }));
        setFeed(prevFeed => prevFeed.map(post =>
          post.id === postId
            ? { ...post, likes: post.likes.filter(id => id !== userId) }
            : post
        ));
      } else {
        await likePost(postId, userId);
        setLikedPosts(prev => ({ ...prev, [postId]: true }));
        setFeed(prevFeed => prevFeed.map(post =>
          post.id === postId
            ? { ...post, likes: [...(post.likes || []), userId] }
            : post
        ));
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
    }
  };

  const openCommentModal = (post) => {
    setCurrentCommentPost(post);
    setShowCommentModal(true);
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setCurrentCommentPost(null);
    setCommentText('');
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentCommentPost) return;

    try {
      setSubmittingComment(true);
      await addComment(currentCommentPost.id, {
        userId: auth.currentUser.uid,
        userName: userProfile.displayName,
        userProfilePic: userProfile.profilePic,
        text: commentText
      });

      setFeed(prevFeed => prevFeed.map(post =>
        post.id === currentCommentPost.id
          ? {
            ...post,
            comments: [
              ...(post.comments || []),
              {
                userId: auth.currentUser.uid,
                userName: userProfile.displayName,
                userProfilePic: userProfile.profilePic,
                text: commentText,
                timestamp: new Date().toISOString()
              }
            ]
          }
          : post
      ));

      setCommentText('');
      closeCommentModal();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const openPostModal = (post, index, allPosts) => {
    setViewerPosts(allPosts);
    setCurrentPostIndex(index);
    setSelectedPostModal(post);
  };

  const closePostModal = () => {
    setSelectedPostModal(null);
    setViewerPosts([]);
    setCurrentPostIndex(0);
  };

  const loadLikesList = async (post) => {
    if (!post?.likes || post.likes.length === 0) {
      setLikesList([]);
      return;
    }

    try {
      const likesData = await Promise.all(
        post.likes.map(async (userId) => {
          const userProfile = await getUserProfile(userId);
          return userProfile ? { id: userId, ...userProfile } : null;
        })
      );
      setLikesList(likesData.filter(Boolean));
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  return (
    <>
      <Helmet>
        <title>Home | InstruMentor</title>
      </Helmet>
      <div
        className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        {/* Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              {/* Logo */}
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="flex items-center gap-3 rounded-2xl px-2 py-1 hover:bg-white/5 transition-colors"
              >
                <div className="relative h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/80">
                  <img
                    src={logoImg}
                    alt="InstruMentor logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="hidden sm:block text-left">
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight">InstruMentor</h1>
                  <p className="text-[11px] text-zinc-400">Connect · Learn · Collaborate</p>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => navigate('/messages')}
                  className="relative p-2 sm:p-3 text-zinc-200 hover:text-white hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  {hasUnseenMessages && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="hidden xs:inline-flex px-4 sm:px-5 py-2 sm:py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-sky-900/30 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Create</span>
                </button>
                <button
                  onClick={() => {
                    const go = () => navigate(`/profile`);
                    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
                      // eslint-disable-next-line no-undef
                      document.startViewTransition(go);
                    } else {
                      go();
                    }
                  }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ring-2 ring-sky-400/40 hover:ring-sky-300 transition-all overflow-hidden hover:scale-105 shadow-md shadow-black/40"
                >
                  {userProfile?.profilePic ? (
                    <img
                      src={userProfile.profilePic}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      style={{ viewTransitionName: 'profile-avatar' }}
                    />
                  ) : (
                  <div
                    className="w-full h-full bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-500 flex items-center justify-center"
                    style={{ viewTransitionName: 'profile-avatar' }}
                  >
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 pt-2 pb-3 px-1 text-sm">
              <button
                onClick={() => setActiveTab('following')}
                className={`relative px-4 py-2 rounded-xl font-semibold transition-colors ${activeTab === 'following'
                  ? 'text-sky-300 bg-slate-800/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Following
                </div>
              </button>
              <button
                onClick={() => setActiveTab('explore')}
                className={`relative px-4 py-2 rounded-xl font-semibold transition-colors ${activeTab === 'explore'
                  ? 'text-sky-300 bg-slate-800/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Explore
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile-only slide panels */}
        <div className="lg:hidden">
          <QuickAccessPanel show={showQuickAccess} onClose={() => setShowQuickAccess(false)} />

          <TrendingPanel
            show={showTrending}
            onClose={() => setShowTrending(false)}
            trendingHashtags={trendingHashtags}
          />

          {!showQuickAccess && activeTab !== 'explore' && (
            <button
              onClick={() => setShowQuickAccess(true)}
              className="fixed left-2 sm:left-3 top-[calc(50%+36px)] -translate-y-1/2 bg-zinc-950/80 backdrop-blur-2xl text-white p-3 rounded-2xl border border-white/10 shadow-xl shadow-black/40 hover:bg-white/5 transition-colors z-30"
            >
              <ChevronRight className="w-6 h-6 text-sky-300" />
            </button>
          )}

          {!showTrending && activeTab !== 'explore' && (
            <button
              onClick={() => setShowTrending(true)}
              className="fixed right-2 sm:right-3 top-[calc(50%+36px)] -translate-y-1/2 bg-zinc-950/80 backdrop-blur-2xl text-white p-3 rounded-2xl border border-white/10 shadow-xl shadow-black/40 hover:bg-white/5 transition-colors z-30"
            >
              <ChevronLeft className="w-6 h-6 text-sky-300" />
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="w-full px-3 sm:px-4 lg:px-6 py-6 sm:py-8" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar (desktop) */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-[92px] space-y-4">
                <div className="rounded-3xl border border-slate-700 bg-zinc-900/70 backdrop-blur-2xl shadow-xl shadow-black/40 p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                      <img src={logoImg} alt="InstruMentor" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 truncate">Navigation</p>
                      <p className="text-xs text-zinc-400 truncate">Quick access</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      onClick={() => navigate('/users')}
                      className="w-full flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors"
                    >
                      <Users className="h-5 w-5 text-sky-300" />
                      Discover musicians
                    </button>
                    <button
                      onClick={() => navigate('/courses')}
                      className="w-full flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors"
                    >
                      <BookOpen className="h-5 w-5 text-sky-300" />
                      Browse courses
                    </button>
                    <button
                      onClick={() => navigate('/audio-rooms')}
                      className="w-full flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors"
                    >
                      <Mic className="h-5 w-5 text-sky-300" />
                      Join audio rooms
                    </button>
                    <button
                      onClick={() => navigate('/original-home')}
                      className="w-full flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors"
                    >
                      <Home className="h-5 w-5 text-sky-300" />
                      Virtual instruments
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-700 bg-zinc-900/70 backdrop-blur-2xl shadow-xl shadow-black/40 p-5">
                  <p className="text-sm font-semibold text-zinc-100">Create something</p>
                  <p className="mt-1 text-xs text-zinc-400">Share a quick practice update.</p>
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="mt-4 w-full rounded-2xl bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 text-sm font-semibold transition-colors"
                  >
                    Create post
                  </button>
                </div>
              </div>
            </aside>

            {/* Center Column */}
            <section className="lg:col-span-6">
              {activeTab !== 'explore' && (
                <div className="mb-6 rounded-3xl overflow-hidden border border-slate-700 bg-zinc-900/55 backdrop-blur-2xl shadow-xl shadow-black/30">
                  <StoriesBar
                    stories={stories}
                    onOpenStory={openStoryViewer}
                    onCreateStory={() => setShowCreateStory(true)}
                  />
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/70 backdrop-blur-2xl rounded-3xl border border-slate-700 shadow-2xl shadow-black/40 overflow-hidden"
                    >
                      <div className="p-5 flex items-center gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-white/10 animate-pulse" />
                        <div className="flex-1 min-w-0">
                          <div className="h-3.5 w-40 max-w-[60%] rounded bg-white/10 animate-pulse" />
                          <div className="mt-2 h-3 w-24 rounded bg-white/10 animate-pulse" />
                        </div>
                      </div>
                      <div className="px-5 pb-5 space-y-2">
                        <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
                        <div className="h-3 w-11/12 rounded bg-white/10 animate-pulse" />
                        <div className="h-3 w-9/12 rounded bg-white/10 animate-pulse" />
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="p-4 flex items-center gap-3">
                        <div className="h-9 w-20 rounded-2xl bg-white/10 animate-pulse" />
                        <div className="h-9 w-20 rounded-2xl bg-white/10 animate-pulse" />
                        <div className="h-9 w-20 rounded-2xl bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : feed.length === 0 ? (
                <div className="bg-zinc-900/75 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/50 border border-slate-700 p-8 sm:p-10 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-sky-400/30 shadow-lg shadow-black/40">
                    <Music className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-zinc-50 mb-2">
                    {activeTab === 'following' ? 'No Posts Yet' : 'No Posts Found'}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
                    {activeTab === 'following'
                      ? 'Follow other musicians to see their posts here!'
                      : 'Be the first to share something amazing!'}
                  </p>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-sky-900/30 transition-colors"
                  >
                    Create Your First Post
                  </button>
                </div>
              ) : activeTab === 'explore' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
                  {feed.filter(post => post.imageUrl).map((post, index) => (
                    <div
                      key={post.id}
                      className="relative group cursor-pointer overflow-hidden aspect-square bg-zinc-900 rounded-xl"
                      onClick={() => openPostModal(post, index, feed.filter(p => p.imageUrl))}
                    >
                      <img
                        src={post.imageUrl}
                        alt="Post"
                        className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="text-white flex items-center gap-6 text-base font-semibold">
                          <div className="flex items-center gap-2">
                            <Heart className="w-6 h-6 fill-white" />
                            <span>{post.likes?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-6 h-6 fill-white" />
                            <span>{post.comments?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 sm:space-y-8">
                  {feed.map((post) => (
                    <div
                      key={post.id}
                      className="bg-zinc-900/75 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/50 border border-slate-700 overflow-hidden hover:border-sky-400/40 transition-colors duration-300"
                    >
                  {/* Post Header */}
                  <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/user-profile/${post.userId}`)}>
                      <div className="w-11 h-11 rounded-2xl border border-sky-400/40 bg-zinc-900 overflow-hidden">
                        <div className="w-full h-full rounded-2xl overflow-hidden">
                          {post.userProfilePic ? (
                            <img src={post.userProfilePic} alt={post.userName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <User className="w-6 h-6 text-zinc-400" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-50">{post.userName}</h3>
                        <p className="text-xs text-zinc-500">
                          {post.timestamp?.toDate().toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="px-5 pb-3">
                    <p className="text-zinc-100 text-base leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Post Image */}
                  {post.imageUrl && (
                    <div className="relative w-full aspect-video bg-zinc-900">
                      <img
                        src={post.imageUrl}
                        alt="Post content"
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="px-5 py-4 flex items-center justify-between border-t border-white/10">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className="flex items-center gap-2 group"
                      >
                        <div className={`p-2 rounded-full transition-colors ${post.likes?.includes(auth.currentUser?.uid) ? 'bg-white/5' : 'group-hover:bg-white/5'}`}>
                          <Heart className={`w-6 h-6 transition-colors ${post.likes?.includes(auth.currentUser?.uid) ? 'fill-cyan-400 text-cyan-300' : 'text-zinc-300 group-hover:text-cyan-300'}`} />
                        </div>
                        <span className={`font-semibold ${post.likes?.includes(auth.currentUser?.uid) ? 'text-cyan-200' : 'text-zinc-300'}`}>
                          {post.likes?.length || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => openCommentModal(post)}
                        className="flex items-center gap-2 group"
                      >
                        <div className="p-2 rounded-full group-hover:bg-white/5 transition-colors">
                          <MessageCircle className="w-6 h-6 text-zinc-300 group-hover:text-sky-300" />
                        </div>
                        <span className="font-semibold text-zinc-300 group-hover:text-sky-300">
                          {post.comments?.length || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          const postLink = `${window.location.origin}/post/${post.id}`;
                          navigator.clipboard.writeText(postLink).then(() => {
                            alert('Link copied!');
                          });
                        }}
                        className="flex items-center gap-2 group"
                      >
                        <div className="p-2 rounded-full group-hover:bg-white/5 transition-colors">
                          <Share2 className="w-6 h-6 text-zinc-300 group-hover:text-sky-200" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right Sidebar (desktop) */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-[92px] space-y-4">
                <div className="rounded-3xl border border-slate-700 bg-zinc-900/70 backdrop-blur-2xl shadow-xl shadow-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Trending</p>
                      <p className="text-xs text-zinc-400">Hashtags right now</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTrending(true)}
                      className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                    >
                      View all
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(trendingHashtags || []).slice(0, 6).map((item) => (
                      <div
                        key={item.tag}
                        className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-100">{item.tag}</span>
                          <span className="text-xs text-zinc-400">{item.count}</span>
                        </div>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-300"
                            style={{ width: `${Math.min(100, (item.count / Math.max(1, (trendingHashtags?.[0]?.count || item.count))) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {(trendingHashtags || []).length === 0 && (
                      <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-6 text-center">
                        <p className="text-sm text-zinc-400">No trends yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Bottom padding for mobile navigation */}
          <div className="pb-20 sm:pb-0"></div>
        </div>

        {/* Create Post Modal - Premium */}
        {
          showCreatePost && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 rounded-3xl border border-sky-300/20 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-8 py-6 flex items-center justify-between rounded-t-3xl">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">Create Post</h2>
                  <button
                    onClick={() => setShowCreatePost(false)}
                    className="p-2 hover:bg-slate-800 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-300" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-sky-300/40 flex-shrink-0">
                      {userProfile?.profilePic ? (
                        <img
                          src={userProfile.profilePic}
                          alt="Your profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center">
                          <User className="w-7 h-7 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-100 text-lg">{userProfile?.displayName}</p>
                      <p className="text-sm text-sky-300 font-medium">Sharing with everyone</p>
                    </div>
                  </div>

                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Share your musical journey... Use @name to tag musicians"
                    className="w-full px-5 py-4 border-2 border-slate-700 bg-slate-800 rounded-2xl focus:outline-none focus:border-sky-400 resize-none text-base text-slate-100 placeholder-slate-500 min-h-[180px] transition-all"
                    rows={6}
                  />

                  {postImage && (
                    <div className="mt-6 relative">
                      <img
                        src={URL.createObjectURL(postImage)}
                        alt="Preview"
                        className="w-full rounded-2xl object-cover max-h-96 shadow-lg"
                      />
                      <button
                        onClick={() => setPostImage(null)}
                        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-4">
                    <label className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-2xl cursor-pointer transition-all border border-slate-700 hover:shadow-md">
                      <Image className="w-5 h-5" />
                      <span className="font-semibold">Add Media</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setPostImage(file);
                          // Get video duration if it's a video
                          if (file && file.type.startsWith('video/')) {
                            const video = document.createElement('video');
                            video.preload = 'metadata';
                            video.onloadedmetadata = () => {
                              setVideoDuration(Math.floor(video.duration));
                              // Auto-select media type based on duration
                              if (video.duration <= 120) {
                                setPostMediaType('reel');
                              } else {
                                setPostMediaType('video');
                              }
                            };
                            video.src = URL.createObjectURL(file);
                          } else {
                            setPostMediaType('post');
                            setVideoDuration(0);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Media Type Selection */}
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-slate-300 mb-3">Content Type:</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPostMediaType('post')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${postMediaType === 'post'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                      >
                        📸 Post
                      </button>
                      <button
                        onClick={() => setPostMediaType('reel')}
                        disabled={!postImage || !postImage.type.startsWith('video/')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${postMediaType === 'reel'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50'
                          }`}
                      >
                        ✨ Vibe (≤2min)
                      </button>
                      <button
                        onClick={() => setPostMediaType('video')}
                        disabled={!postImage || !postImage.type.startsWith('video/')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${postMediaType === 'video'
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50'
                          }`}
                      >
                        🎬 Stream (&gt;2min)
                      </button>
                    </div>
                    {videoDuration > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        Video duration: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-8 py-6 rounded-b-3xl">
                  {/* Media Required Warning */}
                  {!postImage && (
                    <div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-2xl">
                      <p className="text-sm text-amber-800 font-semibold flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Media is required to create a post
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => setShowCreatePost(false)}
                      className="px-8 py-3 text-slate-200 hover:bg-slate-800 rounded-2xl font-semibold transition-all border border-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePost}
                      disabled={uploadingPost || !postImage}
                      className="px-8 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {uploadingPost ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Create Update Modal - Premium */}
        {
          showCreateStory && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 rounded-3xl border border-sky-300/20 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-8 py-6 flex items-center justify-between rounded-t-3xl">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">Create Update</h2>
                  <button
                    onClick={() => setShowCreateStory(false)}
                    className="p-2 hover:bg-slate-800 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-300" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-8">
                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Share a moment from your musical journey..."
                    className="w-full px-5 py-4 border-2 border-slate-700 bg-slate-800 rounded-2xl focus:outline-none focus:border-sky-400 resize-none text-base text-slate-100 placeholder-slate-500 min-h-[150px] transition-all"
                    rows={4}
                  />

                  {storyImages.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      {storyImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Update preview ${index + 1}`}
                            className="w-full rounded-2xl object-cover h-48 shadow-lg"
                          />
                          <button
                            onClick={() => setStoryImages(storyImages.filter((_, i) => i !== index))}
                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-4">
                    <label className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-2xl cursor-pointer transition-all border border-slate-700 hover:shadow-md">
                      <Camera className="w-5 h-5" />
                      <span className="font-semibold">Add Images</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setStoryImages([...storyImages, ...Array.from(e.target.files)])}
                        className="hidden"
                      />
                    </label>
                    {storyImages.length > 0 && (
                      <p className="text-sm text-sky-300 font-medium">
                        {storyImages.length} {storyImages.length === 1 ? 'image' : 'images'} selected
                      </p>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-8 py-6 flex justify-end gap-4 rounded-b-3xl">
                  <button
                    onClick={() => setShowCreateStory(false)}
                    className="px-8 py-3 text-slate-200 hover:bg-slate-800 rounded-2xl font-semibold transition-all border border-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateStory}
                    disabled={uploadingStory}
                    className="px-8 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploadingStory ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Share Update
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Story Viewer Modal */}
        {
          showStoryViewer && currentStoryUser && stories[currentStoryUser] && (
            <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
              <button
                onClick={closeStoryViewer}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {currentStoryIndex > 0 && (
                <button
                  onClick={() => setCurrentStoryIndex(currentStoryIndex - 1)}
                  className="absolute left-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}

              {currentStoryIndex < stories[currentStoryUser].stories.length - 1 && (
                <button
                  onClick={() => setCurrentStoryIndex(currentStoryIndex + 1)}
                  className="absolute right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}

              <div className="relative w-full max-w-lg h-full max-h-[90vh] flex items-center justify-center">
                {stories[currentStoryUser].stories[currentStoryIndex].imageUrl ? (
                  <img
                    src={stories[currentStoryUser].stories[currentStoryIndex].imageUrl}
                    alt="Story"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="bg-gradient-to-br from-sky-600 to-cyan-600 w-full h-full flex items-center justify-center p-8">
                    <p className="text-white text-2xl font-bold text-center">
                      {stories[currentStoryUser].stories[currentStoryIndex].text}
                    </p>
                  </div>
                )}

                {/* Story User Info */}
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white">
                    {stories[currentStoryUser].userInfo?.profilePic ? (
                      <img
                        src={stories[currentStoryUser].userInfo.profilePic}
                        alt={stories[currentStoryUser].userInfo.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold">
                      {stories[currentStoryUser].userInfo?.displayName || 'User'}
                    </p>
                    <p className="text-white/70 text-xs">
                      {stories[currentStoryUser].stories[currentStoryIndex].timestamp?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Comment Modal */}
        {
          showCommentModal && currentCommentPost && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 rounded-3xl border border-sky-300/20 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-8 py-6 flex items-center justify-between rounded-t-3xl">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">Comments</h2>
                  <button
                    onClick={closeCommentModal}
                    className="p-2 hover:bg-slate-800 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-300" />
                  </button>
                </div>

                {/* Comments List */}
                <div className="p-8 space-y-6 max-h-[400px] overflow-y-auto">
                  {currentCommentPost.comments && currentCommentPost.comments.length > 0 ? (
                    currentCommentPost.comments.map((comment, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-300/40 flex-shrink-0">
                          {comment.userProfilePic ? (
                            <img
                              src={comment.userProfilePic}
                              alt={comment.userName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="bg-gray-50 rounded-2xl px-4 py-3">
                            <p className="font-semibold text-gray-900 text-sm">{comment.userName}</p>
                            <p className="text-gray-800 text-sm mt-1">{comment.text}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 ml-4">
                            {new Date(comment.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                    </div>
                  )}
                </div>

                {/* Add Comment Section */}
                <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-8 py-6 rounded-b-3xl">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-300/40 flex-shrink-0">
                      {userProfile?.profilePic ? (
                        <img
                          src={userProfile.profilePic}
                          alt="Your profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow flex gap-3">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                        placeholder="Write a comment..."
                        className="flex-grow px-4 py-3 border-2 border-slate-700 bg-slate-800 text-slate-100 rounded-2xl focus:outline-none focus:border-sky-400 text-sm"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={submittingComment || !commentText.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submittingComment ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Post Detail Modal (for Explore grid clicks) - Redesigned */}
        {
          selectedPostModal && viewerPosts.length > 0 && (
            <div
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
              onWheel={(e) => {
                e.preventDefault();
                if (e.deltaY > 0 && currentPostIndex < viewerPosts.length - 1) {
                  setCurrentPostIndex(prev => prev + 1);
                } else if (e.deltaY < 0 && currentPostIndex > 0) {
                  setCurrentPostIndex(prev => prev - 1);
                }
              }}
            >
              {/* Close Button */}
              <button
                onClick={closePostModal}
                className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Main Container - Image on Left, Details on Right */}
              <div className="w-full h-full sm:h-[90vh] bg-white sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
                {/* Left Side - Image */}
                <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0">
                  {viewerPosts[currentPostIndex]?.imageUrl ? (
                    <img
                      src={viewerPosts[currentPostIndex].imageUrl}
                      alt="Post"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-gray-500">No image</p>
                    </div>
                  )}

                  {/* Navigation Arrows */}
                  {currentPostIndex > 0 && (
                    <button
                      onClick={() => setCurrentPostIndex(prev => prev - 1)}
                      className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {currentPostIndex < viewerPosts.length - 1 && (
                    <button
                      onClick={() => setCurrentPostIndex(prev => prev + 1)}
                      className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}

                  {/* Post Counter */}
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                    <p className="text-white text-sm font-semibold">{currentPostIndex + 1} / {viewerPosts.length}</p>
                  </div>
                </div>

                {/* Right Side - Post Details */}
                <div className="w-full md:w-[400px] flex flex-col bg-white max-h-[60vh] md:max-h-full">
                  {/* Header with User Info */}
                  <div className="p-4 border-b border-gray-200">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -m-2 transition-all"
                      onClick={() => {
                        closePostModal();
                        navigate(`/user-profile/${viewerPosts[currentPostIndex].userId}`);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                        {viewerPosts[currentPostIndex].userProfilePic ? (
                          <img src={viewerPosts[currentPostIndex].userProfilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{viewerPosts[currentPostIndex].userName}</p>
                        <p className="text-xs text-gray-500">
                          {viewerPosts[currentPostIndex]?.timestamp?.toDate().toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Caption */}
                  {viewerPosts[currentPostIndex]?.content && (
                    <div className="p-4 border-b border-gray-200">
                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                        {viewerPosts[currentPostIndex].content}
                      </p>
                    </div>
                  )}

                  {/* Comments Section - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {viewerPosts[currentPostIndex]?.comments && viewerPosts[currentPostIndex].comments.length > 0 ? (
                      viewerPosts[currentPostIndex].comments.map((comment, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-sky-400 to-cyan-400">
                            {comment.userProfilePic ? (
                              <img src={comment.userProfilePic} alt={comment.userName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-white m-auto mt-2" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-2xl px-3 py-2">
                              <p className="font-semibold text-sm text-gray-900">{comment.userName}</p>
                              <p className="text-sm text-gray-800">{comment.text}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-3">
                              {new Date(comment.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No comments yet</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-around mb-3">
                      <button
                        onClick={() => {
                          loadLikesList(viewerPosts[currentPostIndex]);
                          setShowLikesModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-200 rounded-xl transition-all group"
                      >
                        <Heart className={`w-5 h-5 ${viewerPosts[currentPostIndex]?.likes?.includes(auth.currentUser?.uid)
                          ? 'fill-cyan-500 text-cyan-500'
                          : 'text-gray-600 group-hover:text-cyan-500'
                          }`} />
                        <span className="text-sm font-semibold text-gray-700">
                          {viewerPosts[currentPostIndex]?.likes?.length || 0}
                        </span>
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-200 rounded-xl transition-all">
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          {viewerPosts[currentPostIndex]?.comments?.length || 0}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          const postLink = `${window.location.origin}/post/${viewerPosts[currentPostIndex].id}`;
                          navigator.clipboard.writeText(postLink).then(() => {
                            alert('Post link copied to clipboard!');
                          }).catch(() => {
                            alert('Failed to copy link');
                          });
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-200 rounded-xl transition-all"
                      >
                        <Share2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                    <p className="text-xs text-center text-gray-500">Scroll to view more posts</p>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Likes Modal */}
        {
          showLikesModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
                {/* Modal Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-100">Likes</h2>
                  <button
                    onClick={() => setShowLikesModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-300" />
                  </button>
                </div>

                {/* Likes List */}
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                  {likesList.length > 0 ? (
                    <div className="space-y-3">
                      {likesList.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => {
                            setShowLikesModal(false);
                            closePostModal();
                            navigate(`/user-profile/${user.id}`);
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-2xl cursor-pointer transition-all"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center">
                            {user.profilePic ? (
                              <img src={user.profilePic} alt={user.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-100">{user.displayName}</p>
                            {user.bio && (
                              <p className="text-sm text-slate-400 line-clamp-1">{user.bio}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Heart className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400">No likes yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        }

        {/* Bottom Navigation - Mobile Only */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-700 z-50 sm:hidden shadow-lg shadow-black/50">
          <div className="flex justify-around py-3 px-2">
            <button
              onClick={() => navigate('/home')}
              className="flex flex-col items-center gap-1 p-2 text-sky-300"
            >
              <div className="relative">
                <Home className="w-6 h-6" />
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 rounded-full"></div>
              </div>
              <span className="text-xs font-semibold">Home</span>
            </button>
            <button
              onClick={() => navigate('/users')}
              className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-sky-300 transition-colors"
            >
              <Users className="w-6 h-6" />
              <span className="text-xs font-medium">People</span>
            </button>
            <button
              onClick={() => navigate('/courses')}
              className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-sky-300 transition-colors"
            >
              <BookOpen className="w-6 h-6" />
              <span className="text-xs font-medium">Courses</span>
            </button>
            <button
              onClick={() => navigate('/original-home')}
              className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-sky-300 transition-colors"
            >
              <Mic className="w-6 h-6" />
              <span className="text-xs font-medium">Play</span>
            </button>
          </div>
        </div>
      </div >
    </>
  );
};

export default SocialHomePage;
