import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { Helmet } from 'react-helmet-async';
import { gsap } from 'gsap';
import {
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getPosts,
  getCourses,
  getEnrolledCourses,
  createUserProfile,
  deletePost,
} from '../firebase';
import {
  Camera,
  User,
  UserPlus,
  UserMinus,
  ArrowLeft,
  Trash2,
  Heart,
  MessageCircle,
  Share2,
  BookOpen,
  Users,
  Home,
  LogOut,
  Grid3x3,
  Image as ImageIcon,
  X,
  Film,
  Video,
  Sparkles,
  Settings,
  PlusSquare
} from 'lucide-react';
import MagneticCard from '../components/MagneticCard';
import LazyImage from '../components/LazyImage';


const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUserId;
  const profileUserId = userId || currentUserId;

  const defaultProfile = {
    displayName: "",
    email: "",
    bio: "",
    profilePic: null,
    bannerImage: null,
    followers: [],
    following: [],
    isPrivate: false,
  };

  // Profile states
  const [userProfile, setUserProfile] = useState(defaultProfile);
  const [posts, setPosts] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [createdCourses, setCreatedCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const isFollowing = userProfile?.followers?.includes(currentUserId) || false;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("media"); // media, courses
  const [courseSubTab, setCourseSubTab] = useState("created"); // created or enrolled
  const [mediaTab, setMediaTab] = useState("posts"); // posts, reels, tagged

  // Profile editing states
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Followers/Following modal states
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);

  // Image viewer modal states
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Image cropper states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropType, setCropType] = useState(null); // 'profile' or 'banner'
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  // Bio editing state
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');

  // Display name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameText, setDisplayNameText] = useState('');

  // Post viewer state
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState([]);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const postViewerRef = useRef(null);
  const profileContentRef = useRef(null);
  const avatarParallaxRef = useRef(null);

  useEffect(() => {
    const abortController = new AbortController();

    loadProfileData(abortController.signal);

    // Cleanup function - abort requests when component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [profileUserId, currentUserId]);

  useEffect(() => {
    // Entrance animation for right panel
    if (typeof window === 'undefined') return;
    gsap.fromTo(
      '.profile-content',
      { x: 120, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }
    );
  }, [profileUserId]);

  useEffect(() => {
    // Parallax on fixed avatar, driven by right pane scroll
    const el = profileContentRef.current;
    const avatar = avatarParallaxRef.current;
    if (!el || !avatar) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = el.scrollTop || 0;
        gsap.to(avatar, { y: Math.min(42, y * 0.12), duration: 0.25, ease: 'power1.out' });
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const loadProfileData = async (signal) => {
    if (!profileUserId) return;

    setLoading(true);
    try {
      // Load user profile
      let profile = await getUserProfile(profileUserId);

      // Check if aborted
      if (signal?.aborted) return;

      if (!profile && isOwnProfile) {
        // Create profile if it doesn't exist for current user
        await createUserProfile(profileUserId, {
          displayName: auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          profilePic: null, // Don't use Firebase Auth photoURL, user must set it manually
          email: auth.currentUser?.email || ''
        });

        // Check if aborted
        if (signal?.aborted) return;

        profile = await getUserProfile(profileUserId);
      }

      // Check if aborted before updating state
      if (signal?.aborted) return;

      setUserProfile(profile || defaultProfile);

      // Check if profile is private and user is not following
      const isPrivateAccount = profile?.isPrivate === true;
      const canViewContent = isOwnProfile || !isPrivateAccount || (profile?.followers?.includes(currentUserId) ?? false);

      // Only load posts and courses if user can view content
      if (canViewContent) {
        const [userPosts, allPosts, created, enrolled] = await Promise.all([
          getPosts(profileUserId),
          getPosts(),
          getCourses(profileUserId),
          getEnrolledCourses(profileUserId),
        ]);

        if (signal?.aborted) return;

        setPosts((userPosts || []).filter(post => post.imageUrl || post.mediaUrl));
        setTaggedPosts(
          (allPosts || []).filter((post) => {
            const tags = post.taggedUsers || [];
            return Array.isArray(tags) && tags.includes(profileUserId) && post.userId !== profileUserId;
          })
        );
        setCreatedCourses(created || []);
        setEnrolledCourses(enrolled || []);
      } else {
        // Private account - clear content
        if (!signal?.aborted) {
          setPosts([]);
          setTaggedPosts([]);
          setCreatedCourses([]);
          setEnrolledCourses([]);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading profile:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleFollow = async () => {
    try {
      await followUser(currentUserId, profileUserId);
      // Update follower count in UI
      setUserProfile(prev => ({
        ...(prev || defaultProfile),
        followers: Array.from(new Set([...(prev?.followers || []), currentUserId]))
      }));
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async () => {
    try {
      await unfollowUser(currentUserId, profileUserId);
      // Update follower count in UI
      setUserProfile(prev => ({
        ...(prev || defaultProfile),
        followers: (prev?.followers || []).filter(id => id !== currentUserId)
      }));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleProfilePicClick = () => {
    // Open modal to view profile picture
    setShowProfilePicModal(true);
  };

  const handleChangeProfilePic = () => {
    // Trigger file input when user clicks "Change" button in modal
    setShowProfilePicModal(false);
    fileInputRef.current.click();
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const success = await deletePost(postId, currentUserId);
      if (success) {
        setPosts(posts.filter(p => p.id !== postId));
      } else {
        alert('Failed to delete post. You can only delete your own posts.');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select an image file (JPEG, PNG, or GIF)");
      return;
    }

    // Read file and open crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCropType('profile');
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleCroppedProfilePic = async () => {
    if (!croppedAreaPixels || !imageToCrop) return;

    setIsCropping(true);
    setShowCropModal(false);

    try {
      setUploading(true);

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = reader.result;

          await setDoc(doc(db, "users", profileUserId), {
            profilePic: base64Image,
          }, { merge: true });

          setUserProfile(prev => ({
            ...prev,
            profilePic: base64Image
          }));

          alert("Profile picture updated successfully!");
        } catch (error) {
          console.error("Error uploading profile picture:", error);
          alert(`Failed to upload image: ${error.message}`);
        } finally {
          setUploading(false);
          setIsCropping(false);
          setImageToCrop(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.readAsDataURL(croppedBlob);
    } catch (error) {
      console.error("Error cropping image:", error);
      alert(`Failed to crop image: ${error.message}`);
      setIsCropping(false);
      setUploading(false);
    }
  };

  const handleBannerClick = () => {
    // Open modal to view banner
    setShowBannerModal(true);
  };

  const handleChangeBanner = () => {
    // Trigger file input when user clicks "Change" button in modal
    setShowBannerModal(false);
    bannerInputRef.current.click();
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select an image file (JPEG, PNG, or GIF)");
      return;
    }

    // Read file and open crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCropType('banner');
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleCroppedBanner = async () => {
    if (!croppedAreaPixels || !imageToCrop) return;

    setIsCropping(true);
    setShowCropModal(false);

    try {
      setUploadingBanner(true);

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = reader.result;

          await setDoc(doc(db, "users", profileUserId), {
            bannerImage: base64Image,
          }, { merge: true });

          setUserProfile(prev => ({
            ...prev,
            bannerImage: base64Image
          }));

          alert("Banner updated successfully!");
        } catch (error) {
          console.error("Error uploading banner:", error);
          alert(`Failed to upload banner: ${error.message}`);
        } finally {
          setUploadingBanner(false);
          setIsCropping(false);
          setImageToCrop(null);
          if (bannerInputRef.current) {
            bannerInputRef.current.value = '';
          }
        }
      };

      reader.readAsDataURL(croppedBlob);
    } catch (error) {
      console.error("Error cropping banner:", error);
      alert(`Failed to crop banner: ${error.message}`);
      setIsCropping(false);
      setUploadingBanner(false);
    }
  };

  const loadFollowersList = async () => {
    if (!userProfile?.followers || userProfile.followers.length === 0) {
      setFollowersList([]);
      return;
    }

    try {
      const followersData = await Promise.all(
        userProfile.followers.map(async (followerId) => {
          const followerProfile = await getUserProfile(followerId);
          return followerProfile ? { id: followerId, ...followerProfile } : null;
        })
      );
      setFollowersList(followersData.filter(Boolean));
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadFollowingList = async () => {
    if (!userProfile?.following || userProfile.following.length === 0) {
      setFollowingList([]);
      return;
    }

    try {
      const followingData = await Promise.all(
        userProfile.following.map(async (followingId) => {
          const followingProfile = await getUserProfile(followingId);
          return followingProfile ? { id: followingId, ...followingProfile } : null;
        })
      );
      setFollowingList(followingData.filter(Boolean));
    } catch (error) {
      console.error('Error loading following:', error);
    }
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

  const reelPosts = useMemo(
    () =>
      posts.filter(
        (post) => post.mediaType === 'reel' || (post.mediaType === 'video' && post.videoDuration && post.videoDuration <= 120)
      ),
    [posts]
  );

  const standardPosts = useMemo(
    () =>
      posts.filter(
        post => post.mediaType !== 'reel' && !(post.mediaType === 'video' && post.videoDuration && post.videoDuration <= 120)
      ),
    [posts]
  );

  if (!userProfile && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Profile not found</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-purple-600 hover:text-purple-700"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{userProfile?.displayName || 'User'} | InstruMentor</title>
        <meta name="description" content={`${userProfile?.displayName || 'User'}'s profile on InstruMentor. ${userProfile?.bio || 'Musician and music lover on InstruMentor - connecting musicians worldwide.'}`} />
        <meta property="og:title" content={`${userProfile?.displayName || 'User'} | InstruMentor`} />
        <meta property="og:description" content={userProfile?.bio || 'Musician and music lover on InstruMentor - connecting musicians worldwide.'} />
        <meta property="og:image" content={userProfile?.profilePic || 'https://via.placeholder.com/400'} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${userProfile?.displayName || 'User'} | InstruMentor`} />
        <meta name="twitter:description" content={userProfile?.bio || 'Musician and music lover on InstruMentor - connecting musicians worldwide.'} />
        <meta name="twitter:image" content={userProfile?.profilePic || 'https://via.placeholder.com/400'} />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white" style={{width: '100%', maxWidth: 'none'}}>
        {/* Refined Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="cursor-pointer inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-semibold">Back</span>
              </button>

              <div className="min-w-0 text-center">
                <p className="text-sm sm:text-base font-semibold text-zinc-100 truncate max-w-[50vw]">
                  {userProfile?.username ? `@${userProfile.username}` : (userProfile?.displayName || 'Profile')}
                </p>
                <p className="text-[11px] text-zinc-500">{posts.length} posts</p>
              </div>

              <div className="flex items-center gap-2">
                {isOwnProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate('/home', { state: { openCreatePost: true } })}
                      className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-sky-300 hover:bg-white/10 transition-colors"
                      aria-label="Create Post"
                    >
                      <PlusSquare className="w-5 h-5" />
                      <span className="hidden sm:inline">Create post</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/profile-settings')}
                      className="cursor-pointer inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                      aria-label="Settings"
                    >
                      <Settings className="w-5 h-5 text-amber-200" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLogoutModal(true)}
                      className="cursor-pointer inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10 transition-colors"
                      aria-label="Logout"
                    >
                      <LogOut className="w-4 h-4 text-zinc-200" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </>
                )}
                {!isOwnProfile && (
                  <div className="w-10" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* New layout: fixed photo pane + natural page scroll */}
        <div className="w-full">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Left: Full-height profile photo pane (desktop) */}
            <aside className="hidden lg:block lg:col-span-5 lg:h-full profile-avatar">
              <div className="h-full rounded-[2.5rem] overflow-hidden border border-white/10 bg-zinc-900/40 shadow-2xl shadow-black/50">
                <button
                  type="button"
                  onClick={handleProfilePicClick}
                  className="relative h-full w-full cursor-pointer"
                  aria-label="Open profile picture"
                >
                  <div className="absolute inset-0" ref={avatarParallaxRef}>
                  {userProfile?.profilePic ? (
                    <img
                      src={userProfile.profilePic}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      style={{ viewTransitionName: 'profile-avatar' }}
                    />
                  ) : (
                    <div
                      className="h-full w-full bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-500 flex items-center justify-center"
                      style={{ viewTransitionName: 'profile-avatar' }}
                    >
                      <User className="w-28 h-28 text-white/90" />
                    </div>
                  )}
                  </div>

                  {/* subtle overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />

                  {/* quick identity + actions pinned on photo */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-2xl font-semibold text-white truncate">
                          {userProfile?.displayName || "Music Enthusiast"}
                        </p>
                        <p className="mt-1 text-sm text-white/70 truncate">{userProfile?.email}</p>
                      </div>

                      {isOwnProfile && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="h-11 w-11 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 transition-colors inline-flex items-center justify-center"
                            aria-label="Change profile picture"
                          >
                            <Camera className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>

              {isOwnProfile && (
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              )}
            </aside>

            {/* Right: Profile content */}
            <section
              className="lg:col-span-7 lg:pr-2 profile-content"
              ref={profileContentRef}
            >
              <div className="rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-2xl shadow-2xl shadow-black/40 p-6">
                {/* When data is still loading, show content skeleton here (no full-screen loader) */}
                {loading && (
                  <div className="space-y-4">
                    <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-5/6 rounded bg-white/10 animate-pulse" />
                    <div className="h-10 w-full rounded-2xl bg-white/10 animate-pulse" />
                  </div>
                )}

            {/* User Name */}
            {isEditingName && isOwnProfile ? (
              <div className="flex items-center justify-center gap-2 mb-3">
                <input
                  type="text"
                  value={displayNameText}
                  onChange={(e) => setDisplayNameText(e.target.value.slice(0, 30))}
                  className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-center text-xl font-semibold text-slate-100 focus:border-sky-400 focus:outline-none"
                  placeholder="Your name"
                  maxLength={30}
                />
                <button
                  onClick={() => {
                    setDisplayNameText(userProfile?.displayName || '');
                    setIsEditingName(false);
                  }}
                  className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (displayNameText.trim()) {
                      await setDoc(doc(db, "users", profileUserId), {
                        displayName: displayNameText.trim()
                      }, { merge: true });
                      setUserProfile(prev => ({ ...prev, displayName: displayNameText.trim() }));
                      setIsEditingName(false);
                    }
                  }}
                  className="rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="relative group mb-3 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                  {userProfile?.displayName || "Music Enthusiast"}
                </h2>
                {isOwnProfile && (
                  <button
                    onClick={() => {
                      setDisplayNameText(userProfile?.displayName || '');
                      setIsEditingName(true);
                    }}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-800"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}

            {/* Bio Section */}
            <div className="w-full mb-6">
              {isEditingBio && isOwnProfile ? (
                <div className="space-y-3">
                  <textarea
                    value={bioText}
                    onChange={(e) => setBioText(e.target.value.slice(0, 150))}
                    placeholder="Write something about yourself..."
                    className="w-full rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none"
                    rows="3"
                    maxLength={150}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{bioText.length}/150</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setBioText(userProfile.bio || '');
                          setIsEditingBio(false);
                        }}
                        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await setDoc(doc(db, "users", profileUserId), {
                            bio: bioText
                          }, { merge: true });
                          setUserProfile(prev => ({ ...prev, bio: bioText }));
                          setIsEditingBio(false);
                        }}
                        className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <p className="text-center text-sm sm:text-base text-slate-300 px-2">
                    {userProfile?.bio || (isOwnProfile ? "Add a bio to tell others about yourself." : "No bio yet.")}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => {
                        setBioText(userProfile?.bio || '');
                        setIsEditingBio(true);
                      }}
                      className="absolute -right-2 top-0 rounded-xl border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid w-full grid-cols-3 gap-3 mb-6">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center">
                <div className="text-xl font-bold text-slate-100">{posts.length}</div>
                <div className="text-xs text-slate-400">Posts</div>
              </div>
              <button
                onClick={() => {
                  setShowFollowersModal(true);
                  loadFollowersList();
                }}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center hover:bg-slate-800 transition-colors"
              >
                <div className="text-xl font-bold text-slate-100">{userProfile.followers?.length || 0}</div>
                <div className="text-xs text-slate-400">Followers</div>
              </button>
              <button
                onClick={() => {
                  setShowFollowingModal(true);
                  loadFollowingList();
                }}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center hover:bg-slate-800 transition-colors"
              >
                <div className="text-xl font-bold text-slate-100">{userProfile.following?.length || 0}</div>
                <div className="text-xs text-slate-400">Following</div>
              </button>
            </div>

            {/* Useful Activity Strip */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Media Overview</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2">
                    <p className="text-lg font-bold text-slate-100">{standardPosts.length}</p>
                    <p className="text-[11px] text-slate-400">Posts</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2">
                    <p className="text-lg font-bold text-slate-100">{reelPosts.length}</p>
                    <p className="text-[11px] text-slate-400">Reels</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2">
                    <p className="text-lg font-bold text-slate-100">{taggedPosts.length}</p>
                    <p className="text-[11px] text-slate-400">Tagged</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Learning Snapshot</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="flex items-center justify-between"><span>Courses created</span><span className="font-semibold text-slate-100">{createdCourses.length}</span></p>
                  <p className="flex items-center justify-between"><span>Courses enrolled</span><span className="font-semibold text-slate-100">{enrolledCourses.length}</span></p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('courses');
                      setCourseSubTab('enrolled');
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Continue learning
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <div className="flex flex-wrap justify-center gap-3">
                {isFollowing ? (
                  <button
                    onClick={handleUnfollow}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-600 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                  >
                    <UserMinus className="w-4 h-4" />
                    Unfollow
                  </button>
                ) : (
                  <button
                    onClick={handleFollow}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
                  >
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </button>
                )}
                <button
                  onClick={() => navigate('/messages')}
                  className="rounded-2xl border border-slate-600 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Message
                </button>
              </div>
            )}
              </div>
            </section>
          </div>
        </div>

      {/* Tabs Section */}
      <div className="w-full px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 max-w-full" style={{width: '100%', maxWidth: 'none'}}>
        <div className="mx-auto flex w-full max-w-3xl justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-2">
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'media'
                ? 'bg-slate-800 text-sky-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Grid3x3 className="w-4 h-4" />
              <span>Media</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'courses'
                ? 'bg-slate-800 text-sky-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Courses</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-full" style={{width: '100%', maxWidth: 'none'}}>
        {activeTab === 'media' && (
          <div className="mb-6 mx-auto flex w-full max-w-3xl gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-2">
            <button
              onClick={() => setMediaTab('posts')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                mediaTab === 'posts' ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setMediaTab('reels')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                mediaTab === 'reels' ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              Reels
            </button>
            <button
              onClick={() => setMediaTab('tagged')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                mediaTab === 'tagged' ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              Tagged
            </button>
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === "media" && mediaTab === "posts" && (
          <div>
            {/* Content Grid */}
            <div>
            {(() => {
              // Check if account is private
              const isPrivateAccount = userProfile?.isPrivate === true;
              const isFollowingUser = userProfile?.followers?.includes(currentUserId) || false;
              const canViewContent = isOwnProfile || !isPrivateAccount || isFollowingUser;

              // Show private account message if can't view
              if (!isOwnProfile && isPrivateAccount && !isFollowingUser) {
                return (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-100 p-12 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-3">
                      This Account is Private
                    </h3>
                    <p className="text-gray-600 mb-8 text-lg">
                      Follow this account to see their posts, vibes, and streams.
                    </p>
                    <button
                      onClick={handleFollow}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-2xl font-bold hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2 mx-auto"
                    >
                      <UserPlus className="w-5 h-5" />
                      Follow to View Content
                    </button>
                  </div>
                );
              }

              const filteredPosts = standardPosts;

              return loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className="aspect-square rounded-2xl bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 animate-pulse"></div>
                  ))}
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800">
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-100">
                    {isOwnProfile ? "You haven't posted yet" : "No posts yet"}
                  </h3>
                  <p className="mb-8 text-slate-400">
                    {isOwnProfile ? "Share your musical journey with others." : "This user has not shared posts yet."}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => navigate('/home')}
                      className="rounded-2xl bg-sky-600 px-8 py-4 font-semibold text-white hover:bg-sky-500"
                    >
                      Create First Post
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredPosts.map((post, index) => (
                  <MagneticCard
                    key={post.id}
                    className="post-card relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all aspect-square"
                  >
                    {/* Delete Button - Only for own profile */}
                    {isOwnProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                        className="absolute top-3 right-3 z-10 p-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Post Image */}
                    {post.imageUrl ? (
                      <LazyImage
                        src={post.imageUrl}
                        alt="Post"
                        className="w-full h-full object-cover"
                        onClick={() => {
                          setViewerPosts(filteredPosts);
                          setCurrentPostIndex(index);
                          setShowPostViewer(true);
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full bg-gradient-to-br from-indigo-200 to-purple-200 flex items-center justify-center"
                        onClick={() => {
                          setViewerPosts(filteredPosts);
                          setCurrentPostIndex(index);
                          setShowPostViewer(true);
                        }}
                      >
                        <ImageIcon className="w-16 h-16 text-indigo-400" />
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <div className="text-white flex items-center gap-6 text-sm font-semibold w-full justify-center">
                        <div className="flex items-center gap-2">
                          <Heart className="w-5 h-5 fill-white" />
                          <span>{post.likes?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-5 h-5 fill-white" />
                          <span>{post.comments?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </MagneticCard>
                  ))}
                </div>
              );
            })()}
            </div>
          </div>
        )}

        {/* Reels Tab */}
        {activeTab === "media" && mediaTab === "reels" && (
          <div>
            {(() => {
              const isPrivateAccount = userProfile?.isPrivate === true;
              const isFollowingUser = userProfile?.followers?.includes(currentUserId) || false;
              if (!isOwnProfile && isPrivateAccount && !isFollowingUser) {
                return (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
                      <User className="h-12 w-12 text-slate-400" />
                    </div>
                    <h3 className="mb-3 text-3xl font-bold text-slate-100">This Account is Private</h3>
                    <p className="mb-8 text-lg text-slate-400">Follow this account to see their reels.</p>
                    <button
                      onClick={handleFollow}
                      className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-8 py-4 font-bold text-white hover:bg-sky-500"
                    >
                      <UserPlus className="w-5 h-5" />
                      Follow to View Reels
                    </button>
                  </div>
                );
              }

              const reelPostsLocal = reelPosts;

              if (loading) {
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-slate-800 animate-pulse"></div>
                    ))}
                  </div>
                );
              }

              if (reelPostsLocal.length === 0) {
                return (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800">
                      <Film className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-slate-100">
                      {isOwnProfile ? "You haven't posted reels yet" : "No reels yet"}
                    </h3>
                    <p className="mb-8 text-slate-400">
                      {isOwnProfile ? "Share a vibe to appear here." : "This user has not shared reels yet."}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => navigate('/home')}
                        className="rounded-2xl bg-sky-600 px-8 py-4 font-semibold text-white hover:bg-sky-500"
                      >
                        Create First Reel
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {reelPostsLocal.map((post, index) => (
                    <MagneticCard
                      key={post.id}
                      className="post-card relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all aspect-square"
                    >
                      {post.imageUrl ? (
                        <LazyImage
                          src={post.imageUrl}
                          alt="Reel"
                          className="w-full h-full object-cover"
                          onClick={() => {
                            setViewerPosts(reelPostsLocal);
                            setCurrentPostIndex(index);
                            setShowPostViewer(true);
                          }}
                        />
                      ) : (
                        <div
                          className="w-full h-full bg-slate-800 flex items-center justify-center"
                          onClick={() => {
                            setViewerPosts(reelPostsLocal);
                            setCurrentPostIndex(index);
                            setShowPostViewer(true);
                          }}
                        >
                          <Film className="w-16 h-16 text-slate-500" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <div className="text-white flex items-center gap-6 text-sm font-semibold w-full justify-center">
                          <div className="flex items-center gap-2">
                            <Heart className="w-5 h-5 fill-white" />
                            <span>{post.likes?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 fill-white" />
                            <span>{post.comments?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                    </MagneticCard>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tagged Tab */}
        {activeTab === "media" && mediaTab === "tagged" && (
          <div>
            {(() => {
              const isPrivateAccount = userProfile?.isPrivate === true;
              const isFollowingUser = userProfile?.followers?.includes(currentUserId) || false;
              if (!isOwnProfile && isPrivateAccount && !isFollowingUser) {
                return (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
                      <User className="h-12 w-12 text-slate-400" />
                    </div>
                    <h3 className="mb-3 text-3xl font-bold text-slate-100">This Account is Private</h3>
                    <p className="mb-8 text-lg text-slate-400">Follow this account to see tagged posts.</p>
                    <button
                      onClick={handleFollow}
                      className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-8 py-4 font-bold text-white hover:bg-sky-500"
                    >
                      <UserPlus className="w-5 h-5" />
                      Follow to View Tagged Posts
                    </button>
                  </div>
                );
              }

              if (loading) {
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-slate-800 animate-pulse"></div>
                    ))}
                  </div>
                );
              }

              if (taggedPosts.length === 0) {
                return (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800">
                      <Sparkles className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-slate-100">No tagged posts yet</h3>
                    <p className="mb-8 text-slate-400">
                      Posts where this profile is tagged will appear here.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {taggedPosts.map((post, index) => (
                    <MagneticCard
                      key={post.id}
                      className="post-card relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all aspect-square"
                    >
                      {post.imageUrl ? (
                        <LazyImage
                          src={post.imageUrl}
                          alt="Tagged post"
                          className="w-full h-full object-cover"
                          onClick={() => {
                            setViewerPosts(taggedPosts);
                            setCurrentPostIndex(index);
                            setShowPostViewer(true);
                          }}
                        />
                      ) : (
                        <div
                          className="w-full h-full bg-slate-800 flex items-center justify-center"
                          onClick={() => {
                            setViewerPosts(taggedPosts);
                            setCurrentPostIndex(index);
                            setShowPostViewer(true);
                          }}
                        >
                          <ImageIcon className="w-16 h-16 text-slate-500" />
                        </div>
                      )}
                    </MagneticCard>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === "courses" && (
          <div>
            {(() => {
              // Check if account is private
              const isPrivateAccount = userProfile?.isPrivate === true;
              const isFollowingUser = userProfile?.followers?.includes(currentUserId) || false;
              const canViewContent = isOwnProfile || !isPrivateAccount || isFollowingUser;

              // Show private account message if can't view
              if (!isOwnProfile && isPrivateAccount && !isFollowingUser) {
                return (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-100 p-12 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800 mb-3">
                      This Account is Private
                    </h3>
                    <p className="text-gray-600 mb-8 text-lg">
                      Follow this account to see their courses.
                    </p>
                    <button
                      onClick={handleFollow}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-2xl font-bold hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2 mx-auto"
                    >
                      <UserPlus className="w-5 h-5" />
                      Follow to View Content
                    </button>
                  </div>
                );
              }

              return (
                <>
            {/* Course Sub-tabs */}
            <div className="mb-8 flex w-full max-w-md gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-2">
              <button
                onClick={() => setCourseSubTab('created')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  courseSubTab === 'created'
                    ? 'bg-slate-800 text-sky-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Created ({createdCourses.length})
              </button>
              <button
                onClick={() => setCourseSubTab('enrolled')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  courseSubTab === 'enrolled'
                    ? 'bg-slate-800 text-sky-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                Enrolled ({enrolledCourses.length})
              </button>
            </div>
            
            {/* Created Courses */}
            {courseSubTab === 'created' && (
              <div>
                {createdCourses.length === 0 ? (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800">
                      <BookOpen className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-3">
                      {isOwnProfile ? "You haven't created any courses" : "No courses created"}
                    </h3>
                    <p className="text-slate-400 mb-8">
                      {isOwnProfile ? "Share your knowledge by creating a course!" : "This user hasn't created any courses yet."}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => navigate('/courses')}
                        className="rounded-2xl bg-sky-600 px-8 py-4 font-semibold text-white hover:bg-sky-500"
                      >
                        Create First Course
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {createdCourses.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 transition-all group hover:border-slate-600"
                      >
                        <div className="w-full h-48 bg-slate-800 rounded-2xl mb-4 flex items-center justify-center border border-slate-700">
                          <BookOpen className="w-16 h-16 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-sky-300 transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{course.description}</p>

                        <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{course.enrolledUsers?.length || 0} enrolled</span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/course/${course.id}`)}
                          className="w-full rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500 transition-colors"
                        >
                          Manage Course
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Enrolled Courses */}
            {courseSubTab === 'enrolled' && (
              <div>
                {enrolledCourses.length === 0 ? (
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800">
                      <BookOpen className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-3">
                      {isOwnProfile ? "You haven't enrolled in any courses" : "Not enrolled in any courses"}
                    </h3>
                    <p className="text-slate-400 mb-8">
                      {isOwnProfile ? "Start learning by enrolling in a course!" : "This user hasn't enrolled in any courses yet."}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => navigate('/courses')}
                        className="rounded-2xl bg-sky-600 px-8 py-4 font-semibold text-white hover:bg-sky-500"
                      >
                        Browse Courses
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {enrolledCourses.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 transition-all group hover:border-slate-600"
                      >
                        <div className="w-full h-48 bg-slate-800 rounded-2xl mb-4 flex items-center justify-center border border-slate-700">
                          <BookOpen className="w-16 h-16 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-sky-300 transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{course.description}</p>

                        <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{course.enrolledUsers?.length || 0} students</span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/course/${course.id}`)}
                          className="w-full rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500 transition-colors"
                        >
                          Continue Learning
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom padding for mobile */}
      <div className="pb-8"></div>

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-indigo-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-indigo-100 px-6 py-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Followers
              </h2>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="p-2 hover:bg-indigo-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Followers List */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {followersList.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No followers yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followersList.map((follower) => (
                    <button
                      key={follower.id}
                      onClick={() => {
                        setShowFollowersModal(false);
                        navigate(`/user-profile/${follower.id}`);
                      }}
                      className="w-full flex items-center gap-4 p-4 bg-white/80 backdrop-blur-xl rounded-2xl border border-indigo-100 hover:shadow-lg hover:border-indigo-300 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-indigo-200 group-hover:ring-indigo-400 transition-all flex-shrink-0">
                        {follower.profilePic ? (
                          <img
                            src={follower.profilePic}
                            alt={follower.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-pink-400 flex items-center justify-center">
                            <User className="w-7 h-7 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow text-left">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                          {follower.displayName || 'Music Enthusiast'}
                        </h4>
                        <p className="text-sm text-indigo-400 font-medium">
                          {follower.followers?.length || 0} followers
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-indigo-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-indigo-100 px-6 py-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Following
              </h2>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="p-2 hover:bg-indigo-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Following List */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {followingList.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Not following anyone yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followingList.map((following) => (
                    <button
                      key={following.id}
                      onClick={() => {
                        setShowFollowingModal(false);
                        navigate(`/user-profile/${following.id}`);
                      }}
                      className="w-full flex items-center gap-4 p-4 bg-white/80 backdrop-blur-xl rounded-2xl border border-indigo-100 hover:shadow-lg hover:border-indigo-300 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-indigo-200 group-hover:ring-indigo-400 transition-all flex-shrink-0">
                        {following.profilePic ? (
                          <img
                            src={following.profilePic}
                            alt={following.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-pink-400 flex items-center justify-center">
                            <User className="w-7 h-7 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow text-left">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                          {following.displayName || 'Music Enthusiast'}
                        </h4>
                        <p className="text-sm text-indigo-400 font-medium">
                          {following.followers?.length || 0} followers
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Viewer Modal */}
      {showProfilePicModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-indigo-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-indigo-100 px-6 py-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Profile Picture
              </h2>
              <button
                onClick={() => setShowProfilePicModal(false)}
                className="p-2 hover:bg-indigo-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Image Display - Circular Cropped View */}
            <div className="p-8 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
              <div className="relative w-80 h-80 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 rounded-full p-2 shadow-2xl">
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {userProfile.profilePic ? (
                    <img
                      src={userProfile.profilePic}
                      alt="Profile Picture"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-32 h-32 text-indigo-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwnProfile && (
              <div className="bg-white border-t border-indigo-100 px-6 py-5 flex justify-end gap-3">
                <button
                  onClick={() => setShowProfilePicModal(false)}
                  className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-2xl font-semibold transition-all border border-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={handleChangeProfilePic}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Change Picture
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner Viewer Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-indigo-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-indigo-100 px-6 py-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Banner Image
              </h2>
              <button
                onClick={() => setShowBannerModal(false)}
                className="p-2 hover:bg-indigo-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Image Display */}
            <div className="p-8 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
              {userProfile.bannerImage ? (
                <img
                  src={userProfile.bannerImage}
                  alt="Banner"
                  className="max-w-full max-h-[70vh] object-contain rounded-3xl shadow-2xl"
                />
              ) : (
                <div className="w-full h-64 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center">
                  <ImageIcon className="w-32 h-32 text-white/50" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isOwnProfile && (
              <div className="bg-white border-t border-indigo-100 px-6 py-5 flex justify-end gap-3">
                <button
                  onClick={() => setShowBannerModal(false)}
                  className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-2xl font-semibold transition-all border border-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={handleChangeBanner}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Change Banner
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-5xl my-8 border border-indigo-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {cropType === 'profile' ? 'Crop Profile Picture' : 'Crop Banner'}
              </h2>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageToCrop(null);
                }}
                className="p-2 hover:bg-indigo-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Cropper Container */}
            <div className="relative bg-black" style={{ height: 'min(60vh, 500px)' }}>
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'profile' ? 1 : 3}
                cropShape={cropType === 'profile' ? 'round' : 'rect'}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Zoom
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className="px-6 py-3 text-gray-700 hover:bg-white rounded-2xl font-semibold transition-all border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={cropType === 'profile' ? handleCroppedProfilePic : handleCroppedBanner}
                  disabled={isCropping}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCropping ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      Apply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instagram-Style Post Viewer - Redesigned */}
      {showPostViewer && viewerPosts.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4"
          ref={postViewerRef}
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
            onClick={() => setShowPostViewer(false)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Main Container - Image on Left, Details on Right */}
          <div className="w-full max-w-6xl h-full sm:h-[90vh] bg-white sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
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
                  <ImageIcon className="w-20 h-20 text-gray-600" />
                </div>
              )}

              {/* Navigation Arrows on Image */}
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
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden">
                    {userProfile.profilePic ? (
                      <img src={userProfile.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{userProfile?.displayName || 'User'}</p>
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
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-400 to-pink-400">
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
                    <Heart className={`w-5 h-5 ${
                      viewerPosts[currentPostIndex]?.likes?.includes(currentUserId)
                        ? 'fill-pink-500 text-pink-500'
                        : 'text-gray-600 group-hover:text-pink-500'
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
      )}

      {/* Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Likes</h2>
              <button
                onClick={() => setShowLikesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
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
                        setShowPostViewer(false);
                        navigate(`/user-profile/${user.id}`);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        {user.profilePic ? (
                          <img src={user.profilePic} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.displayName}</p>
                        {user.bio && (
                          <p className="text-sm text-gray-500 line-clamp-1">{user.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No likes yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">Log out?</h3>
              <p className="mt-1 text-sm text-slate-400">You will need to sign in again to access your account.</p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutModal(false);
                  await handleSignOut();
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ProfilePage;