import { client } from '../config/redis.js';

const KEY_PREFIX = 'instrumentor:';
const ROOMS_KEY = `${KEY_PREFIX}rooms`;
const ROOM_PARTICIPANTS_PREFIX = `${KEY_PREFIX}room:participants:`;
const ROOM_MESSAGES_PREFIX = `${KEY_PREFIX}room:messages:`;
const ROOM_TTL = 24 * 60 * 60; // 24 hours

// Fallback in-memory state if Redis is down
const memoryState = {
    rooms: new Map(),
    participants: new Map(),
    messages: new Map(),
    sessions: new Map(),
    lockedRooms: new Map(),
    meetings: new Map(), // courseId -> [meetings]
    progress: new Map()
};

const LOCKED_ROOMS_KEY = `${KEY_PREFIX}rooms:locked`;
const MEETINGS_PREFIX = `${KEY_PREFIX}meetings:`;  // courseId -> meetings
const PROGRESS_PREFIX = `${KEY_PREFIX}progress:`;

const isRedisAvailable = () => client.isOpen;

export const stateService = {
    // Rooms
    async getRooms() {
        if (!isRedisAvailable()) return Array.from(memoryState.rooms.values());

        const rooms = await client.hVals(ROOMS_KEY);
        return rooms.map(r => JSON.parse(r));
    },

    async getRoom(roomId) {
        if (!isRedisAvailable()) return memoryState.rooms.get(roomId);

        const room = await client.hGet(ROOMS_KEY, roomId);
        return room ? JSON.parse(room) : null;
    },

    async createRoom(room) {
        if (!isRedisAvailable()) {
            memoryState.rooms.set(room.id, room);
            return room;
        }

        await client.hSet(ROOMS_KEY, room.id, JSON.stringify(room));
        return room;
    },

    async updateRoom(roomId, updates) {
        if (!isRedisAvailable()) {
            const room = memoryState.rooms.get(roomId);
            if (room) {
                Object.assign(room, updates);
                room.updated_at = new Date().toISOString();
                return room;
            }
            return null;
        }

        const roomStr = await client.hGet(ROOMS_KEY, roomId);
        if (!roomStr) return null;

        const room = JSON.parse(roomStr);
        Object.assign(room, updates);
        room.updated_at = new Date().toISOString();

        await client.hSet(ROOMS_KEY, roomId, JSON.stringify(room));
        return room;
    },

    async deleteRoom(roomId) {
        if (!isRedisAvailable()) {
            memoryState.rooms.delete(roomId);
            memoryState.participants.delete(roomId);
            memoryState.messages.delete(roomId);
            return;
        }

        await client.hDel(ROOMS_KEY, roomId);
        await client.del(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        await client.del(`${ROOM_MESSAGES_PREFIX}${roomId}`);
    },

    // Participants
    async getParticipants(roomId) {
        if (!isRedisAvailable()) return memoryState.participants.get(roomId) || [];

        const participants = await client.hVals(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        return participants.map(p => JSON.parse(p));
    },

    async addParticipant(roomId, participant) {
        if (!isRedisAvailable()) {
            if (!memoryState.participants.has(roomId)) {
                memoryState.participants.set(roomId, []);
            }
            const list = memoryState.participants.get(roomId);
            // Remove existing if any (update)
            const idx = list.findIndex(p => p.userId === participant.userId);
            if (idx !== -1) list.splice(idx, 1);
            list.push(participant);
            return;
        }

        await client.hSet(
            `${ROOM_PARTICIPANTS_PREFIX}${roomId}`,
            participant.userId,
            JSON.stringify(participant)
        );
        // Refresh TTL
        await client.expire(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`, ROOM_TTL);
    },

    async removeParticipant(roomId, userId) {
        if (!isRedisAvailable()) {
            const list = memoryState.participants.get(roomId);
            if (list) {
                const idx = list.findIndex(p => p.userId === userId);
                if (idx !== -1) list.splice(idx, 1);
            }
            return;
        }

        await client.hDel(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`, userId);
    },

    // Messages
    async getMessages(roomId) {
        if (!isRedisAvailable()) return memoryState.messages.get(roomId) || [];

        const messages = await client.lRange(`${ROOM_MESSAGES_PREFIX}${roomId}`, 0, -1);
        return messages.map(m => JSON.parse(m)).reverse(); // Redis stores newest first (LPUSH)
    },

    async addMessage(roomId, message) {
        if (!isRedisAvailable()) {
            if (!memoryState.messages.has(roomId)) {
                memoryState.messages.set(roomId, []);
            }
            memoryState.messages.get(roomId).push(message);
            return;
        }

        await client.lPush(`${ROOM_MESSAGES_PREFIX}${roomId}`, JSON.stringify(message));
        // Cap messages at 500
        await client.lTrim(`${ROOM_MESSAGES_PREFIX}${roomId}`, 0, 499);
        await client.expire(`${ROOM_MESSAGES_PREFIX}${roomId}`, ROOM_TTL);
    },

    // User Sessions
    async getUserSession(email) {
        if (!isRedisAvailable()) return memoryState.sessions.get(email);

        const session = await client.hGet(SESSIONS_KEY, email);
        return session ? JSON.parse(session) : null;
    },

    async setUserSession(email, sessionData) {
        if (!isRedisAvailable()) {
            memoryState.sessions.set(email, sessionData);
            return;
        }

        await client.hSet(SESSIONS_KEY, email, JSON.stringify(sessionData));
    },

    async removeUserSession(email) {
        if (!isRedisAvailable()) {
            memoryState.sessions.delete(email);
            return;
        }

        await client.hDel(SESSIONS_KEY, email);
    },

    // Locked Rooms
    async isRoomLocked(roomId) {
        if (!isRedisAvailable()) return memoryState.lockedRooms.get(roomId) || false;

        const isLocked = await client.hGet(LOCKED_ROOMS_KEY, roomId);
        return isLocked === 'true';
    },

    async setRoomLocked(roomId, locked) {
        if (!isRedisAvailable()) {
            memoryState.lockedRooms.set(roomId, locked);
            return;
        }

        if (locked) {
            await client.hSet(LOCKED_ROOMS_KEY, roomId, 'true');
        } else {
            await client.hDel(LOCKED_ROOMS_KEY, roomId);
        }
    },

    // Meetings (grouped by courseId)
    async getMeetings(courseId) {
        if (!isRedisAvailable()) return memoryState.meetings.get(courseId) || [];

        const meetings = await client.lRange(`${MEETINGS_PREFIX}${courseId}`, 0, -1);
        return meetings.map(m => JSON.parse(m));
    },

    async getAllMeetings() {
        if (!isRedisAvailable()) {
            // Flatten map values
            return Array.from(memoryState.meetings.values()).flat();
        }

        // Scan for all meeting keys
        const keys = await client.keys(`${MEETINGS_PREFIX}*`);
        let allMeetings = [];
        for (const key of keys) {
            const meetings = await client.lRange(key, 0, -1);
            allMeetings = allMeetings.concat(meetings.map(m => JSON.parse(m)));
        }
        return allMeetings;
    },

    async getMeeting(meetingId) {
        // Since meetings are stored in lists by courseId, this is inefficient in Redis without an index.
        // We'll iterate all meetings or maintain a secondary index. 
        // For simplicity/parity with original, we'll iterate.
        const allMeetings = await this.getAllMeetings();
        return allMeetings.find(m => m.id === meetingId);
    },

    async saveMeeting(meeting) {
        if (!isRedisAvailable()) {
            if (!memoryState.meetings.has(meeting.courseId)) {
                memoryState.meetings.set(meeting.courseId, []);
            }
            memoryState.meetings.get(meeting.courseId).push(meeting);
            return meeting;
        }

        await client.lPush(`${MEETINGS_PREFIX}${meeting.courseId}`, JSON.stringify(meeting));
        return meeting;
    },

    async updateMeeting(meetingId, updates) {
        const meeting = await this.getMeeting(meetingId);
        if (!meeting) return null;

        const updatedMeeting = { ...meeting, ...updates };

        // We need to update it in the list. This is tricky in Redis lists.
        // We have to remove the old one and add the new one, or rewrite the list.
        // simpler: read all, update, write back.
        if (!isRedisAvailable()) {
            const list = memoryState.meetings.get(meeting.courseId);
            const idx = list.findIndex(m => m.id === meetingId);
            if (idx !== -1) {
                list[idx] = updatedMeeting;
            }
            return updatedMeeting;
        }

        // Redis implementation:
        const key = `${MEETINGS_PREFIX}${meeting.courseId}`;
        const meetings = await client.lRange(key, 0, -1);
        const parsedMeetings = meetings.map(m => JSON.parse(m));
        const idx = parsedMeetings.findIndex(m => m.id === meetingId);

        if (idx !== -1) {
            parsedMeetings[idx] = updatedMeeting;
            await client.del(key);
            // Push back in reverse order to maintain order? Or just push all.
            // lRange 0 -1 returns first to last. lPush adds to head.
            // If we utilize rPush we can reconstruct order.
            for (const m of parsedMeetings) {
                await client.rPush(key, JSON.stringify(m));
            }
        }
        return updatedMeeting;
    },

    // Progress
    async getProgress(userId, meetingId) {
        const key = `${userId}_${meetingId}`;
        if (!isRedisAvailable()) return memoryState.progress.get(key);

        const progress = await client.hGet(PROGRESS_PREFIX, key);
        return progress ? JSON.parse(progress) : null;
    },

    async saveProgress(userId, meetingId, progressData) {
        const key = `${userId}_${meetingId}`;
        if (!isRedisAvailable()) {
            memoryState.progress.set(key, progressData);
            return;
        }

        await client.hSet(PROGRESS_PREFIX, key, JSON.stringify(progressData));
    }
};
