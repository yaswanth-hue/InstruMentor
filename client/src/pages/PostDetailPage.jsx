import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db, getUserProfile, likePost, unlikePost, addComment, getComments } from '../firebase';
import {
  ArrowLeft,
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
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    loadPost();
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert('Please log in to comment');
      return;
    }

    try {
      setSubmittingComment(true);
      const userProfile = await getUserProfile(userId);

      await addComment(postId, {
        userId,
        userName: userProfile?.displayName || 'Anonymous',
        userProfilePic: userProfile?.profilePic || '',
        text: commentText.trim()
      });

      // Reload the post to get updated comments
      await loadPost();
      setCommentText('');
      setShowCommentModal(false);
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

  if (loading) {
    return <LoadingSpinner message="Loading post…" />;
  }

  if (!post || !postOwner) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{post?.author?.displayName ? `${post.author.displayName}'s Post` : 'Post'} | InstruMentor</title>
        <meta name="description" content={post?.caption || `View this post by ${post?.author?.displayName || 'a musician'} on InstruMentor - connect with musicians worldwide.`} />
        <meta property="og:title" content={`${post?.author?.displayName || 'Musician'}'s Post | InstruMentor`} />
        <meta property="og:description" content={post?.caption || 'View this post on InstruMentor'} />
        <meta property="og:image" content={post?.imageUrl || post?.mediaUrl || 'https://via.placeholder.com/400'} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${post?.author?.displayName || 'Musician'}'s Post | InstruMentor`} />
        <meta name="twitter:description" content={post?.caption || 'View this post on InstruMentor'} />
        <meta name="twitter:image" content={post?.imageUrl || post?.mediaUrl || 'https://via.placeholder.com/400'} />
      </Helmet>
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden" style={{width: '100%', maxWidth: 'none'}}>
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6">
          <div className="flex items-center h-14">
            <button
              onClick={() => navigate('/home')}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="ml-3 text-lg font-bold text-gray-900">
              Post
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Image */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt="Post"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-400">No image</p>
            </div>
          )}
        </div>

        {/* Right Side - Post Details */}
        <div className="w-full md:w-[420px] flex flex-col bg-white border-l border-gray-200">
          {/* Header with User Info */}
          <div className="px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate(`/user-profile/${postOwner.uid || post.userId}`)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                {postOwner.profilePic ? (
                  <img src={postOwner.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{postOwner.displayName}</p>
              </div>
            </div>
          </div>

          {/* Caption */}
          {post.content && (
            <div className="px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              <p className="text-gray-900 text-sm leading-relaxed">
                <span className="font-semibold">{postOwner.displayName}</span> {post.content}
              </p>
            </div>
          )}

          {/* Comments Section - Scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 bg-white">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((comment, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-400 to-teal-500">
                    {comment.userProfilePic ? (
                      <img src={comment.userProfilePic} alt={comment.userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-tight">
                      <span className="font-semibold">{comment.userName}</span> <span className="text-gray-700">{comment.text}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
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
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No comments yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="border-t border-gray-100 bg-white flex-shrink-0">
            {/* Like, Comment, Share, Save buttons */}
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLikePost}
                  disabled={isLiking}
                  className="hover:opacity-70 transition-opacity disabled:opacity-50"
                >
                  <Heart className={`w-6 h-6 ${
                    isLiked
                      ? 'fill-red-500 text-red-500'
                      : 'text-gray-800'
                  }`} />
                </button>
                <button
                  onClick={() => setShowCommentModal(true)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <MessageCircle className="w-6 h-6 text-gray-800" />
                </button>
                <button
                  onClick={() => {
                    const postLink = `${window.location.origin}/post/${post.id}`;
                    navigator.clipboard.writeText(postLink).then(() => {
                      alert('Post link copied to clipboard!');
                    }).catch(() => {
                      alert('Failed to copy link');
                    });
                  }}
                  className="hover:opacity-70 transition-opacity"
                >
                  <Share2 className="w-6 h-6 text-gray-800" />
                </button>
              </div>
              <button
                onClick={handleSavePost}
                className="hover:opacity-70 transition-opacity"
              >
                <Bookmark className={`w-6 h-6 ${
                  isSaved
                    ? 'fill-gray-900 text-gray-900'
                    : 'text-gray-800'
                }`} />
              </button>
            </div>

            {/* Likes count */}
            <div className="px-4 pb-3">
              <button
                onClick={() => {
                  loadLikesList();
                  setShowLikesModal(true);
                }}
                className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
              >
                {post.likes?.length || 0} {post.likes?.length === 1 ? 'like' : 'likes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Likes</h2>
              <button
                onClick={() => setShowLikesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Likes List */}
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-90px)] bg-gray-50">
              {likesList.length > 0 ? (
                <div className="space-y-2">
                  {likesList.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setShowLikesModal(false);
                        navigate(`/user-profile/${user.id}`);
                      }}
                      className="flex items-center gap-4 p-3 hover:bg-white rounded-xl cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200 hover:shadow-sm"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md">
                        {user.profilePic ? (
                          <img src={user.profilePic} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{user.displayName}</p>
                        {user.bio && (
                          <p className="text-sm text-gray-500 line-clamp-1">{user.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No likes yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Comment</h2>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="p-6">
              <textarea
                placeholder="Write your comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full min-h-[120px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-gray-50 rounded-lg p-4 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                disabled={submittingComment}
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCommentModal(false);
                    setCommentText('');
                  }}
                  className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                  disabled={submittingComment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PostDetailPage;