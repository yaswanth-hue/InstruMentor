import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db, getUserProfile, likePost, unlikePost, addComment, getComments } from '../firebase';
import {
  User,
  Heart,
  MessageCircle,
  Share2,
  X,
  Send,
  Bookmark
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const PostDetailPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [postOwner, setPostOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);

      // Get post data
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (!postDoc.exists()) {
        alert('Post not found');
        navigate('/home');
        return;
      }

      const postData = { id: postDoc.id, ...postDoc.data() };

      // Get comments from subcollection or fallback to document array
      const comments = await getComments(postId);
      postData.comments = comments;

      setPost(postData);

      // Check if current user liked this post
      const currentUserId = auth.currentUser?.uid;
      setIsLiked(postData.likes?.includes(currentUserId) || false);

      // Check if current user saved this post
      if (currentUserId) {
        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsSaved(userData.savedPosts?.includes(postId) || false);
        }
      }

      // Get post owner profile
      const ownerProfile = await getUserProfile(postData.userId);
      setPostOwner(ownerProfile);
    } catch (error) {
      console.error('Error loading post:', error);
      alert('Failed to load post');
      navigate('/home');
    } finally {
      setLoading(false);
    }
  };

  const loadLikesList = async () => {
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

  const handleLikePost = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert('Please log in to like posts');
      return;
    }

    // Prevent multiple rapid clicks
    if (isLiking) return;

    try {
      setIsLiking(true);
      const wasLiked = isLiked;

      if (wasLiked) {
        // Unlike
        setIsLiked(false);
        setPost(prev => ({
          ...prev,
          likes: prev.likes.filter(id => id !== userId)
        }));
        await unlikePost(postId, userId);
      } else {
        // Like
        setIsLiked(true);
        setPost(prev => ({
          ...prev,
          likes: [...(prev.likes || []), userId]
        }));
        await likePost(postId, userId);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert UI state on error
      setIsLiked(!isLiked);
      alert('Failed to update like: ' + error.message);
    } finally {
      setIsLiking(false);
    }
  };

  // Inline comment box, matching the Explore post viewer — no separate
  // "Add Comment" popup.
  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert('Please log in to comment');
      return;
    }

    try {
      setSubmittingComment(true);
      const userProfile = await getUserProfile(userId);
      const newComment = {
        userId,
        userName: userProfile?.displayName || 'Anonymous',
        userProfilePic: userProfile?.profilePic || '',
        text: commentText.trim(),
        timestamp: new Date().toISOString()
      };

      await addComment(postId, {
        userId: newComment.userId,
        userName: newComment.userName,
        userProfilePic: newComment.userProfilePic,
        text: newComment.text
      });

      setPost(prev => ({
        ...prev,
        comments: [...(prev.comments || []), newComment]
      }));
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment: ' + error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSavePost = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert('Please log in to save posts');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);

      if (isSaved) {
        // Unsave
        await updateDoc(userRef, {
          savedPosts: arrayRemove(postId)
        });
        setIsSaved(false);
      } else {
        // Save
        await updateDoc(userRef, {
          savedPosts: arrayUnion(postId)
        });
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      alert('Failed to save post: ' + error.message);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading post…" />;
  }

  if (!post || !postOwner) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{postOwner?.displayName ? `${postOwner.displayName}'s Post` : 'Post'} | InstruMentor</title>
        <meta name="description" content={post?.content || `View this post by ${postOwner?.displayName || 'a musician'} on InstruMentor - connect with musicians worldwide.`} />
        <meta property="og:title" content={`${postOwner?.displayName || 'Musician'}'s Post | InstruMentor`} />
        <meta property="og:description" content={post?.content || 'View this post on InstruMentor'} />
        <meta property="og:image" content={post?.imageUrl || 'https://via.placeholder.com/400'} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${postOwner?.displayName || 'Musician'}'s Post | InstruMentor`} />
        <meta name="twitter:description" content={post?.content || 'View this post on InstruMentor'} />
        <meta name="twitter:image" content={post?.imageUrl || 'https://via.placeholder.com/400'} />
      </Helmet>

      {/* Same shell as the Explore post viewer: full-bleed dark backdrop,
          centered card, floating close button — instead of the old
          full-page header-bar layout. */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
        <div className="relative w-full h-full sm:h-[90vh] bg-zinc-900 sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row">
          {/* Close Button */}
          <button
            onClick={goBack}
            className="absolute top-4 right-4 z-20 p-3 bg-zinc-950/80 hover:bg-zinc-800 border border-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-zinc-200" />
          </button>

          {/* Left Side - Image */}
          <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0">
            {post.imageUrl ? (
              post.mediaType === 'reel' || post.mediaType === 'video' ? (
                <video
                  src={post.imageUrl}
                  controls
                  playsInline
                  loop
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="max-w-full max-h-full object-contain"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-zinc-500">No image</p>
              </div>
            )}
          </div>

          {/* Right Side - Post Details */}
          <div className="w-full md:w-[400px] flex flex-col bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10 max-h-[60vh] md:max-h-full">
            {/* Header with User Info */}
            <div className="p-4 border-b border-white/10">
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-2xl p-2 -m-2 transition-colors"
                onClick={() => navigate(`/user-profile/${postOwner.uid || post.userId}`)}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center overflow-hidden border border-white/10">
                  {postOwner.profilePic ? (
                    <img src={postOwner.profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-zinc-50">{postOwner.displayName}</p>
                  {post.timestamp?.toDate && (
                    <p className="text-xs text-zinc-500">
                      {post.timestamp.toDate().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Caption */}
            {post.content && (
              <div className="p-4 border-b border-white/10">
                <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>
            )}

            {/* Comments Section - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {post.comments && post.comments.length > 0 ? (
                post.comments.map((comment, idx) => (
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
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !submittingComment) {
                      handleAddComment();
                    }
                  }}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400 transition-colors"
                />
                <button
                  onClick={handleAddComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="p-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingComment ? (
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
                  <button onClick={handleLikePost} disabled={isLiking} className="group disabled:opacity-50">
                    <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-cyan-400 text-cyan-300' : 'text-zinc-300 group-hover:text-cyan-300'
                      }`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loadLikesList();
                      setShowLikesModal(true);
                    }}
                    className="text-sm font-semibold text-zinc-300 hover:text-white hover:underline"
                  >
                    {post.likes?.length || 0}
                  </button>
                </div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <MessageCircle className="w-5 h-5 text-zinc-300" />
                  <span className="text-sm font-semibold text-zinc-300">
                    {post.comments?.length || 0}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const postLink = `${window.location.origin}/post/${post.id}`;
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
                <button
                  onClick={handleSavePost}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <Bookmark className={`w-5 h-5 transition-colors ${isSaved ? 'fill-amber-300 text-amber-300' : 'text-zinc-300 hover:text-amber-200'
                    }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-white/10 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Likes</h2>
              <button
                onClick={() => setShowLikesModal(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-300" />
              </button>
            </div>

            {/* Likes List */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-90px)]">
              {likesList.length > 0 ? (
                <div className="space-y-2">
                  {likesList.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setShowLikesModal(false);
                        navigate(`/user-profile/${user.id}`);
                      }}
                      className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl cursor-pointer transition-colors"
                    >
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center border border-white/10">
                        {user.profilePic ? (
                          <img src={user.profilePic} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-100 truncate">{user.displayName}</p>
                        {user.bio && (
                          <p className="text-sm text-zinc-400 line-clamp-1">{user.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Heart className="w-16 h-16 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-400 font-medium">No likes yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PostDetailPage;