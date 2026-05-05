# 🔐 Hashing & Salting Guide for InstruMentor

## 📚 Table of Contents
1. [What is Hashing?](#what-is-hashing)
2. [What is Salting?](#what-is-salting)
3. [Why It Matters](#why-it-matters)
4. [Current Implementation (Firebase)](#current-implementation)
5. [Additional Use Cases for Your Project](#use-cases)
6. [Practical Examples](#practical-examples)
7. [Security Best Practices](#best-practices)

---

## 🎯 What is Hashing?

**Hashing** is a one-way cryptographic function that converts any input into a fixed-length string of random-looking characters.

### **Visual Example:**
```
Plain Password: "MySecretPassword123"
                     ↓ (hashing algorithm)
Hash Output:    "5f4dcc3b5aa765d61d8327deb882cf99"
```

### **Key Properties:**

| Property | Explanation | Example |
|----------|-------------|---------|
| **One-Way** | Cannot reverse to get original | Hash → ❌ Password |
| **Deterministic** | Same input = Same output | "hello" always → "5d41..." |
| **Fast** | Computes in milliseconds | < 1ms |
| **Avalanche Effect** | Tiny change = Different hash | "hello" vs "Hello" = Completely different |
| **Fixed Length** | Same length regardless of input | "hi" and "very long text" = 64 chars |

### **Common Hashing Algorithms:**

```javascript
// SHA-256 (Fast - for data integrity)
"password123" → "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"

// bcrypt (Slow - for passwords) ✅ BEST FOR PASSWORDS
"password123" → "$2b$12$KIXxBV7f2ydT3hCJ8f5u4eF9LZxQQxGN9x8y7z6a5b4c3d2e1f0g1h"

// MD5 (Obsolete - DO NOT USE)
"password123" → "482c811da5d5b4bc6d497ffa98491e38"
```

---

## 🧂 What is Salting?

**Salting** is adding random data to passwords **before** hashing to prevent rainbow table attacks.

### **Without Salt (VULNERABLE):**
```javascript
User 1: "password123" → Hash: "ef92b778..."
User 2: "password123" → Hash: "ef92b778..." // SAME HASH!

// Attacker sees duplicate hashes:
// "Both users have the same password!"
// "I can crack one and get both accounts!"
```

### **With Salt (SECURE):**
```javascript
User 1: "password123" + "random_salt_1" → Hash: "a1b2c3d4..."
User 2: "password123" + "random_salt_2" → Hash: "x9y8z7w6..."

// Different hashes even with same password!
// Attacker must crack each individually
```

### **How It Works:**
```
1. Generate random salt: "r4nd0m$alt123"
2. Combine with password: "MyPassword" + "r4nd0m$alt123"
3. Hash the combination: SHA-256("MyPasswordr4nd0m$alt123")
4. Store BOTH in database:
   {
     hash: "9f8e7d6c5b4a3210...",
     salt: "r4nd0m$alt123"
   }
```

### **Why Salt?**

**Rainbow Tables** are pre-computed hash tables:
```
Plain Text      → Hash
"password"      → "5f4dcc..."
"password123"   → "482c81..."
"qwerty"        → "d8578e..."
```

**With salt**, attackers can't use pre-computed tables:
```
"password" + "randomsalt1" → "unique_hash_1"
"password" + "randomsalt2" → "unique_hash_2"
```

---

## ❓ Why It Matters for Your Project

### **Scenarios Where Data Needs Protection:**

| Data Type | Risk Without Hashing | Solution |
|-----------|---------------------|----------|
| **User Passwords** | Attacker sees plain text | ✅ Firebase handles this |
| **Room Passwords** | Private rooms exposed | ✅ Hash room passwords |
| **API Keys** | Keys stolen from DB | ✅ Hash API keys |
| **Reset Tokens** | Tokens hijacked | ✅ Hash reset tokens |
| **Session IDs** | Session hijacking | ✅ Hash session IDs |

---

## 🔥 Current Implementation (Firebase)

### **Good News: Firebase Handles Your Authentication!**

```javascript
// Your current code: src/firebase.js
const signUpWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);
```

**What Firebase Does Automatically:**
1. ✅ Generates unique salt for each user
2. ✅ Uses **bcrypt** algorithm (industry standard)
3. ✅ Stores hash + salt (never plain password)
4. ✅ Uses 10+ rounds of hashing (slow to crack)
5. ✅ Handles verification automatically

**Firebase Password Storage:**
```
User enters: "MyPassword123"
            ↓
Firebase generates: salt = "randomsalt123"
            ↓
Firebase combines: "MyPassword123" + "randomsalt123"
            ↓
Firebase hashes: bcrypt(combined, 12 rounds)
            ↓
Firebase stores: {
  hash: "$2b$12$KIXxBV7f2ydT3hCJ8f5u4e...",
  salt: "randomsalt123"
}
```

**Verification Process:**
```
User logs in: "MyPassword123"
            ↓
Firebase retrieves: stored hash + salt
            ↓
Firebase combines: "MyPassword123" + stored_salt
            ↓
Firebase hashes: bcrypt(combined, 12 rounds)
            ↓
Firebase compares: new_hash === stored_hash ✅
```

**So your user passwords are ALREADY SECURE!** 🎉

---

## 💡 Additional Use Cases for Your Project

While Firebase handles authentication, here are **5 specific features** in your project that SHOULD use hashing/salting:

### **1. Private Audio/Video Room Passwords**

**Current State:** No password protection
**Problem:** Anyone with room ID can join

**Solution with Hashing:**

```javascript
// When creating a private room
import { hashRoomPassword } from '../utils/passwordSecurity.js';

const createPrivateRoom = async (roomData) => {
  const hashedPassword = await hashRoomPassword(roomData.password);

  const room = {
    id: Date.now().toString(),
    title: roomData.title,
    passwordHash: hashedPassword, // Store hash, NOT plain password
    isPrivate: true,
    ...roomData
  };

  return room;
};

// When user tries to join
import { verifyRoomPassword } from '../utils/passwordSecurity.js';

const joinPrivateRoom = async (roomId, userPassword) => {
  const room = await getRoom(roomId);

  if (room.isPrivate) {
    const isValid = await verifyRoomPassword(userPassword, room.passwordHash);

    if (!isValid) {
      throw new Error('Incorrect room password');
    }
  }

  // Join room...
};
```

**Benefit:** Even if database is compromised, attacker can't see room passwords!

### **2. API Keys for Third-Party Integrations**

**Use Case:** If you want to give teachers API keys to integrate with their school systems

```javascript
import { createApiKey } from '../utils/passwordSecurity.js';

// Generate API key for a teacher
const generateTeacherApiKey = async (teacherId) => {
  const { apiKey, hash, salt } = createApiKey();

  // Store in database
  await db.collection('apiKeys').add({
    teacherId,
    keyHash: hash,    // Store hash only
    salt: salt,
    createdAt: new Date()
  });

  // Show to teacher ONCE (cannot be recovered later)
  return apiKey; // "abc123def456..." - ONLY TIME IT'S SHOWN
};

// Verify API key on requests
const verifyApiKey = async (providedKey) => {
  const keys = await db.collection('apiKeys').get();

  for (const keyDoc of keys.docs) {
    const { keyHash, salt } = keyDoc.data();
    const isValid = verifyWithSalt(providedKey, keyHash, salt);

    if (isValid) {
      return { valid: true, teacherId: keyDoc.data().teacherId };
    }
  }

  return { valid: false };
};
```

### **3. Course Enrollment Codes**

**Use Case:** Teachers create enrollment codes for students

```javascript
// Teacher creates course enrollment code
const createEnrollmentCode = async (courseId) => {
  const code = generateSecureToken(); // Random code
  const { hash, salt } = hashWithSalt(code);

  await db.collection('enrollmentCodes').add({
    courseId,
    codeHash: hash,
    salt: salt,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    usedBy: []
  });

  return code; // "enrollment-abc123" - Show to teacher
};

// Student uses enrollment code
const enrollWithCode = async (studentId, providedCode) => {
  const codes = await db.collection('enrollmentCodes')
    .where('expiresAt', '>', new Date())
    .get();

  for (const codeDoc of codes.docs) {
    const { codeHash, salt, courseId, usedBy } = codeDoc.data();
    const isValid = verifyWithSalt(providedCode, codeHash, salt);

    if (isValid && !usedBy.includes(studentId)) {
      // Enroll student
      await enrollInCourse(courseId, studentId);

      // Mark code as used
      await codeDoc.ref.update({
        usedBy: [...usedBy, studentId]
      });

      return { success: true, courseId };
    }
  }

  return { success: false, error: 'Invalid or expired code' };
};
```

### **4. Password Reset Tokens**

**Use Case:** Secure password reset via email

```javascript
import { generatePasswordResetToken, verifyPasswordResetToken } from '../utils/passwordSecurity.js';

// User requests password reset
const requestPasswordReset = async (email) => {
  const { token, hash, salt, expires } = generatePasswordResetToken();

  // Store in database
  await db.collection('passwordResets').add({
    email,
    tokenHash: hash,
    salt: salt,
    expires: expires,
    used: false
  });

  // Send email with token
  await sendEmail({
    to: email,
    subject: 'Password Reset',
    body: `Click here: https://your-app.com/reset?token=${token}`
  });
};

// User clicks link and submits new password
const resetPassword = async (token, newPassword) => {
  const resets = await db.collection('passwordResets')
    .where('used', '==', false)
    .get();

  for (const resetDoc of resets.docs) {
    const { tokenHash, salt, expires, email } = resetDoc.data();

    const { valid, reason } = verifyPasswordResetToken(
      token,
      tokenHash,
      salt,
      expires
    );

    if (valid) {
      // Reset password in Firebase
      // (Firebase Admin SDK required for server-side)

      // Mark token as used
      await resetDoc.ref.update({ used: true });

      return { success: true };
    }
  }

  return { success: false, error: 'Invalid or expired token' };
};
```

### **5. Meeting Recording Access Tokens**

**Use Case:** Temporary access links for viewing recordings

```javascript
// Generate temporary access token for recording
const generateRecordingAccessToken = async (meetingId, userId) => {
  const token = generateSecureToken();
  const { hash, salt } = hashWithSalt(token);

  await db.collection('recordingAccess').add({
    meetingId,
    userId,
    tokenHash: hash,
    salt: salt,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    views: 0,
    maxViews: 5
  });

  // Return shareable link
  return `https://your-app.com/recording/${meetingId}?token=${token}`;
};

// Verify token when accessing recording
const accessRecording = async (meetingId, providedToken) => {
  const access = await db.collection('recordingAccess')
    .where('meetingId', '==', meetingId)
    .where('expiresAt', '>', new Date())
    .get();

  for (const accessDoc of access.docs) {
    const { tokenHash, salt, views, maxViews } = accessDoc.data();
    const isValid = verifyWithSalt(providedToken, tokenHash, salt);

    if (isValid && views < maxViews) {
      // Increment view count
      await accessDoc.ref.update({ views: views + 1 });

      return { allowed: true, viewsRemaining: maxViews - views - 1 };
    }
  }

  return { allowed: false, error: 'Invalid, expired, or max views reached' };
};
```

---

## 📖 Practical Examples

### **Example 1: Hash vs Plain Text Storage**

```javascript
// ❌ BAD: Storing plain password (NEVER DO THIS!)
const room = {
  id: '123',
  title: 'Private Music Lesson',
  password: 'secret123' // Attacker can see this!
};

// ✅ GOOD: Storing hashed password
import { hashRoomPassword } from '../utils/passwordSecurity.js';

const hashedPassword = await hashRoomPassword('secret123');
const room = {
  id: '123',
  title: 'Private Music Lesson',
  passwordHash: '$2b$12$KIXxBV7f2...' // Attacker cannot reverse this!
};
```

### **Example 2: Timing Attack Prevention**

```javascript
// ❌ BAD: Regular comparison (vulnerable to timing attacks)
const verifyToken = (inputToken, storedToken) => {
  return inputToken === storedToken; // Takes different time based on where mismatch occurs
};

// ✅ GOOD: Constant-time comparison
import { secureCompare } from '../utils/passwordSecurity.js';

const verifyToken = (inputToken, storedToken) => {
  return secureCompare(inputToken, storedToken); // Always takes same time
};
```

**Why?** Attackers can measure response time to guess tokens character by character!

### **Example 3: Strong vs Weak Hashing**

```javascript
// ❌ WEAK: MD5 (broken, fast to crack)
const weakHash = crypto.createHash('md5').update('password').digest('hex');
// Can crack billions per second!

// ⚠️ OK: SHA-256 (better, but still too fast for passwords)
const okHash = crypto.createHash('sha256').update('password').digest('hex');
// Can crack millions per second

// ✅ STRONG: bcrypt (slow by design, perfect for passwords)
const strongHash = await bcrypt.hash('password', 12);
// Only thousands per second (takes ~200ms per attempt)
```

**Rule:** For passwords, ALWAYS use bcrypt, scrypt, or Argon2!

---

## 🛡️ Security Best Practices

### **1. Never Store Plain Passwords**
```javascript
❌ password: "MyPassword123"
✅ passwordHash: "$2b$12$..."
```

### **2. Use Strong Algorithms**
```javascript
✅ bcrypt (for passwords)
✅ SHA-256 (for data integrity)
❌ MD5 (broken)
❌ SHA-1 (broken)
```

### **3. Use Sufficient Salt Length**
```javascript
❌ salt: "abc"              // 3 bytes - TOO SHORT
✅ salt: crypto.randomBytes(32) // 32 bytes - GOOD
```

### **4. Use High Cost Factor (bcrypt)**
```javascript
❌ bcrypt.hash(password, 4)  // TOO FAST
✅ bcrypt.hash(password, 12) // GOOD (takes ~200ms)
```

### **5. Don't Invent Your Own Crypto**
```javascript
❌ myCustomHash = password + "salt" + reverse(password) // INSECURE
✅ bcrypt.hash(password, salt) // USE PROVEN LIBRARIES
```

### **6. Store Salt with Hash**
```javascript
// Database record:
{
  userId: "123",
  passwordHash: "$2b$12$KIXxBV7f...",
  // Salt is embedded in bcrypt hash (after $12$)
  // No need to store separately!
}
```

### **7. Use Constant-Time Comparison**
```javascript
❌ if (token === storedToken) // Timing attack vulnerable
✅ if (crypto.timingSafeEqual(token, storedToken)) // Safe
```

---

## 📊 Hash Algorithm Comparison

| Algorithm | Type | Speed | Use Case | Security |
|-----------|------|-------|----------|----------|
| **bcrypt** | Slow | ~200ms | Passwords | ⭐⭐⭐⭐⭐ Excellent |
| **Argon2** | Slow | ~100ms | Passwords | ⭐⭐⭐⭐⭐ Excellent |
| **scrypt** | Slow | ~150ms | Passwords | ⭐⭐⭐⭐ Very Good |
| **SHA-256** | Fast | <1ms | Data integrity | ⭐⭐⭐ Good (NOT for passwords) |
| **SHA-1** | Fast | <1ms | Legacy | ⭐ Broken |
| **MD5** | Fast | <1ms | Checksums | ❌ Broken |

---

## 🚀 Quick Implementation Guide

### **Step 1: Install Dependencies**
```bash
npm install bcrypt
```

### **Step 2: Import Utilities**
```javascript
import {
  hashPassword,
  verifyPassword,
  hashWithSalt,
  verifyWithSalt
} from './utils/passwordSecurity.js';
```

### **Step 3: Hash Sensitive Data**
```javascript
// For passwords
const hashedPassword = await hashPassword('userPassword123');

// For API keys, tokens, etc.
const { hash, salt } = hashWithSalt('apiKey123');
```

### **Step 4: Verify Data**
```javascript
// Verify password
const isValid = await verifyPassword('userInput', storedHash);

// Verify token
const isValid = verifyWithSalt('tokenInput', storedHash, storedSalt);
```

---

## ✅ Summary

### **What You Learned:**
1. ✅ **Hashing** = One-way encryption (can't reverse)
2. ✅ **Salting** = Random data added before hashing
3. ✅ **Firebase** already handles password hashing
4. ✅ **Use bcrypt** for passwords (slow = secure)
5. ✅ **Never store plain passwords or tokens**

### **Where to Use in Your Project:**
1. ✅ Private room passwords
2. ✅ API keys for integrations
3. ✅ Course enrollment codes
4. ✅ Password reset tokens
5. ✅ Recording access tokens

### **Key Takeaways:**
- 🔐 **Hashing + Salting** = Industry standard for security
- ⚡ **Firebase handles** user authentication (you're covered!)
- 🎯 **Additional use cases** exist in your project
- 🛡️ **Always hash** sensitive data before storing
- ❌ **Never invent** your own crypto

**Your passwords are secure thanks to Firebase, and now you know how to protect other sensitive data too!** 🎉
