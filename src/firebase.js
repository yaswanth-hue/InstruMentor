// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  increment
} from "firebase/firestore";
import { getDatabase } from "firebase/database"; // ✅ Import Realtime Database
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // ✅ Initialize RTDB
const storage = getStorage(app); // ✅ Initialize Storage for course materials/videos

// Auth providers
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Auth functions
const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
const signUpWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
const logout = () => signOut(auth);

// Firestore helper functions
const addResource = async (data) => {
  const docRef = await addDoc(collection(db, "resources"), data);
  return docRef.id;
};

const updateResource = async (id, updatedData) => {
  const resourceRef = doc(db, "resources", id);
  await updateDoc(resourceRef, updatedData);
};

const deleteResource = async (id) => {
  const resourceRef = doc(db, "resources", id);
  await deleteDoc(resourceRef);
};

const getResourcesByInstrumentAndLevel = async (instrument, level) => {
  const q = query(
    collection(db, "resources"),
    where("instrument", "==", instrument),
    where("level", "==", level)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Social Network helper functions
const createUserProfile = async (userId, userData) => {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    ...userData,
    following: [],
    followers: [],
    createdAt: new Date()
  }, { merge: true });
};

const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

const followUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);
  
  // Add target to current user's following
  const currentUserRef = doc(db, "users", currentUserId);
  batch.update(currentUserRef, {
    following: arrayUnion(targetUserId)
  });
  
  // Add current user to target's followers
  const targetUserRef = doc(db, "users", targetUserId);
  batch.update(targetUserRef, {
    followers: arrayUnion(currentUserId)
  });
  
  await batch.commit();
};

const unfollowUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);
  
  // Remove target from current user's following
  const currentUserRef = doc(db, "users", currentUserId);
  batch.update(currentUserRef, {
    following: arrayRemove(targetUserId)
  });
  
  // Remove current user from target's followers
  const targetUserRef = doc(db, "users", targetUserId);
  batch.update(targetUserRef, {
    followers: arrayRemove(currentUserId)
  });
  
  await batch.commit();
};

// Posts helper functions
const createPost = async (postData, imageFile = null) => {
  console.log('createPost called with imageFile:', imageFile ? imageFile.name : 'NO IMAGE');
  let imageUrl = null;

  // Convert image to base64 if provided
  if (imageFile) {
    console.log('Converting post image to base64...');
    imageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
    console.log('Post image converted successfully to base64');
  } else {
    console.log('No image file provided for this post');
  }

  console.log('Creating post document with imageUrl:', imageUrl ? 'BASE64_DATA' : null);
  const docRef = await addDoc(collection(db, "posts"), {
    ...postData,
    imageUrl,
    timestamp: serverTimestamp(),
    likes: [],
    comments: []
  });
  console.log('Post created with ID:', docRef.id);
  return docRef.id;
};

const deletePost = async (postId, userId) => {
  const postRef = doc(db, "posts", postId);
  const postDoc = await getDoc(postRef);

  if (postDoc.exists() && postDoc.data().userId === userId) {
    await deleteDoc(postRef);
    return true;
  }
  return false;
};

const likePost = async (postId, userId) => {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    likes: arrayUnion(userId)
  });
};

const unlikePost = async (postId, userId) => {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    likes: arrayRemove(userId)
  });
};

const addComment = async (postId, commentData) => {
  // Use subcollection approach only - no fallback to avoid size limits
  const commentsRef = collection(db, "posts", postId, "comments");
  await addDoc(commentsRef, {
    ...commentData,
    timestamp: new Date().toISOString()
  });

  // Also increment the comment count on the post
  const postRef = doc(db, "posts", postId);
  try {
    await updateDoc(postRef, {
      commentCount: increment(1)
    });
  } catch (error) {
    // If commentCount field doesn't exist, it's okay
    console.log("Could not update comment count:", error);
  }
};

const getComments = async (postId) => {
  try {
    // Try to get from subcollection first
    const commentsRef = collection(db, "posts", postId, "comments");
    const q = query(commentsRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Fallback to old method - get from post document
    const postRef = doc(db, "posts", postId);
    const postDoc = await getDoc(postRef);
    if (postDoc.exists()) {
      return postDoc.data().comments || [];
    }

    return [];
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
};

const getPosts = async (userId = null) => {
  let q;
  if (userId) {
    // Don't use orderBy with where to avoid needing a composite index
    q = query(collection(db, "posts"), where("userId", "==", userId));
  } else {
    q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
  }
  const querySnapshot = await getDocs(q);

  // Sort in JavaScript if filtering by userId
  let posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (userId) {
    posts.sort((a, b) => {
      const aTime = a.timestamp?.toDate?.() || new Date(0);
      const bTime = b.timestamp?.toDate?.() || new Date(0);
      return bTime - aTime; // Descending order (newest first)
    });
  }

  return posts;
};

const getFeedPosts = async (followingList) => {
  if (!followingList || followingList.length === 0) return [];
  const q = query(
    collection(db, "posts"),
    where("userId", "in", followingList),
    orderBy("timestamp", "desc"),
    limit(50)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Messages helper functions
const sendMessageRequest = async (messageData) => {
  // If there is any accepted conversation between these two users, mark as accepted
  try {
    const { senderId, receiverId } = messageData;
    const acceptedQuery = query(
      collection(db, "messages"),
      where("participants", "array-contains", senderId),
      where("status", "==", "accepted"),
      limit(25)
    );
    const snap = await getDocs(acceptedQuery);
    const hasAccepted = snap.docs.some((d) => {
      const data = d.data();
      const participants = data.participants || [];
      return participants.includes(receiverId);
    });

    const docRef = await addDoc(collection(db, "messages"), {
      ...messageData,
      status: hasAccepted ? "accepted" : "pending",
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    const docRef = await addDoc(collection(db, "messages"), {
      ...messageData,
      status: "pending",
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  }
};

const acceptMessageRequest = async (messageId) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    status: "accepted"
  });
};

const rejectMessageRequest = async (messageId) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    status: "rejected",
  });
};

const getMessages = async (userId) => {
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Courses helper functions
const createCourse = async (courseData) => {
  const docRef = await addDoc(collection(db, "courses"), {
    ...courseData,
    enrolledUsers: [],
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

const enrollInCourse = async (courseId, userId) => {
  const courseRef = doc(db, "courses", courseId);
  await updateDoc(courseRef, {
    enrolledUsers: arrayUnion(userId)
  });
};

const getCourses = async (creatorId = null) => {
  let q;
  if (creatorId) {
    q = query(collection(db, "courses"), where("creatorId", "==", creatorId));
  } else {
    q = query(collection(db, "courses"), limit(50));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getEnrolledCourses = async (userId) => {
  const q = query(
    collection(db, "courses"),
    where("enrolledUsers", "array-contains", userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

  // Single course fetch
  const getCourseById = async (courseId) => {
    const courseDoc = await getDoc(doc(db, "courses", courseId));
    return courseDoc.exists() ? { id: courseDoc.id, ...courseDoc.data() } : null;
  };

  // Unenroll a user from a course
  const unenrollFromCourse = async (courseId, userId) => {
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
      enrolledUsers: arrayRemove(userId)
    });
  };

// Meetings helper functions
export const createMeeting = async (meetingData) => {
  const docRef = await addDoc(collection(db, "meetings"), {
    ...meetingData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getMeetings = async (courseId) => {
  const q = query(
    collection(db, "meetings"),
    where("courseId", "==", courseId)
  );
  const querySnapshot = await getDocs(q);
  const meetings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort on the client side to avoid index requirement
  return meetings.sort((a, b) => {
    const dateA = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
    const dateB = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
    return dateA - dateB;
  });
};

// Single meeting
export const getMeetingById = async (meetingId) => {
  const snap = await getDoc(doc(db, "meetings", meetingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Course materials/lectures helpers - Support large video files
export const uploadCourseMaterial = (courseId, file, title, uploaderId, onProgress) => {
  return new Promise((resolve, reject) => {
    const filePath = `courseMaterials/${courseId}/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Get the current max order
          const materialsRef = collection(db, "courseMaterials");
          const q = query(materialsRef, where("courseId", "==", courseId));
          const snapshot = await getDocs(q);
          const maxOrder = snapshot.empty ? 0 : Math.max(...snapshot.docs.map(doc => doc.data().order || 0));

          const docRef = await addDoc(materialsRef, {
            courseId,
            title,
            fileUrl: downloadURL,
            filePath,
            uploaderId,
            fileType: file.type,
            fileSize: file.size,
            fileName: file.name,
            order: maxOrder + 1,
            createdAt: serverTimestamp(),
          });

          resolve({ id: docRef.id, fileUrl: downloadURL });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

export const getCourseMaterials = async (courseId) => {
  const q = query(
    collection(db, "courseMaterials"),
    where("courseId", "==", courseId),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const deleteCourseMaterial = async (materialId) => {
  const materialDoc = await getDoc(doc(db, "courseMaterials", materialId));
  if (materialDoc.exists()) {
    const data = materialDoc.data();
    if (data.filePath) {
      try {
        const fileRef = storageRef(storage, data.filePath);
        await deleteObject(fileRef);
      } catch (error) {
        console.error('Error deleting file from storage:', error);
      }
    }
  }
  await deleteDoc(doc(db, "courseMaterials", materialId));
};

export const updateMaterialOrder = async (materialId, newOrder) => {
  const materialRef = doc(db, "courseMaterials", materialId);
  await updateDoc(materialRef, { order: newOrder });
};

export const reorderCourseMaterials = async (courseId, reorderedMaterials) => {
  const batch = writeBatch(db);
  reorderedMaterials.forEach((material, index) => {
    const materialRef = doc(db, "courseMaterials", material.id);
    batch.update(materialRef, { order: index + 1 });
  });
  await batch.commit();
};

// Stories helper functions
const createStory = async (storyData, imageFiles) => {
  let imageUrls = [];

  if (imageFiles && imageFiles.length > 0) {
    // Convert all images to base64
    const uploadPromises = imageFiles.map(async (file, index) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    imageUrls = await Promise.all(uploadPromises);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  const docRef = await addDoc(collection(db, "stories"), {
    ...storyData,
    imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // Keep backwards compatible
    imageUrls: imageUrls, // Support multiple images
    timestamp: serverTimestamp(),
    expiresAt,
    views: []
  });
  return docRef.id;
};

const getActiveStories = async () => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc"),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getUserStories = async (userId) => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("userId", "==", userId),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc"),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getStoriesGroupedByUser = async (followingList = []) => {
  const now = new Date();
  let q;

  if (followingList.length > 0) {
    // Get stories from followed users + own stories
    const allUserIds = [...followingList];
    q = query(
      collection(db, "stories"),
      where("userId", "in", allUserIds.slice(0, 10)), // Firestore limit
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc")
    );
  } else {
    // Get all active stories
    q = query(
      collection(db, "stories"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc"),
      limit(50)
    );
  }

  const querySnapshot = await getDocs(q);
  const stories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Group stories by user and fetch user info
  const groupedStories = {};
  stories.forEach(story => {
    if (!groupedStories[story.userId]) {
      groupedStories[story.userId] = {
        stories: [],
        userInfo: {
          displayName: story.userName,
          profilePic: story.userProfilePic
        }
      };
    }
    groupedStories[story.userId].stories.push(story);
  });

  return groupedStories;
};

const markStoryAsViewed = async (storyId, userId) => {
  const storyRef = doc(db, "stories", storyId);
  await updateDoc(storyRef, {
    views: arrayUnion(userId)
  });
};

const deleteExpiredStories = async () => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("expiresAt", "<=", now)
  );
  const querySnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  return querySnapshot.docs.length;
};

// ✅ Export RTDB as well
export {
  auth,
  db,
  rtdb,
  googleProvider,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logout,
  addResource,
  updateResource,
  deleteResource,
  getResourcesByInstrumentAndLevel,
  // Social Network exports
  createUserProfile,
  getUserProfile,
  followUser,
  unfollowUser,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getComments,
  getPosts,
  getFeedPosts,
  sendMessageRequest,
  acceptMessageRequest,
  rejectMessageRequest,
  getMessages,
  createCourse,
  enrollInCourse,
  getCourses,
  getEnrolledCourses,
  getCourseById,
  unenrollFromCourse,
  storage,
  // Stories exports
  createStory,
  getActiveStories,
  getUserStories,
  getStoriesGroupedByUser,
  markStoryAsViewed,
  deleteExpiredStories
};
