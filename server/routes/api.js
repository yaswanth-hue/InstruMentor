import express from 'express';
import * as roomController from '../controllers/roomController.js';
import * as meetingController from '../controllers/meetingController.js';
import { apiLimiter, validateRoomCreation } from '../middleware/security.js';

const router = express.Router();

// Room Routes
router.get('/audio-rooms', apiLimiter, roomController.getRooms);
router.post('/audio-rooms', apiLimiter, validateRoomCreation, roomController.createRoom);
router.get('/audio-rooms/:id', roomController.getRoom);
router.post('/audio-rooms/:id/verify-password', apiLimiter, roomController.verifyRoomAccess);
router.put('/audio-rooms/:id/settings', roomController.updateRoomSettings);
router.delete('/audio-rooms/:id', roomController.deleteRoom);
router.get('/audio-rooms/:id/participants', roomController.getParticipants);
router.get('/audio-rooms/:id/messages', roomController.getMessages);

// Course Meeting Routes
router.post('/courses/:courseId/meetings', meetingController.createMeeting);
router.get('/courses/:courseId/meetings', meetingController.getCourseMeetings);
router.get('/meetings/:meetingId', meetingController.getMeeting);
router.post('/meetings/:meetingId/start', meetingController.startMeeting);
router.post('/meetings/:meetingId/end', meetingController.endMeeting);
router.post('/meetings/:meetingId/progress', meetingController.saveProgress);
router.get('/courses/:courseId/progress/:userId', meetingController.getCourseProgress);
router.post('/meetings/:meetingId/check-access', meetingController.checkAccess);

export default router;