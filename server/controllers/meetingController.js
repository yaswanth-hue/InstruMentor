import { stateService } from '../services/stateService.js';
import { v4 as uuidv4 } from 'uuid';

export const createMeeting = async (req, res) => {
    const { courseId } = req.params;
    const { title, description, scheduledTime, hostId, hostName, hostEmail, allowedEmails = [] } = req.body;

    const meeting = {
        id: uuidv4(),
        courseId,
        title,
        description,
        scheduledTime: new Date(scheduledTime),
        hostId,
        hostName,
        hostEmail,
        allowedEmails: [...allowedEmails, hostEmail],
        isActive: false,
        isRecording: false,
        recordingUrl: null,
        materials: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await stateService.saveMeeting(meeting);
    res.json(meeting);
};

export const getCourseMeetings = async (req, res) => {
    const meetings = await stateService.getMeetings(req.params.courseId);
    res.json(meetings);
};

export const getMeeting = async (req, res) => {
    const meeting = await stateService.getMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json(meeting);
};

export const startMeeting = async (req, res) => {
    const { meetingId } = req.params;
    const { hostId } = req.body;

    const meeting = await stateService.getMeeting(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.hostId !== hostId) {
        return res.status(403).json({ error: 'Only the host can start the meeting' });
    }

    const updates = {
        isActive: true,
        startedAt: new Date().toISOString()
    };

    const updatedMeeting = await stateService.updateMeeting(meetingId, updates);

    if (req.io) {
        req.io.emit('meeting-started', { meetingId, courseId: meeting.courseId });
    }

    res.json(updatedMeeting);
};

export const endMeeting = async (req, res) => {
    const { meetingId } = req.params;
    const { hostId } = req.body;

    // Logic from server.js: just notify and cleanup
    // We should probably update isActive to false in DB too
    const meeting = await stateService.getMeeting(meetingId);

    if (meeting) {
        // If we want to strictly check host
        // if (meeting.hostId !== hostId) ...

        await stateService.updateMeeting(meetingId, { isActive: false, endedAt: new Date().toISOString() });
    }

    if (req.io) {
        req.io.to(meetingId).emit('room-closed');
    }

    // Clear participants in state
    // await stateService.deleteRoom(meetingId); // Wait, this deletes chat history too. Maybe just remove participants?
    // Original server.js did: roomParticipants[meetingId] = []

    // We should probably keep chat history for meetings?
    //server.js: 
    // delete chatMessages[roomId]? No, only for audio-rooms delete endpoint.
    // For end meeting: roomParticipants[meetingId] = []

    const participants = await stateService.getParticipants(meetingId);
    for (const p of participants) {
        await stateService.removeParticipant(meetingId, p.userId);
    }

    res.json({ success: true, message: 'Meeting ended' });
};

export const saveProgress = async (req, res) => {
    const { meetingId } = req.params;
    const { userId, watchedDuration, totalDuration, completed } = req.body;

    const progressData = {
        userId,
        meetingId,
        watchedDuration,
        totalDuration,
        completed: completed || false,
        progressPercentage: Math.round((watchedDuration / totalDuration) * 100),
        lastWatched: new Date().toISOString()
    };

    await stateService.saveProgress(userId, meetingId, progressData);
    res.json(progressData);
};

export const getCourseProgress = async (req, res) => {
    const { courseId, userId } = req.params;
    const meetings = await stateService.getMeetings(courseId);

    const progressPromises = meetings.map(async (meeting) => {
        const userProgress = await stateService.getProgress(userId, meeting.id);

        return {
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            scheduledTime: meeting.scheduledTime,
            hasRecording: !!meeting.recordingUrl,
            progress: userProgress || {
                userId,
                meetingId: meeting.id,
                watchedDuration: 0,
                totalDuration: 0,
                completed: false,
                progressPercentage: 0
            }
        };
    });

    const progressList = await Promise.all(progressPromises);

    res.json({
        courseId,
        userId,
        totalMeetings: meetings.length,
        completedMeetings: progressList.filter(p => p.progress.completed).length,
        overallProgress: progressList.length > 0
            ? Math.round(progressList.reduce((sum, p) => sum + p.progress.progressPercentage, 0) / progressList.length)
            : 0,
        meetings: progressList
    });
};

export const checkAccess = async (req, res) => {
    const { meetingId } = req.params;
    const { userEmail, userId } = req.body;

    const meeting = await stateService.getMeeting(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (!meeting.allowedEmails.includes(userEmail)) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const session = await stateService.getUserSession(userEmail);
    if (session && session.isActive) {
        return res.status(409).json({ error: 'You are already in a meeting session' });
    }

    res.json({ allowed: true, meeting });
};
