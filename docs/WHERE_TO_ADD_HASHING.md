# 🎯 Where YOU Need to Add Hashing in InstruMentor

## 📊 Current Security Status

I analyzed your **entire codebase** and here's what I found:

### ✅ **Already Secure (Firebase Handles)**
- ✅ User login passwords
- ✅ User authentication tokens
- ✅ Email/password sign up
- ✅ Google OAuth

**Firebase already hashes all of these with bcrypt!** You don't need to do anything.

---

## ⚠️ **Areas That NEED Hashing**

Based on my analysis, here are **5 specific areas** in your code where you should add hashing:

---

## 1. 🚨 **AUDIO ROOM PASSWORDS** (High Priority)

### **Current State: NO PASSWORD PROTECTION**

**File:** `src/pages/AudioRoomsListPage.jsx` (Line 107-121)

```javascript
// Currently anyone can join any room - NO PASSWORD!
const response = await fetch('http://localhost:3001/api/audio-rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: roomTitle,
    description: roomDescription,
    host_id: user.uid,
    host_name: user.displayName || user.email,
    max_participants: 10,
    allow_chat: true,
    allow_media: false
    // ❌ NO PASSWORD FIELD!
  })
});
```

### **Problem:**
- Anyone with the room ID can join
- No privacy for private lessons
- Teachers can't have confidential meetings

### **Solution: Add Room Password Hashing**

**Step 1: Update Room Creation** (`AudioRoomsListPage.jsx`)

```javascript
import { hashRoomPassword } from '../utils/passwordSecurity.js';

const handleCreateRoom = async () => {
  if (!user) {
    navigate('/login');
    return;
  }

  const roomTitle = prompt('Enter room title:');
  if (!roomTitle) return;

  const roomDescription = prompt('Enter room description (optional):') || '';

  // NEW: Ask for password
  const makePrivate = confirm('Make this a private room? (requires password)');
  let passwordHash = null;

  if (makePrivate) {
    const password = prompt('Enter room password (min 6 characters):');
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    // Hash the password before sending
    passwordHash = await hashRoomPassword(password);
  }

  try {
    const response = await fetch('http://localhost:3001/api/audio-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: roomTitle,
        description: roomDescription,
        host_id: user.uid,
        host_name: user.displayName || user.email,
        max_participants: 10,
        allow_chat: true,
        allow_media: false,
        is_private: makePrivate,
        password_hash: passwordHash // Store hash, NOT plain password
      })
    });

    if (response.ok) {
      const newRoom = await response.json();
      setAudioRooms(prev => [newRoom, ...prev]);
      navigate(`/audio-room/${newRoom.id}`);
    }
  } catch (err) {
    alert('Error creating room: ' + err.message);
  }
};
```

**Step 2: Update Joining Logic** (`AudioRoomsListPage.jsx`)

```javascript
import { verifyRoomPassword } from '../utils/passwordSecurity.js';

const handleJoinRoom = async (room) => {
  // If room is private, ask for password
  if (room.is_private) {
    const password = prompt(`This room is private. Enter password:`);
    if (!password) return;

    // Verify password against stored hash
    const isValid = await verifyRoomPassword(password, room.password_hash);

    if (!isValid) {
      alert('Incorrect password!');
      return;
    }
  }

  // Join room
  navigate(`/audio-room/${room.id}`, { replace: true });
};
```

**Step 3: Update Server** (`server.js`)

```javascript
// Add to room creation
app.post('/api/audio-rooms', apiLimiter, validateRoomCreation, (req, res) => {
  const {
    title,
    description,
    host_id,
    host_name,
    max_participants = 10,
    allow_chat = true,
    allow_media = false,
    is_private = false,        // NEW
    password_hash = null       // NEW - store hash only
  } = req.body;

  const newRoom = {
    id: Date.now().toString(),
    title,
    description,
    host_id,
    host_name,
    max_participants,
    is_active: true,
    allow_chat,
    allow_media,
    is_private,              // NEW
    password_hash,           // NEW
    allow_screen_share: false,
    is_muted_by_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  audioRooms.push(newRoom);
  roomParticipants[newRoom.id] = [];
  chatMessages[newRoom.id] = [];

  res.json(newRoom);
});
```

---

## 2. 📚 **COURSE ENROLLMENT CODES** (Medium Priority)

### **Current State: NO ENROLLMENT CODES**

**Where:** When teachers share courses with students

### **Problem:**
- Currently, all courses are publicly visible
- No way to restrict course access
- Teachers can't create private courses for specific students

### **Solution: Add Enrollment Codes**

**File:** `src/firebase.js` - Add new functions

```javascript
import { hashWithSalt, verifyWithSalt, generateSecureToken } from './utils/passwordSecurity.js';

// Teacher creates enrollment code
export const createEnrollmentCode = async (courseId, expiresInDays = 7) => {
  const code = generateSecureToken().substring(0, 12).toUpperCase(); // "A1B2C3D4E5F6"
  const { hash, salt } = hashWithSalt(code);

  const codeData = {
    courseId,
    codeHash: hash,
    salt: salt,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    usedBy: [],
    maxUses: 30 // Limit to 30 students
  };

  const docRef = await addDoc(collection(db, 'enrollmentCodes'), codeData);

  return {
    codeId: docRef.id,
    code: code, // Show this to teacher ONCE
    expiresAt: codeData.expiresAt
  };
};

// Student uses enrollment code
export const enrollWithCode = async (userId, providedCode) => {
  const codesSnapshot = await getDocs(
    query(
      collection(db, 'enrollmentCodes'),
      where('expiresAt', '>', new Date())
    )
  );

  for (const codeDoc of codesSnapshot.docs) {
    const { codeHash, salt, courseId, usedBy, maxUses } = codeDoc.data();

    // Verify code
    const isValid = verifyWithSalt(providedCode.toUpperCase(), codeHash, salt);

    if (isValid) {
      // Check if already used by this user
      if (usedBy.includes(userId)) {
        return { success: false, error: 'You already used this code' };
      }

      // Check max uses
      if (usedBy.length >= maxUses) {
        return { success: false, error: 'Code has reached maximum uses' };
      }

      // Enroll student
      await enrollInCourse(courseId, userId);

      // Update code usage
      await updateDoc(codeDoc.ref, {
        usedBy: arrayUnion(userId)
      });

      return { success: true, courseId };
    }
  }

  return { success: false, error: 'Invalid or expired code' };
};
```

**Usage in Course Page** (`src/pages/CoursePage.jsx`)

```javascript
// Teacher view - Generate code button
{isCreator && (
  <button onClick={handleGenerateCode}>
    Generate Enrollment Code
  </button>
)}

const handleGenerateCode = async () => {
  const { code, expiresAt } = await createEnrollmentCode(courseId);
  alert(`Share this code with students: ${code}\nExpires: ${expiresAt.toLocaleDateString()}`);
};

// Student view - Enter code
const handleEnrollWithCode = async () => {
  const code = prompt('Enter enrollment code:');
  if (!code) return;

  const result = await enrollWithCode(userId, code);

  if (result.success) {
    alert('Successfully enrolled!');
    window.location.reload();
  } else {
    alert(result.error);
  }
};
```

---

## 3. 🔑 **API KEYS** (Low Priority - Future Feature)

### **Current State: NOT IMPLEMENTED**

### **When You'll Need It:**
- If you add API access for schools
- Third-party integrations
- Mobile app authentication

### **Solution: API Key Management**

**File:** `src/firebase.js`

```javascript
import { createApiKey } from './utils/passwordSecurity.js';

// Generate API key for a school/organization
export const generateApiKey = async (organizationId, organizationName) => {
  const { apiKey, hash, salt } = createApiKey();

  await addDoc(collection(db, 'apiKeys'), {
    organizationId,
    organizationName,
    keyHash: hash,
    salt: salt,
    createdAt: new Date(),
    lastUsed: null,
    requestCount: 0,
    isActive: true
  });

  return apiKey; // Show ONCE, cannot be recovered
};

// Verify API key (use in backend)
export const verifyApiKey = async (providedKey) => {
  const keysSnapshot = await getDocs(
    query(
      collection(db, 'apiKeys'),
      where('isActive', '==', true)
    )
  );

  for (const keyDoc of keysSnapshot.docs) {
    const { keyHash, salt, organizationId } = keyDoc.data();
    const isValid = verifyWithSalt(providedKey, keyHash, salt);

    if (isValid) {
      // Update last used
      await updateDoc(keyDoc.ref, {
        lastUsed: new Date(),
        requestCount: increment(1)
      });

      return { valid: true, organizationId };
    }
  }

  return { valid: false };
};
```

---

## 4. 🔄 **PASSWORD RESET TOKENS** (Medium Priority)

### **Current State: Firebase Handles Basic Reset**

### **When You Need Custom Reset:**
- Custom reset UI
- Additional verification steps
- Reset via SMS

### **Solution:** (Reference only - Firebase already handles email reset)

```javascript
import { generatePasswordResetToken, verifyPasswordResetToken } from './utils/passwordSecurity.js';

// If you want CUSTOM password reset flow
export const requestCustomPasswordReset = async (email) => {
  const { token, hash, salt, expires } = generatePasswordResetToken();

  await addDoc(collection(db, 'passwordResets'), {
    email,
    tokenHash: hash,
    salt: salt,
    expires: expires,
    used: false
  });

  // Send email with token
  const resetLink = `https://your-app.com/reset-password?token=${token}`;
  // Send via your email service

  return { success: true };
};
```

---

## 5. 🎥 **MEETING RECORDING ACCESS** (Low Priority)

### **Current State: NO RECORDING FEATURE YET**

### **When You Add Recordings:**
- Private meeting recordings
- Limited-time access
- View count limits

### **Solution:**

```javascript
import { generateSecureToken, hashWithSalt, verifyWithSalt } from './utils/passwordSecurity.js';

// Generate temporary recording access
export const generateRecordingAccess = async (meetingId, userId, durationHours = 24) => {
  const token = generateSecureToken();
  const { hash, salt } = hashWithSalt(token);

  await addDoc(collection(db, 'recordingAccess'), {
    meetingId,
    userId,
    tokenHash: hash,
    salt: salt,
    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
    views: 0,
    maxViews: 5
  });

  return `https://your-app.com/recording/${meetingId}?token=${token}`;
};

// Verify recording access
export const verifyRecordingAccess = async (meetingId, providedToken) => {
  const accessSnapshot = await getDocs(
    query(
      collection(db, 'recordingAccess'),
      where('meetingId', '==', meetingId),
      where('expiresAt', '>', new Date())
    )
  );

  for (const accessDoc of accessSnapshot.docs) {
    const { tokenHash, salt, views, maxViews } = accessDoc.data();
    const isValid = verifyWithSalt(providedToken, tokenHash, salt);

    if (isValid && views < maxViews) {
      // Increment view count
      await updateDoc(accessDoc.ref, {
        views: views + 1
      });

      return { allowed: true, viewsRemaining: maxViews - views - 1 };
    }
  }

  return { allowed: false, error: 'Invalid, expired, or max views reached' };
};
```

---

## 📋 **Priority Summary**

| Feature | Priority | Impact | Effort |
|---------|----------|--------|--------|
| **1. Room Passwords** | 🔴 HIGH | Privacy for lessons | 2 hours |
| **2. Enrollment Codes** | 🟡 MEDIUM | Course access control | 3 hours |
| **3. API Keys** | 🟢 LOW | Future feature | 2 hours |
| **4. Password Reset** | 🟡 MEDIUM | Firebase handles | 1 hour |
| **5. Recording Access** | 🟢 LOW | Feature not built | 2 hours |

---

## 🚀 **Quick Implementation Guide**

### **Start with Room Passwords (Most Important)**

```bash
# 1. Already have the utilities file
# utils/passwordSecurity.js ✅

# 2. Import in AudioRoomsListPage.jsx
import { hashRoomPassword, verifyRoomPassword } from '../utils/passwordSecurity.js';

# 3. Update room creation (add password)
# 4. Update room joining (verify password)
# 5. Update server.js (store password_hash)

# Done! ✅
```

---

## ✅ **What You DON'T Need to Hash**

These are already handled by Firebase or don't need hashing:

- ❌ User login passwords (Firebase handles)
- ❌ OAuth tokens (Firebase handles)
- ❌ Session cookies (Firebase handles)
- ❌ User emails (no need to hash)
- ❌ User names (public data)
- ❌ Room titles (public data)
- ❌ Chat messages (need to be readable)

---

## 📖 **Files You Need to Modify**

### **For Room Passwords:**
1. `src/pages/AudioRoomsListPage.jsx` - Add password input
2. `src/pages/AudioRoomPage.jsx` - Verify before joining
3. `server.js` - Store password_hash field
4. `utils/passwordSecurity.js` - Already created ✅

### **For Enrollment Codes:**
1. `src/firebase.js` - Add code functions
2. `src/pages/CoursePage.jsx` - Add UI for codes
3. Create new Firestore collection: `enrollmentCodes`

---

## 🎯 **Bottom Line**

### **What Firebase Already Protects:**
✅ User passwords (bcrypt with salt)
✅ Authentication tokens
✅ OAuth flows

### **What YOU Need to Add Hashing For:**
1. 🔴 **Audio room passwords** (IMPLEMENT NOW)
2. 🟡 **Course enrollment codes** (IMPLEMENT SOON)
3. 🟢 **API keys** (WHEN YOU ADD API)
4. 🟢 **Recording access** (WHEN YOU ADD RECORDINGS)

---

## 📞 **Next Steps**

1. **Start with #1** - Room Passwords (highest impact)
2. **Test thoroughly** - Make sure hashing works
3. **Move to #2** - Enrollment codes
4. **Add #3-5** - When you build those features

**Total Implementation Time: 4-6 hours** ⏱️

**Security Improvement: MASSIVE** 🔒

Your user authentication is already secure thanks to Firebase, but these 5 areas will make your entire platform enterprise-grade secure! 🎉
