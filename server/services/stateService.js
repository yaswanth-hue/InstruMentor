const memoryState = {
    rooms: new Map(),
    participants: new Map(),
    messages: new Map(),
    sessions: new Map(),
    lockedRooms: new Map(),
    meetings: new Map(),
    progress: new Map()
};

export const stateService = {
    async getRooms() {
        return Array.from(memoryState.rooms.values());
    },

    async getRoom(roomId) {
        return memoryState.rooms.get(roomId) ?? null;
    },

    async createRoom(room) {
        memoryState.rooms.set(room.id, room);
        return room;
    },

    async updateRoom(roomId, updates) {
        const room = memoryState.rooms.get(roomId);
        if (!room) return null;

        Object.assign(room, updates);
        room.updated_at = new Date().toISOString();
        return room;
    },

    async deleteRoom(roomId) {
        memoryState.rooms.delete(roomId);
        memoryState.participants.delete(roomId);
        memoryState.messages.delete(roomId);
    },

    async getParticipants(roomId) {
        return memoryState.participants.get(roomId) || [];
    },

    async addParticipant(roomId, participant) {
        if (!memoryState.participants.has(roomId)) {
            memoryState.participants.set(roomId, []);
        }
        const list = memoryState.participants.get(roomId);
        const idx = list.findIndex(p => p.userId === participant.userId);
        if (idx !== -1) list.splice(idx, 1);
        list.push(participant);
    },

    async removeParticipant(roomId, userId) {
        const list = memoryState.participants.get(roomId);
        if (!list) return;

        const idx = list.findIndex(p => p.userId === userId);
        if (idx !== -1) list.splice(idx, 1);
    },

    async getMessages(roomId) {
        return memoryState.messages.get(roomId) || [];
    },

    async addMessage(roomId, message) {
        if (!memoryState.messages.has(roomId)) {
            memoryState.messages.set(roomId, []);
        }
        const messages = memoryState.messages.get(roomId);
        messages.push(message);
        if (messages.length > 500) {
            messages.splice(0, messages.length - 500);
        }
    },

    async getUserSession(email) {
        return memoryState.sessions.get(email) ?? null;
    },

    async setUserSession(email, sessionData) {
        memoryState.sessions.set(email, sessionData);
    },

    async removeUserSession(email) {
        memoryState.sessions.delete(email);
    },

    async isRoomLocked(roomId) {
        return memoryState.lockedRooms.get(roomId) || false;
    },

    async setRoomLocked(roomId, locked) {
        memoryState.lockedRooms.set(roomId, locked);
    },

    async getMeetings(courseId) {
        return memoryState.meetings.get(courseId) || [];
    },

    async getAllMeetings() {
        return Array.from(memoryState.meetings.values()).flat();
    },

    async getMeeting(meetingId) {
        const allMeetings = await this.getAllMeetings();
        return allMeetings.find(m => m.id === meetingId) ?? null;
    },

    async saveMeeting(meeting) {
        if (!memoryState.meetings.has(meeting.courseId)) {
            memoryState.meetings.set(meeting.courseId, []);
        }
        memoryState.meetings.get(meeting.courseId).push(meeting);
        return meeting;
    },

    async updateMeeting(meetingId, updates) {
        const meeting = await this.getMeeting(meetingId);
        if (!meeting) return null;

        const updatedMeeting = { ...meeting, ...updates };
        const list = memoryState.meetings.get(meeting.courseId);
        const idx = list.findIndex(m => m.id === meetingId);
        if (idx !== -1) {
            list[idx] = updatedMeeting;
        }
        return updatedMeeting;
    },

    async getProgress(userId, meetingId) {
        const key = `${userId}_${meetingId}`;
        return memoryState.progress.get(key) ?? null;
    },

    async saveProgress(userId, meetingId, progressData) {
        const key = `${userId}_${meetingId}`;
        memoryState.progress.set(key, progressData);
    }
};
