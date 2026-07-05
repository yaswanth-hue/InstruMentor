import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  db,
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
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { renderContentWithMentions, buildMentionResolver } from '../utils/mentions.jsx';
import {
  Mail,
  PlusCircle,
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
  Send,
  X
} from 'lucide-react';
import StoriesBar from '../components/social/StoriesBar';

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

// Firestore documents are capped at 1MB. Base64 inflates file size by ~33%,
// and the post document also carries some text fields, so we cap raw video
// uploads well under that ceiling to make sure they reliably fit.
const MAX_VIBE_VIDEO_BYTES = 650 * 1024; // 650KB

const SocialHomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [hashtagFilter, setHashtagFilter] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentCommentPost, setCurrentCommentPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedPostModal, setSelectedPostModal] = useState(null);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [postMediaType, setPostMediaType] = useState('post'); // post, reel, video
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState([]);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [viewerCommentText, setViewerCommentText] = useState('');
  const [submittingViewerComment, setSubmittingViewerComment] = useState(false);

  // @mention autocomplete + rendering
  const postTextareaRef = useRef(null);
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionCandidatesLoaded, setMentionCandidatesLoaded] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null = no active mention
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [taggedProfilesById, setTaggedProfilesById] = useState({});

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
        getUserProfile(auth.currentUser.uid).then(profile => {
          if (profile) {
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

  // Open the Create Post modal if we were navigated here with that intent
  // (e.g. the "Create Post" button on the profile page)
  useEffect(() => {
    if (location.state?.openCreatePost) {
      setShowCreatePost(true);
      // Clear the flag so it doesn't reopen on back/forward navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Apply a hashtag filter if we were navigated here from the Discover
  // Hashtags page (which passes the chosen tag via router state)
  useEffect(() => {
    if (location.state?.hashtagFilter) {
      handleSelectHashtag(location.state.hashtagFilter);
      // Clear the flag so it doesn't reapply on back/forward navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Preload the mention-suggestion pool as soon as the compose modal opens,
  // and close any open suggestion dropdown when it's closed.
  useEffect(() => {
    if (showCreatePost) {
      loadMentionCandidates();
    } else {
      setMentionQuery(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreatePost]);

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
      let globalPosts = [];
      if (activeTab === 'following') {
        if (profile?.following?.length > 0) {
          posts = await getFeedPosts(profile.following);
        } else {
          posts = [];
        }
        // Trending should reflect the whole platform, not just people you
        // follow, so fetch the global pool separately in this branch.
        globalPosts = await getPosts();
      } else if (activeTab === 'explore') {
        const allPosts = await getPosts(); // Fetch all posts...
        posts = allPosts.filter(post => post.userId !== userId); // ...but exclude your own
        globalPosts = allPosts;
      }

      // Check if aborted
      if (signal?.aborted) return;

      setFeed(posts);

      // Fetch (and cache) minimal profile info for anyone tagged in this
      // batch of posts, so @mentions can be rendered as real, clickable
      // links instead of just styled text.
      const taggedIds = [...new Set(posts.flatMap((p) => p.taggedUsers || []))];
      const missingIds = taggedIds.filter((id) => !taggedProfilesById[id]);
      if (missingIds.length > 0) {
        Promise.all(
          missingIds.map(async (id) => {
            try {
              const profile = await getUserProfile(id);
              return profile ? [id, { id, username: profile.username, displayName: profile.displayName }] : null;
            } catch (e) {
              return null;
            }
          })
        ).then((entries) => {
          if (signal?.aborted) return;
          const valid = entries.filter(Boolean);
          if (valid.length > 0) {
            setTaggedProfilesById((prev) => ({ ...prev, ...Object.fromEntries(valid) }));
          }
        });
      }

      // Track liked posts for current user
      const currentUserId = auth.currentUser?.uid;
      const liked = {};
      posts.forEach(post => {
        if (post.likes && post.likes.includes(currentUserId)) {
          liked[post.id] = true;
        }
      });
      setLikedPosts(liked);

      // Calculate trending hashtags — always from the global pool so
      // trending reflects the whole platform, not just the active tab's feed
      const hashtags = {};
      globalPosts.forEach(post => {
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

    if (isImage && postMediaType === 'reel') {
      alert('Images cannot be uploaded as Vibes. Please select "Post" type.');
      return;
    }

    if (isVideo && postMediaType === 'post') {
      alert('Videos cannot be uploaded as regular Posts. Please select "Vibe" type.');
      return;
    }

    if (postMediaType === 'reel' && videoDuration > 120) {
      alert('Vibes must be 2 minutes or less. Please trim your video and try again.');
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

  // Loads a pool of users to suggest from once (when the compose modal is
  // first opened), reused for the rest of the session.
  const loadMentionCandidates = async () => {
    if (mentionCandidatesLoaded) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), limit(200)));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== auth.currentUser?.uid);
      setMentionCandidates(list);
    } catch (e) {
      console.error('Failed to load mention candidates:', e);
    } finally {
      setMentionCandidatesLoaded(true);
    }
  };

  // Figures out whether the caret currently sits inside an "@token" being
  // typed, and if so, what the token is so far (possibly empty).
  const handlePostContentChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setPostContent(value);

    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setActiveMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter((u) => {
        const username = (u.username || '').toLowerCase();
        const displayName = (u.displayName || '').toLowerCase();
        const compact = displayName.replace(/\s+/g, '');
        return username.startsWith(q) || displayName.startsWith(q) || compact.startsWith(q);
      })
      .slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  // Replaces the in-progress "@token" with the chosen user's exact handle
  // (matching what resolveTaggedUsersByMentions looks for), then restores
  // focus and caret position right after the inserted mention.
  const handleSelectMention = (user) => {
    const handle = user.username || (user.displayName || '').replace(/\s+/g, '');
    const textarea = postTextareaRef.current;
    const cursor = textarea ? textarea.selectionStart : postContent.length;
    const textBeforeCursor = postContent.slice(0, cursor);
    const textAfterCursor = postContent.slice(cursor);

    const newTextBefore = textBeforeCursor.replace(
      /(?:^|\s)@([a-zA-Z0-9_.]*)$/,
      (whole) => `${whole.startsWith('@') ? '' : whole[0]}@${handle} `
    );
    const newValue = newTextBefore + textAfterCursor;

    setPostContent(newValue);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const pos = newTextBefore.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handlePostTextareaKeyDown = (e) => {
    if (mentionQuery === null || mentionSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMentionIndex((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSelectMention(mentionSuggestions[activeMentionIndex]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  const mentionResolver = useMemo(
    () => buildMentionResolver(Object.values(taggedProfilesById)),
    [taggedProfilesById]
  );

  // Posts already carry their hashtags as plain text in `content` — reuse
  // the same extraction regex the trending count uses, so "clicking a
  // trending tag" and "counting trending tags" agree on what counts as a
  // match (e.g. "#guitar" won't also match "#guitarist").
  const getPostHashtags = (content) =>
    (content?.match(/#[\w]+/g) || []).map((t) => t.toLowerCase());

  const filteredFeed = useMemo(() => {
    if (!hashtagFilter) return feed;
    const tag = hashtagFilter.toLowerCase();
    return feed.filter((post) => getPostHashtags(post.content).includes(tag));
  }, [feed, hashtagFilter]);

  const handleSelectHashtag = (tag) => {
    setHashtagFilter(tag);
    // Explore already pulls from the whole post pool, so it's the best
    // place to actually find everything tagged with it.
    setActiveTab('explore');
  };

  const clearHashtagFilter = () => setHashtagFilter(null);

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
        setViewerPosts(prevPosts => prevPosts.map(post =>
          post.id === postId
            ? { ...post, likes: (post.likes || []).filter(id => id !== userId) }
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
        setViewerPosts(prevPosts => prevPosts.map(post =>
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

  // Adds a comment directly from the Explore post viewer, without going
  // through the separate feed Comment Modal (which tracks its own post via
  // currentCommentPost). Keeps both viewerPosts and feed in sync.
  const handleAddViewerComment = async (post) => {
    if (!viewerCommentText.trim() || !post) return;

    try {
      setSubmittingViewerComment(true);
      const newComment = {
        userId: auth.currentUser.uid,
        userName: userProfile.displayName,
        userProfilePic: userProfile.profilePic,
        text: viewerCommentText,
        timestamp: new Date().toISOString()
      };
      await addComment(post.id, {
        userId: newComment.userId,
        userName: newComment.userName,
        userProfilePic: newComment.userProfilePic,
        text: newComment.text
      });

      const appendComment = (p) =>
        p.id === post.id ? { ...p, comments: [...(p.comments || []), newComment] } : p;

      setViewerPosts(prev => prev.map(appendComment));
      setFeed(prevFeed => prevFeed.map(appendComment));
      setViewerCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingViewerComment(false);
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
    setViewerCommentText('');
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
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 pt-2 pb-3 px-1 text-sm">
              <button
                onClick={() => { setActiveTab('following'); setHashtagFilter(null); }}
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
                onClick={() => { setActiveTab('explore'); setHashtagFilter(null); }}
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

        {/* Mobile-only floating trigger */}
        <div className="lg:hidden">
          {activeTab !== 'explore' && (
            <button
              onClick={() => navigate('/hashtags')}
              className="fixed right-2 sm:right-3 top-[calc(50%+36px)] -translate-y-1/2 bg-zinc-950/80 backdrop-blur-2xl text-white p-3 rounded-2xl border border-white/10 shadow-xl shadow-black/40 hover:bg-white/5 transition-colors z-30"
            >
              <ChevronLeft className="w-6 h-6 text-sky-300" />
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="w-full px-3 sm:px-4 lg:px-6 py-6 sm:py-8" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Center Column */}
            <section className="lg:col-span-9">
              {activeTab !== 'explore' && (
                <div className="mb-6 rounded-3xl overflow-hidden border border-slate-700 bg-zinc-900/55 backdrop-blur-2xl shadow-xl shadow-black/30">
                  <StoriesBar
                    stories={stories}
                    onOpenStory={openStoryViewer}
                    onCreateStory={() => setShowCreateStory(true)}
                  />
                </div>
              )}

              {hashtagFilter && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3">
                  <p className="text-sm text-sky-200">
                    Showing posts tagged <span className="font-semibold">{hashtagFilter}</span>
                  </p>
                  <button
                    type="button"
                    onClick={clearHashtagFilter}
                    className="flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              )}

              {loading ? (
                activeTab === 'explore' ? (
                  <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1.5 sm:gap-2 [column-fill:_balance]">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl mb-1.5 sm:mb-2 break-inside-avoid bg-white/10 animate-pulse"
                        style={{ height: `${140 + ((i * 47) % 160)}px` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="bg-zinc-900/70 backdrop-blur-2xl rounded-3xl border border-slate-700 shadow-2xl shadow-black/40 overflow-hidden"
                      >
                        <div className="px-5 pt-5 pb-3 flex items-center gap-4">
                          <div className="h-11 w-11 rounded-2xl bg-white/10 animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <div className="h-3.5 w-40 max-w-[60%] rounded bg-white/10 animate-pulse" />
                            <div className="mt-2 h-3 w-24 rounded bg-white/10 animate-pulse" />
                          </div>
                        </div>
                        <div className="px-5 pb-3 space-y-2">
                          <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
                          <div className="h-3 w-9/12 rounded bg-white/10 animate-pulse" />
                        </div>
                        <div className="w-full aspect-video bg-white/10 animate-pulse" />
                        <div className="px-5 py-4 flex items-center gap-6 border-t border-white/10">
                          {[0, 1, 2].map((j) => (
                            <div key={j} className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-white/10 animate-pulse" />
                              <div className="h-3 w-5 rounded bg-white/10 animate-pulse" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : filteredFeed.length === 0 ? (
                <div className="bg-zinc-900/75 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/50 border border-slate-700 p-8 sm:p-10 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-sky-400/30 shadow-lg shadow-black/40">
                    <Music className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-zinc-50 mb-2">
                    {hashtagFilter ? 'No Posts Found' : activeTab === 'following' ? 'No Posts Yet' : 'No Posts Found'}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
                    {hashtagFilter
                      ? `No posts tagged ${hashtagFilter} yet.`
                      : activeTab === 'following'
                        ? 'Follow other musicians to see their posts here!'
                        : 'Be the first to share something amazing!'}
                  </p>
                </div>
              ) : activeTab === 'explore' ? (
                <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1.5 sm:gap-2 [column-fill:_balance]">
                  {filteredFeed.filter(post => post.imageUrl).map((post, index) => (
                    <div
                      key={post.id}
                      className="relative group cursor-pointer overflow-hidden bg-zinc-900 rounded-xl mb-1.5 sm:mb-2 break-inside-avoid"
                      onClick={() => openPostModal(post, index, filteredFeed.filter(p => p.imageUrl))}
                    >
                      <img
                        src={post.imageUrl}
                        alt="Post"
                        loading="lazy"
                        className="w-full h-auto object-cover group-hover:brightness-75 transition-all duration-300"
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
                  {filteredFeed.map((post) => (
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
                    <p className="text-zinc-100 text-base leading-relaxed whitespace-pre-wrap">
                      {renderContentWithMentions(post.content, mentionResolver, (userId) => navigate(`/user-profile/${userId}`))}
                    </p>
                  </div>

                  {/* Post Media */}
                  {post.imageUrl && (
                    <div className="relative w-full aspect-video bg-zinc-900">
                      {post.mediaType === 'reel' || post.mediaType === 'video' ? (
                        <video
                          src={post.imageUrl}
                          controls
                          playsInline
                          loop
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={post.imageUrl}
                          alt="Post content"
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      )}
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
                      onClick={() => navigate('/hashtags')}
                      className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                    >
                      View all
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(trendingHashtags || []).slice(0, 6).map((item) => (
                      <div
                        key={item.tag}
                        onClick={() => handleSelectHashtag(item.tag)}
                        className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 hover:bg-slate-800 transition-colors cursor-pointer"
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

          {/* Bottom padding so the floating nav never covers content */}
          <div className="pb-24"></div>
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

                  <div className="relative">
                    <textarea
                      ref={postTextareaRef}
                      value={postContent}
                      onChange={handlePostContentChange}
                      onKeyDown={handlePostTextareaKeyDown}
                      onBlur={() => {
                        // Let a suggestion's onMouseDown fire before we close the dropdown.
                        setTimeout(() => setMentionQuery(null), 120);
                      }}
                      placeholder="Share your musical journey... Use @name to tag musicians"
                      className="w-full px-5 py-4 border-2 border-slate-700 bg-slate-800 rounded-2xl focus:outline-none focus:border-sky-400 resize-none text-base text-slate-100 placeholder-slate-500 min-h-[180px] transition-all"
                      rows={6}
                    />
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden">
                        {mentionSuggestions.map((user, index) => (
                          <button
                            key={user.id}
                            type="button"
                            onMouseDown={(e) => {
                              // Prevent the textarea's onBlur from firing first and closing the dropdown.
                              e.preventDefault();
                              handleSelectMention(user);
                            }}
                            onMouseEnter={() => setActiveMentionIndex(index)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              index === activeMentionIndex ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                            }`}
                          >
                            {user.profilePic ? (
                              <img
                                src={user.profilePic}
                                alt={user.displayName}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-100 truncate">
                                {user.displayName || 'Music Enthusiast'}
                              </p>
                              {user.username && (
                                <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content Type Selection — choose this first so the picker below only offers the right kind of file */}
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-slate-300 mb-3">Content Type:</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setPostMediaType('post');
                          if (postImage && postImage.type.startsWith('video/')) {
                            setPostImage(null);
                            setVideoDuration(0);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${postMediaType === 'post'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                      >
                        📸 Post
                      </button>
                      <button
                        onClick={() => {
                          setPostMediaType('reel');
                          if (postImage && !postImage.type.startsWith('video/')) {
                            setPostImage(null);
                            setVideoDuration(0);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${postMediaType === 'reel'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                      >
                        ✨ Vibe
                      </button>
                    </div>
                    {videoDuration > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        Video duration: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <label className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-2xl cursor-pointer transition-all border border-slate-700 hover:shadow-md">
                      <Image className="w-5 h-5" />
                      <span className="font-semibold">{postMediaType === 'reel' ? 'Add Video' : 'Add Photo'}</span>
                      <input
                        type="file"
                        accept={postMediaType === 'reel' ? 'video/*' : 'image/*'}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          const isVideo = file.type.startsWith('video/');
                          const isImage = file.type.startsWith('image/');

                          // Defense in depth: some mobile browsers/pickers ignore the
                          // `accept` attribute, so re-validate the file type here too.
                          if (postMediaType === 'reel' && !isVideo) {
                            alert('Vibes only accept videos. Switch to "Post" to share a photo.');
                            e.target.value = '';
                            return;
                          }
                          if (postMediaType === 'post' && !isImage) {
                            alert('Posts only accept photos. Switch to "Vibe" to share a video.');
                            e.target.value = '';
                            return;
                          }

                          if (isVideo) {
                            if (file.size > MAX_VIBE_VIDEO_BYTES) {
                              alert(`That video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Vibes need to be under ${(MAX_VIBE_VIDEO_BYTES / 1024).toFixed(0)}KB — try a shorter clip or a lower-resolution export.`);
                              e.target.value = '';
                              return;
                            }
                            // Get video duration
                            const video = document.createElement('video');
                            video.preload = 'metadata';
                            video.onloadedmetadata = () => {
                              const duration = Math.floor(video.duration);
                              if (duration > 120) {
                                // Vibes are capped at 2 minutes
                                alert('Vibes must be 2 minutes or less. Please choose a shorter video.');
                                e.target.value = '';
                                return;
                              }
                              setPostImage(file);
                              setVideoDuration(duration);
                            };
                            video.src = URL.createObjectURL(file);
                          } else {
                            setPostImage(file);
                            setVideoDuration(0);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {postMediaType === 'reel'
                      ? `Vibes (videos) must be under ${(MAX_VIBE_VIDEO_BYTES / 1024).toFixed(0)}KB and 2 minutes — keep clips short and low-resolution.`
                      : 'Posts accept photos only. Switch to "Vibe" above to share a short video instead.'}
                  </p>

                  {postImage && (
                    <div className="mt-6 relative">
                      {postImage.type.startsWith('video/') ? (
                        <video
                          src={URL.createObjectURL(postImage)}
                          controls
                          className="w-full rounded-2xl object-contain max-h-96 shadow-lg bg-black"
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(postImage)}
                          alt="Preview"
                          className="w-full rounded-2xl object-cover max-h-96 shadow-lg"
                        />
                      )}
                      <button
                        onClick={() => { setPostImage(null); setVideoDuration(0); }}
                        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
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
                          <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                            <p className="font-semibold text-zinc-100 text-sm">{comment.userName}</p>
                            <p className="text-zinc-300 text-sm mt-1">{comment.text}</p>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 ml-4">
                            {new Date(comment.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <MessageCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500">No comments yet. Be the first to comment!</p>
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

        {/* Post Detail Modal (for Explore grid clicks) */}
        {
          selectedPostModal && viewerPosts.length > 0 && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
              {/* Main Container - Image on Left, Details on Right */}
              <div className="relative w-full h-full sm:h-[90vh] bg-zinc-900 sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row">
                {/* Close Button */}
                <button
                  onClick={closePostModal}
                  className="absolute top-4 right-4 z-20 p-3 bg-zinc-950/80 hover:bg-zinc-800 border border-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-200" />
                </button>

                {/* Left Side - Image */}
                <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0">
                  {viewerPosts[currentPostIndex]?.imageUrl ? (
                    viewerPosts[currentPostIndex].mediaType === 'reel' || viewerPosts[currentPostIndex].mediaType === 'video' ? (
                      <video
                        src={viewerPosts[currentPostIndex].imageUrl}
                        controls
                        playsInline
                        loop
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <img
                        src={viewerPosts[currentPostIndex].imageUrl}
                        alt="Post"
                        className="max-w-full max-h-full object-contain"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-zinc-500">No image</p>
                    </div>
                  )}

                  {/* Navigation Arrows */}
                  {currentPostIndex > 0 && (
                    <button
                      onClick={() => { setCurrentPostIndex(prev => prev - 1); setViewerCommentText(''); }}
                      className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {currentPostIndex < viewerPosts.length - 1 && (
                    <button
                      onClick={() => { setCurrentPostIndex(prev => prev + 1); setViewerCommentText(''); }}
                      className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
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
                <div className="w-full md:w-[400px] flex flex-col bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10 max-h-[60vh] md:max-h-full">
                  {/* Header with User Info */}
                  <div className="p-4 border-b border-white/10">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-2xl p-2 -m-2 transition-colors"
                      onClick={() => {
                        closePostModal();
                        navigate(`/user-profile/${viewerPosts[currentPostIndex].userId}`);
                      }}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center overflow-hidden border border-white/10">
                        {viewerPosts[currentPostIndex].userProfilePic ? (
                          <img src={viewerPosts[currentPostIndex].userProfilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-50">{viewerPosts[currentPostIndex].userName}</p>
                        <p className="text-xs text-zinc-500">
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
                    <div className="p-4 border-b border-white/10">
                      <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {renderContentWithMentions(viewerPosts[currentPostIndex].content, mentionResolver, (userId) => { closePostModal(); navigate(`/user-profile/${userId}`); })}
                      </p>
                    </div>
                  )}

                  {/* Comments Section - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {viewerPosts[currentPostIndex]?.comments && viewerPosts[currentPostIndex].comments.length > 0 ? (
                      viewerPosts[currentPostIndex].comments.map((comment, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-8 h-8 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-sky-400 to-cyan-400 border border-white/10">
                            {comment.userProfilePic ? (
                              <img src={comment.userProfilePic} alt={comment.userName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-white m-auto mt-2" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="rounded-2xl bg-white/5 border border-white/5 px-3 py-2">
                              <p className="font-semibold text-sm text-zinc-100">{comment.userName}</p>
                              <p className="text-sm text-zinc-300">{comment.text}</p>
                            </div>
                            <p className="text-xs text-zinc-500 mt-1 ml-3">
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
                        <MessageCircle className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-500 text-sm">No comments yet</p>
                      </div>
                    )}
                  </div>

                  {/* Add a comment, right here */}
                  <div className="px-4 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={viewerCommentText}
                        onChange={(e) => setViewerCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !submittingViewerComment) {
                            handleAddViewerComment(viewerPosts[currentPostIndex]);
                          }
                        }}
                        placeholder="Write a comment..."
                        className="flex-1 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400 transition-colors"
                      />
                      <button
                        onClick={() => handleAddViewerComment(viewerPosts[currentPostIndex])}
                        disabled={submittingViewerComment || !viewerCommentText.trim()}
                        className="p-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submittingViewerComment ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4">
                    <div className="flex items-center justify-around">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors">
                        <button
                          onClick={() => handleLikePost(viewerPosts[currentPostIndex].id)}
                          className="group"
                        >
                          <Heart className={`w-5 h-5 transition-colors ${viewerPosts[currentPostIndex]?.likes?.includes(auth.currentUser?.uid)
                            ? 'fill-cyan-400 text-cyan-300'
                            : 'text-zinc-300 group-hover:text-cyan-300'
                            }`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadLikesList(viewerPosts[currentPostIndex]);
                            setShowLikesModal(true);
                          }}
                          className="text-sm font-semibold text-zinc-300 hover:text-white hover:underline"
                        >
                          {viewerPosts[currentPostIndex]?.likes?.length || 0}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2">
                        <MessageCircle className="w-5 h-5 text-zinc-300" />
                        <span className="text-sm font-semibold text-zinc-300">
                          {viewerPosts[currentPostIndex]?.comments?.length || 0}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const postLink = `${window.location.origin}/post/${viewerPosts[currentPostIndex].id}`;
                          navigator.clipboard.writeText(postLink).then(() => {
                            alert('Post link copied to clipboard!');
                          }).catch(() => {
                            alert('Failed to copy link');
                          });
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <Share2 className="w-5 h-5 text-zinc-300" />
                      </button>
                    </div>
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
      </div >
    </>
  );
};

export default SocialHomePage;