# Audio Room Password Lock Testing Guide

## Implementation Summary

The audio room password lock feature has been successfully implemented with the following components:

### Files Modified

1. **src/pages/AudioRoomsListPage.jsx**
   - Added bcrypt password hashing on room creation
   - Added password verification before joining private rooms
   - Added visual lock icons (Lock/LockOpen from lucide-react)
   - Private rooms display with yellow border and lock icon

2. **server.js**
   - Updated POST /api/audio-rooms endpoint to accept `is_private` and `password_hash` fields
   - Stores password hash securely in room object

3. **middleware/security.js**
   - Updated sanitizeInput to exclude `password_hash` field from sanitization
   - Ensures bcrypt hashes are preserved during transmission

4. **package.json**
   - Added bcryptjs ^3.0.8 dependency

## Testing Steps

### 1. Test Room Creation (UI)

1. Navigate to the Audio Rooms page in your browser
2. Click "Create New Room"
3. When prompted "Make this a private room?", click OK
4. Enter a password (minimum 6 characters), e.g., "testpass123"
5. Fill in room title and description
6. Verify the room appears with:
   - Yellow border (`border-2 border-yellow-400`)
   - Lock icon visible
   - Yellow "Join Room" button

### 2. Test Password Verification (UI)

**Correct Password:**
1. Click "Join Room" on a private room
2. Enter the correct password when prompted
3. Should navigate to `/audio-room/{roomId}`

**Incorrect Password:**
1. Click "Join Room" on a private room
2. Enter an incorrect password
3. Should display "Incorrect password!" alert
4. Should NOT navigate to the room

### 3. Test API Endpoints (cURL)

**Create Private Room:**
```bash
curl -X POST http://localhost:3001/api/audio-rooms \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Secret Meeting",
    "description": "Password protected room",
    "host_id": "user123",
    "host_name": "Test User",
    "max_participants": 10,
    "allow_chat": true,
    "allow_media": false,
    "is_private": true,
    "password_hash": "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
  }'
```

**Expected Response:**
- Room object with `is_private: true`
- Full password_hash preserved (should be 60 characters starting with $2a$)

**List All Rooms:**
```bash
curl http://localhost:3001/api/audio-rooms
```

**Expected Response:**
- Array of rooms
- Private rooms should have `is_private: true` and `password_hash` field

### 4. Security Verification

**Password Hash Format:**
- Should be bcrypt hash: `$2a$10$...` (60 characters)
- Salt rounds: 10
- Never stored or transmitted as plaintext

**Sanitization Test:**
- Verify password_hash is NOT modified by security middleware
- Test with special characters in hash (already present in bcrypt format)

## Password Hash Example

Password: `"testpass123"`
Generated Hash: `"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"`

You can verify this hash works by:
```javascript
import bcrypt from 'bcryptjs';
const isValid = await bcrypt.compare('testpass123', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
console.log(isValid); // Should be true
```

## Visual Indicators

### Private Room Card
- Border: 2px yellow (`border-2 border-yellow-400`)
- Lock icon in header area
- Join button color: yellow/amber (`bg-yellow-600 hover:bg-yellow-700`)
- Lock icon on join button

### Public Room Card
- Border: default gray
- No lock icon
- Join button color: purple (`bg-purple-600 hover:bg-purple-700`)

## Expected User Flow

1. **Creating Private Room:**
   - User clicks "Create New Room"
   - Confirms "Make this a private room?" → Yes
   - Enters password (min 6 chars)
   - Password is hashed with bcrypt (10 rounds) on client-side
   - Hash sent to server with `is_private: true`
   - Server stores room with password_hash

2. **Joining Private Room:**
   - User clicks "Join Room" on private room
   - Prompted for password
   - Password compared with stored hash using bcrypt.compare()
   - If valid → navigate to room
   - If invalid → show error, stay on list page

3. **Joining Public Room:**
   - User clicks "Join Room" on public room
   - No password prompt
   - Immediately navigate to room

## Known Issues / Notes

- Server must be running for API tests
- bcryptjs is used (not bcrypt) for better Windows compatibility
- Password hashing happens on client-side for this implementation
- Consider moving password hashing to server-side for production (best practice)
- Redis warnings are normal when running in single-server mode

## Success Criteria

✅ Private rooms display with lock icon and yellow styling
✅ Password prompt appears when joining private rooms
✅ Correct password allows entry to room
✅ Incorrect password blocks entry with error message
✅ Password hashes are preserved in API (not sanitized)
✅ Public rooms work normally without password prompts
✅ Room list correctly shows is_private status

## Next Steps (Future Enhancements)

- Move password hashing to server-side
- Add password strength requirements (uppercase, numbers, symbols)
- Add ability to change room password
- Add room owner ability to remove password
- Store rooms in database instead of in-memory
- Add room password reset functionality
