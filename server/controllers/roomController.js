import { stateService } from '../services/stateService.js';
import { hashRoomPassword, verifyRoomPassword } from '../utils/passwordSecurity.js';
import { v4 as uuidv4 } from 'uuid';

// ── REST handlers (used by routes/api.js) ──────────────────────────────────
// The audio-rooms list/create/join flow is REST-driven (the client fetches
// these directly from AudioRoomsListPage/CreateRoomModal/AudioRoomComponent);
// only in-room realtime state (join/leave/mute/chat/etc, below) goes over
// Socket.IO via registerRoomHandlers.

export const getRooms = async (req, res) => {
  const rooms = await stateService.getRooms();
  const publicRooms = rooms.map(({ password_hash, ...rest }) => rest);
  res.json(publicRooms);
};

export const createRoom = async (req, res) => {
  const {
    title,
    description = '',
    host_id,
    host_name,
    max_participants = 20,
    allow_chat = true,
    allow_media = true,
    is_private = false,
    password
  } = req.body;

  const password_hash = is_private ? await hashRoomPassword(password) : null;

  const room = {
    id: uuidv4(),
    title,
    description,
    host_id,
    host_name,
    max_participants,
    allow_chat,
    allow_media,
    is_private,
    password_hash,
    created_at: new Date().toISOString()
  };

  await stateService.createRoom(room);

  const { password_hash: _omit, ...publicRoom } = room;

  // Let anyone already on the room list see the new room appear live.
  req.io?.emit('room-created', publicRoom);

  res.status(201).json(publicRoom);
};

export const getRoom = async (req, res) => {
  const room = await stateService.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { password_hash, ...publicRoom } = room;
  res.json(publicRoom);
};

export const verifyRoomAccess = async (req, res) => {
  const room = await stateService.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const valid = await verifyRoomPassword(req.body.password, room.password_hash);
  res.json({ valid });
};

export const updateRoomSettings = async (req, res) => {
  const room = await stateService.updateRoom(req.params.id, req.body);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { password_hash, ...publicRoom } = room;
  req.io?.to(req.params.id).emit('room-media-settings-updated', publicRoom);
  res.json(publicRoom);
};

export const deleteRoom = async (req, res) => {
  const room = await stateService.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  await stateService.deleteRoom(req.params.id);
  req.io?.emit('room-deleted', { roomId: req.params.id });
  res.status(204).send();
};

export const getParticipants = async (req, res) => {
  const participants = await stateService.getParticipants(req.params.id);
  res.json(participants);
};

export const getMessages = async (req, res) => {
  const messages = await stateService.getMessages(req.params.id);
  res.json(messages);
};