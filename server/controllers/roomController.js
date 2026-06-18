import { stateService } from '../services/stateService.js';

export const getRooms = async (req, res) => {
    const rooms = await stateService.getRooms();
    res.json(rooms);
};

export const createRoom = async (req, res) => {
    const {
        title, description, host_id, host_name, max_participants = 10,
        allow_chat = true, allow_media = false, is_private = false, password_hash = null
    } = req.body;

    const newRoom = {
        id: Date.now().toString(),
        title, description, host_id, host_name, max_participants,
        is_active: true, allow_chat, allow_media, allow_screen_share: false,
        is_muted_by_default: false, is_private, password_hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    await stateService.createRoom(newRoom);

    // Broadcast new room to all list-page clients (exclude password_hash)
    if (req.io) {
        const publicRoom = { ...newRoom, password_hash: undefined };
        req.io.emit('room-created', publicRoom);
    }

    res.json(newRoom);
};

export const getRoom = async (req, res) => {
    const room = await stateService.getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
};

export const updateRoomSettings = async (req, res) => {
    const { id } = req.params;
    const { allow_chat, allow_media, allow_screen_share, is_muted_by_default } = req.body;

    const updates = {};
    if (allow_chat !== undefined) updates.allow_chat = allow_chat;
    if (allow_media !== undefined) updates.allow_media = allow_media;
    if (allow_screen_share !== undefined) updates.allow_screen_share = allow_screen_share;
    if (is_muted_by_default !== undefined) updates.is_muted_by_default = is_muted_by_default;

    const updatedRoom = await stateService.updateRoom(id, updates);
    if (!updatedRoom) return res.status(404).json({ error: 'Room not found' });

    if (req.io) {
        req.io.to(id).emit('room-settings-updated', updates);
    }

    res.json(updatedRoom);
};

export const deleteRoom = async (req, res) => {
    const { id } = req.params;
    const room = await stateService.getRoom(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    await stateService.deleteRoom(id);

    if (req.io) {
        req.io.to(id).emit('room-closed', { roomId: id });
        req.io.emit('room-deleted', { roomId: id });
    }

    res.json({ message: 'Room deleted successfully' });
};

export const getParticipants = async (req, res) => {
    const participants = await stateService.getParticipants(req.params.id);
    res.json(participants);
};

export const getMessages = async (req, res) => {
    const messages = await stateService.getMessages(req.params.id);
    res.json(messages);
};